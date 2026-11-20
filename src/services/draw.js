import { supabase } from '../config/supabase.js';

// Estado do sorteio para o usuário logado. A RLS só devolve o PRÓPRIO par.
export async function fetchDrawState() {
  const [d, a] = await Promise.all([
    supabase.from('draws').select('id, drawn_at').eq('status', 'completed').maybeSingle(),
    supabase.from('draw_assignments').select('receiver_id, revealed_at').maybeSingle(),
  ]);
  if (d.error || a.error) throw d.error || a.error;
  return { done: !!d.data, drawnAt: d.data?.drawn_at || null, mine: a.data || null };
}

export async function fetchDrawStatus() {
  const { data, error } = await supabase.rpc('get_draw_status');
  if (error) throw error;
  return data;
}

export async function revealMyResult() {
  const { data, error } = await supabase.rpc('reveal_my_result');
  if (error) throw error;
  return data; // id do sorteado, ou null se não há par
}

export async function runDraw() {
  const { data, error } = await supabase.functions.invoke('run-draw', { method: 'POST' });
  if (error) {
    let code = error.name === 'FunctionsFetchError' ? 'network' : 'server';
    try { code = (await error.context.json()).error || code; } catch { /* mantém o código */ }
    throw Object.assign(new Error(code), { code });
  }
  return data;
}

export function subscribeDraw(onChange) {
  let t = 0;
  const fire = () => { clearTimeout(t); t = setTimeout(onChange, 300); };
  const ch = supabase.channel('draw-status')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'draws' }, fire)
    .subscribe((s) => { if (s === 'SUBSCRIBED') fire(); });
  return () => { clearTimeout(t); supabase.removeChannel(ch); };
}
