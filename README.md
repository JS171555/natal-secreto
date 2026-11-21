<p align="center">
  <img src="public/pwa-icon-192.png" alt="Ícone do Natal Secreto" width="112" height="112">
</p>

<h1 align="center">Natal Secreto</h1>

<p align="center">
  <strong>Uma árvore de Natal coletiva para o seu amigo secreto.</strong><br>
  Cada participante pendura uma bola com sua foto; depois, cada pessoa abre sua própria surpresa.
</p>

<p align="center">
  <a href="#comece-aqui">Começar</a> ·
  <a href="#configurar-o-supabase">Configurar Supabase</a> ·
  <a href="#segurança-e-privacidade">Segurança</a>
</p>

## Sobre o projeto

Natal Secreto é um aplicativo web responsivo para organizar uma única rodada de amigo secreto em uma árvore compartilhada. Participantes entram com conta própria, escolhem um nome e uma foto para sua bola; a árvore é atualizada em tempo real. Quando o administrador realiza o sorteio, cada participante elegível revela somente o próprio resultado.

A interface e as mensagens estão em português brasileiro. O projeto é construído com HTML, CSS e JavaScript em módulos, sem framework de interface e sem TypeScript.

## O que o app oferece

- Cadastro e entrada com e-mail e senha, autenticação opcional com Google e recuperação de senha.
- Perfil com nome público confirmado pelo participante.
- Uma participação por conta, com pré-visualização da foto antes da confirmação.
- Árvore ilustrada com bolas de participantes, neve, iluminação e atualizações em tempo real.
- Ação administrativa para realizar um sorteio; cada participante abre e pode rever somente o próprio resultado.
- Interface adaptável a telas pequenas, indicador de carregamento compartilhado e respeito à preferência de movimento reduzido.
- Manifesto e ícones PWA para instalação em dispositivos compatíveis.

> O manifesto PWA e os ícones estão configurados, mas o projeto não inclui service worker. Portanto, não há cache offline implementado nem promessa de funcionamento sem conexão.

## Como funciona

1. A pessoa cria uma conta, confirma o e-mail se essa opção estiver habilitada no Supabase e entra no app.
2. No primeiro acesso, define o nome que aparecerá na árvore.
3. Escolhe uma foto para a bola e confirma sua participação. A participação é única e fica encerrada quando o sorteio é feito.
4. O administrador acompanha as confirmações e realiza o sorteio quando o grupo estiver pronto.
5. Cada participante abre sua caixa e vê o próprio sorteado. O administrador pode consultar contagens de revelação, não os pares dos demais pela interface.

São necessários pelo menos dois participantes confirmados. O sorteio é único e não pode ser repetido pela interface; use um projeto Supabase separado para testes e não apague dados de produção para reiniciar uma rodada.

## Stack e estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `index.html` e `src/main.js` | Documento inicial, autenticação e entrada nas telas do app. |
| `src/pages/` | Login, cadastro, recuperação de senha, perfil e árvore. |
| `src/components/` | Cena, bolas, participação, sorteio, modais, neve e carregamento. |
| `src/services/` | Chamadas de autenticação, perfil, participantes e sorteio ao Supabase. |
| `src/config/supabase.js` | Inicialização do cliente Supabase com variáveis `VITE_*`. |
| `src/styles/` | Estilos gerais e da árvore. |
| `src/utils/` | Layout, preparação de imagens, animação e efeitos. |
| `supabase/migrations/` | Esquema, RLS, Storage, Realtime e regras do sorteio. |
| `supabase/setup_completo.sql` | Script agregado das migrações 001 a 005 para projeto novo. |
| `supabase/functions/run-draw/` | Edge Function que valida a autorização e inicia o sorteio no servidor. |
| `supabase/admin_setup.sql` | SQL para definir a conta administradora (REI). |
| `public/` | Manifesto, ícones PWA e cabeçalhos para hosts compatíveis. |
| `dist/` | Saída de produção do Vite; atualmente versionada no repositório. |
| `SEGURANCA.md` | Resumo das políticas e dos limites conhecidos de segurança. |

**Tecnologias:** Vite 8, JavaScript ES Modules, CSS, Supabase Auth/Database/Storage/Realtime/Edge Functions e Font Awesome.

## Requisitos

- Node.js **22.12 ou superior** e npm. Essa faixa é compatível com as versões resolvidas no `package-lock.json`.
- Um projeto Supabase próprio para desenvolvimento ou produção.
- Supabase CLI somente para vincular o projeto e publicar a Edge Function.

## Comece aqui

```bash
git clone https://github.com/JS171555/natal-secreto.git
cd natal-secreto
npm ci
cp .env.example .env
```

Abra `.env` e preencha os valores do seu projeto Supabase:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable
```

A URL e a chave `anon`/`publishable` são obtidas no painel do Supabase. Essas variáveis `VITE_*` entram no código entregue ao navegador: nunca coloque aqui `service_role`, senha administrativa ou segredo OAuth. Salve o arquivo e inicie o ambiente local:

```bash
npm run dev
```

O Vite inicia em `http://localhost:5173`. Se alterar `.env` com o servidor rodando, reinicie `npm run dev`.

## Configurar o Supabase

### 1. Criar o esquema e as políticas

Em um projeto Supabase novo, abra **SQL Editor** e execute `supabase/setup_completo.sql` uma única vez. O script agregado reúne as etapas das migrações 001–005: tabelas, restrições, políticas RLS, Storage, Realtime e funções do banco.

