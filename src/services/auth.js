import { supabase } from '../config/supabase.js';

const wrap = async (p) => { const { data, error } = await p; if (error) throw error; return data; };

export const signIn = (email, password) => wrap(supabase.auth.signInWithPassword({ email, password }));
export const signUp = (name, email, password) =>
  wrap(supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: location.origin } }));
export const signInWithGoogle = () =>
  wrap(supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }));
export const sendRecovery = (email) => wrap(supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin }));
export const updatePassword = (password) => wrap(supabase.auth.updateUser({ password }));
export const flags = { manualOut: false }; // distingue "Sair" de sessão expirada
export const signOut = () => { flags.manualOut = true; return wrap(supabase.auth.signOut()); };

export function friendlyError(e) {
  const m = String(e?.message || e || '').toLowerCase();
  if (m.includes('jwt expired') || m.includes('session')) return 'Sua sessão expirou. Entre novamente.';
  if (e?.code === '23514' || m.includes('reserved_name') || m.includes('check constraint')) return 'Esse nome não pode ser usado. Escolha outro.';
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar. Veja sua caixa de entrada.';
  if (m.includes('already registered')) return 'Este e-mail já tem cadastro. Tente entrar ou recuperar a senha.';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.';
  if (m.includes('provider is not enabled')) return 'O login com Google ainda não foi ativado no Supabase.';
  return 'Algo deu errado. Tente novamente.';
}
