# Natal Secreto — Etapa 1

## Supabase
1. Crie um projeto em supabase.com.
2. SQL Editor: execute `supabase/migrations/001_schema.sql`.
3. Authentication > URL Configuration: *Site URL* = URL do app (ex.: `http://localhost:5173`) e adicione a mesma em *Redirect URLs* (vale também para a URL de produção).
4. Authentication > Providers > Google: ative e informe Client ID/Secret do Google Cloud (Authorized redirect URI: `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
5. Crie sua conta no app, depois execute `supabase/admin_setup.sql` com seu e-mail.

## Local
```
cp .env.example .env   # preencha URL e chave anon
npm install
npm run dev
```
## Build
`npm run build` gera `dist/` (publique em Netlify, Vercel, Cloudflare Pages etc. com as duas variáveis VITE_*).

## Etapa 2 (árvore)
- Execute também `supabase/migrations/002_tree.sql`.
- Para ver bolas antes da Etapa 3 (sem fotos reais, aparece a inicial do nome):
  `insert into public.participants (user_id, photo_path) select id, 'teste/'||id||'.jpg' from public.profiles where display_name is not null on conflict do nothing;`
  Para remover: `delete from public.participants where photo_path like 'teste/%';`

## Etapa 3 (participação)
- Execute `supabase/migrations/003_participation.sql` (cria o bucket `participant-photos`, políticas de Storage e ativa o Realtime em `participants`).
- Se testou com o `insert` da Etapa 2, apague essas linhas de teste antes (`delete ... where photo_path like 'teste/%'`), senão essas pessoas não poderão participar de verdade.
- Para conferir o Realtime: abra o app em dois navegadores com contas diferentes e confirme a participação em um deles.
