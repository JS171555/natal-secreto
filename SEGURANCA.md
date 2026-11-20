# Revisão de segurança (Etapa 5)

**Chaves e ambiente.** O frontend usa só a chave anon (`.env`, fora do git). A Service Role Key existe apenas dentro da Edge Function, injetada pela Supabase. `.env.example` não contém segredos.

**RLS e permissões.** Todas as tabelas têm RLS e os privilégios foram revogados de `anon`/`authenticated` e reconcedidos só ao necessário: ler perfis, participantes e sorteio; atualizar apenas `display_name` do próprio perfil; inserir a própria participação. `app_settings` não tem nenhuma policy (inacessível pelo navegador). Admin = `app_settings.admin_user_id`, definido só por SQL; nada que o navegador envie altera isso.

**Sorteio.** Roda na Edge Function com `crypto.getRandomValues`, só para o admin (checado no servidor), e grava tudo numa transação (`perform_draw`, executável só pela service role). Índice parcial garante um único sorteio. `draw_assignments` só é legível pelo próprio sorteador e não está no Realtime; o admin vê apenas contagens. Gatilho e RLS bloqueiam novas participações depois do sorteio.

**Participação e Storage.** Uma participação por usuário (chave primária). Foto: o app recorta e recomprime em JPEG; o bucket aceita só `image/jpeg` até 1 MB; envio só na própria pasta, com nome aleatório, sem sobrescrita, máximo de 3 arquivos por usuário; `photo_path` precisa seguir exatamente `<uid>/<uuid>.jpg`. Só é possível apagar arquivo próprio órfão.

**Nome e conteúdo.** Todo texto vindo do banco passa por escape antes de entrar no HTML. O nome "REI" é reservado ao admin (gatilho no banco).

**Limites conhecidos.** O bucket é público: quem tiver a URL (impossível de adivinhar) vê a foto. O dono do projeto Supabase enxerga os pares no painel. Não há limitação de tentativas além da própria do Supabase Auth.
