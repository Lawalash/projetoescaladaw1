import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  uploadPlanilhaEstoque,
  listarTarefasOperacionais,
  validarTarefaOperacional,
  registrarPontoColaborador,
  listarPontosColaboradores,
  criarTarefaOperacional,
  obterEquipeOperacional,
  importarPontosColaboradores
} from '../services/api';
import './styles/Dashboard.css';

const formatarNumero = (valor) => new Intl.NumberFormat('pt-BR').format(Number(valor || 0));
const formatarPercentual = (valor) => `${Number(valor || 0).toFixed(1)}%`;
const ROLE_NOMES = {
  asg: 'Serviços Gerais',
  enfermaria: 'Enfermagem',
  supervisora: 'Supervisão ASG'
};
const ESTOQUE_LABELS = {
  alimentos: 'Alimentos',
  limpeza: 'Produtos de limpeza',
  medicamentos: 'Medicamentos'
};
const formatarNomeEstoque = (tipo) => {
  if (!tipo) return '';
  const texto = tipo.replace(/_/g, ' ').trim();
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
const STATUS_LABELS = {
  concluida: 'Concluída',
  pendente: 'Pendente',
  nao_realizada: 'Não realizada'
};
const RECORRENCIA_LABELS = {
  unica: 'Única',
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal'
};
const formatarDataSimples = (valor) => {
  if (!valor) return '';
  try {
    return format(parseISO(valor), 'dd/MM/yyyy');
  } catch (error) {
    try {
      return format(new Date(valor), 'dd/MM/yyyy');
    } catch (err) {
      return valor;
    }
  }
};
const formatarDataHora = (valor) => {
  if (!valor) return '--';
  try {
    return format(new Date(valor), 'dd/MM/yyyy HH:mm');
  } catch (error) {
    return '--';
  }
};

function Dashboard({
  role = 'patrao',
  membroAtivo = null,
  membrosEquipe = [],
  onSolicitarTrocaMembro,
  onAtualizarEquipe
}) {
  const [inicio, setInicio] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [fim, setFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [painel, setPainel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadTipo, setUploadTipo] = useState('alimentos');
  const [uploadResponsavel, setUploadResponsavel] = useState('');
  const [tarefas, setTarefas] = useState([]);
  const [tarefasCarregando, setTarefasCarregando] = useState(false);
  const [tarefasErro, setTarefasErro] = useState(null);
  const [pontos, setPontos] = useState([]);
  const [pontosCarregando, setPontosCarregando] = useState(false);
  const [pontosErro, setPontosErro] = useState(null);
  const [filtroRoleTarefa, setFiltroRoleTarefa] = useState(
    role === 'patrao' ? 'asg' : role === 'supervisora' ? 'asg' : role
  );
  const [filtroMembroId, setFiltroMembroId] = useState(null);
  const [novaTarefa, setNovaTarefa] = useState(() => ({
    titulo: '',
    descricao: '',
    roleDestino: role === 'supervisora' ? 'asg' : 'asg',
    dataLimite: '',
    recorrencia: 'unica',
    destinoTipo: 'individual',
    destinatarios: []
  }));
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [equipesDirecao, setEquipesDirecao] = useState([]);
  const [equipesCarregando, setEquipesCarregando] = useState(false);
  const [equipesErro, setEquipesErro] = useState(null);
  const [registrandoPonto, setRegistrandoPonto] = useState(false);
  const [observacaoPonto, setObservacaoPonto] = useState('');
  const [tipoPonto, setTipoPonto] = useState('entrada');
  const [colaboradoresPorRole, setColaboradoresPorRole] = useState({});
  const [importandoPontos, setImportandoPontos] = useState(false);
  const [pontosImportStatus, setPontosImportStatus] = useState(null);
  const [estoqueTipoSelecionado, setEstoqueTipoSelecionado] = useState('alimentos');
  const [modoTarefas, setModoTarefas] = useState('equipe');

  const isPatrao = role === 'patrao';
  const isSupervisora = role === 'supervisora';
  const isASG = role === 'asg';
  const isEnfermaria = role === 'enfermaria';
  const podeCriarTarefas = isPatrao || isSupervisora;
  const permitirUpload = isASG;
  const permitirImportarPontos = isPatrao || isSupervisora;
  const mostrarKPIs = !isASG;
  const mostrarSaude = isPatrao || isEnfermaria;
  const mostrarMedicacao = isPatrao || isEnfermaria;
  const mostrarEstoque = isPatrao || isASG;
  const mostrarPlanilhas = isPatrao;
  const membroAtivoId = membroAtivo?.id || null;
  const membroFiltro = isPatrao || isSupervisora ? filtroMembroId : membroAtivoId;
  const colaboradorAtualNome = membroAtivo?.nome;
  const colaboradoresDisponiveis = useMemo(() => {
    if (!podeCriarTarefas) return [];
    if (isSupervisora) {
      return membrosEquipe.filter((item) => item.role === 'asg');
    }
    return colaboradoresPorRole[novaTarefa.roleDestino] || [];
  }, [
    colaboradoresPorRole,
    membrosEquipe,
    novaTarefa.roleDestino,
    podeCriarTarefas,
    isSupervisora
  ]);

  useEffect(() => {
    if (novaTarefa.destinoTipo !== 'individual') {
      setNovaTarefa((prev) => (prev.destinatarios.length ? { ...prev, destinatarios: [] } : prev));
      return;
    }

    const idsDisponiveis = new Set(colaboradoresDisponiveis.map((item) => Number(item.id)));
    setNovaTarefa((prev) => {
      const filtrados = prev.destinatarios.filter((id) => idsDisponiveis.has(Number(id)));
      if (filtrados.length === prev.destinatarios.length) {
        return prev;
      }
      return { ...prev, destinatarios: filtrados };
    });
  }, [colaboradoresDisponiveis, novaTarefa.destinoTipo]);

  useEffect(() => {
    if (novaTarefa.destinoTipo !== 'individual') return;
    if (!colaboradoresDisponiveis.length) return;

    setNovaTarefa((prev) => {
      if (prev.destinatarios.length) return prev;
      if (colaboradoresDisponiveis.length === 1) {
        return {
          ...prev,
          destinatarios: [Number(colaboradoresDisponiveis[0].id)]
        };
      }
      return prev;
    });
  }, [colaboradoresDisponiveis, novaTarefa.destinoTipo]);

  useEffect(() => {
    carregarPainel();
  }, [inicio, fim]);

  useEffect(() => {
    setModoTarefas('equipe');
  }, [role]);

  useEffect(() => {
    if (!isPatrao && !isSupervisora) {
      setFiltroRoleTarefa(role);
    }
  }, [isPatrao, isSupervisora, role]);

  useEffect(() => {
    if (!isPatrao) {
      setFiltroMembroId(membroAtivoId || null);
    }
  }, [isPatrao, membroAtivoId]);

  useEffect(() => {
    if (isPatrao && filtroRoleTarefa && filtroRoleTarefa !== 'todas') {
      setNovaTarefa((prev) => ({ ...prev, roleDestino: filtroRoleTarefa }));
    } else if (isPatrao && filtroRoleTarefa === 'todas') {
      setFiltroMembroId(null);
    }
  }, [filtroRoleTarefa, isPatrao]);

  useEffect(() => {
    if (!podeCriarTarefas) return;
    const destino = isSupervisora ? 'asg' : novaTarefa.roleDestino;
    if (!destino) return;
    if (isSupervisora && destino !== 'asg') return;
    if (colaboradoresPorRole[destino]) return;

    let ativo = true;
    obterEquipeOperacional({ role: destino })
      .then((resposta) => {
        if (!ativo) return;
        setColaboradoresPorRole((anterior) => ({
          ...anterior,
          [destino]: resposta?.membros || []
        }));
      })
      .catch((error) => {
        if (!ativo) return;
        console.error('Erro ao carregar colaboradores para criação de tarefa:', error);
      });

    return () => {
      ativo = false;
    };
  }, [colaboradoresPorRole, novaTarefa.roleDestino, podeCriarTarefas, isSupervisora]);

  useEffect(() => {
    if (!isPatrao && !isSupervisora) return;

    let ativo = true;
    setEquipesCarregando(true);
    setEquipesErro(null);

    const roleConsulta = isPatrao
      ? filtroRoleTarefa && filtroRoleTarefa !== 'todas'
        ? filtroRoleTarefa
        : undefined
      : filtroRoleTarefa;

    obterEquipeOperacional({ role: roleConsulta })
      .then((resposta) => {
        if (!ativo) return;
        const lista = resposta?.membros || [];
        setEquipesDirecao(lista);
        setFiltroMembroId((atual) => {
          if (!atual) return null;
          return lista.some((item) => Number(item.id) === Number(atual)) ? atual : null;
        });
      })
      .catch((error) => {
        if (!ativo) return;
        console.error('Erro ao carregar equipe para direção:', error);
        setEquipesErro('Não foi possível carregar os colaboradores dessa equipe.');
        setEquipesDirecao([]);
        setFiltroMembroId(null);
      })
      .finally(() => {
        if (!ativo) return;
        setEquipesCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [isPatrao, isSupervisora, filtroRoleTarefa]);

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

  const carregarTarefas = useCallback(async () => {
    setTarefasCarregando(true);
    setTarefasErro(null);

    try {
      const params = {};
      const roleConsulta = isPatrao
        ? filtroRoleTarefa && filtroRoleTarefa !== 'todas'
          ? filtroRoleTarefa
          : undefined
        : isSupervisora
          ? filtroRoleTarefa
          : role;
      if (roleConsulta) {
        params.role = roleConsulta;
      }
      if (membroFiltro) {
        params.membroId = membroFiltro;
      }

      const resposta = await listarTarefasOperacionais(params);
      setTarefas(resposta?.tarefas || []);
    } catch (error) {
      console.error('Erro ao carregar tarefas operacionais:', error);
      setTarefasErro('Não foi possível carregar as tarefas operacionais.');
    } finally {
      setTarefasCarregando(false);
    }
  }, [filtroRoleTarefa, isPatrao, membroFiltro, role]);

  const carregarPontos = useCallback(async () => {
    setPontosCarregando(true);
    setPontosErro(null);

    try {
      const params = {};
      const roleConsulta = isPatrao
        ? filtroRoleTarefa && filtroRoleTarefa !== 'todas'
          ? filtroRoleTarefa
          : undefined
        : isSupervisora
          ? filtroRoleTarefa
          : role;
      if (roleConsulta) {
        params.role = roleConsulta;
      }
      if (membroFiltro) {
        params.membroId = membroFiltro;
      }
      params.limite = isPatrao ? 50 : 20;

      const resposta = await listarPontosColaboradores(params);
      setPontos(resposta?.registros || []);
    } catch (error) {
      console.error('Erro ao carregar pontos dos colaboradores:', error);
      setPontosErro('Não foi possível carregar os registros de ponto.');
    } finally {
      setPontosCarregando(false);
    }
  }, [filtroRoleTarefa, isPatrao, membroFiltro, role]);

  useEffect(() => {
    carregarTarefas();
  }, [carregarTarefas]);

  useEffect(() => {
    carregarPontos();
  }, [carregarPontos]);

  const handleValidarTarefa = useCallback(async (tarefaId, status) => {
    const membroDestino = isPatrao || isSupervisora ? filtroMembroId : membroAtivoId;
    setTarefasErro(null);
    if (!membroDestino) {
      setTarefasErro('Selecione um colaborador para validar as atividades.');
      if (onSolicitarTrocaMembro) {
        onSolicitarTrocaMembro();
      }
      return;
    }

    try {
      const precisaObservacao = status !== 'pendente';
      const observacao = precisaObservacao
        ? window.prompt('Deseja adicionar uma observação? (opcional)', '') || ''
        : '';

      await validarTarefaOperacional({
        tarefaId,
        membroId: membroDestino,
        status,
        observacao: observacao || undefined
      });
      await carregarTarefas();
    } catch (error) {
      console.error('Erro ao validar tarefa:', error);
      setTarefasErro('Não foi possível registrar a validação da tarefa.');
    }
  }, [carregarTarefas, filtroMembroId, isPatrao, membroAtivoId, onSolicitarTrocaMembro]);

  const handleCriarTarefa = async (event) => {
    event.preventDefault();
    if (!novaTarefa.titulo.trim()) {
      setTarefasErro('Informe um título para a tarefa.');
      return;
    }

    if (
      novaTarefa.destinoTipo === 'individual' &&
      (!novaTarefa.destinatarios || !novaTarefa.destinatarios.length)
    ) {
      setTarefasErro('Selecione ao menos um colaborador para a tarefa.');
      return;
    }

    setCriandoTarefa(true);
    setTarefasErro(null);

    try {
      await criarTarefaOperacional({
        titulo: novaTarefa.titulo.trim(),
        descricao: novaTarefa.descricao.trim(),
        roleDestino: novaTarefa.roleDestino,
        dataLimite: novaTarefa.dataLimite || undefined,
        recorrencia: novaTarefa.recorrencia,
        destinoTipo: novaTarefa.destinoTipo,
        destinatarios:
          novaTarefa.destinoTipo === 'individual'
            ? novaTarefa.destinatarios.map((id) => Number(id))
            : undefined
      });

      setNovaTarefa((anterior) => ({
        ...anterior,
        titulo: '',
        descricao: '',
        dataLimite: '',
        recorrencia: 'unica',
        destinoTipo: 'individual',
        destinatarios: []
      }));

      if (isPatrao && filtroRoleTarefa !== novaTarefa.roleDestino) {
        setFiltroRoleTarefa(novaTarefa.roleDestino);
      }

      await carregarTarefas();
    } catch (error) {
      console.error('Erro ao criar tarefa operacional:', error);
      setTarefasErro('Não foi possível criar a tarefa. Verifique os campos preenchidos.');
    } finally {
      setCriandoTarefa(false);
    }
  };

  const handleRegistrarPonto = async (event) => {
    event.preventDefault();
    const membroDestino = isPatrao || isSupervisora ? filtroMembroId : membroAtivoId;
    if (!membroDestino) {
      setPontosErro('Selecione um colaborador para registrar o ponto.');
      if (onSolicitarTrocaMembro) {
        onSolicitarTrocaMembro();
      }
      return;
    }

    setRegistrandoPonto(true);
    setPontosErro(null);

    try {
      await registrarPontoColaborador({
        membroId: membroDestino,
        tipo: tipoPonto,
        observacao: observacaoPonto || undefined
      });
      setObservacaoPonto('');
      await carregarPontos();
    } catch (error) {
      console.error('Erro ao registrar ponto:', error);
      setPontosErro('Não foi possível registrar o ponto do colaborador.');
    } finally {
      setRegistrandoPonto(false);
    }
  };

  const handleImportarPontos = async (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setImportandoPontos(true);
    setPontosImportStatus(null);

    try {
      const resposta = await importarPontosColaboradores({ arquivo });
      const mensagemSucesso = `Importados ${resposta.importados || 0} de ${resposta.totalPlanilha || 0} registros.`;
      setPontosImportStatus({ tipo: 'sucesso', mensagem: mensagemSucesso });
      await carregarPontos();
    } catch (error) {
      console.error('Erro ao importar planilha de pontos:', error);
      const mensagemErro = error?.response?.data?.error || 'Não foi possível importar a planilha de pontos.';
      setPontosImportStatus({ tipo: 'erro', mensagem: mensagemErro });
    } finally {
      setImportandoPontos(false);
      // eslint-disable-next-line no-param-reassign
      event.target.value = '';
    }
  };

  const tarefasVisiveis = useMemo(() => {
    if (!tarefas.length) return [];
    if (isSupervisora) {
      if (modoTarefas === 'pessoais') {
        return tarefas.filter((tarefa) => tarefa.roleDestino === 'supervisora');
      }
      return tarefas;
    }

    if (!isPatrao && modoTarefas === 'pessoais') {
      if (!membroAtivoId) return [];
      return tarefas.filter((tarefa) =>
        tarefa.destinatarios?.some((destinatario) => Number(destinatario.membroId) === Number(membroAtivoId))
      );
    }

    return tarefas;
  }, [isPatrao, isSupervisora, membroAtivoId, modoTarefas, tarefas]);

  const resumoTarefas = useMemo(() => {
    if (!tarefasVisiveis.length) {
      return { total: 0, concluidas: 0, pendentes: 0 };
    }

    if (isPatrao) {
      const concluidas = tarefasVisiveis.filter((tarefa) => Number(tarefa.totalConcluidas || 0) > 0).length;
      return {
        total: tarefasVisiveis.length,
        concluidas,
        pendentes: tarefasVisiveis.length - concluidas
      };
    }

    const concluidas = tarefasVisiveis.filter((tarefa) => tarefa.validacaoAtual?.status === 'concluida').length;
    return {
      total: tarefasVisiveis.length,
      concluidas,
      pendentes: tarefasVisiveis.length - concluidas
    };
  }, [isPatrao, tarefasVisiveis]);

  const obterStatusTarefa = useCallback((tarefa) => {
    if (isPatrao) {
      return Number(tarefa.totalConcluidas || 0) > 0 ? 'concluida' : 'pendente';
    }
    return tarefa.validacaoAtual?.status || 'pendente';
  }, [isPatrao]);

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
        mensagem: `${resposta.inseridos} registros importados com sucesso.`
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
      categoria: item.categoria,
      cobertura: item.coberturaDias || 0,
      tipo: 'Alimentos'
    })) || [];

    const limpeza = painel.inventario.limpeza?.map((item) => ({
      categoria: item.categoria,
      cobertura: item.coberturaDias || 0,
      tipo: 'Limpeza'
    })) || [];

    return [...alimentos, ...limpeza];
  }, [painel]);

  const inventarioResumo = useMemo(() => {
    const calcular = (lista = []) => {
      if (!lista.length) {
        return { coberturaMedia: 0, itensCriticos: 0 };
      }

      const coberturaValida = lista
        .map((item) => Number(item.coberturaDias || 0))
        .filter((valor) => Number.isFinite(valor));

      const somaCobertura = coberturaValida.reduce((acc, valor) => acc + valor, 0);
      const itensCriticos = lista.reduce((acc, item) => acc + Number(item.itensCriticos || 0), 0);

      return {
        coberturaMedia: coberturaValida.length ? Number((somaCobertura / coberturaValida.length).toFixed(1)) : 0,
        itensCriticos
      };
    };

    return {
      alimentos: calcular(painel?.inventario?.alimentos || []),
      limpeza: calcular(painel?.inventario?.limpeza || [])
    };
  }, [painel]);

  const inventarioDetalhado = useMemo(() => {
    const normalizar = (lista = []) =>
      lista.map((item) => {
        const quantidadeAtual = Number(item.quantidadeAtual ?? item.quantidade_atual ?? 0);
        const consumoDiario = Number(item.consumoDiario ?? item.consumo_diario ?? 0);
        const coberturaDireta = item.coberturaDias ?? item.cobertura_dias;
        const coberturaCalculada =
          consumoDiario > 0 && Number.isFinite(consumoDiario)
            ? Number((quantidadeAtual / consumoDiario).toFixed(1))
            : null;

        return {
          categoria: item.categoria || 'Sem categoria',
          nome: item.nome || item.nome_item,
          unidade: item.unidade || '',
          quantidadeAtual: Number.isFinite(quantidadeAtual) ? quantidadeAtual : 0,
          consumoDiario: Number.isFinite(consumoDiario) ? consumoDiario : 0,
          coberturaDias:
            coberturaDireta !== undefined && coberturaDireta !== null
              ? Number(coberturaDireta)
              : coberturaCalculada,
          validade: item.validade || null,
          fornecedor: item.fornecedor || '',
          lote: item.lote || '',
          observacoes: item.observacoes || '',
          atualizadoEm: item.atualizadoEm || item.atualizado_em || null
        };
      });

    const tiposDisponiveis = Object.keys(painel?.inventarioDetalhado || {});
    const resultado = tiposDisponiveis.reduce((acc, tipo) => {
      acc[tipo] = normalizar(painel.inventarioDetalhado?.[tipo] || []);
      return acc;
    }, {});

    if (!resultado.alimentos) {
      resultado.alimentos = normalizar(painel?.inventarioDetalhado?.alimentos || []);
    }

    if (!resultado.limpeza) {
      resultado.limpeza = normalizar(painel?.inventarioDetalhado?.limpeza || []);
    }

    return resultado;
  }, [painel]);

  const estoqueAgrupadoPorCategoria = useMemo(() => {
    const agrupar = (lista = []) => {
      const mapa = new Map();

      lista.forEach((item) => {
        const chave = item.categoria || 'Sem categoria';
        if (!mapa.has(chave)) {
          mapa.set(chave, {
            categoria: chave,
            itens: [],
            totalQuantidade: 0
          });
        }

        const grupo = mapa.get(chave);
        grupo.itens.push(item);
        grupo.totalQuantidade += Number(item.quantidadeAtual || 0);
      });

      return Array.from(mapa.values()).map((grupo) => ({
        ...grupo,
        totalQuantidade: Number(grupo.totalQuantidade.toFixed(2)),
        itens: grupo.itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      }));
    };

    return Object.entries(inventarioDetalhado).reduce((acc, [tipo, lista]) => {
      acc[tipo] = agrupar(lista);
      return acc;
    }, {});
  }, [inventarioDetalhado]);

  const totalItensPorTipo = useMemo(() => {
    const totais = {};
    Object.entries(estoqueAgrupadoPorCategoria).forEach(([tipo, grupos]) => {
      totais[tipo] = grupos.reduce((acc, grupo) => acc + grupo.itens.length, 0);
    });
    return totais;
  }, [estoqueAgrupadoPorCategoria]);

  const estoqueDetalheSelecionado = estoqueAgrupadoPorCategoria[estoqueTipoSelecionado] || [];

  const estoqueVisaoASG = useMemo(() => {
    if (!isASG) return [];
    return Object.entries(estoqueAgrupadoPorCategoria).map(([tipo, grupos]) => {
      const destaque = grupos
        .slice()
        .sort((a, b) => b.totalQuantidade - a.totalQuantidade)
        .map((grupo) => ({
          categoria: grupo.categoria,
          quantidade: grupo.totalQuantidade,
          itensMonitorados: grupo.itens.length
        }))
        .slice(0, 4);

      return {
        tipo,
        nome: ESTOQUE_LABELS[tipo] || formatarNomeEstoque(tipo),
        totalCategorias: grupos.length,
        destaque
      };
    });
  }, [estoqueAgrupadoPorCategoria, isASG]);

  useEffect(() => {
    const tipos = Object.keys(estoqueAgrupadoPorCategoria);
    if (!tipos.length) return;

    const atualDisponivel = estoqueAgrupadoPorCategoria[estoqueTipoSelecionado]?.length;
    if (!atualDisponivel) {
      const primeiroDisponivel = tipos.find((tipo) => estoqueAgrupadoPorCategoria[tipo].length);
      if (primeiroDisponivel && primeiroDisponivel !== estoqueTipoSelecionado) {
        setEstoqueTipoSelecionado(primeiroDisponivel);
      }
    }
  }, [estoqueAgrupadoPorCategoria, estoqueTipoSelecionado]);

  const cronogramaResumo = useMemo(() => {
    if (!painel?.cronograma || !painel.cronograma.length) {
      return [];
    }

    const mapa = new Map();

    painel.cronograma.forEach((item) => {
      const chave = item.tipo || 'Atividades';
      const existente = mapa.get(chave) || {
        tipo: chave,
        quantidade: 0,
        responsaveis: new Set()
      };

      existente.quantidade += 1;
      if (item.responsavel) {
        existente.responsaveis.add(item.responsavel);
      }

      mapa.set(chave, existente);
    });

    return Array.from(mapa.values()).map((registro) => ({
      tipo: registro.tipo,
      quantidade: registro.quantidade,
      responsaveis: registro.responsaveis.size ? Array.from(registro.responsaveis).join(', ') : 'Equipe'
    }));
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
            Atualizar
          </button>
        </div>

        {permitirUpload && (
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
                Enviar planilha
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} />
              </label>
          </div>
        )}
      </div>

      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.status}`}>{uploadStatus.mensagem}</div>
      )}

      {erro && <div className="erro-box">{erro}</div>}

      {painel && (
        <>
          {!isASG && (
            <>
              {mostrarKPIs && (
                <section className="kpis">
                  <article className="kpi-card">
                    <header>
                      <span className="kpi-card__titulo">Residentes ativos</span>
                      <strong className="kpi-card__valor">{formatarNumero(painel.resumo?.residentesAtivos)}</strong>
                    </header>
                    <p>{formatarNumero(painel.resumo?.residentesObservacao)} em observação</p>
                  </article>

                  <article className="kpi-card">
                    <header>
                      <span className="kpi-card__titulo">Taxa de ocupação</span>
                      <strong className="kpi-card__valor">{formatarPercentual(painel.resumo?.taxaOcupacao)}</strong>
                    </header>
                    <p>{formatarNumero(painel.resumo?.residentesInternados)} residentes internados</p>
                  </article>

                  <article className="kpi-card">
                    <header>
                      <span className="kpi-card__titulo">Adesão à medicação</span>
                      <strong className="kpi-card__valor">{formatarPercentual(painel.resumo?.taxaMedicacao)}</strong>
                    </header>
                    <p>{formatarNumero(painel.resumo?.incidentesClinicos)} incidentes clínicos</p>
                  </article>

                  <article className="kpi-card">
                    <header>
                      <span className="kpi-card__titulo">Bem-estar médio</span>
                      <strong className="kpi-card__valor">{Number(painel.resumo?.bemEstarMedio || 0).toFixed(1)}</strong>
                    </header>
                    <p>Taxa de óbito {formatarPercentual(painel.resumo?.taxaObito)}</p>
                  </article>
                </section>
              )}

              <section className="cards-secundarios">
                <div className="card pequeno">
                  <h3>Próxima consulta médica</h3>
                  <p>{painel.resumo?.proximaConsulta ? format(parseISO(painel.resumo.proximaConsulta), 'dd/MM/yyyy') : 'Sem registro'}</p>
                </div>
                <div className="card pequeno">
                  <h3>Encontros familiares</h3>
                  <p>{formatarNumero(painel.resumo?.encontrosFamiliares)}</p>
                </div>
                <div className="card pequeno">
                  <h3>Atendimentos clínicos</h3>
                  <p>{formatarNumero(painel.resumo?.atendimentosClinicos)}</p>
                </div>
                <div className="card pequeno">
                  <h3>Internações no período</h3>
                  <p>{formatarNumero(painel.resumo?.internacoesPeriodo)}</p>
                </div>
              </section>
            </>
          )}

          <section className="operacional-controles">
            <div className="operacional-card">
              <div className="operacional-card__header">
                <div>
                  <h3>Validação de atividades</h3>
                  <p>Acompanhe as rotinas lançadas pelo gestor e confirme as entregas da equipe.</p>
                </div>
                {(isPatrao || isSupervisora) && (
                  <div className="operacional-card__filtros">
                    <label>
                      Equipe
                      <select value={filtroRoleTarefa} onChange={(event) => setFiltroRoleTarefa(event.target.value)}>
                        <option value="asg">Serviços Gerais</option>
                        {(isPatrao || isSupervisora) && <option value="supervisora">Supervisão ASG</option>}
                        {isPatrao && <option value="enfermaria">Enfermagem</option>}
                        {isPatrao && <option value="todas">Todas as equipes</option>}
                      </select>
                    </label>
                    <label>
                      Colaborador
                      <select
                        value={filtroMembroId || ''}
                        onChange={(event) =>
                          setFiltroMembroId(event.target.value ? Number(event.target.value) : null)
                        }
                        disabled={
                          (isPatrao && filtroRoleTarefa === 'todas') ||
                          equipesCarregando ||
                          !equipesDirecao.length
                        }
                      >
                        <option value="">Todos</option>
                        {equipesDirecao.map((membro) => (
                          <option key={membro.id} value={membro.id}>
                            {membro.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={carregarTarefas}
                      disabled={tarefasCarregando}
                    >
                      Atualizar
                    </button>
                  </div>
                )}
              </div>

              <div className="operacional-card__meta">
                <span>
                  <strong>{resumoTarefas.concluidas}</strong> concluídas
                </span>
                <span>
                  <strong>{resumoTarefas.pendentes}</strong> pendentes
                </span>
                {colaboradorAtualNome && <span>Colaborador ativo: {colaboradorAtualNome}</span>}

                {isSupervisora ? (
                  <div className="tarefas-toggle">
                    <button
                      type="button"
                      className={modoTarefas === 'equipe' ? 'ativo' : ''}
                      onClick={() => setModoTarefas('equipe')}
                    >
                      Visão da equipe
                    </button>
                    <button
                      type="button"
                      className={modoTarefas === 'pessoais' ? 'ativo' : ''}
                      onClick={() => setModoTarefas('pessoais')}
                    >
                      Atribuídas a mim
                    </button>
                  </div>
                ) : (
                  <div className="operacional-card__acoes">
                    {onSolicitarTrocaMembro && (
                      <button type="button" className="secondary-button" onClick={onSolicitarTrocaMembro}>
                        Trocar colaborador
                      </button>
                    )}
                    {onAtualizarEquipe && (
                      <button type="button" className="secondary-button" onClick={onAtualizarEquipe}>
                        Atualizar equipe
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isPatrao && equipesErro && <div className="alerta erro">{equipesErro}</div>}
              {tarefasErro && <div className="alerta erro">{tarefasErro}</div>}

              {tarefasCarregando ? (
                <div className="estado-carregando">Carregando tarefas...</div>
              ) : tarefasVisiveis.length ? (
                <ul className="lista-tarefas">
                  {tarefasVisiveis.map((tarefa) => {
                    const status = obterStatusTarefa(tarefa);
                    const statusLabel = STATUS_LABELS[status] || status;
                    const dataLimiteFormatada = formatarDataSimples(tarefa.dataLimite);
                    const recorrenciaLabel = RECORRENCIA_LABELS[tarefa.recorrencia] || 'Única';
                    const destinoResumo =
                      tarefa.destinoTipo === 'equipe'
                        ? 'Aplicação: equipe completa'
                        : `Aplicação: ${tarefa.destinatarios?.length || 0} colaborador(es)`;
                    return (
                      <li key={tarefa.id} className={`tarefa-card tarefa-card--${status}`}>
                        <div className="tarefa-card__info">
                          <h4>{tarefa.titulo}</h4>
                          {tarefa.descricao && <p>{tarefa.descricao}</p>}
                          <div className="tarefa-card__meta">
                            <span>{ROLE_NOMES[tarefa.roleDestino] || tarefa.roleDestino}</span>
                            <span>{recorrenciaLabel}</span>
                            <span>{destinoResumo}</span>
                            {dataLimiteFormatada && <span>Limite: {dataLimiteFormatada}</span>}
                          </div>
                          {tarefa.destinatarios && tarefa.destinatarios.length > 0 && (
                            <div className="tarefa-card__destinatarios">
                              {tarefa.destinatarios.map((destinatario) => (
                                <span
                                  key={`${tarefa.id}-${destinatario.membroId || destinatario.nome}`}
                                  className={`tarefa-chip tarefa-chip--${destinatario.status || 'pendente'}`}
                                >
                                  {destinatario.nome || 'Equipe'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="tarefa-card__acoes">
                          <span className={`tarefa-status tarefa-status--${status}`}>{statusLabel}</span>
                          {isPatrao ? (
                            <div className="tarefa-card__validacoes">
                              {tarefa.validacoes && tarefa.validacoes.length ? (
                                tarefa.validacoes.map((item) => (
                                  <div key={`${item.tarefaId}-${item.membroId}`} className="tarefa-card__validacao-item">
                                    <strong>{item.membroNome || 'Equipe'}</strong>
                                    <span>{STATUS_LABELS[item.status] || item.status}</span>
                                    {item.concluidoEm && <span>{formatarDataHora(item.concluidoEm)}</span>}
                                    {item.observacao && <p>{item.observacao}</p>}
                                  </div>
                                ))
                              ) : (
                                <div className="tarefa-card__validacao-item vazio">Nenhuma validação registrada.</div>
                              )}
                            </div>
                          ) : (
                            <div className="tarefa-card__botoes">
                              <button type="button" onClick={() => handleValidarTarefa(tarefa.id, 'concluida')}>
                                Confirmar entrega
                              </button>
                              {status === 'concluida' && (
                                <button type="button" onClick={() => handleValidarTarefa(tarefa.id, 'pendente')}>
                                  Reabrir
                                </button>
                              )}
                              <button type="button" onClick={() => handleValidarTarefa(tarefa.id, 'nao_realizada')}>
                                Reportar impedimento
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="operacional-card__vazio">
                  {isPatrao
                    ? 'Nenhuma tarefa cadastrada para esta equipe.'
                    : 'Nenhuma tarefa pendente para este colaborador.'}
                </div>
              )}

              {podeCriarTarefas && (
                <form className="form-nova-tarefa" onSubmit={handleCriarTarefa}>
                  <h4>{isPatrao ? 'Nova tarefa para a equipe' : 'Designar rotina para a equipe ASG'}</h4>
                  <div className="form-nova-tarefa__grid">
                    <div>
                      <label htmlFor="tarefa-titulo">Título</label>
                      <input
                        id="tarefa-titulo"
                        type="text"
                        value={novaTarefa.titulo}
                        onChange={(event) => setNovaTarefa((prev) => ({ ...prev, titulo: event.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="tarefa-equipe">Equipe</label>
                      <select
                        id="tarefa-equipe"
                        value={novaTarefa.roleDestino}
                        onChange={(event) =>
                          setNovaTarefa((prev) => ({ ...prev, roleDestino: event.target.value }))
                        }
                        disabled={isSupervisora}
                      >
                        <option value="asg">Serviços Gerais</option>
                        <option value="enfermaria">Enfermagem</option>
                        {isPatrao && <option value="supervisora">Supervisão ASG</option>}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tarefa-recorrencia">Recorrência</label>
                      <select
                        id="tarefa-recorrencia"
                        value={novaTarefa.recorrencia}
                        onChange={(event) =>
                          setNovaTarefa((prev) => ({ ...prev, recorrencia: event.target.value }))
                        }
                      >
                        <option value="unica">Única</option>
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tarefa-destino">Aplicação</label>
                      <select
                        id="tarefa-destino"
                        value={novaTarefa.destinoTipo}
                        onChange={(event) =>
                          setNovaTarefa((prev) => ({ ...prev, destinoTipo: event.target.value }))
                        }
                      >
                        <option value="individual">Por colaborador</option>
                        <option value="equipe">Toda a equipe</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tarefa-limite">Data limite</label>
                      <input
                        id="tarefa-limite"
                        type="date"
                        value={novaTarefa.dataLimite}
                        onChange={(event) => setNovaTarefa((prev) => ({ ...prev, dataLimite: event.target.value }))}
                      />
                    </div>
                    {novaTarefa.destinoTipo === 'individual' && (
                      <div className="form-nova-tarefa__full">
                        <label htmlFor="tarefa-destinatarios">Colaboradores</label>
                        {colaboradoresDisponiveis.length ? (
                          <div className="destinatarios-lista" role="group" aria-labelledby="tarefa-destinatarios">
                            {colaboradoresDisponiveis.map((membro) => {
                              const idNumero = Number(membro.id);
                              const selecionado = novaTarefa.destinatarios.includes(idNumero);
                              return (
                                <label key={membro.id} className="destinatarios-item">
                                  <input
                                    type="checkbox"
                                    checked={selecionado}
                                    onChange={() =>
                                      setNovaTarefa((prev) => {
                                        const presente = prev.destinatarios.includes(idNumero);
                                        const lista = presente
                                          ? prev.destinatarios.filter((valor) => valor !== idNumero)
                                          : [...prev.destinatarios, idNumero];
                                        return { ...prev, destinatarios: lista };
                                      })
                                    }
                                  />
                                  <span>{membro.nome}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="texto-suporte">Nenhum colaborador disponível para seleção.</div>
                        )}
                      </div>
                    )}
                    {novaTarefa.destinoTipo === 'equipe' && (
                      <div className="form-nova-tarefa__full texto-suporte">
                        Esta tarefa será distribuída automaticamente para todos os membros ativos da equipe.
                      </div>
                    )}
                    <div className="form-nova-tarefa__full">
                      <label htmlFor="tarefa-descricao">Descrição</label>
                      <textarea
                        id="tarefa-descricao"
                        rows={3}
                        value={novaTarefa.descricao}
                        onChange={(event) => setNovaTarefa((prev) => ({ ...prev, descricao: event.target.value }))}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primaria" disabled={criandoTarefa}>
                    {criandoTarefa ? 'Salvando...' : 'Adicionar tarefa'}
                  </button>
                </form>
              )}
            </div>

            <div className="operacional-card">
              <div className="operacional-card__header">
                <div>
                  <h3>Registro de ponto</h3>
                  <p>Registre entradas, saídas e contingências para manter o histórico atualizado da equipe.</p>
                </div>
                {!isPatrao && colaboradorAtualNome && (
                  <span className="operacional-card__colaborador">Colaborador ativo: {colaboradorAtualNome}</span>
                )}
              </div>

              {permitirImportarPontos && (
                <div className="importacao-pontos">
                  <label className="secondary-button" htmlFor="input-importar-pontos">
                    {importandoPontos ? 'Importando...' : 'Importar planilha de pontos'}
                  </label>
                  <input
                    id="input-importar-pontos"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportarPontos}
                    disabled={importandoPontos}
                    hidden
                  />
                </div>
              )}

              {pontosImportStatus && (
                <div className={`alerta ${pontosImportStatus.tipo === 'erro' ? 'erro' : 'sucesso'}`}>
                  {pontosImportStatus.mensagem}
                </div>
              )}

              {pontosErro && <div className="alerta erro">{pontosErro}</div>}

              <form className="form-ponto" onSubmit={handleRegistrarPonto}>
                <div className="form-ponto__grid">
                  <div>
                    <label htmlFor="ponto-tipo">Tipo de registro</label>
                    <select id="ponto-tipo" value={tipoPonto} onChange={(event) => setTipoPonto(event.target.value)}>
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                  </div>
                  <div className="form-ponto__observacao">
                    <label htmlFor="ponto-observacao">Observação (opcional)</label>
                    <input
                      id="ponto-observacao"
                      type="text"
                      placeholder="Ex.: cobertura extra ou visita externa"
                      value={observacaoPonto}
                      onChange={(event) => setObservacaoPonto(event.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn-primaria"
                  disabled={registrandoPonto || (isPatrao && !filtroMembroId)}
                >
                  {registrandoPonto ? 'Registrando...' : 'Registrar ponto'}
                </button>
              </form>

              {pontosCarregando ? (
                <div className="estado-carregando">Carregando registros...</div>
              ) : pontos.length ? (
                <div className="lista-pontos__container">
                  <ul className="lista-pontos">
                    {pontos.map((registro) => (
                      <li key={registro.id} className={`ponto-item ponto-item--${registro.tipo}`}>
                        <div className="ponto-item__cabecalho">
                          <strong>{registro.membroNome || 'Equipe'}</strong>
                          <span>{ROLE_NOMES[registro.role] || 'Equipe'}</span>
                        </div>
                        <div className="ponto-item__meta">
                          <span>{formatarDataHora(registro.registradoEm)}</span>
                          <span className={`tag-ponto tag-ponto--${registro.tipo}`}>{registro.tipo}</span>
                        </div>
                        {registro.usuarioNome && (
                          <span className="ponto-item__registrado-por">
                            Registrado por {registro.usuarioNome}
                          </span>
                        )}
                        {registro.observacao && <p>{registro.observacao}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="operacional-card__vazio">Nenhum registro de ponto no período selecionado.</div>
              )}
            </div>
          </section>

          <section className="graficos-grid">
            {mostrarSaude && (
              <div className="grafico-card">
                <div className="grafico-header">
                  <h3>Tendências de saúde diária</h3>
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
            )}

            {mostrarSaude && (
              <div className="grafico-card">
                <div className="grafico-header">
                  <h3>Óbitos e internações por mês</h3>
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
            )}

            {mostrarSaude && (
              <div className="grafico-card">
                <div className="grafico-header">
                  <h3>Evolução semanal da ocupação</h3>
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
            )}

            {mostrarMedicacao && (
              <div className="grafico-card">
                <div className="grafico-header">
                  <h3>Adesão à medicação por ala</h3>
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
            )}

            {mostrarEstoque && (
              <>
                {isASG ? (
                  <section className="estoque-simples">
                    {estoqueVisaoASG.length ? (
                      estoqueVisaoASG.map((grupo) => (
                        <article key={grupo.tipo} className="estoque-simples__card">
                          <header>
                            <div>
                              <h4>{grupo.nome}</h4>
                              <span>{grupo.totalCategorias} categorias monitoradas</span>
                            </div>
                          </header>
                          <ul>
                            {grupo.destaque.map((categoria) => (
                              <li key={`${grupo.tipo}-${categoria.categoria}`}>
                                <strong>{categoria.categoria}</strong>
                                <span>{formatarNumero(categoria.quantidade)} unidades</span>
                                <small>{categoria.itensMonitorados} itens cadastrados</small>
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))
                    ) : (
                      <div className="estoque-simples__vazio">Nenhum estoque disponível para o período.</div>
                    )}
                  </section>
                ) : (
                  <div className="grafico-card">
                    <div className="grafico-header">
                      <h3>Cobertura de estoques</h3>
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
                )}

                <div className="grafico-card alertas">
                  <div className="grafico-header">
                    <h3>Alertas ativos</h3>
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
              </>
            )}
          </section>

          {isPatrao && (
            <section className="estoque-detalhado">
              <div className="estoque-detalhado__header">
                <div>
                  <h3>Estoque detalhado por seção</h3>
                  <p>Visualize a disponibilidade de cada item agrupado por categoria operacional.</p>
                </div>
                <div className="estoque-detalhado__resumo">
                  <span>
                    {totalItensPorTipo[estoqueTipoSelecionado] || 0} itens monitorados ·{' '}
                    {estoqueDetalheSelecionado.length} seções
                  </span>
                </div>
              </div>

              <div className="estoque-detalhado__tabs">
                {Object.keys(estoqueAgrupadoPorCategoria).map((tipo) => (
                  <button
                    type="button"
                    key={tipo}
                    className={
                      estoqueTipoSelecionado === tipo
                        ? 'estoque-detalhado__tab ativo'
                        : 'estoque-detalhado__tab'
                    }
                    onClick={() => setEstoqueTipoSelecionado(tipo)}
                  >
                    {ESTOQUE_LABELS[tipo] || formatarNomeEstoque(tipo)}
                  </button>
                ))}
              </div>

              {estoqueDetalheSelecionado.length ? (
                <div className="estoque-detalhado__grid">
                  {estoqueDetalheSelecionado.map((categoria) => {
                    const categoriaCritica = categoria.itens.some(
                      (item) =>
                        Number(item.quantidadeAtual || 0) <= 0 ||
                        (item.coberturaDias !== null &&
                          item.coberturaDias !== undefined &&
                          Number(item.coberturaDias) <= 2)
                    );

                    return (
                      <article
                        key={`${estoqueTipoSelecionado}-${categoria.categoria}`}
                        className={
                          categoriaCritica
                            ? 'estoque-detalhado__card critico'
                            : 'estoque-detalhado__card'
                        }
                      >
                        <header className="estoque-detalhado__card-header">
                          <div>
                            <h4>{categoria.categoria}</h4>
                            <span>{categoria.itens.length} itens acompanhados</span>
                          </div>
                          {categoriaCritica && <span className="estoque-detalhado__badge">atenção</span>}
                        </header>

                        <div className="estoque-tabela__container">
                          <table className="estoque-tabela">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Quantidade</th>
                                <th>Cobertura</th>
                                <th>Validade</th>
                                <th>Fornecedor</th>
                                <th>Lote</th>
                                <th>Observações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoria.itens.map((item) => {
                                const itemCritico =
                                  Number(item.quantidadeAtual || 0) <= 0 ||
                                  (item.coberturaDias !== null &&
                                    item.coberturaDias !== undefined &&
                                    Number(item.coberturaDias) <= 2);

                                return (
                                  <tr key={`${categoria.categoria}-${item.nome}`} className={itemCritico ? 'critico' : ''}>
                                    <td>{item.nome}</td>
                                    <td>
                                      {formatarNumero(item.quantidadeAtual)}
                                      {item.unidade ? ` ${item.unidade}` : ''}
                                    </td>
                                    <td>
                                      {item.coberturaDias !== null && item.coberturaDias !== undefined
                                        ? `${item.coberturaDias} dias`
                                        : 'Sem previsão'}
                                    </td>
                                    <td>{item.validade ? formatarDataSimples(item.validade) : '—'}</td>
                                    <td>{item.fornecedor || '—'}</td>
                                    <td>{item.lote || '—'}</td>
                                    <td>{item.observacoes || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="estoque-detalhado__vazio">
                  <p>Nenhum item cadastrado para este tipo de estoque.</p>
                  <button
                    type="button"
                    className="estoque-detalhado__alternar"
                    onClick={() =>
                      setEstoqueTipoSelecionado((tipoAtual) =>
                        tipoAtual === 'alimentos' ? 'limpeza' : 'alimentos'
                      )
                    }
                  >
                    Ver outra seção
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="cronograma-inventario">
            <div className="card cronograma">
              <h3>Cronograma de atividades</h3>
              {cronogramaResumo.length > 0 && (
                <div className="cronograma-resumo">
                  <table>
                    <thead>
                      <tr>
                        <th>Grupo</th>
                        <th>Atividades no período</th>
                        <th>Responsáveis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cronogramaResumo.map((linha) => (
                        <tr key={linha.tipo}>
                          <td>{linha.tipo}</td>
                          <td>{linha.quantidade}</td>
                          <td>{linha.responsaveis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

            {mostrarPlanilhas && (
              <div className="card planilhas">
                <h3>Planilhas anexadas recentemente</h3>
                <ul>
                  {painel.planilhas && painel.planilhas.length > 0 ? (
                    painel.planilhas.map((planilha) => {
                      const nomeArquivo =
                        planilha.nome || planilha.nome_original || planilha.nomeOriginal || 'Planilha enviada';

                      return (
                        <li key={planilha.id}>
                          <div>
                            <strong>{nomeArquivo}</strong>
                            <span>Enviado por {planilha.enviadoPor || 'Equipe'}</span>
                          </div>
                          <a href={`/${planilha.caminho}`} download>
                            Baixar arquivo
                          </a>
                        </li>
                      );
                    })
                  ) : (
                    <li className="planilha-vazia">Nenhuma planilha enviada ainda.</li>
                  )}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default Dashboard;
