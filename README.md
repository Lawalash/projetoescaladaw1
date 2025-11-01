# AuroraCare — Plataforma integrada para lares de idosos

AuroraCare unifica backend, frontend e automações de ETL para apoiar a rotina de um lar de idosos. O objetivo é monitorar
indicadores clínicos, cronogramas de atividades, estoques críticos e pendências da equipe em uma experiência única.

## 🗂️ Estrutura de pastas

- `backend/` — API Express (Node.js) com autenticação, upload de planilhas e serviços de notificação
- `frontend/` — Dashboard React + portal operacional com controle de acesso por perfil
- `etl/` — Scripts Python para importar planilhas de métricas clínicas e estoque
- `docs/` — Documentos de apoio (planos operacionais, playbooks)

## 🚀 Como executar (passo a passo)

### 1. Pré-requisitos

- Node.js 18+
- npm
- MySQL 8+
- (Opcional) Python 3.9+ para os scripts de ETL

### 2. Backend — API e autenticação

```bash
cd backend
npm install

# configure o arquivo .env (exemplo abaixo)
cat <<'ENV' > .env
PORT=8000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=suasenha
DB_NAME=qw1_relatorios
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=auroracare-super-secreto
ENV

# recrie as tabelas e dados de demonstração
npm run db:reset

# subir a API em modo desenvolvimento
npm run dev
```

### 3. Frontend — Portal operacional

```bash
cd frontend
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173` consumindo a API em `http://localhost:8000`.

### 4. ETL (opcional)

```bash
cd etl
pip install -r requirements.txt
python etl.py --file ../sample_data/saude_diaria.csv --tipo saude_diaria
python etl.py --file ../sample_data/estoque_alimentos.xlsx --tipo estoque_alimentos
```

## 🔐 Perfis disponíveis e credenciais padrão

Após executar `npm run db:reset` você pode acessar o sistema com os seguintes usuários:

| Perfil            | E-mail                        | Senha         | Destino no portal |
|-------------------|-------------------------------|---------------|-------------------|
| Direção           | `direcao@auroracare.com`      | `patroes123`  | Dashboard completo + relatório da equipe |
| Serviços gerais   | `asg@auroracare.com`          | `limpeza123`  | Painel focado em limpeza, estoque e tarefas |
| Enfermagem        | `enfermaria@auroracare.com`   | `enfermaria123` | Visão clínica com indicadores de saúde |

A autenticação utiliza tokens assinados via HMAC (HS256). Para ajustar a expiração ou o segredo, altere `JWT_SECRET` no
arquivo `.env` do backend.

### Query SQL para criar usuários manualmente

Caso precise popular os usuários em um banco existente, utilize a consulta abaixo (os hashes já estão prontos para as senhas
padrão listadas acima):

```sql
INSERT INTO usuarios (nome, email, senha_hash, role) VALUES
  ('Direção Aurora', 'direcao@auroracare.com', '0c45f9e259b99c03387c815565161972:64ec71cf9dac69997110a9c5c829a4bae9e60184442e6cc12ea529c41eaf5033706f13d65e964ed947c62b6895b59ae40f08a08f21836d96b080c19041b01b14', 'patrao'),
  ('Time de Limpeza', 'asg@auroracare.com', 'd6fe599427fa09b7063496edb730b149:2f995eb82d6e47396c8ede64f625466dd4a4201a6fac7a52dd236c3ef16020ec8c2d179be7ef2afd392e45d4083852fee1df2eaebbd6ba9a0a5330d3c06571db', 'asg'),
  ('Coordenação Enfermagem', 'enfermaria@auroracare.com', '054146d86900a461c1788d186f460d8d:9a9d6f5a590c4f92d7e6e29e481074f33583b5d947d39b4988433a0880431cd3de252abca8efede2dd691212371da0856a526e5e31ea4377063d1600057713fc', 'enfermaria');
```

> Observação: a tabela `usuarios` é criada automaticamente pelo script `npm run db:reset`. Execute a query apenas caso esteja
> migrando dados para um banco existente.

> Dica: se precisar cadastrar usuários manualmente direto no MySQL, você também pode gerar o hash com `SHA2('sua_senha', 256)`.
> A API valida tanto os hashes neste formato quanto os valores `salt:hash` gerados pela utilidade de segurança (`hashPassword`).

## 📋 Funcionalidades implementadas

- **Login com separação de perfis** (direção, serviços gerais e enfermagem) e redirecionamento para a interface adequada.
- **Dashboard inteligente** com gráficos condicionais por perfil (ex.: equipe de limpeza foca em estoque e cronograma).
- **Relatório de acompanhamento** para a direção consolidando métricas, pendências e ações recomendadas.
- **Documentação operacional** com checklists por área, pendências e entregáveis solicitados nas demandas do projeto.

## ✅ Checklist rápido após subir o ambiente

1. `npm run dev` no backend — aguarde o log de conexão com o MySQL.
2. `npm run dev` no frontend — acesse `http://localhost:5173` e efetue login com um dos usuários acima.
3. Envie uma planilha de estoque pela área de serviços gerais e valide a atualização dos indicadores.
4. Revise o relatório da equipe na visão da direção para acompanhar pendências e recomendações.

Bom trabalho e bons cuidados! 🏡💙
