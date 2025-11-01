# QW1 — Automação de Relatórios (CSV → Dashboard Web)

## 📋 Visão Geral

Sistema completo de automação de relatórios para PMEs, com upload de CSV/Excel, dashboard web interativo, exportação de dados e notificações automáticas por e-mail e WhatsApp.

**Stack:**
- **Front-end:** React + Recharts
- **Back-end:** Node.js (Express) + Python (pandas)
- **Banco:** MySQL local (via Workbench)
- **Notificações:** Nodemailer (e-mail) + Vonage/Twilio (WhatsApp)
- **Agendamento:** node-cron + PM2

---

## 🗂️ Estrutura do Projeto

```
qw1-automacao-relatorios/
├─ backend/
│  ├─ package.json
│  ├─ .env.example
│  ├─ src/
│  │  ├─ index.js
│  │  ├─ routes/
│  │  │  └─ vendas.js
│  │  ├─ controllers/
│  │  │  └─ vendasController.js
│  │  ├─ services/
│  │  │  ├─ etlService.js
│  │  │  └─ notificationService.js
│  │  └─ db/
│  │     └─ connection.js
│  ├─ scripts/
│  │  └─ import_csv.js
│  ├─ cron/
│  │  └─ jobs.js
│  └─ uploads/
├─ etl/
│  ├─ etl.py
│  └─ requirements.txt
├─ frontend/
│  ├─ package.json
│  └─ src/
│     ├─ App.jsx
│     ├─ services/
│     │  └─ api.js
│     └─ components/
│        ├─ Dashboard.jsx
│        ├─ ChartVendas.jsx
│        ├─ TopProdutos.jsx
│        ├─ ExportCSVButton.jsx
│        └─ ConfigurarEnvio.jsx
├─ sample_data/
│  └─ dados_exemplo.csv
├─ sql/
│  └─ schema.sql
├─ docker-compose.yml
└─ README.md
```

---

## ⚙️ Passo a Passo - Instalação Local

### 1️⃣ **Pré-requisitos**

```bash
# Node.js 18+
node --version

# Python 3.9+
python --version

# MySQL 8.0+
mysql --version

# MySQL Workbench instalado
```

### 2️⃣ **Configurar Banco de Dados (MySQL Workbench)**

1. Abra o **MySQL Workbench**
2. Conecte-se à sua instância MySQL local (usuário `root` ou outro)
3. Abra o arquivo `sql/schema.sql` no Workbench
4. Execute o script (botão ⚡ ou Ctrl+Shift+Enter)

**Ou via terminal:**

```bash
mysql -u root -p < sql/schema.sql
```

**Verificar criação:**

```sql
USE qw1_relatorios;
SHOW TABLES;
-- Deve mostrar: vendas, config_envio
```

### 3️⃣ **Configurar Backend (Node.js)**

```bash
cd backend
npm install

# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com suas credenciais
nano .env  # ou use seu editor preferido
```

**Exemplo `.env`:**

```env
PORT=8000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=qw1_relatorios

# E-mail (use Gmail, Outlook, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seuemail@gmail.com
SMTP_PASS=sua_senha_app

# WhatsApp (Vonage)
VONAGE_API_KEY=sua_api_key
VONAGE_API_SECRET=seu_secret
WHATSAPP_FROM=5583999999999

# Cron (padrão: a cada hora)
CRON_EXPRESSION=0 * * * *
```

**Testar backend:**

```bash
npm run dev
# Deve abrir em http://localhost:8000
```

### 4️⃣ **Configurar ETL (Python)**

```bash
cd etl
pip install -r requirements.txt

# Testar ETL com dados de exemplo
python etl.py --file ../sample_data/dados_exemplo.csv
```

**Saída esperada:**

```
✅ ETL Concluído
- Linhas processadas: 30
- Linhas inseridas: 30
- Erros: 0
```

**Verificar no MySQL:**

```sql
USE qw1_relatorios;
SELECT COUNT(*) FROM vendas;
-- Deve retornar: 30
```

### 5️⃣ **Configurar Frontend (React)**

```bash
cd frontend
npm install
npm start
# Abre automaticamente em http://localhost:3000
```

### 6️⃣ **Testar Sistema Completo**

#### ✅ **Checklist de Aceitação**

