import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { obterPainelCompleto } from '../services/api';
import './styles/RelatorioEquipe.css';

function RelatorioEquipe() {
  const [painel, setPainel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const carregarPainel = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const dados = await obterPainelCompleto();
      setPainel(dados);
    } catch (error) {
      console.error('Erro ao gerar relatório da equipe:', error);
      setErro('Não foi possível gerar o relatório. Tente novamente em instantes.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPainel();
  }, []);

  const inventarioResumo = useMemo(() => {
    const calcular = (lista = []) => {
      if (!lista.length) {
        return { coberturaMedia: 0, itensCriticos: 0 };
      }

      const coberturas = lista
        .map((item) => Number(item.coberturaDias || 0))
        .filter((valor) => Number.isFinite(valor));

      const totalCobertura = coberturas.reduce((acc, valor) => acc + valor, 0);
      const itensCriticos = lista.reduce((acc, item) => acc + Number(item.itensCriticos || 0), 0);

      return {
        coberturaMedia: coberturas.length ? Number((totalCobertura / coberturas.length).toFixed(1)) : 0,
        itensCriticos
      };
    };

    return {
      alimentos: calcular(painel?.inventario?.alimentos || []),
      limpeza: calcular(painel?.inventario?.limpeza || [])
    };
  }, [painel]);

  const equipeResumo = useMemo(() => {
    if (!painel?.cronograma) return [];

    const mapa = new Map();

    painel.cronograma.forEach((item) => {
      const responsavel = item.responsavel || 'Equipe';
      const existente = mapa.get(responsavel) || {
        responsavel,
        tarefas: 0,
        proxima: null,
        atividade: null,
        tipos: new Set(),
        alas: new Set()
      };

      existente.tarefas += 1;
      if (item.tipo) existente.tipos.add(item.tipo);
      if (item.ala) existente.alas.add(item.ala);

      if (item.data) {
        const dataItem = parseISO(item.data);
        if (!existente.proxima || dataItem < existente.proxima) {
          existente.proxima = dataItem;
          existente.atividade = item.atividade;
        }
      }

      mapa.set(responsavel, existente);
    });

    return Array.from(mapa.values())
      .map((item) => ({
        responsavel: item.responsavel,
        tarefas: item.tarefas,
        proxima: item.proxima ? format(item.proxima, 'dd/MM') : '—',
        atividade: item.atividade || '—',
        escopo: item.tipos.size ? Array.from(item.tipos).join(', ') : '—',
        alas: item.alas.size ? Array.from(item.alas).join(', ') : '—'
      }))
      .sort((a, b) => b.tarefas - a.tarefas);
  }, [painel]);

  const pendencias = useMemo(() => {
    const lista = [];

    painel?.alertas?.forEach((alerta) => {
      lista.push({
        titulo: alerta.tipo,
        detalhe: alerta.mensagem,
        prioridade: alerta.severidade || 'média',
        responsavel: alerta.tipo.toLowerCase().includes('estoque') ? 'Serviços gerais' : 'Coordenação',
        prazo: alerta.severidade === 'alto' ? 'Imediato' : 'Próxima reunião'
      });
    });

    if (inventarioResumo.limpeza.itensCriticos > 0) {
      lista.push({
        titulo: 'Reforçar reposição de limpeza',
        detalhe: `${inventarioResumo.limpeza.itensCriticos} categorias abaixo do mínimo.`,
        prioridade: 'alto',
        responsavel: 'Serviços gerais',
        prazo: 'Hoje'
      });
    }

    if (inventarioResumo.alimentos.itensCriticos > 0) {
      lista.push({
        titulo: 'Validar compras da dispensa',
        detalhe: `${inventarioResumo.alimentos.itensCriticos} categorias críticas de alimentos.`,
        prioridade: 'alto',
        responsavel: 'Nutrição / Compras',
        prazo: 'Até o próximo abastecimento'
      });
    }

    if ((painel?.resumo?.taxaMedicacao || 0) < 90) {
      lista.push({
        titulo: 'Revisar adesão medicamentosa',
        detalhe: `Taxa média em ${Number(painel?.resumo?.taxaMedicacao || 0).toFixed(1)}%.`,
        prioridade: 'média',
        responsavel: 'Enfermagem',
        prazo: 'Reunião de passagem de plantão'
      });
    }

    return lista.slice(0, 6);
  }, [inventarioResumo, painel]);

  const estrategias = [
    'Implantar checklist digital diário para estoques de limpeza e insumos críticos.',
    'Realizar conferência quinzenal da farmácia com dupla checagem de validade e lote.',
    'Apresentar feedback individualizado para cada colaborador com base nas métricas do painel.',
    'Reativar o plano de contingência das medicações com dupla conferência em horários de pico.',
    'Revisar responsáveis por turno e confirmar metas individuais alinhadas.'
  ];

  const aderenciaMedia = Number(painel?.resumo?.taxaMedicacao || 0).toFixed(1);
  const bemEstarMedio = Number(painel?.resumo?.bemEstarMedio || 0).toFixed(1);
  const coberturaAlimentos = inventarioResumo.alimentos.coberturaMedia;
  const coberturaLimpeza = inventarioResumo.limpeza.coberturaMedia;
  const alertasAtivos = painel?.alertas?.length || 0;

  return (
    <div className="relatorio-equipe">
      <div className="relatorio-equipe__header">
        <div>
          <h2>Relatório de acompanhamento da equipe</h2>
          <p>Indicadores consolidados para direcionar feedbacks e tomadas de decisão semanais.</p>
        </div>
        <button type="button" onClick={carregarPainel} disabled={carregando}>
          {carregando ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </div>

      {erro && <div className="relatorio-equipe__erro">{erro}</div>}

      {carregando && !painel ? (
        <div className="relatorio-equipe__loading">
          <div className="spinner" />
          <p>Montando relatório estratégico...</p>
        </div>
      ) : (
        <>
          <section className="relatorio-equipe__kpis">
            <article className="relatorio-equipe__kpi">
              <span className="relatorio-equipe__kpi-label">Adesão à medicação</span>
              <strong>{`${aderenciaMedia}%`}</strong>
              <p>Acompanhamento direto da enfermagem</p>
            </article>
            <article className="relatorio-equipe__kpi">
              <span className="relatorio-equipe__kpi-label">Bem-estar médio</span>
              <strong>{bemEstarMedio}</strong>
              <p>Resultado das rotinas de cuidado e lazer</p>
            </article>
            <article className="relatorio-equipe__kpi">
              <span className="relatorio-equipe__kpi-label">Cobertura alimentos</span>
              <strong>{`${coberturaAlimentos} dias`}</strong>
              <p>{inventarioResumo.alimentos.itensCriticos} categorias demandam reposição</p>
            </article>
            <article className="relatorio-equipe__kpi">
              <span className="relatorio-equipe__kpi-label">Cobertura limpeza</span>
              <strong>{`${coberturaLimpeza} dias`}</strong>
              <p>{inventarioResumo.limpeza.itensCriticos} categorias em alerta</p>
            </article>
            <article className="relatorio-equipe__kpi">
              <span className="relatorio-equipe__kpi-label">Alertas ativos</span>
              <strong>{alertasAtivos}</strong>
              <p>Priorizar tratativas antes do fechamento da semana</p>
            </article>
          </section>

          <section className="relatorio-equipe__grid">
            <div className="relatorio-equipe__card relatorio-equipe__card--table">
              <h3>Desempenho por responsável</h3>
              {equipeResumo.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Responsável</th>
                      <th>Tarefas (14 dias)</th>
                      <th>Próxima agenda</th>
                      <th>Atividade foco</th>
                      <th>Escopo</th>
                      <th>Alas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipeResumo.map((linha) => (
                      <tr key={linha.responsavel}>
                        <td>{linha.responsavel}</td>
                        <td>{linha.tarefas}</td>
                        <td>{linha.proxima}</td>
                        <td>{linha.atividade}</td>
                        <td>{linha.escopo}</td>
                        <td>{linha.alas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="relatorio-equipe__vazio">Ainda não existem atividades registradas para o período selecionado.</p>
              )}
            </div>

            <div className="relatorio-equipe__card">
              <h3>Pendências críticas</h3>
              {pendencias.length > 0 ? (
                <ul className="relatorio-equipe__pendencias">
                  {pendencias.map((item, index) => (
                    <li key={`${item.titulo}-${index}`} className={`prioridade-${item.prioridade}`}>
                      <div>
                        <strong>{item.titulo}</strong>
                        <p>{item.detalhe}</p>
                      </div>
                      <footer>
                        <span>{item.responsavel}</span>
                        <span>{item.prazo}</span>
                      </footer>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="relatorio-equipe__vazio">Nenhuma pendência relevante encontrada.</p>
              )}
            </div>
          </section>

          <section className="relatorio-equipe__card relatorio-equipe__card--estrategias">
            <h3>Próximas ações recomendadas</h3>
            <ul>
              {estrategias.map((acao) => (
                <li key={acao}>{acao}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export default RelatorioEquipe;
