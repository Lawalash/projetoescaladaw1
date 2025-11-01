# AuroraCare — Plataforma para lares de idosos

Este repositório reúne backend, frontend e automações de ETL para o AuroraCare, um painel de monitoramento pensado para casas de repouso. O objetivo é consolidar indicadores clínicos, cronogramas de atividades e saúde financeira/operacional do lar em uma experiência única.

### Pastas principais

- `backend/` — API Express (Node.js) + jobs agendados para disparar relatórios
- `frontend/` — Dashboard React com gráficos de saúde, estoque e cronograma
- `etl/` — Script Python para importar planilhas de estoque e métricas médicas

Para instruções detalhadas de configuração consulte `frontend/README.md`.

### Banco de dados de desenvolvimento

O backend espera um banco MySQL chamado `qw1_relatorios` (configurável via variáveis `DB_*`).
Para recriar toda a estrutura e popular dados de exemplo execute:

```bash
cd backend
npm install
npm run db:reset
```

O script `db:reset` remove tabelas existentes, recria o esquema utilizado pela API
(`residentes`, `leitos`, `metricas_*`, cronogramas, estoque etc.) e insere registros
fictícios suficientes para que o painel do frontend seja carregado sem erros.

