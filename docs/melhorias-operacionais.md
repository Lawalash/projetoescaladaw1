# Plano de melhorias operacionais

Este documento consolida propostas de melhoria para responder às demandas recebidas pelos grupos **@Amor** e **@Número desconhecido**. As ações abaixo estão organizadas por fluxo de trabalho, com entregáveis claros e responsáveis sugeridos para facilitar o acompanhamento.

## 1. Gestão de Estoques (Limpeza, Despensa e Farmácia)
- **Inventário mensal integrado**: implementar checklists digitais no A2 Data Monitoramento Ocupacional (módulo de estoque) com categorias separadas para material de limpeza, gêneros alimentícios e itens farmacêuticos. O mesmo formulário gera três relatórios: limpeza, despensa e farmácia.
- **Classificação ABC**: priorizar itens de alto giro (classe A) para revisões semanais. Ex.: detergente, desinfetante, luvas descartáveis, medicações contínuas e fraldas geriátricas.
- **Alertas de compra automática**: configurar limites mínimos no dashboard para disparar notificações por e-mail/WhatsApp quando o saldo atingir 30% do consumo médio.
- **Histórico de consumo**: alimentar o ETL com dados de movimentação para gerar gráficos de tendência (ex.: comparativo mensal de ampolas e fraldas), apoiando decisões de compra.

### Entregáveis
1. Planilha padrão de contagem com códigos de item e unidades de medida padronizadas.
2. Rotina ETL semanal para importar contagens do Google Sheets.
3. Painel "Status dos Estoques" no frontend com cartões para cada categoria.

## 2. Cronograma de Limpeza e Organização de Ambientes
- **Planejamento quinzenal**: criar cronograma que alterna tarefas pesadas (enceramento, desinfecção profunda) e leves (reposição, poeira) por dia da semana.
- **Checklists por turno**: disponibilizar no aplicativo um checklist para cada equipe (manhã, tarde, noite) com responsáveis nomeados.
- **Integração com equipe de farmácia**: incluir inspeção rápida da farmácia no cronograma da equipe de limpeza para garantir organização física após repor insumos.

### Exemplo de cronograma semanal
| Dia | Turno | Atividades principais | Responsável sugerido |
| --- | --- | --- | --- |
| Segunda | Manhã | Limpeza geral das áreas comuns, revisão de material de limpeza | Equipe A (coord. Maria) |
| Terça | Tarde | Desinfecção de quartos com maior rotatividade, revisão de estoque de ampolas | Equipe B (coord. João) |
| Quarta | Noite | Organização da farmácia, conferência de validade de medicamentos | Equipe C (coord. Ana) |
| Quinta | Manhã | Reposição da despensa, auditoria do checklist de limpeza | Equipe A |
| Sexta | Tarde | Limpeza pesada de cozinha e lavanderia, planejamento de compras | Equipe B |
| Sábado | Manhã | Revisão cruzada dos checklists, briefing de pendências | Equipe C |

## 3. Documentação da Equipe e Relatórios de Desempenho
- **Template de relatório individual**: registrar metas, pontos fortes e pontos de atenção de cada colaborador mensalmente. Incluir espaço para feedback sobre estratégias que não funcionaram e plano de ação.
- **Ata digital das reuniões**: utilizar o módulo de documentação para registrar pendências alinhadas com a coordenação (campo "Responsável" + "Prazo").
- **Painel de performance**: criar indicadores de aderência ao cronograma, acurácia das contagens de estoque e cumprimento das estratégias testadas.

### Campos sugeridos para o relatório individual
1. Nome do colaborador e função.
2. Metas do mês anterior e status (atingida/não atingida + motivo).
3. Pontos de destaque observados pelo gestor.
4. Oportunidades de melhoria com plano de treinamento.
5. Estratégias testadas (o que funcionou / não funcionou e próximos passos).
6. Pendências compartilhadas com a liderança.

## 4. Revisão de Estratégias e Resolução de Pendências
- **Retrospectiva mensal**: reunião curta para revisar iniciativas que falharam, registrando motivo raiz (ex.: equipe reduzida, falta de insumo, fluxo não seguido).
- **Matriz de decisão**: documentar se cada estratégia será retomada agora que a equipe está completa, postergada ou descartada.
- **Kanban de pendências**: integrar ao painel um quadro Kanban (A fazer / Em andamento / Concluído) para acompanhar compromissos assumidos com a gestão.

### Indicadores-chave de acompanhamento
- % de itens críticos com estoque acima do nível mínimo.
- Tempo médio de resolução de pendências abertas com a coordenação.
- Taxa de adesão ao cronograma de limpeza (checklists concluídos / previstos).
- Satisfação da equipe (pesquisa rápida mensal).

## 5. Próximos passos recomendados
1. Validar com as equipes responsáveis (limpeza, farmácia, coordenação) o template de inventário e o cronograma semanal.
2. Configurar as automações necessárias no backend/ETL para coletar dados de estoque e performance.
3. Atualizar o frontend para exibir dashboards de estoque e performance, além do quadro de pendências.
4. Treinar a equipe no uso dos novos formulários e checklists digitais.
5. Agendar primeira retrospectiva após 30 dias para mensurar resultados e ajustar processos.

Estas ações alinham as solicitações recebidas com a capacidade atual da plataforma, gerando visibilidade operacional e facilitando decisões rápidas pela liderança.
