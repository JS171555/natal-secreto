import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/main.css';
import './styles/tree.css';
import { supabase, configured } from './config/supabase.js';
import { getProfile, isAdmin } from './services/profile.js';
import { renderLogin, renderRegister, renderForgot, renderReset } from './pages/auth.js';
import { renderProfileSetup } from './pages/profile-setup.js';
import { renderNotice } from './pages/home.js';
import { flags } from './services/auth.js';
import { mountTree } from './pages/tree.js';

const app = document.getElementById('app');
let currentUser = null, recovery = false;

const showAuth = (view = 'login', notice) =>
  ({ login: renderLogin, register: renderRegister, forgot: renderForgot }[view] || renderLogin)(app, showAuth, notice);

async function enter(user) {
  renderNotice(app, 'Natal Secreto', 'Carregando…');
  try {
    const profile = await getProfile(user.id);
    if (!profile?.display_name) return renderProfileSetup(app, user, () => enter(user));
    mountTree(app, { user, name: profile.display_name, admin: await isAdmin() });
  } catch {
    renderNotice(app, 'Não foi possível carregar', 'Verifique sua conexão e se o banco do Supabase foi configurado.', 'Tentar de novo', () => enter(user));
  }
}

if (!configured) {
  renderNotice(app, 'Configuração pendente', 'Copie .env.example para .env e informe VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
} else {
  supabase.auth.onAuthStateChange((event, session) => {
    // Sem await de chamadas Supabase aqui dentro: evita deadlock do cliente.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        recovery = true;
        return renderReset(app, () => { recovery = false; currentUser = null; supabase.auth.getSession().then(({ data }) => data.session && (currentUser = data.session.user.id, enter(data.session.user))); });
      }
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        const expired = event === 'SIGNED_OUT' && currentUser && !flags.manualOut;
        const oauthFail = /error_description|error=/.test(location.hash) || /error_description/.test(location.search);
        flags.manualOut = false; currentUser = null; recovery = false;
        if (oauthFail) history.replaceState(null, '', location.pathname);
        return showAuth('login', expired ? 'Sua sessão expirou. Entre novamente para continuar.' : oauthFail ? 'Não foi possível concluir o login com o Google. Tente novamente.' : undefined);
      }
      if (recovery || !session) return;
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session.user.id !== currentUser) {
        currentUser = session.user.id; enter(session.user);
      }
    });
  });
}
