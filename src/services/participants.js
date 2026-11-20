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

// Participação: 1) envia a foto, 2) registra no banco. Se o registro falhar, o upload é removido.
export async function confirmParticipation(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  if (up.error) throw Object.assign(new Error('upload'), { userMessage: 'Falha ao enviar a foto. Verifique a conexão e tente de novo.' });
  const { error } = await supabase.from('participants').insert({ user_id: userId, photo_path: path });
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    const already = error.code === '23505';
    throw Object.assign(new Error('insert'), { already, userMessage: already ? 'Sua participação já estava confirmada.' : error.code === '42501' ? 'Não foi possível confirmar agora (o sorteio pode já ter sido realizado).' : 'Não foi possível registrar sua participação. Tente de novo.' });
  }
}

// Realtime: qualquer mudança em participants dispara onChange (com debounce). Também ao (re)conectar.
export function subscribeParticipants(onChange) {
  let t = 0;
  const fire = () => { clearTimeout(t); t = setTimeout(onChange, 300); };
  const ch = supabase.channel('participants-tree')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, fire)
    .subscribe((s) => { if (s === 'SUBSCRIBED') fire(); });
  return () => { clearTimeout(t); supabase.removeChannel(ch); };
}
