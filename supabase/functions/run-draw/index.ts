// Edge Function run-draw — escrita em JavaScript puro (o .ts é só o nome de entrada padrão da Supabase).
// Deploy: supabase functions deploy run-draw
// Fluxo: valida o JWT → confere que é o administrador → sorteia com aleatoriedade criptográfica →
// grava tudo de uma vez via perform_draw (transação única). Os pares nunca são devolvidos nem registrados em log.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function randInt(max) { // inteiro uniforme em [0, max) sem viés de módulo
  const limit = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= limit);
  return a[0] % max;
}
function derangement(ids) { // embaralhamento Fisher-Yates; repete até ninguém ficar no próprio lugar
  for (;;) {
    const t = [...ids];
    for (let i = t.length - 1; i > 0; i--) { const j = randInt(i + 1); [t[i], t[j]] = [t[j], t[i]]; }
    if (t.every((v, i) => v !== ids[i])) return t;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /i, '');
  const { data: u, error: ue } = await createClient(url, anon).auth.getUser(token);
  if (ue || !u?.user) return json({ error: 'unauthenticated' }, 401);

  const db = createClient(url, service, { auth: { persistSession: false } });
  const { data: s } = await db.from('app_settings').select('value').eq('key', 'admin_user_id').maybeSingle();
  if (!s || s.value !== u.user.id) return json({ error: 'forbidden' }, 403);

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: rows, error } = await db.from('participants').select('user_id').order('user_id');
    if (error) return json({ error: 'server' }, 500);
    const ids = rows.map((r) => r.user_id);
    if (ids.length < 2) return json({ error: 'not_enough' }, 422);
    const { error: rpcErr } = await db.rpc('perform_draw', { p_admin: u.user.id, p_givers: ids, p_receivers: derangement(ids) });
    if (!rpcErr) return json({ ok: true, participants: ids.length });
    const m = rpcErr.message || '';
    if (m.includes('already_done')) return json({ error: 'already_done' }, 409);
    if (m.includes('participants_changed')) continue; // alguém entrou no meio: tenta de novo
    console.error('perform_draw falhou:', m);
    return json({ error: 'server' }, 500);
  }
  return json({ error: 'participants_changed' }, 409);
});
