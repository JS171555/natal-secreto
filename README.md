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
