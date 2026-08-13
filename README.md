# La Mia Dolce Vita — Gestão de Folgas

Scaffold do sistema descrito na especificação: Next.js (App Router) + TypeScript +
Prisma + PostgreSQL + NextAuth (Auth.js) + Tailwind CSS + Zod + Argon2id.

## O que já está implementado

- **Modelo de dados completo** (`prisma/schema.prisma`): todas as tabelas da seção 36
  da especificação, com enums para os status descritos na seção 37.
- **Motor central de disponibilidade** (`lib/availability.ts`): a função
  `verificarDisponibilidade` pedida na seção 39, com os códigos de motivo exatos
  (`DISPONIVEL`, `LOJA_FECHADA`, `CONFLITO_FUNCAO`, etc.). Todas as rotas passam por
  ela — o frontend nunca decide disponibilidade sozinho (seção 40).
- **Concorrência**: a criação de uma solicitação roda `verificarDisponibilidade` de
  novo dentro de uma transação Postgres `Serializable` (seção 41). Veja a nota sobre
  o índice único abaixo — ele é o reforço final contra corrida de dados.
- **Autenticação**: NextAuth com Credentials Provider, senha com Argon2id, sessão
  JWT. Conta do Diretor criada apenas via `prisma/seed.ts` + variável de ambiente
  (seção 43 — a senha nunca fica no repositório).
- **Controle de acesso no servidor**: `middleware.ts` bloqueia `/admin` para quem
  não é Diretor, mesmo digitando a URL manualmente (seção 44). Cada rota de API
  também valida a sessão de novo (`lib/session.ts`) — não basta esconder o menu.
- **Histórico imutável**: `lib/audit.ts` grava em `AuditLog` dentro da mesma
  transação de cada alteração (seção 34). Correção de crédito nunca sobrescreve o
  lançamento original — cria um novo registro de ajuste (seção 35).
- **Fluxos principais**: cadastro → aprovação, domingo do mês, compensatória/extra
  com saldo (total/reservado/disponível — seção 22), aprovação/recusa,
  cancelamento com aprovação do Diretor (seção 38), feriados (sem gerar crédito
  automático — seção 26), bloqueio de datas, funções com limite configurável por
  dia (seção 49), configurações gerais (seção 48).
- **Telas**: login, cadastro, painel do Diretor completo (início, funcionários,
  ficha do funcionário, solicitações, créditos, feriados, calendário/bloqueios,
  funções, histórico, configurações) e painel do Funcionário (início, calendário
  de escolha de data, minhas solicitações com pedido de cancelamento).

## O que falta antes de ir para produção

Isto é um scaffold sólido, não um sistema testado e revisado. Antes de publicar:

1. **Backup automático do banco** (seção 51): configurar no provedor do
   PostgreSQL (a maioria — Supabase, Neon, Railway, RDS — já oferece isso).
2. **HTTPS e variáveis de produção**: ao publicar (Vercel, Railway, etc.), gerar um
   `NEXTAUTH_SECRET` novo e configurar `DATABASE_URL` apontando para o Postgres
   real.
3. **"Esqueci minha senha" via canal automático**: hoje o fluxo é manual — a
   Direção gera uma senha temporária na ficha do funcionário e repassa por
   WhatsApp (ver `app/esqueci-senha/page.tsx`). Se no futuro vocês quiserem
   algo self-service (SMS via WhatsApp Business API, e-mail), isso ainda
   precisa de um provedor configurado.

Já concluído desde a versão anterior deste README:

- **Índice único parcial** contra corrida de concorrência (seção 41) — já
  criado nas migrações/instruções abaixo.
- **Tela de "Corrigir crédito"** na ficha do funcionário (seção 31).
- **Fluxo de "Esqueci minha senha"** (redefinição manual pela Direção).
- **Os 15 testes da seção 52** — ver "Testes" abaixo.

## Rodando localmente

Pré-requisitos: Node.js 18.18+ e um PostgreSQL acessível (local ou um serviço
como Supabase/Neon/Railway — precisa ser "online e persistente" como pede a
seção 1).

```bash
npm install

cp .env.example .env
# edite .env: DATABASE_URL, NEXTAUTH_SECRET (openssl rand -base64 32),
# ADMIN_USERNAME e ADMIN_INITIAL_PASSWORD

npx prisma migrate dev --name init
npx prisma db seed        # cria a conta da Lamia + funções iniciais

npm run dev                # http://localhost:3000
```

Depois de rodar a primeira migração, crie também o índice único parcial que
reforça a trava de concorrência (seção 41) — a migração sozinha não cobre isso:

```sql
CREATE UNIQUE INDEX leave_requests_one_active_slot
ON leave_requests ("jobFunctionId", date)
WHERE status IN ('PENDENTE', 'APROVADA');
```

(Se no futuro vocês quiserem permitir mais de 1 pessoa por função por dia, esse
índice deixa de funcionar como está — nesse caso o controle de limite fica só
na lógica de `verificarDisponibilidade`, que já é configurável por função.)

Depois do primeiro login como `Lamia`, é recomendável trocar a senha (não há
tela de troca de senha ainda — peça para a própria Direção gerar uma nova pela
ficha do funcionário, ou ajuste direto no banco por enquanto).

## Testes

15 testes com Vitest, cobrindo o motor de disponibilidade (todos os códigos de
motivo da seção 39), saldo/correção de crédito (seção 22 e 35), histórico
imutável (seção 34), hash de senha (seção 43) e a trava de concorrência via
transação `Serializable` (seção 41) — este último roda duas solicitações
concorrentes de verdade contra o Postgres e confirma que só uma vence.

Os testes rodam contra um banco de teste **separado** do banco de
desenvolvimento (nunca contra `DATABASE_URL` do `.env` principal):

```bash
createdb lamia_dolce_vita_test

cat > .env.test <<'EOF'
DATABASE_URL="postgresql://SEU_USUARIO@localhost:5432/lamia_dolce_vita_test?schema=public"
EOF

DATABASE_URL="postgresql://SEU_USUARIO@localhost:5432/lamia_dolce_vita_test?schema=public" \
  npx prisma migrate deploy

# não esquecer do índice único parcial acima também no banco de teste

npm test
```

## Ordem de leitura sugerida do código

Segue a ordem de implantação da seção 53 da especificação:

1. `prisma/schema.prisma` — banco de dados
2. `lib/auth.ts`, `middleware.ts` — login e segurança
3. `prisma/seed.ts` — conta do Diretor
4. `app/cadastro/page.tsx`, `app/api/register/route.ts` — cadastro
5. `app/admin/funcionarios/`, `app/api/employees/` — aprovação de cadastros
6. `app/admin/funcoes/`, `app/api/job-functions/` — funções
7. `app/admin/creditos/`, `app/api/credits/` — créditos
8. `lib/availability.ts` — motor de disponibilidade
9. `components/LeaveCalendar.tsx` — calendário
10. `app/api/leave-requests/` — solicitações
11. `app/admin/solicitacoes/` — aprovação/recusa
12. `app/admin/feriados/`, `app/api/holidays/` — feriados
13. `app/admin/calendario/`, `app/api/blocked-dates/` — bloqueios
14. `lib/audit.ts`, `app/admin/historico/` — histórico
15. Ação "DESATIVAR" em `app/api/employees/[id]/route.ts` — desativação
16. Todo o `app/` — interface mobile (Tailwind responsivo)
17. `tests/` — testes (Vitest)
18. *(a fazer)* — publicação