Se o projeto já tiver parte do esquema, não execute o agregado às cegas: confira o estado atual e aplique somente as migrações que faltam, em ordem (`001_schema.sql` até `005_hardening.sql`). Os scripts não devem ser tratados como uma operação de reinicialização.

### 2. Configurar autenticação e URLs

No painel do Supabase, em **Authentication → URL Configuration**, configure a **Site URL** e inclua em **Redirect URLs** a origem local `http://localhost:5173` e a origem final do app. O fluxo de e-mail e a recuperação de senha retornam para a origem aberta no navegador.

E-mail e senha são o fluxo padrão. Para habilitar **Entrar com Google**, ative o provedor Google em **Authentication → Providers → Google**, configure as credenciais OAuth no Google Cloud e autorize como callback do provedor:

```text
https://SEU-PROJETO.supabase.co/auth/v1/callback
```

Google OAuth depende dessa configuração externa e não é habilitado pelo código do repositório sozinho.

### 3. Publicar a Edge Function do sorteio

Instale e autentique o Supabase CLI, vincule-o ao projeto e publique a função:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy run-draw
```

A função valida a sessão e o papel administrativo no servidor e grava o sorteio por meio de uma operação transacional. As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são lidas no ambiente da Edge Function; a chave de serviço não deve ser copiada para o frontend.

### 4. Definir o administrador

1. Crie a conta que será administradora pelo próprio app e confirme o e-mail, se exigido.
2. Abra `supabase/admin_setup.sql`, substitua `SEU-EMAIL@exemplo.com` pelo e-mail exato dessa conta e execute o SQL no painel do Supabase.

A conta marcada no banco recebe o papel **REI**. Essa definição não é feita pelo navegador; não compartilhe nem altere manualmente o SQL fora do projeto correto.

## Build e publicação

```bash
npm run build
npm run preview
```

`npm run build` gera a pasta `dist/`; `npm run preview` serve essa saída localmente para revisão. Publique `dist/` em uma hospedagem estática, configurando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente de **build**. O repositório não escolhe nem configura automaticamente um provedor ou pipeline de deploy.

`public/_headers` fornece cabeçalhos de segurança em hosts compatíveis com esse formato, como Netlify e Cloudflare Pages. Em Vercel ou outro host que não leia `_headers`, configure os mesmos cabeçalhos no formato nativo do provedor. Depois da publicação, inclua a origem final também nas Redirect URLs do Supabase.

A pasta `dist/` é versionada. Gere-a com o Vite; não edite os arquivos compilados manualmente. Não há script de testes automatizados configurado no `package.json`; valide o fluxo em um projeto Supabase de teste antes de promover uma versão.

> **Atenção ao bundle Vite 8:** em uma execução recente, `npm run build` terminou sem erro, mas o JavaScript gerado ficou muito menor e não incluiu marcadores da interface da árvore, como `treebar` e `REALIZAR SORTEIO`. A saída compilada anterior continha esses elementos e foi preservada em `dist/`. Após qualquer rebuild, revise o app com `npm run preview` e teste autenticação, árvore, participação e sorteio antes de publicar. O projeto ainda não tem um fallback de minificação validado; não trate `npx vite build --minify esbuild` como solução garantida sem confirmar a dependência e o resultado no ambiente de build.

## Segurança e privacidade

- O frontend usa somente a chave pública `anon`/`publishable`; as tabelas contam com Row Level Security (RLS) e permissões restritas.
- A chave `service_role` é usada exclusivamente no ambiente servidor da Edge Function. Nunca a inclua em `.env` do navegador, no README ou no Git.
- A função de sorteio verifica a sessão e o administrador no servidor; a gravação dos pares ocorre no banco. Cada conta autenticada pode revelar somente o próprio resultado pela aplicação.
- Fotos são recortadas e convertidas no navegador para JPEG quadrado de até 640 px. O arquivo selecionado pode ter até 15 MB; o arquivo enviado ao bucket é limitado a 1 MB. O banco limita uploads a três arquivos por usuário e uma participação por conta.
- **As fotos ficam em um bucket público do Supabase.** Uma URL pública da foto permite acessá-la; não trate as imagens como conteúdo privado ou confidencial. Consulte também [`SEGURANCA.md`](SEGURANCA.md).
- Não existe proteção adicional contra tentativas de login implementada pelo app além dos controles oferecidos pelo Supabase Auth.

## Limites conhecidos

- O produto modela uma única árvore/evento e um único sorteio concluído.
- São necessários ao menos dois participantes; ninguém pode entrar depois do sorteio.
- Não há interface para repetir ou desfazer um sorteio, trocar foto após confirmação, excluir participantes ou administrar vários eventos.
- Não há service worker, sincronização offline ou funcionamento offline implementados.
- O repositório não contém configuração de CI/CD nem um provedor de hospedagem predefinido.

## Verificação manual recomendada

Em um projeto Supabase de teste, valide pelo menos:

1. Cadastro, confirmação de e-mail (quando ativada), login, recuperação de senha e Google OAuth (se configurado).
2. Definição do nome, confirmação de participação com foto e atualização da árvore em uma segunda sessão/navegador.
3. Sorteio pelo administrador somente após dois ou mais participantes confirmados.
4. Revelação individual em cada conta e confirmação de que uma conta não recebe o resultado das demais.
5. Layout em celular e desktop, carregamento e comportamento com movimento reduzido.

## Licença

Nenhum arquivo de licença foi identificado neste repositório. Consulte o responsável pelo projeto antes de redistribuir ou reutilizar o código.
