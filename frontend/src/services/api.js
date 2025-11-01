import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Obter dados agregados para dashboard
export const obterDadosAgregados = async (dataInicio, dataFim) => {
  try {
    const response = await api.get('/vendas/agregado', {
      params: { start: dataInicio, end: dataFim }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar dados agregados:', error);
    throw error;
  }
};

// Obter top produtos
export const obterTopProdutos = async (period = 30) => {
  try {
    const response = await api.get('/vendas/top-produtos', { params: { period } });
    return response.data?.data || [];
  } catch (error) {
    console.error('Erro ao buscar top produtos:', error);
    return [];
  }
};


// Upload de CSV
export const uploadCSV = async (arquivo) => {
  try {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    
    const response = await api.post('/vendas/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    throw error;
  }
};

// Exportar CSV
export const exportarCSV = async (dataInicio, dataFim) => {
  try {
    const response = await api.get('/vendas/export/csv', {
      params: { start: dataInicio, end: dataFim },
      responseType: 'blob'
    });
    
    // Criar link de download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_${dataInicio}_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao exportar:', error);
    throw error;
  }
};

// Obter configurações de envio
export const obterConfigEnvio = async () => {
  try {
    const response = await api.get('/vendas/config/envio');
    return response.data;
  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    throw error;
  }
};

// Salvar configuração de envio
export const salvarConfigEnvio = async (tipoEnvio, destinatario) => {
  try {
    const response = await api.post('/vendas/config/envio', {
      tipo_envio: tipoEnvio,
      destinatario
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    throw error;
  }
};

// Remover destinatário
export const removerDestinatario = async (id) => {
  try {
    const response = await api.delete(`/vendas/config/envio/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao remover destinatário:', error);
    throw error;
  }
};

// Testar notificação
export const testarNotificacao = async (tipo, destinatario) => {
  try {
    const response = await api.post('/vendas/notificacao/testar', {
      tipo,
      destinatario
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao testar notificação:', error);
    throw error;
  }
};

export default api;