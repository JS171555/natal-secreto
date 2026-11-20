# Natal Secreto

App web de Amigo Secreto de Natal: uma árvore coletiva onde cada participante pendura uma bola com a própria foto. Vite 8, HTML/CSS/JS (ES Modules), Supabase (Auth, Database, Storage, Realtime, Edge Functions) e Font Awesome. Sem frameworks e sem TypeScript.

## 1. Supabase
1. Crie um projeto em supabase.com.
2. **SQL Editor**: execute `supabase/setup_completo.sql` (reúne as migrações 001 a 005: tabelas, RLS, bucket de fotos, sorteio, endurecimento). Em instalação já existente, rode só as migrações que faltam, em ordem.
3. **Authentication > URL Configuration**: *Site URL* = URL do app (ex.: `http://localhost:5173`); em *Redirect URLs* inclua também a URL de produção.
4. **Authentication > Providers > Google**: ative e informe Client ID e Secret do Google Cloud (URI de redirecionamento autorizada: `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
5. **Edge Function**: `supabase login`, `supabase link --project-ref SEU-PROJETO`, `supabase functions deploy run-draw`. Ela usa as variáveis que a própria Supabase injeta; nada de chave secreta no frontend.
6. Crie sua conta no app, confirme o e-mail, defina o nome e rode `supabase/admin_setup.sql` com o seu e-mail. Essa conta passa a ser o **REI** (administrador).

## 2. Rodar localmente
```
cp .env.example .env     # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (chave anon/publishable)
npm install
npm run dev              # http://localhost:5173
```

## 3. Build e publicação
`npm run build` gera `dist/`. Publique em Netlify, Cloudflare Pages ou Vercel definindo as duas variáveis `VITE_*` no painel. `public/_headers` (Netlify/Cloudflare) aplica CSP e cabeçalhos de segurança; na Vercel, replique-os em `vercel.json`. Depois de publicar, adicione a URL final nas *Redirect URLs* do Supabase.

## 4. Roteiro de teste (com contas reais)
1. Cadastro, confirmação de e-mail, recuperação de senha e login com Google.
2. Confirme participação com foto em 3+ contas; abra em dois navegadores e veja a bola aparecer sem recarregar.
3. Como admin: SORTEIO > REALIZAR SORTEIO. Em cada conta a caixa de presente aparece; abra e confira "VOCÊ TIROU!".
4. Para repetir o teste: `delete from public.draws;` no SQL Editor (apaga os pares em cascata). Não existe reinicialização pela interface, de propósito.

## Estrutura
`src/config` cliente Supabase · `src/services` auth, perfil, participantes, sorteio · `src/pages` telas · `src/components` cena, ornamentos, neve, modais · `src/utils` layout e imagem · `src/styles` CSS · `supabase/migrations` SQL · `supabase/functions/run-draw` sorteio. Revisão de segurança em `SEGURANCA.md`.
