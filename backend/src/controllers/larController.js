const { query } = require('../db/connection');
const etlService = require('../services/etlService');
const notificationService = require('../services/notificationService');
const operacionalService = require('../services/operacionalService');

function formatarDataISO(date) {
  return date.toISOString().slice(0, 10);
}

function obterPeriodoPadrao(start, end) {
  const hoje = new Date();
  const fim = end ? new Date(end) : hoje;
  const inicio = start ? new Date(start) : new Date(fim);

  if (!start) {
    inicio.setDate(fim.getDate() - 29);
  }

  return {
    inicio: formatarDataISO(inicio),
    fim: formatarDataISO(fim)
  };
}

function numeroOuZero(valor, casas = 2) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return 0;
  }
  return Number.parseFloat(valor).toFixed(casas);
}

function normalizarFloat(valor) {
  if (valor === null || valor === undefined) {
    return 0;
  }
  return Number.parseFloat(valor);
}

exports.obterPainelCompleto = async (req, res) => {
  try {
    const { inicio, fim } = obterPeriodoPadrao(req.query.start, req.query.end);

    const [resumoBase] = await query(
      `
      SELECT
        (SELECT COUNT(*) FROM residentes WHERE status IN ('ativo','observacao')) AS residentesAtivos,
        (SELECT COUNT(*) FROM residentes WHERE status = 'observacao') AS residentesObservacao,
        (SELECT COUNT(*) FROM residentes WHERE status = 'internado') AS residentesInternados,
        (SELECT COUNT(*) FROM leitos) AS totalLeitos,
        (SELECT SUM(CASE WHEN ocupado = 1 THEN 1 ELSE 0 END) FROM leitos) AS leitosOcupados,
        (SELECT AVG(TIMESTAMPDIFF(YEAR, data_nascimento, CURDATE())) FROM residentes WHERE status IN ('ativo','observacao')) AS idadeMedia,
        (SELECT COALESCE(AVG(taxa_aderencia),0) FROM metricas_medicacao WHERE data_ref BETWEEN ? AND ?) AS taxaMedicacao,
        (SELECT COALESCE(SUM(obitos),0) FROM metricas_saude WHERE data_ref BETWEEN ? AND ?) AS obitosPeriodo,
        (SELECT COALESCE(SUM(incidentes_clinicos),0) FROM metricas_saude WHERE data_ref BETWEEN ? AND ?) AS incidentesClinicos,
        (SELECT MIN(data_agendada) FROM consultas_medicas WHERE data_agendada >= CURDATE()) AS proximaConsulta,
        (SELECT COALESCE(AVG(pontuacao_bem_estar),0) FROM metricas_saude WHERE data_ref BETWEEN ? AND ?) AS bemEstarMedio,
        (SELECT COUNT(*) FROM consultorias_familiares WHERE data_agendada BETWEEN ? AND ?) AS encontrosFamiliares,
        (SELECT COUNT(*) FROM agendamentos_clinicos WHERE data_agendada BETWEEN ? AND ?) AS atendimentosClinicos,
        (SELECT COALESCE(SUM(internacoes),0) FROM metricas_saude WHERE data_ref BETWEEN ? AND ?) AS internacoesPeriodo
    `,
      [
        inicio,
        fim,
        inicio,
        fim,
        inicio,
        fim,
        inicio,
        fim,
        inicio,
        fim,
        inicio,
        fim,
        inicio,
        fim
      ]
    );

    const [
      saudeDiaria,
      medicacaoPorAla,
      ocupacaoSemanal,
      obitosMensal,
      cronograma,
      estoqueAlimentos,
      estoqueLimpeza,
      alertasEstoque,
      planilhasEstoque
    ] = await Promise.all([
      query(
        `
          SELECT
            data_ref,
            pressao_sistolica,
            pressao_diastolica,
            frequencia_cardiaca,
            glicemia,
            incidentes_quedas,
            internacoes,
            pontuacao_bem_estar
          FROM metricas_saude
          WHERE data_ref BETWEEN ? AND ?
          ORDER BY data_ref ASC
        `,
        [inicio, fim]
      ),
      query(
        `
          SELECT ala, ROUND(AVG(taxa_aderencia), 2) AS taxa_aderencia
          FROM metricas_medicacao
          WHERE data_ref BETWEEN ? AND ?
          GROUP BY ala
          ORDER BY ala ASC
        `,
        [inicio, fim]
      ),
      query(
        `
          SELECT
            DATE_FORMAT(data_ref, '%Y-%u') AS semana,
            ROUND(AVG(taxa_ocupacao), 2) AS taxa_ocupacao,
            ROUND(AVG(taxa_obito), 2) AS taxa_obito
          FROM metricas_saude
          WHERE data_ref BETWEEN DATE_SUB(?, INTERVAL 12 WEEK) AND ?
          GROUP BY semana
          ORDER BY semana ASC
        `,
        [fim, fim]
      ),
      query(
        `
          SELECT
            DATE_FORMAT(data_ref, '%Y-%m') AS mes,
            SUM(obitos) AS total_obitos,
            SUM(internacoes) AS total_internacoes
          FROM metricas_saude
          WHERE data_ref BETWEEN DATE_SUB(?, INTERVAL 11 MONTH) AND ?
          GROUP BY mes
          ORDER BY mes ASC
        `,
        [fim, fim]
      ),
      query(
        `
          SELECT
            data,
            hora_inicio,
            hora_fim,
            atividade,
            responsavel,
            ala,
            tipo,
            observacoes
          FROM cronograma_atividades
          WHERE data BETWEEN ? AND DATE_ADD(?, INTERVAL 14 DAY)
          ORDER BY data ASC, hora_inicio ASC
          LIMIT 20
        `,
        [inicio, fim]
      ),
      query(
        `
          SELECT
            categoria,
            SUM(quantidade_atual) AS quantidadeAtual,
            SUM(capacidade_maxima) AS capacidadeTotal,
            SUM(consumo_diario) AS consumoDiario,
            MIN(validade) AS proximaValidade,
            SUM(CASE WHEN quantidade_atual <= nivel_minimo THEN 1 ELSE 0 END) AS itensCriticos
          FROM estoque_alimentos
          GROUP BY categoria
          ORDER BY categoria ASC
        `
      ),
      query(
        `
          SELECT
            categoria,
            SUM(quantidade_atual) AS quantidadeAtual,
            SUM(capacidade_maxima) AS capacidadeTotal,
            SUM(consumo_diario) AS consumoDiario,
            MIN(validade) AS proximaValidade,
            SUM(CASE WHEN quantidade_atual <= nivel_minimo THEN 1 ELSE 0 END) AS itensCriticos
          FROM estoque_limpeza
          GROUP BY categoria
          ORDER BY categoria ASC
        `
      ),
      query(
        `
          SELECT tipo_alerta AS tipo, mensagem, severidade, criado_em
          FROM estoque_alertas
          WHERE resolvido = 0
          ORDER BY severidade DESC, criado_em DESC
        `
      ),
      query(
        `
          SELECT id, nome_original, caminho_arquivo, enviado_por, criado_em
          FROM estoque_planilhas
          ORDER BY criado_em DESC
          LIMIT 10
        `
      )
    ]);

    const totalLeitos = Number(resumoBase?.totalLeitos || 0);
    const leitosOcupados = Number(resumoBase?.leitosOcupados || 0);
    const taxaOcupacao = totalLeitos > 0 ? (leitosOcupados / totalLeitos) * 100 : 0;
    const obitosPeriodo = Number(resumoBase?.obitosPeriodo || 0);
    const residentesAtivos = Number(resumoBase?.residentesAtivos || 0);
    const taxaObito = residentesAtivos > 0 ? (obitosPeriodo / residentesAtivos) * 100 : 0;

    const inventario = {
      alimentos: estoqueAlimentos.map((item) => {
        const quantidade = normalizarFloat(item.quantidadeAtual);
        const consumo = normalizarFloat(item.consumoDiario);
        return {
          categoria: item.categoria,
          quantidadeAtual: quantidade,
          capacidadeTotal: normalizarFloat(item.capacidadeTotal),
          coberturaDias: consumo > 0 ? Number((quantidade / consumo).toFixed(1)) : null,
          proximaValidade: item.proximaValidade,
          itensCriticos: Number(item.itensCriticos || 0)
        };
      }),
      limpeza: estoqueLimpeza.map((item) => {
        const quantidade = normalizarFloat(item.quantidadeAtual);
        const consumo = normalizarFloat(item.consumoDiario);
        return {
          categoria: item.categoria,
          quantidadeAtual: quantidade,
          capacidadeTotal: normalizarFloat(item.capacidadeTotal),
          coberturaDias: consumo > 0 ? Number((quantidade / consumo).toFixed(1)) : null,
          proximaValidade: item.proximaValidade,
          itensCriticos: Number(item.itensCriticos || 0)
        };
      })
    };

    res.json({
      periodo: { inicio, fim },
      resumo: {
        residentesAtivos,
        residentesObservacao: Number(resumoBase?.residentesObservacao || 0),
        residentesInternados: Number(resumoBase?.residentesInternados || 0),
        idadeMedia: numeroOuZero(resumoBase?.idadeMedia, 1),
        taxaMedicacao: numeroOuZero(resumoBase?.taxaMedicacao, 1),
        taxaOcupacao: Number(taxaOcupacao.toFixed(1)),
        taxaObito: Number(taxaObito.toFixed(2)),
        incidentesClinicos: Number(resumoBase?.incidentesClinicos || 0),
        internacoesPeriodo: Number(resumoBase?.internacoesPeriodo || 0),
        proximaConsulta: resumoBase?.proximaConsulta,
        bemEstarMedio: numeroOuZero(resumoBase?.bemEstarMedio, 1),
        encontrosFamiliares: Number(resumoBase?.encontrosFamiliares || 0),
        atendimentosClinicos: Number(resumoBase?.atendimentosClinicos || 0)
      },
      series: {
      saudeDiaria: saudeDiaria.map((item) => ({
        ...item,
        data_ref: item.data_ref ? new Date(item.data_ref).toISOString().slice(0, 10) : null
      })),
      medicacaoPorAla,
      ocupacaoSemanal,
      obitosMensal
      },
      inventario,
      alertas: alertasEstoque.map((alerta) => ({
        ...alerta,
        criado_em: alerta.criado_em
          ? new Date(alerta.criado_em).toISOString()
          : alerta.criadoEm
          ? new Date(alerta.criadoEm).toISOString()
          : null
      })),
      cronograma: cronograma.map((item) => ({
        ...item,
        data: item.data ? new Date(item.data).toISOString() : null,
        hora_inicio: item.hora_inicio || item.horaInicio,
        hora_fim: item.hora_fim || item.horaFim
      })),
      planilhas: planilhasEstoque.map((planilha) => ({
        id: planilha.id,
        nome: planilha.nome_original,
        caminho: planilha.caminho_arquivo,
        enviadoPor: planilha.enviado_por,
        criadoEm: planilha.criado_em
      }))
    });
  } catch (error) {
    console.error('Erro ao montar painel do lar:', error);
    res.status(500).json({ error: 'Erro ao montar painel estratégico do lar' });
  }
};

