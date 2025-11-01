import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  obterPainelCompleto,
  uploadPlanilhaEstoque
} from '../services/api';
import './styles/Dashboard.css';

const formatarNumero = (valor) => new Intl.NumberFormat('pt-BR').format(Number(valor || 0));
const formatarPercentual = (valor) => `${Number(valor || 0).toFixed(1)}%`;

function Dashboard() {
  const [inicio, setInicio] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [fim, setFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [painel, setPainel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadTipo, setUploadTipo] = useState('alimentos');
  const [uploadResponsavel, setUploadResponsavel] = useState('');

  useEffect(() => {
    carregarPainel();
  }, [inicio, fim]);

  const carregarPainel = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const dados = await obterPainelCompleto(inicio, fim);
      setPainel(dados);
    } catch (error) {
      console.error('Erro ao carregar painel:', error);
      setErro('Não foi possível carregar os dados do lar.');
    } finally {
      setCarregando(false);
    }
  };

  const handleUpload = async (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setUploadStatus({ status: 'carregando', mensagem: 'Processando planilha...' });

    try {
      const resposta = await uploadPlanilhaEstoque({
        arquivo,
        tipo: uploadTipo,
        responsavel: uploadResponsavel
      });

      setUploadStatus({
        status: 'sucesso',
        mensagem: `✅ ${resposta.inseridos} registros importados com sucesso.`
      });
      carregarPainel();
    } catch (error) {
      setUploadStatus({ status: 'erro', mensagem: 'Erro ao importar planilha: ' + error.message });
    } finally {
      event.target.value = '';
    }
  };

  const saudeDiaria = useMemo(() => {
    if (!painel?.series?.saudeDiaria) return [];
    return painel.series.saudeDiaria.map((item) => {
      const dataRef = item.data_ref ? parseISO(item.data_ref) : null;
      return {
        ...item,
        data: dataRef ? format(dataRef, 'dd/MM') : '--',
        pressao_sistolica: Number(item.pressao_sistolica || 0),
        pressao_diastolica: Number(item.pressao_diastolica || 0),
        glicemia: Number(item.glicemia || 0),
        frequencia_cardiaca: Number(item.frequencia_cardiaca || 0)
      };
    });
  }, [painel]);

  const obitosMensal = useMemo(() => {
    if (!painel?.series?.obitosMensal) return [];
    return painel.series.obitosMensal.map((item) => ({
      ...item,
      mes: item.mes,
      total_obitos: Number(item.total_obitos || 0),
      total_internacoes: Number(item.total_internacoes || 0)
    }));
  }, [painel]);

  const ocupacaoSemanal = useMemo(() => {
    if (!painel?.series?.ocupacaoSemanal) return [];
    return painel.series.ocupacaoSemanal.map((item) => ({
      ...item,
      taxa_ocupacao: Number(item.taxa_ocupacao || 0),
      taxa_obito: Number(item.taxa_obito || 0)
    }));
  }, [painel]);

  const medicacaoPorAla = painel?.series?.medicacaoPorAla?.map((item) => ({
    ...item,
    taxa_aderencia: Number(item.taxa_aderencia || 0)
  })) || [];

  const inventarioCobertura = useMemo(() => {
    if (!painel?.inventario) return [];

    const alimentos = painel.inventario.alimentos?.map((item) => ({
      categoria: `🍎 ${item.categoria}`,
      cobertura: item.coberturaDias || 0,
      tipo: 'Alimentos'
    })) || [];

    const limpeza = painel.inventario.limpeza?.map((item) => ({
      categoria: `🧼 ${item.categoria}`,
      cobertura: item.coberturaDias || 0,
      tipo: 'Limpeza'
    })) || [];

    return [...alimentos, ...limpeza];
  }, [painel]);

  if (carregando && !painel) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Buscando informações do lar...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="filtros">
          <div className="filtro-grupo">
            <label>Início</label>
            <input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} max={fim} />
          </div>

          <div className="filtro-grupo">
            <label>Fim</label>
            <input
              type="date"
              value={fim}
              onChange={(event) => setFim(event.target.value)}
              min={inicio}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <button type="button" className="btn-atualizar" onClick={carregarPainel}>
            🔄 Atualizar
          </button>
        </div>

        <div className="upload-wrapper">
          <div className="upload-meta">
            <label htmlFor="tipo-planilha">Tipo de estoque</label>
            <select
              id="tipo-planilha"
              value={uploadTipo}
              onChange={(event) => setUploadTipo(event.target.value)}
            >
              <option value="alimentos">Alimentos</option>
              <option value="limpeza">Produtos de limpeza</option>
            </select>
          </div>

          <input
            type="text"
            className="input-responsavel"
            placeholder="Responsável pelo envio"
            value={uploadResponsavel}
            onChange={(event) => setUploadResponsavel(event.target.value)}
          />

          <label className="btn-upload">
            📁 Enviar planilha
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} />
          </label>
        </div>
      </div>

      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.status}`}>{uploadStatus.mensagem}</div>
      )}

      {erro && <div className="erro-box">{erro}</div>}

      {painel && (
        <>
          <section className="kpis">
            <article className="kpi-card">
              <div className="kpi-icon residentes">👵</div>
              <div>
                <h4>Residentes Ativos</h4>
                <p className="kpi-valor">{formatarNumero(painel.resumo?.residentesAtivos)}</p>
                <span>{formatarNumero(painel.resumo?.residentesObservacao)} em observação</span>
              </div>
            </article>

            <article className="kpi-card">
              <div className="kpi-icon ocupacao">🏥</div>
              <div>
                <h4>Taxa de Ocupação</h4>
                <p className="kpi-valor">{formatarPercentual(painel.resumo?.taxaOcupacao)}</p>
                <span>{formatarNumero(painel.resumo?.residentesInternados)} residentes internados</span>
              </div>
            </article>

            <article className="kpi-card">
              <div className="kpi-icon saude">💊</div>
              <div>
                <h4>Adesão à Medicação</h4>
                <p className="kpi-valor">{formatarPercentual(painel.resumo?.taxaMedicacao)}</p>
                <span>{formatarNumero(painel.resumo?.incidentesClinicos)} incidentes clínicos</span>
              </div>
            </article>

            <article className="kpi-card">
              <div className="kpi-icon bem-estar">💚</div>
              <div>
                <h4>Bem-estar médio</h4>
                <p className="kpi-valor">{Number(painel.resumo?.bemEstarMedio || 0).toFixed(1)}</p>
                <span>{formatarPercentual(painel.resumo?.taxaObito)} taxa de óbito</span>
              </div>
            </article>
          </section>

          <section className="cards-secundarios">
            <div className="card pequeno">
              <h3>📅 Próxima consulta médica</h3>
              <p>{painel.resumo?.proximaConsulta ? format(parseISO(painel.resumo.proximaConsulta), 'dd/MM/yyyy') : 'Sem registro'}</p>
            </div>
            <div className="card pequeno">
              <h3>🤝 Encontros familiares</h3>
              <p>{formatarNumero(painel.resumo?.encontrosFamiliares)}</p>
            </div>
            <div className="card pequeno">
              <h3>🩺 Atendimentos clínicos</h3>
              <p>{formatarNumero(painel.resumo?.atendimentosClinicos)}</p>
            </div>
            <div className="card pequeno">
              <h3>🚑 Internações no período</h3>
              <p>{formatarNumero(painel.resumo?.internacoesPeriodo)}</p>
            </div>
          </section>

          <section className="graficos-grid">
            <div className="grafico-card">
              <div className="grafico-header">
                <h3>🩺 Tendências de Saúde Diária</h3>
                <span>Pressão, batimentos e glicemia</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={saudeDiaria} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bee3f8' }} />
                  <Legend />
                  <Line type="monotone" dataKey="pressao_sistolica" name="Pressão Sistólica" stroke="#4257b2" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pressao_diastolica" name="Pressão Diastólica" stroke="#5ca4a9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="frequencia_cardiaca" name="Frequência Cardíaca" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="glicemia" name="Glicemia" stroke="#ec4899" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grafico-card">
              <div className="grafico-header">
                <h3>📉 Óbitos e Internações por mês</h3>
                <span>Panorama dos últimos 12 meses</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={obitosMensal} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="colorObitos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorInternacoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#fcd34d' }} />
                  <Area type="monotone" dataKey="total_obitos" name="Óbitos" stroke="#ef4444" fill="url(#colorObitos)" strokeWidth={2} />
                  <Area type="monotone" dataKey="total_internacoes" name="Internações" stroke="#6366f1" fill="url(#colorInternacoes)" strokeWidth={2} />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grafico-card">
              <div className="grafico-header">
                <h3>📈 Ocupação Semanal</h3>
                <span>Monitoramento das últimas 12 semanas</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={ocupacaoSemanal} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#cbd5f5' }} />
                  <Legend />
                  <Line type="monotone" dataKey="taxa_ocupacao" name="Ocupação (%)" stroke="#0ea5e9" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="taxa_obito" name="Óbito (%)" stroke="#ef4444" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grafico-card">
              <div className="grafico-header">
                <h3>💊 Adesão à medicação por ala</h3>
                <span>Média do período selecionado</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={medicacaoPorAla} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                  <YAxis type="category" dataKey="ala" />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#6ee7b7' }} formatter={(value) => `${value}%`} />
                  <Bar dataKey="taxa_aderencia" name="Adesão" fill="#22c55e" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grafico-card">
              <div className="grafico-header">
                <h3>🥗 Cobertura de Estoques</h3>
                <span>Dias de autonomia por categoria</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={inventarioCobertura} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#fde68a' }} formatter={(value) => `${value} dias`} />
                  <Legend />
                  <Bar dataKey="cobertura" name="Dias de cobertura" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grafico-card alertas">
              <div className="grafico-header">
                <h3>🚨 Alertas ativos</h3>
                <span>Priorize tratativas críticas</span>
              </div>
              <ul className="lista-alertas">
                {painel.alertas && painel.alertas.length > 0 ? (
                  painel.alertas.map((alerta, index) => (
                    <li key={`${alerta.tipo}-${index}`} className={`alerta ${alerta.severidade || 'media'}`}>
                      <strong>{alerta.tipo}</strong>
                      <p>{alerta.mensagem}</p>
                      {alerta.criado_em && <span>{format(parseISO(alerta.criado_em), 'dd/MM HH:mm')}</span>}
                    </li>
                  ))
                ) : (
                  <li className="alerta vazio">Nenhum alerta crítico no momento.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="cronograma-inventario">
            <div className="card cronograma">
              <h3>🗓️ Cronograma de atividades</h3>
              <ul>
                {painel.cronograma && painel.cronograma.length > 0 ? (
                  painel.cronograma.map((item, index) => {
                    const dataCrono = item.data ? parseISO(item.data) : null;
                    return (
                      <li key={`${item.data}-${item.hora_inicio}-${index}`}>
                      <div className="cronograma-data">
                        <strong>{dataCrono ? format(dataCrono, 'dd/MM') : '--/--'}</strong>
                        <span>
                          {item.hora_inicio?.slice(0, 5) || '--:--'} - {item.hora_fim?.slice(0, 5) || '--:--'}
                        </span>
                      </div>
                      <div className="cronograma-info">
                        <h4>{item.atividade}</h4>
                        <p>{item.tipo} · Ala {item.ala}</p>
                        <span>{item.responsavel}</span>
                      </div>
                    </li>
                    );
                  })
                ) : (
                  <li className="cronograma-vazio">Nenhuma atividade cadastrada no período.</li>
                )}
              </ul>
            </div>

            <div className="card planilhas">
              <h3>📎 Planilhas anexadas recentemente</h3>
              <ul>
                {painel.planilhas && painel.planilhas.length > 0 ? (
                  painel.planilhas.map((planilha) => (
                    <li key={planilha.id}>
                      <div>
                        <strong>{planilha.nome}</strong>
                        <span>{planilha.enviadoPor || 'Equipe'}</span>
                      </div>
                      <a href={`/${planilha.caminho}`} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    </li>
                  ))
                ) : (
                  <li className="planilha-vazia">Nenhuma planilha enviada ainda.</li>
                )}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Dashboard;
