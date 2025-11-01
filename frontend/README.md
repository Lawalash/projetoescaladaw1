# A2 Data Monitoramento Ocupacional — Monitoramento de Lar de Idosos

## 📋 Visão Geral

O portal A2 Data Monitoramento Ocupacional foi concebido para casas de repouso. O projeto combina dashboard em tempo real, ingestão de planilhas de estoque, monitoramento de indicadores de saúde e disparo automatizado de comunicados para familiares e equipe médica.

**Principais áreas monitoradas:**

- Ocupação do lar e idade média dos residentes
- Indicadores clínicos diários (pressão, frequência cardíaca, glicemia, quedas, internações)
- Aderência aos medicamentos por ala
- Cobertura dos estoques de alimentos e produtos de limpeza
- Cronograma de atividades, consultas e encontros familiares
- Alertas críticos (baixa cobertura de estoque, eventos clínicos)

---

## 🧱 Arquitetura

```
auroracare/
├─ backend/
│  ├─ src/
│  │  ├─ index.js                 # API Express
│  │  ├─ controllers/larController.js
│  │  ├─ routes/lar.js
│  │  ├─ services/
│  │  │  ├─ etlService.js         # Processamento de planilhas (CSV/XLSX)
│  │  │  └─ notificationService.js
│  │  └─ db/connection.js         # Pool MySQL
│  ├─ cron/jobs.js                # Resumo automático agendado
│  └─ uploads/planilhas/          # Planilhas anexadas via dashboard
├─ etl/etl.py                     # ETL em Python para estoques/saúde
├─ frontend/src/
│  ├─ App.jsx                     # Shell com abas “Painel” e “Comunicações”
│  ├─ components/Dashboard.jsx
│  ├─ components/ConfigurarEnvio.jsx
│  └─ services/api.js             # Cliente Axios
└─ sql/schema.sql                 # Script base de tabelas
```

---

## ⚙️ Pré-requisitos

- Node.js 18+
- Python 3.9+
- MySQL 8+
- npm e pip

---

## 🛠️ Configuração Passo a Passo

### 1. Banco de Dados

```bash
mysql -u root -p < sql/schema.sql
```

O script cria as tabelas base (`residentes`, `metricas_saude`, `metricas_medicacao`, `estoque_itens`, `estoque_alimentos`, `estoque_limpeza`, `config_envio`, etc).

### 2. Backend (Node.js)

```bash
cd backend
npm install
cp .env.example .env
```

Exemplo de `.env`:

```env
PORT=8000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=aurora_care

CORS_ORIGIN=http://localhost:5173

# SMTP para e-mails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@gmail.com
SMTP_PASS=senha_de_app
EMAIL_FROM=seuemail@gmail.com
EMAIL_FROM_NAME=A2 Data Monitoramento Ocupacional

# WhatsApp (Vonage)
VONAGE_API_KEY=xxx
VONAGE_API_SECRET=yyy
WHATSAPP_FROM=5583999999999

# Agendamentos
ENABLE_CRON=true
CRON_EXPRESSION=0 9 * * *   # diariamente às 9h
```

Inicie o servidor:

```bash
npm run dev
# http://localhost:8000/api/lar/painel
```

### 3. ETL (Python)

```bash
cd etl
pip install -r requirements.txt

# Importar planilha de estoque de alimentos
python etl.py --file ../sample_data/estoque_alimentos.xlsx --tipo estoque_alimentos

# Importar métricas de saúde
python etl.py --file ../sample_data/saude_diaria.csv --tipo saude_diaria
```

O script normaliza colunas, converte datas/numéricos e grava diretamente no MySQL.

### 4. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

---

## ✅ Checklist de Validação

### API
- `GET http://localhost:8000/api/lar/painel?start=2025-01-01&end=2025-01-30`
- `POST http://localhost:8000/api/lar/inventario/upload` (multipart com arquivo + `tipo` + `responsavel`)
- `POST http://localhost:8000/api/lar/notificacoes/testar` (JSON `{ tipo: 'email', destinatario: '...' }`)

### Dashboard
- KPIs exibem residentes, ocupação, adesão, óbitos
- Gráficos mostram tendências de saúde, ocupação semanal, estoques e aderência por ala
- Cronograma lista atividades dos próximos dias
- Upload de planilhas atualiza cobertura de estoque

### Comunicações
- Cadastro de familiares/profissionais via aba “Comunicações”
- Botão “Testar” envia resumo diário para o contato
- Logs populam tabela `logs_envio`

### Cron / Automatização
- `ENABLE_CRON=true` agenda o envio diário
- Mensagem gerada lista KPIs, ocupação semanal e alertas de estoque

---

## 📎 Fluxo de Upload de Planilhas

1. Selecione o tipo de estoque (alimentos ou limpeza) no dashboard
2. Informe o responsável pelo envio
3. Faça upload do arquivo CSV/XLSX com colunas:
   - `Categoria`, `Item`, `Quantidade`, `Unidade`, `Consumo_Diario`, `Validade`, `Lote`, `Fornecedor`
4. O backend grava os itens em `estoque_itens` e registra o arquivo em `estoque_planilhas`

Para métricas de saúde, utilize o ETL Python com colunas:
`data_ref`, `pressao_sistolica`, `pressao_diastolica`, `frequencia_cardiaca`, `glicemia`, `incidentes_quedas`, `internacoes`, `pontuacao_bem_estar`, `taxa_ocupacao`, `taxa_obito`.

---

## 📬 Notificações Automáticas

- Relatórios diários via e-mail/WhatsApp com resumo clínico e coberturas de estoque
- Template HTML em `notificationService.js`
- Mensagens de WhatsApp usam Vonage
- Contatos cadastrados ficam em `config_envio`

---

## 🧪 Dados de Demonstração

- Pastas `sample_data/` (estoques e saúde) podem ser importadas via ETL Python
- Utilize `npm run dev` + `npm run cron` (se configurado) para simular o ciclo completo

---

## 📮 Suporte

- Ajuste queries do controlador (`larController.js`) de acordo com sua modelagem real
- Configure variáveis de ambiente de e-mail/WhatsApp antes de acionar notificações
- Para produção, recomenda-se PM2 + SSL + backups automáticos do MySQL

Boas análises! 🏡💙