exports.uploadPlanilhaEstoque = async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'patrao' && role !== 'asg') {
      return res.status(403).json({ error: 'Somente direção ou equipe de limpeza podem enviar planilhas.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const responsavel = req.body?.responsavel || 'Equipe administrativa';
    const tipoEstoque = req.body?.tipo || 'alimentos';
    const filePath = req.file.path;

    const processamento = await etlService.processarPlanilhaEstoque(filePath, tipoEstoque);

    await query(
      `
        INSERT INTO estoque_planilhas (nome_original, caminho_arquivo, enviado_por, total_registros, criado_em)
        VALUES (?, ?, ?, ?, NOW())
      `,
      [req.file.originalname, filePath, responsavel, processamento.inseridos]
    );

    res.json({
      success: true,
      mensagem: 'Planilha de estoque processada com sucesso',
      ...processamento
    });
  } catch (error) {
    console.error('Erro ao importar planilha de estoque:', error);
    res.status(500).json({ error: 'Erro ao importar planilha: ' + error.message });
  }
};

exports.testarNotificacao = async (req, res) => {
  try {
    if (req.user?.role !== 'patrao') {
      return res.status(403).json({ error: 'Apenas a direção pode testar notificações.' });
    }

    const { tipo, destinatario } = req.body;

    if (!tipo || !destinatario) {
      return res.status(400).json({ error: 'Tipo e destinatário são obrigatórios' });
    }

    const painel = await query(
      `
        SELECT
          (SELECT COUNT(*) FROM residentes WHERE status IN ('ativo','observacao')) AS residentes,
          (SELECT COUNT(*) FROM leitos WHERE ocupado = 1) AS leitosOcupados,
          (SELECT COUNT(*) FROM leitos) AS totalLeitos,
          (SELECT COALESCE(AVG(taxa_aderencia),0) FROM metricas_medicacao WHERE data_ref >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS taxaMedicacao
      `
    );

    const resumo = painel[0] || {};
    const taxaOcupacao = resumo.totalLeitos > 0 ? ((resumo.leitosOcupados / resumo.totalLeitos) * 100).toFixed(1) : '0.0';

    if (tipo === 'email') {
      await notificationService.enviarEmail(
        destinatario,
        'Resumo diário - Lar de Idosos',
        `
          <h1>Atualização do Lar de Idosos</h1>
          <p><strong>Residentes ativos:</strong> ${resumo.residentes || 0}</p>
          <p><strong>Taxa de ocupação:</strong> ${taxaOcupacao}%</p>
          <p><strong>Adesão a medicação:</strong> ${numeroOuZero(resumo.taxaMedicacao, 1)}%</p>
          <p>Mensagem automática gerada em ${new Date().toLocaleString('pt-BR')}.</p>
        `
      );
    } else if (tipo === 'whatsapp') {
      await notificationService.enviarWhatsApp(
        destinatario,
        `📋 Resumo do Lar\nResidentes ativos: ${resumo.residentes || 0}\nOcupação: ${taxaOcupacao}%\nAdesão à medicação: ${numeroOuZero(resumo.taxaMedicacao, 1)}%`
      );
    }

    res.json({ success: true, mensagem: 'Notificação de teste enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao testar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação: ' + error.message });
  }
};

exports.obterConfigNotificacoes = async (_req, res) => {
  try {
    if (_req.user?.role !== 'patrao') {
      return res.status(403).json({ error: 'Apenas a direção pode listar notificações.' });
    }

    const destinatarios = await query('SELECT * FROM config_envio WHERE ativo = 1 ORDER BY criado_em DESC');
    res.json({ destinatarios });
  } catch (error) {
    console.error('Erro ao buscar configurações de notificação:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
};

exports.salvarConfigNotificacao = async (req, res) => {
  try {
    if (req.user?.role !== 'patrao') {
      return res.status(403).json({ error: 'Apenas a direção pode cadastrar notificações.' });
    }

    const { tipo_envio, destinatario, responsavel } = req.body;

    if (!tipo_envio || !destinatario) {
      return res.status(400).json({ error: 'Tipo de envio e destinatário são obrigatórios' });
    }

    await query(
      `
        INSERT INTO config_envio (tipo_envio, destinatario, responsavel, ativo, criado_em)
        VALUES (?, ?, ?, 1, NOW())
      `,
      [tipo_envio, destinatario, responsavel || null]
    );

    res.json({ success: true, mensagem: 'Destinatário adicionado com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar notificação:', error);
    res.status(500).json({ error: 'Erro ao salvar destinatário: ' + error.message });
  }
};

exports.removerNotificacao = async (req, res) => {
  try {
    if (req.user?.role !== 'patrao') {
      return res.status(403).json({ error: 'Apenas a direção pode remover notificações.' });
    }

    const { id } = req.params;
    await query('DELETE FROM config_envio WHERE id = ?', [id]);
    res.json({ success: true, mensagem: 'Destinatário removido' });
  } catch (error) {
    console.error('Erro ao remover destinatário:', error);
    res.status(500).json({ error: 'Erro ao remover destinatário: ' + error.message });
  }
};

exports.obterEquipeOperacional = async (req, res) => {
  try {
    const roleUsuario = req.user?.role;
    const { role: roleFiltro } = req.query || {};

    let membros;
    if (roleUsuario === 'patrao' && roleFiltro) {
      membros = await operacionalService.obterEquipePorRole(roleFiltro);
    } else {
      membros = await operacionalService.obterEquipePorUsuario(req.user.id, roleUsuario);
    }

    res.json({ membros });
  } catch (error) {
    console.error('Erro ao obter equipe operacional:', error);
    res.status(500).json({ error: 'Não foi possível carregar a equipe operacional.' });
  }
};

exports.listarTarefasOperacionais = async (req, res) => {
  try {
    const roleUsuario = req.user?.role;
    const { role: roleFiltro, membroId } = req.query || {};

    const roleConsulta = roleUsuario === 'patrao'
      ? (roleFiltro && roleFiltro !== 'todas' ? roleFiltro : undefined)
      : roleUsuario;

    const membro = membroId ? Number.parseInt(membroId, 10) : null;
    if (roleUsuario !== 'patrao' && membro && !(await operacionalService.membroPertenceAoUsuario(membro, req.user.id))) {
      return res.status(403).json({ error: 'Colaborador não pertence a este usuário.' });
    }

    const tarefas = await operacionalService.listarTarefas({
      role: roleConsulta,
      membroId: membro || undefined,
      incluirValidacoes: roleUsuario === 'patrao'
    });

    res.json({ tarefas });
  } catch (error) {
    console.error('Erro ao listar tarefas operacionais:', error);
    res.status(500).json({ error: 'Não foi possível listar as tarefas.' });
  }
};

exports.criarTarefaOperacional = async (req, res) => {
  try {
    const roleUsuario = req.user?.role;
    if (!['patrao', 'supervisora'].includes(roleUsuario)) {
      return res.status(403).json({ error: 'Você não possui permissão para cadastrar tarefas.' });
    }

    const {
      titulo,
      descricao,
      roleDestino,
      dataLimite,
      documentoUrl,
      recorrencia,
      destinoTipo,
      destinatarios
    } = req.body || {};

    if (!titulo || !roleDestino) {
      return res.status(400).json({ error: 'Título e role destino são obrigatórios.' });
    }

    if (!['asg', 'enfermaria', 'supervisora'].includes(roleDestino)) {
      return res.status(400).json({ error: 'Role destino inválida.' });
    }

    if (roleUsuario === 'supervisora' && roleDestino !== 'asg') {
      return res.status(403).json({ error: 'Supervisão só pode direcionar tarefas para a equipe de ASG.' });
    }

    const recorrenciaNormalizada = ['diaria', 'semanal'].includes((recorrencia || '').toLowerCase())
      ? recorrencia.toLowerCase()
      : 'unica';
    const destinoTipoNormalizado = (destinoTipo || 'individual').toLowerCase() === 'equipe'
      ? 'equipe'
      : 'individual';

    let destinatariosIds = [];
    if (Array.isArray(destinatarios)) {
      destinatariosIds = destinatarios
        .map((id) => Number.parseInt(id, 10))
        .filter((valor) => Number.isInteger(valor) && valor > 0);
    } else if (destinatarios) {
      destinatariosIds = String(destinatarios)
        .split(',')
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((valor) => Number.isInteger(valor) && valor > 0);
    }

    const tarefaId = await operacionalService.criarTarefa({
      titulo,
      descricao,
      roleDestino,
      dataLimite: dataLimite || null,
      documentoUrl: documentoUrl || null,
      criadoPor: req.user.id,
      recorrencia: recorrenciaNormalizada,
      destinoTipo: destinoTipoNormalizado,
      destinatariosIds
    });

    const [tarefa] = await query(
      `SELECT t.id, t.titulo, t.descricao, t.role_destino AS roleDestino, t.recorrencia, t.destino_tipo AS destinoTipo,
              t.data_limite AS dataLimite, t.documento_url AS documentoUrl, t.criado_em AS criadoEm, u.nome AS criadoPorNome
       FROM tarefas t
       LEFT JOIN usuarios u ON u.id = t.criado_por
       WHERE t.id = ?
       LIMIT 1`,
      [tarefaId]
    );

    const destinatariosTarefa = await query(
      `SELECT membro_id AS membroId, destino_nome_snapshot AS destinoNome, status, observacao, anexo_url AS anexoUrl,
              concluido_em AS concluidoEm
       FROM tarefas_execucoes
       WHERE tarefa_id = ?`,
      [tarefaId]
    );

    res.status(201).json({
      tarefa: {
        ...tarefa,
        totalConcluidas: 0,
        totalValidacoes: destinatariosTarefa.length,
        destinatarios: destinatariosTarefa.map((item) => ({
          ...item,
          nome: item.destinoNome
        })),
        validacoes: []
      }
    });
  } catch (error) {
    console.error('Erro ao criar tarefa operacional:', error);
    res.status(500).json({ error: 'Não foi possível criar a tarefa. ' + error.message });
  }
};

exports.validarTarefaOperacional = async (req, res) => {
  try {
    const { id } = req.params;
    const { membroId, status, observacao, anexoUrl } = req.body || {};

    const tarefaId = Number.parseInt(id, 10);
    if (!tarefaId || !status) {
      return res.status(400).json({ error: 'Tarefa e status são obrigatórios.' });
    }

    const statusNormalizado = status.toLowerCase();
    if (!['pendente', 'concluida', 'nao_realizada'].includes(statusNormalizado)) {
      return res.status(400).json({ error: 'Status informado é inválido.' });
    }

    const membro = membroId ? Number.parseInt(membroId, 10) : null;
    const roleUsuario = req.user?.role;

    if (!membro) {
      return res.status(400).json({ error: 'Informe o colaborador responsável pela validação.' });
    }

    let membroRegistro = null;
    if (roleUsuario === 'patrao') {
      membroRegistro = await operacionalService.obterMembroPorId(membro);
      if (!membroRegistro) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }
    } else {
      const pertence = await operacionalService.membroPertenceAoUsuario(membro, req.user.id);
      if (!pertence) {
        return res.status(403).json({ error: 'Colaborador não pertence a este usuário.' });
      }
      membroRegistro = await operacionalService.obterMembroPorId(membro);
    }

    const validacao = await operacionalService.registrarValidacaoTarefa({
      tarefaId,
      membroId: membro,
      status: statusNormalizado,
      observacao,
      anexoUrl,
      membroNome: membroRegistro?.nome
    });

    res.json({ validacao });
  } catch (error) {
    console.error('Erro ao validar tarefa operacional:', error);
    res.status(500).json({ error: 'Não foi possível registrar a validação da tarefa.' });
  }
};

exports.registrarPontoColaborador = async (req, res) => {
  try {
    const { membroId, tipo, observacao, dataHora } = req.body || {};
    const membro = membroId ? Number.parseInt(membroId, 10) : null;

    if (!membro) {
      return res.status(400).json({ error: 'Selecione um colaborador antes de registrar o ponto.' });
    }

    const roleUsuario = req.user?.role;

    if (roleUsuario === 'patrao') {
      const membroRegistro = await operacionalService.obterMembroPorId(membro);
      if (!membroRegistro) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }
    } else if (!(await operacionalService.membroPertenceAoUsuario(membro, req.user.id))) {
      return res.status(403).json({ error: 'Colaborador não pertence a este usuário.' });
    }

    await operacionalService.registrarPonto({
      membroId: membro,
      usuarioId: req.user.id,
      tipo,
      observacao,
      dataHora
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Erro ao registrar ponto do colaborador:', error);
    const mensagem = error?.message?.includes('Colaborador não encontrado')
      ? error.message
      : 'Não foi possível registrar o ponto.';
    const status = error?.message?.includes('Colaborador não encontrado') ? 404 : 500;
    res.status(status).json({ error: mensagem });
  }
};

exports.listarPontosColaboradores = async (req, res) => {
  try {
    const { membroId, role: roleFiltro, limite } = req.query || {};
    const roleUsuario = req.user?.role;
    const membro = membroId ? Number.parseInt(membroId, 10) : null;

    if (roleUsuario !== 'patrao') {
      if (membro && !(await operacionalService.membroPertenceAoUsuario(membro, req.user.id))) {
        return res.status(403).json({ error: 'Colaborador não pertence a este usuário.' });
      }
    } else if (membro) {
      const membroRegistro = await operacionalService.obterMembroPorId(membro);
      if (!membroRegistro) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }
    }

    const registros = await operacionalService.listarPontos({
      role: roleUsuario === 'patrao'
        ? (roleFiltro && roleFiltro !== 'todas' ? roleFiltro : undefined)
        : roleUsuario,
      membroId: membro || undefined,
      limite
    });

    res.json({ registros });
  } catch (error) {
    console.error('Erro ao listar pontos dos colaboradores:', error);
    res.status(500).json({ error: 'Não foi possível carregar o histórico de pontos.' });
  }
};

exports.importarPontosColaboradores = async (req, res) => {
  try {
    const roleUsuario = req.user?.role;
    if (!['patrao', 'supervisora'].includes(roleUsuario)) {
      return res.status(403).json({ error: 'Somente a direção ou supervisão podem importar pontos.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado para importação.' });
    }

    const processamento = await etlService.processarPlanilhaPontos(req.file.path);

    if (!processamento.registros.length) {
      return res.status(400).json({
        error: 'Nenhuma linha válida foi encontrada na planilha de pontos.',
        detalhes: processamento.erros
      });
    }

    const resultado = await operacionalService.registrarPontosEmLote({
      registros: processamento.registros,
      usuarioId: req.user.id
    });

    res.json({
      sucesso: true,
      totalPlanilha: processamento.registros.length,
      importados: resultado.inseridos,
      inconsistenciasPlanilha: processamento.erros,
      inconsistenciasBanco: resultado.erros
    });
  } catch (error) {
    console.error('Erro ao importar planilha de pontos:', error);
    res.status(500).json({ error: 'Não foi possível importar os pontos. ' + error.message });
  }
};
