import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { obterTopProdutos } from '../services/api';

function TopProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    try {
      setLoading(true);
      const dados = await obterTopProdutos(30);
      setProdutos(dados);
    } catch (error) {
      setErro('Erro ao carregar produtos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner-small"></div>
      </div>
    );
  }

  if (erro) {
    return <div style={{ color: 'red', padding: '20px' }}>⚠️ {erro}</div>;
  }

  if (!produtos || produtos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        📊 Nenhum produto encontrado
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'white',
          border: '1px solid #ddd',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
            {data.produto}
          </p>
          <p style={{ margin: '3px 0', color: '#667eea' }}>
            Vendas: {data.num_vendas}
          </p>
          <p style={{ margin: '3px 0', color: '#764ba2' }}>
            Receita: R$ {parseFloat(data.receita_total).toFixed(2)}
          </p>
          <p style={{ margin: '3px 0', color: '#4CAF50' }}>
            Quantidade: {data.quantidade_vendida}
          </p>
          <p style={{ margin: '3px 0', color: '#FF9800' }}>
            Preço Médio: R$ {parseFloat(data.preco_medio).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={produtos}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="produto" type="category" tick={{ fontSize: 11 }} width={140} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="receita_total" fill="#667eea" name="Receita (R$)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default TopProdutos;