// frontend/src/components/ChartVendas.jsx
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

function ChartVendas({ dados }) {
  if (!dados || dados.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        📊 Nenhum dado disponível
      </div>
    );
  }

  const dadosFormatados = dados.map(item => ({
    ...item,
    // garante formato dd/mm/aaaa
    data: item.data_venda ? new Date(item.data_venda).toLocaleDateString('pt-BR') : item.data_venda
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div style={{
          background: 'white',
          border: '1px solid #ddd',
          padding: '10px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.data}</div>
          <div>Vendas: {d.num_vendas ?? 0}</div>
          <div>Itens: {d.quantidade_total ?? 0}</div>
          <div>Receita: R$ {Number(d.receita_total ?? 0).toFixed(2)}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dadosFormatados} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eaeaea" />
        <XAxis dataKey="data" angle={-45} textAnchor="end" height={70} />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="num_vendas" fill="#667eea" name="Número de Vendas" />
        <Bar dataKey="quantidade_total" fill="#764ba2" name="Quantidade" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default ChartVendas;
