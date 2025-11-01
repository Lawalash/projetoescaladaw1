import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const login = async ({ email, senha }) => {
  const response = await api.post('/auth/login', { email, senha });
  return response.data;
};

export const obterPainelCompleto = async (inicio, fim) => {
  const params = {};
  if (inicio) params.start = inicio;
  if (fim) params.end = fim;

  const response = await api.get('/lar/painel', {
    params
  });
  return response.data;
};

export const uploadPlanilhaEstoque = async ({ arquivo, tipo, responsavel }) => {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (tipo) formData.append('tipo', tipo);
  if (responsavel) formData.append('responsavel', responsavel);

  const response = await api.post('/lar/inventario/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

export const obterConfigNotificacoes = async () => {
  const response = await api.get('/lar/config/notificacoes');
  return response.data;
};

export const salvarConfigNotificacao = async ({ tipoEnvio, destinatario, responsavel }) => {
  const response = await api.post('/lar/config/notificacoes', {
    tipo_envio: tipoEnvio,
    destinatario,
    responsavel
  });
  return response.data;
};

export const removerNotificacao = async (id) => {
  const response = await api.delete(`/lar/config/notificacoes/${id}`);
  return response.data;
};

export const testarNotificacao = async ({ tipo, destinatario }) => {
  const response = await api.post('/lar/notificacoes/testar', {
    tipo,
    destinatario
  });
  return response.data;
};

export const obterEquipeOperacional = async ({ role } = {}) => {
  const response = await api.get('/lar/equipe', {
    params: role ? { role } : {}
  });
  return response.data;
};

export const listarTarefasOperacionais = async ({ role, membroId } = {}) => {
  const params = {};
  if (role) params.role = role;
  if (membroId) params.membroId = membroId;

  const response = await api.get('/lar/tarefas', { params });
  return response.data;
};

export const criarTarefaOperacional = async ({
  titulo,
  descricao,
  roleDestino,
  dataLimite,
  documentoUrl,
  recorrencia,
  destinoTipo,
  destinatarios
}) => {
  const response = await api.post('/lar/tarefas', {
    titulo,
    descricao,
    roleDestino,
    dataLimite,
    documentoUrl,
    recorrencia,
    destinoTipo,
    destinatarios
  });
  return response.data;
};

export const validarTarefaOperacional = async ({ tarefaId, membroId, status, observacao, anexoUrl }) => {
  const response = await api.patch(`/lar/tarefas/${tarefaId}/validar`, {
    membroId,
    status,
    observacao,
    anexoUrl
  });
  return response.data;
};

export const registrarPontoColaborador = async ({ membroId, tipo, observacao, dataHora }) => {
  const response = await api.post('/lar/pontos', {
    membroId,
    tipo,
    observacao,
    dataHora
  });
  return response.data;
};

export const listarPontosColaboradores = async ({ role, membroId, limite } = {}) => {
  const params = {};
  if (role) params.role = role;
  if (membroId) params.membroId = membroId;
  if (limite) params.limite = limite;

  const response = await api.get('/lar/pontos', { params });
  return response.data;
};

export const importarPontosColaboradores = async ({ arquivo }) => {
  const formData = new FormData();
  formData.append('arquivo', arquivo);

  const response = await api.post('/lar/pontos/importar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

export default api;