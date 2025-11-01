import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { obterDadosAgregados, uploadCSV, exportarCSV } from '../services/api';
import ChartVendas from './ChartVendas';
import TopProdutos from './TopProdutos';
import './styles/Dashboard.css';

function Dashboard() {
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  const carregarDados = async () => {
    setLoading(true);
    setErro(null);
    
    try {
      const resultado = await obterDadosAgregados(dataInicio, dataFim);
      setDados(resultado);
    } catch (error) {
      setErro('Erro ao carregar dados: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCSV = async (event) => {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    setUploadStatus({ tipo: 'loading', mensagem: 'Enviando arquivo...' });

    try {
      const resultado = await uploadCSV(arquivo);
      setUploadStatus({
        tipo: 'success',
        mensagem: `✅ ${resultado.inseridos} linhas importadas com sucesso!`
      });
      
      // Recarregar dados após 2 segundos
      setTimeout(() => {
        carregarDados();
        setUploadStatus(null);
      }, 2000);
    } catch (error) {
      setUploadStatus({
        tipo: 'error',
        mensagem: '❌ Erro ao importar: ' + error.message
      });
    }

    // Limpar input
    event.target.value = '';
  };

  const handleExportar = async () => {
    try {
      await exportarCSV(dataInicio, dataFim);
    } catch (error) {
      alert('Erro ao exportar: ' + error.message);
    }
  };

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  if (loading && !dados) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Filtros e Ações */}
      <div className="dashboard-header">
        <div className="filtros">
          <div className="filtro-grupo">
            <label>Data Início:</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              max={dataFim}
            />
          </div>
          
          <div className="filtro-grupo">
            <label>Data Fim:</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              min={dataInicio}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <button className="btn-atualizar" onClick={carregarDados}>
            🔄 Atualizar
          </button>
        </div>

        <div className="acoes">
          <label className="btn-upload">
            📤 Importar CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleUploadCSV}
              style={{ display: 'none' }}
            />
          </label>

          <button className="btn-exportar" onClick={handleExportar}>
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {/* Status de Upload */}
      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.tipo}`}>
          {uploadStatus.mensagem}
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="erro-box">
          ⚠️ {erro}
        </div>
      )}

      {/* KPIs */}
      {dados && dados.kpis && (
        <div className="kpis">
          <div className="kpi-card">
            <div className="kpi-icon">🛒</div>
            <div className="kpi-info">
              <span className="kpi-label">Total de Vendas</span>
              <span className="kpi-valor">{dados.kpis.total_vendas || 0}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">💰</div>
            <div className="kpi-info">
              <span className="kpi-label">Receita Total</span>
              <span className="kpi-valor">{formatarMoeda(dados.kpis.receita_total)}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">📊</div>
            <div className="kpi-info">
              <span className="kpi-label">Ticket Médio</span>
              <span className="kpi-valor">{formatarMoeda(dados.kpis.ticket_medio)}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">📦</div>
            <div className="kpi-info">
              <span className="kpi-label">Itens Vendidos</span>
              <span className="kpi-valor">{dados.kpis.itens_vendidos || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      {dados && (
        <div className="graficos">
          <div className="grafico-box">
            <h3>📈 Vendas por Dia</h3>
            <ChartVendas dados={dados.vendasPorDia} />
          </div>

          <div className="grafico-box">
            <h3>🏆 Top 10 Produtos</h3>
            <TopProdutos />
          </div>
        </div>
      )}

      {/* Vendas por Loja */}
      {dados && dados.vendasPorLoja && dados.vendasPorLoja.length > 0 && (
        <div className="vendas-loja">
          <h3>🏪 Vendas por Loja</h3>
          <div className="lojas-grid">
            {dados.vendasPorLoja.map((loja, index) => (
              <div key={index} className="loja-card">
                <h4>{loja.loja}</h4>
                <div className="loja-stats">
                  <div>
                    <span className="loja-label">Vendas:</span>
                    <span className="loja-valor">{loja.num_vendas}</span>
                  </div>
                  <div>
                    <span className="loja-label">Receita:</span>
                    <span className="loja-valor">{formatarMoeda(loja.receita_total)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;