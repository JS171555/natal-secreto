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
import { swap } from './utils/motion.js';
import { LOAD, hideLoading, showLoading } from './components/ui-loading.js';

const app = document.getElementById('app');
let currentUser = null, recovery = false, tree = null;

// Mantém os gestos de rolagem, mas evita zoom por pinça/gestos no iOS, Android e Windows touch.
const blockZoomGesture = (event) => event.preventDefault();
document.addEventListener('gesturestart', blockZoomGesture, { passive: false });
document.addEventListener('gesturechange', blockZoomGesture, { passive: false });
document.addEventListener('touchmove', (event) => {
  if (event.touches?.length > 1) event.preventDefault();
}, { passive: false });
window.addEventListener('wheel', (event) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault();
}, { passive: false });
window.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (['+', '=', '-', '_', '0'].includes(event.key) || ['NumpadAdd', 'NumpadSubtract', 'Numpad0'].includes(event.code)) event.preventDefault();
}, true);

// O splash do HTML existe antes do bundle; o indicador CSS continua ativo enquanto o Supabase responde ao auth.
showLoading(LOAD.tree);
// O onAuthStateChange do Supabase pode não chegar nunca (sem rede, projeto fora do ar).
// Nesse caso o splash do HTML viraria tela presa: depois de 20s ele sai de cena e
// oferece o login, que é a única coisa que ainda faz sentido oferecer.
setTimeout(() => {
  if (app.children.length) return;
  hideLoading();
  showAuth('login', 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.');
}, 20000);

/** Troca de tela com transição, encerrando antes a árvore montada (neve, realtime, anéis). */
const mount = (render, opts) => {
  if (tree) { tree.destroy(); tree = null; }
  return swap(app, render, opts);
};

const showAuth = (view = 'login', notice) => {
  hideLoading();
  const render = ({ login: renderLogin, register: renderRegister, forgot: renderForgot }[view] || renderLogin);
  return mount(() => render(app, showAuth, notice));
};

async function enter(user) {
  showLoading(LOAD.tree); // o mesmo padrão do app cobre todo o carregamento inicial
  try {
    const profile = await getProfile(user.id);
    if (!profile?.display_name) { hideLoading(); return mount(() => renderProfileSetup(app, user, () => enter(user))); }
    const admin = await isAdmin();
    await mount(() => { tree = mountTree(app, { user, name: profile.display_name, admin }); });
  } catch {
    hideLoading();
    mount(() => renderNotice(app, 'Não foi possível carregar', 'Verifique sua conexão e se o banco do Supabase foi configurado.', 'Tentar de novo', () => enter(user)));
  }
}

if (!configured) {
  hideLoading();
  renderNotice(app, 'Configuração pendente', 'Copie .env.example para .env e informe VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
} else {
  supabase.auth.onAuthStateChange((event, session) => {
    // Sem await de chamadas Supabase aqui dentro: evita deadlock do cliente.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        recovery = true;
        return mount(() => renderReset(app, () => { recovery = false; currentUser = null; supabase.auth.getSession().then(({ data }) => data.session && (currentUser = data.session.user.id, enter(data.session.user))); }));
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
