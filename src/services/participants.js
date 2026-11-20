import { supabase } from '../config/supabase.js';

export const PHOTO_BUCKET = 'participant-photos'; // criado na Etapa 3

export async function fetchParticipants() {
  const { data, error } = await supabase
    .from('participants')
    .select('user_id, photo_path, confirmed_at, profiles(display_name)')
    .order('confirmed_at', { ascending: true }).order('user_id', { ascending: true });
  if (error) throw error;
  return data;
}

// Id do administrador (informação pública: ele aparece como REI). Veja migrations/002_tree.sql.
export async function fetchAdminId() {
  const { data, error } = await supabase.rpc('get_admin_id');
  if (error) throw error;
  return data;
}

export const photoUrl = (path) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