**Backend:**
- [ ] `GET http://localhost:8000/api/vendas?start=2025-10-01&end=2025-10-15` retorna JSON
- [ ] `GET http://localhost:8000/api/vendas/top-produtos?limit=5` retorna top 5 produtos
- [ ] `POST http://localhost:8000/api/etl/run` executa ETL (precisa enviar path no body)

**Frontend:**
- [ ] Dashboard carrega sem erros
- [ ] Gráfico de vendas por dia é exibido
- [ ] Top produtos aparece corretamente
- [ ] Botão "Exportar CSV" baixa arquivo
- [ ] Filtros por data funcionam

**ETL:**
- [ ] Upload de novo CSV via interface funciona
- [ ] Dados novos aparecem no dashboard

**Notificações:**
- [ ] Testar envio manual: `POST http://localhost:8000/api/notificacao/testar`
- [ ] Receber e-mail de teste
- [ ] Receber WhatsApp de teste (se configurado)

---

## 🔄 Agendamento Automático (Cron)

O sistema pode enviar relatórios automaticamente via e-mail/WhatsApp.

### Configurar Frequência

**Via Interface (Frontend):**
1. Acesse "Configurações de Envio"
2. Defina frequência (ex: a cada 1 hora, diariamente às 9h)
3. Adicione e-mails e números de WhatsApp
4. Salvar

**Via Backend (arquivo .env):**

```env
# A cada hora
CRON_EXPRESSION=0 * * * *

# Diariamente às 9h
CRON_EXPRESSION=0 9 * * *

# A cada 30 minutos
CRON_EXPRESSION=*/30 * * * *
```

### Iniciar Processo Cron (com PM2)

```bash
cd backend

# Instalar PM2 globalmente (se não tiver)
npm install -g pm2

# Iniciar backend
pm2 start src/index.js --name qw1-backend

# Iniciar cron job
pm2 start cron/jobs.js --name qw1-cron

# Ver processos
pm2 list

# Ver logs
pm2 logs qw1-cron
```

**Parar processos:**

```bash
pm2 stop qw1-backend
pm2 stop qw1-cron
```

---

## 📤 Exportar Dados

### Via Interface

1. No dashboard, selecione período (data inicial e final)
2. Clique em "Exportar CSV"
3. Arquivo `relatorio_YYYY-MM-DD.csv` será baixado

### Via API

```bash
curl "http://localhost:8000/api/export/csv?start=2025-10-01&end=2025-10-15" \
  --output relatorio.csv
```

---

## 🚀 Deploy (Próximos Passos)

### Opção 1: Docker (Local ou Servidor)

```bash
# Subir tudo com Docker Compose
docker-compose up --build

# Acessar:
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# MySQL: localhost:3306
```

### Opção 2: Cloud (Produção)

**Backend:** Render, Railway, Heroku
**Frontend:** Vercel, Netlify
**Banco:** AWS RDS, PlanetScale, Supabase

**Passos resumidos:**
1. Criar repositório Git
2. Conectar Render ao repo (backend)
3. Conectar Vercel ao repo (frontend)
4. Criar banco MySQL na nuvem (RDS/PlanetScale)
5. Atualizar variáveis de ambiente em cada serviço

---

## 🔐 Segurança

- ✅ **Nunca commitar** `.env` (já está no `.gitignore`)
- ✅ **Validar uploads** (tamanho máximo, tipos permitidos)
- ✅ **CORS configurado** apenas para origens permitidas
- ✅ **Sanitização** de inputs em queries SQL
- ✅ **Rate limiting** em endpoints sensíveis (produção)

---

## 📈 Melhorias Futuras (Pós-MVP)

1. **Autenticação:** Login com JWT, OAuth
2. **Multi-tenant:** Cada cliente tem seus dados isolados (SaaS)
3. **Billing:** Integração com Stripe/PagSeguro
4. **Dashboards personalizados:** Usuário cria seus próprios gráficos
5. **BI Avançado:** Previsões com ML (Python scikit-learn)
6. **Mobile:** App React Native ou PWA

---

## 📞 Suporte

**Dev-CEO:** [Seu Nome]  
**Local:** Campina Grande, PB  
**Contato:** [seu@email.com] | [(83) 9999-9999]

---

## 📄 Licença

Proprietário - QW1 © 2025