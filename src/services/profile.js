import { supabase } from '../config/supabase.js';

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('id, display_name').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDisplayName(userId, name) {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) throw error;
}

// O papel de administrador vive só no servidor (app_settings); o navegador apenas pergunta.
export async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  return data === true;
}
