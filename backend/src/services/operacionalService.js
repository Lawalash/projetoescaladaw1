const { query } = require('../db/connection');

let schemaPronta = false;
let colunasDestinoPreparadas = false;

function normalizarTexto(valor) {
  if (!valor) return '';
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function colunaExiste(tabela, coluna) {
  const resultado = await query(
    `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [tabela, coluna]
  );

  return resultado.length > 0;
}

async function prepararColunasDestino() {
  if (colunasDestinoPreparadas) return;

  const possuiDestinoId = await colunaExiste('tarefas', 'destino_id');
  const possuiDestinoMembroId = await colunaExiste('tarefas', 'destino_membro_id');

  if (possuiDestinoId && !possuiDestinoMembroId) {
    await query(
      'ALTER TABLE tarefas CHANGE destino_id destino_membro_id INT NULL'
    ).catch(() => {});
  }

  if (!(await colunaExiste('tarefas', 'destino_membro_id'))) {
    await query(
      'ALTER TABLE tarefas ADD COLUMN destino_membro_id INT NULL AFTER destino_tipo'
    ).catch(() => {});
  }

  const possuiDestinoNomeLegado = await colunaExiste('tarefas', 'destino_nome');
  const possuiDestinoNomeSnapshot = await colunaExiste('tarefas', 'destino_nome_snapshot');

  if (possuiDestinoNomeLegado && !possuiDestinoNomeSnapshot) {
    await query(
      'ALTER TABLE tarefas CHANGE destino_nome destino_nome_snapshot VARCHAR(180) NULL'
    ).catch(() => {});
  }

  if (!(await colunaExiste('tarefas', 'destino_nome_snapshot'))) {
    await query(
      'ALTER TABLE tarefas ADD COLUMN destino_nome_snapshot VARCHAR(180) NULL AFTER destino_membro_id'
    ).catch(() => {});
  }

  colunasDestinoPreparadas = true;
}

async function garantirSchema() {
  if (schemaPronta) return;

  await query(
    `CREATE TABLE IF NOT EXISTS equipe_membros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nome VARCHAR(150) NOT NULL,
      role ENUM('asg','enfermaria','supervisora') NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY equipe_membros_unique (usuario_id, nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await query(
    "ALTER TABLE equipe_membros MODIFY role ENUM('asg','enfermaria','supervisora') NOT NULL"
  ).catch(() => {});

  await query(
    `CREATE TABLE IF NOT EXISTS tarefas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(180) NOT NULL,
      descricao TEXT,
      role_destino ENUM('asg','enfermaria','supervisora') NOT NULL,
      recorrencia ENUM('unica','diaria','semanal') DEFAULT 'unica',
      destino_tipo ENUM('individual','equipe') DEFAULT 'individual',
      destino_membro_id INT NULL,
      destino_nome_snapshot VARCHAR(180) NULL,
      criado_por INT,
      data_limite DATE,
      documento_url VARCHAR(255),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await query(
    "ALTER TABLE tarefas MODIFY role_destino ENUM('asg','enfermaria','supervisora') NOT NULL"
  ).catch(() => {});

  await query(
    "ALTER TABLE tarefas ADD COLUMN recorrencia ENUM('unica','diaria','semanal') DEFAULT 'unica' AFTER role_destino"
  ).catch(() => {});

  await query(
    "ALTER TABLE tarefas ADD COLUMN destino_tipo ENUM('individual','equipe') DEFAULT 'individual' AFTER recorrencia"
  ).catch(() => {});

  await prepararColunasDestino();

  await query(
    `CREATE TABLE IF NOT EXISTS tarefas_execucoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tarefa_id INT NOT NULL,
      membro_id INT,
      status ENUM('pendente','concluida','nao_realizada') DEFAULT 'pendente',
      observacao TEXT,
      anexo_url VARCHAR(255),
      concluido_em TIMESTAMP NULL,
      destino_nome_snapshot VARCHAR(180),
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY tarefa_execucao_unica (tarefa_id, membro_id),
      CONSTRAINT fk_execucao_tarefa FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await query(
    'ALTER TABLE tarefas_execucoes ADD COLUMN destino_nome_snapshot VARCHAR(180) AFTER concluido_em'
  ).catch(() => {});

  await query(
    `CREATE TABLE IF NOT EXISTS pontos_registros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      membro_id INT NOT NULL,
      usuario_id INT NOT NULL,
      membro_nome VARCHAR(150),
      tipo ENUM('entrada','saida','intervalo') DEFAULT 'entrada',
      registrado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      observacao VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await query(
    'ALTER TABLE pontos_registros ADD COLUMN membro_nome VARCHAR(150) AFTER usuario_id'
  ).catch(() => {});

  schemaPronta = true;
}

async function seedEquipeBasica(usuarioId, role) {
  const membrosPadrao = {
    asg: ['Carlos Alberto Duarte', 'Elaine Pacheco', 'Marcos Vinícius', 'Roberta Castro'],
    enfermaria: ['Téc. Fernanda Costa'],
    supervisora: ['Vitória Barboza Silveira']
  };

  const lista = membrosPadrao[role] || [];
  if (!lista.length) return;

  const existentes = await query(
    'SELECT COUNT(*) AS total FROM equipe_membros WHERE usuario_id = ? AND role = ?',
    [usuarioId, role]
  );

  if (existentes?.[0]?.total >= lista.length) {
    return;
  }

  const atuaisNomes = await query(
    'SELECT nome FROM equipe_membros WHERE usuario_id = ? AND role = ?',
    [usuarioId, role]
  );

  const nomesExistentes = new Set((atuaisNomes || []).map((item) => item.nome));
  const novos = lista.filter((nome) => !nomesExistentes.has(nome));
  if (!novos.length) return;

  const placeholders = novos.map(() => '(?, ?, ?)').join(', ');
  const valores = novos.flatMap((nome) => [usuarioId, nome, role]);
  await query(
    `INSERT INTO equipe_membros (usuario_id, nome, role) VALUES ${placeholders}`,
    valores
  );
}

async function garantirSupervisorEquipe(usuarioId) {
  await seedEquipeBasica(usuarioId, 'supervisora');
  await seedEquipeBasica(usuarioId, 'asg');
}

async function obterEquipePorUsuario(usuarioId, role, roleFiltro) {
  await garantirSchema();
  if (!usuarioId) return [];

  if (role === 'asg' || role === 'enfermaria') {
    await seedEquipeBasica(usuarioId, role);
  } else if (role === 'supervisora') {
    await garantirSupervisorEquipe(usuarioId);
  }

  const filtroAplicado = roleFiltro && roleFiltro !== 'todas' ? roleFiltro : null;
  const params = [usuarioId];

  let where = 'WHERE usuario_id = ? AND ativo = 1';
  if (filtroAplicado) {
    where += ' AND role = ?';
    params.push(filtroAplicado);
  }

  const ordenacao =
    role === 'supervisora'
      ? "ORDER BY CASE WHEN role = 'supervisora' THEN 0 ELSE 1 END, nome ASC"
      : 'ORDER BY nome ASC';

  return query(
    `SELECT id, nome, role, ativo, criado_em AS criadoEm
     FROM equipe_membros
     ${where}
     ${ordenacao}`,
    params
  );
}

async function obterEquipePorRole(role) {
  await garantirSchema();
  if (!role) return [];

  return query(
    `SELECT em.id, em.nome, em.role, em.usuario_id AS usuarioId
     FROM equipe_membros em
     WHERE em.role = ? AND em.ativo = 1
     ORDER BY em.nome ASC`,
    [role]
  );
}

async function criarTarefa({
  titulo,
  descricao,
  roleDestino,
  criadoPor,
  dataLimite,
  documentoUrl,
  recorrencia = 'unica',
  destinoTipo = 'individual',
  destinatariosIds = []
}) {
  await garantirSchema();

  const resultado = await query(
    `INSERT INTO tarefas (titulo, descricao, role_destino, recorrencia, destino_tipo, destino_membro_id, destino_nome_snapshot, criado_por, data_limite, documento_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      titulo,
      descricao || null,
      roleDestino,
      recorrencia || 'unica',
      destinoTipo || 'individual',
      null,
      null,
      criadoPor || null,
      dataLimite || null,
      documentoUrl || null
    ]
  );

  const tarefaId = resultado.insertId;

  let membrosDestino = [];

  if (destinoTipo === 'equipe') {
    const equipe = await obterEquipePorRole(roleDestino);
    membrosDestino = equipe.map((item) => ({ id: item.id, nome: item.nome }));
  } else if (Array.isArray(destinatariosIds) && destinatariosIds.length) {
    const placeholders = destinatariosIds.map(() => '?').join(',');
    const membros = await query(
      `SELECT id, nome, role FROM equipe_membros WHERE id IN (${placeholders}) AND ativo = 1`,
      destinatariosIds
    );
    membrosDestino = membros
      .filter((item) => item.role === roleDestino)
      .map((item) => ({ id: item.id, nome: item.nome }));
  }

  if (!membrosDestino.length && destinoTipo === 'individual') {
    const equipePadrao = await obterEquipePorRole(roleDestino);
    if (equipePadrao.length === 1) {
      membrosDestino = [{ id: equipePadrao[0].id, nome: equipePadrao[0].nome }];
    }
  }

  if (!membrosDestino.length && destinoTipo === 'individual') {
    throw new Error('Nenhum colaborador válido informado para a tarefa.');
  }

  if (!membrosDestino.length && destinoTipo === 'equipe') {
    throw new Error('Nenhuma equipe ativa encontrada para o destino selecionado.');
  }

  if (membrosDestino.length) {
    const inserts = membrosDestino.flatMap((membro) => [
      tarefaId,
      membro.id || null,
      'pendente',
      membro.nome
    ]);
    const placeholders = membrosDestino.map(() => '(?, ?, ?, ?)').join(',');
    await query(
      `INSERT INTO tarefas_execucoes (tarefa_id, membro_id, status, destino_nome_snapshot)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE destino_nome_snapshot = VALUES(destino_nome_snapshot), atualizado_em = CURRENT_TIMESTAMP`,
      inserts
    );
  }

  if (destinoTipo === 'individual') {
    const principal = membrosDestino.length === 1 ? membrosDestino[0] : null;
    await query(
      `UPDATE tarefas
          SET destino_membro_id = ?,
              destino_nome_snapshot = ?
        WHERE id = ?`,
      [principal ? principal.id : null, principal ? principal.nome : null, tarefaId]
    ).catch(() => {});
  } else {
    await query(
      'UPDATE tarefas SET destino_membro_id = NULL, destino_nome_snapshot = NULL WHERE id = ? LIMIT 1',
      [tarefaId]
    ).catch(() => {});
  }

  return tarefaId;
}

async function listarTarefas({ role, membroId, incluirValidacoes = false }) {
  await garantirSchema();

  await sincronizarExecucoesPendentes();

  const params = [];
  let where = 'WHERE 1=1';
  if (role) {
    where += ' AND t.role_destino = ?';
    params.push(role);
  }

  const linhas = await query(
    `
      SELECT
        t.id,
        t.titulo,
        t.descricao,
        t.role_destino AS roleDestino,
        t.recorrencia,
        t.destino_tipo AS destinoTipo,
        t.data_limite AS dataLimite,
        t.documento_url AS documentoUrl,
        t.criado_em AS criadoEm,
        t.criado_por AS criadoPorId,
        u.nome AS criadoPorNome,
        IFNULL(SUM(CASE WHEN te.status = 'concluida' THEN 1 ELSE 0 END), 0) AS totalConcluidas,
        IFNULL(COUNT(te.id), 0) AS totalValidacoes
      FROM tarefas t
      LEFT JOIN usuarios u ON u.id = t.criado_por
      LEFT JOIN tarefas_execucoes te ON te.tarefa_id = t.id
      ${where}
      GROUP BY t.id
      ORDER BY t.criado_em DESC
      LIMIT 200
    `,
    params
  );

  if (!linhas.length) {
    return [];
  }

  const ids = linhas.map((item) => item.id);
  const placeholders = ids.map(() => '?').join(',');
  const execucoes = await query(
    `SELECT te.id,
            te.tarefa_id AS tarefaId,
            te.membro_id AS membroId,
            te.status,
            te.observacao,
            te.anexo_url AS anexoUrl,
            te.concluido_em AS concluidoEm,
            te.destino_nome_snapshot AS destinoNome,
            em.nome AS membroNome,
            em.role AS membroRole
     FROM tarefas_execucoes te
     LEFT JOIN equipe_membros em ON em.id = te.membro_id
     WHERE te.tarefa_id IN (${placeholders})`,
    ids
  );

  const mapaExecucoesPorTarefa = execucoes.reduce((acc, item) => {
    if (!acc[item.tarefaId]) {
      acc[item.tarefaId] = [];
    }
    acc[item.tarefaId].push(item);
    return acc;
  }, {});

  const mapaExecucaoPorTarefaEMembro = execucoes.reduce((acc, item) => {
    if (item.membroId !== null && item.membroId !== undefined) {
      acc[`${item.tarefaId}:${item.membroId}`] = item;
    }
    return acc;
  }, {});

  const tarefasProcessadas = linhas
    .map((item) => {
      const execTarefa = mapaExecucoesPorTarefa[item.id] || [];
      const destinatarios = execTarefa.map((exec) => ({
        membroId: exec.membroId,
        nome: exec.destinoNome || exec.membroNome,
        status: exec.status,
        observacao: exec.observacao,
        anexoUrl: exec.anexoUrl,
        concluidoEm: exec.concluidoEm
      }));

      const resultado = {
        ...item,
        destinatarios,
        totalDestinatarios: destinatarios.length,
        validacoes: incluirValidacoes
          ? execTarefa
              .filter((exec) => exec.status !== 'pendente')
              .map((exec) => ({
                id: exec.id,
                tarefaId: exec.tarefaId,
                membroId: exec.membroId,
                membroNome: exec.destinoNome || exec.membroNome,
                status: exec.status,
                observacao: exec.observacao,
                anexoUrl: exec.anexoUrl,
                concluidoEm: exec.concluidoEm
              }))
          : []
      };

      if (membroId) {
        const chave = `${item.id}:${membroId}`;
        resultado.validacaoAtual = mapaExecucaoPorTarefaEMembro[chave] || null;
      }

      return resultado;
    })
    .filter((item) => {
      if (!membroId) return true;
      if (item.destinoTipo === 'equipe') return true;
      return item.destinatarios.some((dest) => dest.membroId === membroId);
    });

  return tarefasProcessadas;
}

async function registrarValidacaoTarefa({ tarefaId, membroId, status, observacao, anexoUrl, membroNome }) {
  await garantirSchema();

  const agora = new Date();
  const concluidoEm = status === 'pendente' ? null : agora;

  let destinoNome = membroNome || null;
  if (!destinoNome && membroId) {
    const membro = await obterMembroPorId(membroId);
    destinoNome = membro?.nome || null;
  }

  await query(
    `INSERT INTO tarefas_execucoes (tarefa_id, membro_id, status, observacao, anexo_url, concluido_em, destino_nome_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       observacao = VALUES(observacao),
       anexo_url = VALUES(anexo_url),
       concluido_em = VALUES(concluido_em),
       destino_nome_snapshot = COALESCE(VALUES(destino_nome_snapshot), destino_nome_snapshot),
       atualizado_em = CURRENT_TIMESTAMP`,
    [tarefaId, membroId || null, status, observacao || null, anexoUrl || null, concluidoEm, destinoNome]
  );

  if (membroId) {
    await query(
      `UPDATE tarefas
          SET destino_membro_id = COALESCE(destino_membro_id, ?),
              destino_nome_snapshot = COALESCE(destino_nome_snapshot, ?)
        WHERE id = ?`,
      [membroId, destinoNome || null, tarefaId]
    ).catch(() => {});
  }

  const [registro] = await query(
    `SELECT te.id, te.tarefa_id AS tarefaId, te.membro_id AS membroId, te.status, te.observacao,
            te.anexo_url AS anexoUrl, te.concluido_em AS concluidoEm, te.destino_nome_snapshot AS destinoNome,
            te.atualizado_em AS atualizadoEm
     FROM tarefas_execucoes te
     WHERE te.tarefa_id = ? AND te.membro_id <=> ?`,
    [tarefaId, membroId || null]
  );

  return registro;
}

async function obterMembroPorNomeERole(nome, role) {
  await garantirSchema();
  if (!nome || !role) return null;

  const lista = await query(
    `SELECT id, usuario_id AS usuarioId, nome, role, ativo
       FROM equipe_membros
      WHERE role = ? AND ativo = 1`,
    [role]
  );

  const alvo = normalizarTexto(nome);
  if (!alvo) return null;

  return (
    lista.find((item) => normalizarTexto(item.nome) === alvo) || null
  );
}

async function sincronizarExecucoesPendentes() {
  await garantirSchema();

  const pendentes = await query(
    `SELECT t.id,
            t.role_destino AS roleDestino,
            t.destino_membro_id AS destinoMembroId,
            t.destino_nome_snapshot AS destinoNome
       FROM tarefas t
  LEFT JOIN tarefas_execucoes te ON te.tarefa_id = t.id
      WHERE t.destino_tipo = 'individual'
        AND te.id IS NULL
        AND (t.destino_membro_id IS NOT NULL OR t.destino_nome_snapshot IS NOT NULL)
      LIMIT 200`
  );

  if (!pendentes.length) return;

  const cachePorNome = new Map();

  for (const tarefa of pendentes) {
    let membro = null;

    if (tarefa.destinoMembroId) {
      membro = await obterMembroPorId(tarefa.destinoMembroId);
    }

    if (!membro && tarefa.destinoNome) {
      const chave = `${tarefa.roleDestino}:${normalizarTexto(tarefa.destinoNome)}`;
      if (cachePorNome.has(chave)) {
        membro = cachePorNome.get(chave);
      } else {
        membro = await obterMembroPorNomeERole(tarefa.destinoNome, tarefa.roleDestino);
        cachePorNome.set(chave, membro || null);
      }
    }

    if (!membro) {
      continue;
    }

    await query(
      `INSERT INTO tarefas_execucoes (tarefa_id, membro_id, status, destino_nome_snapshot)
       VALUES (?, ?, 'pendente', ?)
       ON DUPLICATE KEY UPDATE destino_nome_snapshot = VALUES(destino_nome_snapshot), atualizado_em = CURRENT_TIMESTAMP`,
      [tarefa.id, membro.id || null, membro.nome]
    ).catch(() => {});

    await query(
      `UPDATE tarefas
          SET destino_membro_id = ?,
              destino_nome_snapshot = ?
        WHERE id = ?`,
      [membro.id || null, membro.nome, tarefa.id]
    ).catch(() => {});
  }
}

async function registrarPonto({ membroId, usuarioId, tipo, observacao, dataHora }) {
  await garantirSchema();

  const membro = await obterMembroPorId(membroId);
  if (!membro) {
    throw new Error('Colaborador não encontrado para registrar o ponto.');
  }

  await query(
    `INSERT INTO pontos_registros (membro_id, usuario_id, membro_nome, tipo, observacao, registrado_em)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [
      membroId,
      usuarioId,
      membro.nome,
      tipo || 'entrada',
      observacao || null,
      dataHora ? new Date(dataHora) : new Date()
    ]
  );
}

async function registrarPontosEmLote({ registros, usuarioId }) {
  await garantirSchema();

  if (!Array.isArray(registros) || !registros.length) {
    return { inseridos: 0, erros: [] };
  }

  const membrosAtivos = await query(
    `SELECT id, nome, role FROM equipe_membros WHERE ativo = 1`
  );
  const mapaMembros = new Map(
    membrosAtivos.map((membro) => [normalizarTexto(membro.nome), membro])
  );

  const erros = [];
  let inseridos = 0;

  for (const registro of registros) {
    try {
      const nomeNormalizado = normalizarTexto(registro.nome);
      const membroEncontrado = mapaMembros.get(nomeNormalizado);
      if (!membroEncontrado) {
        throw new Error(`Colaborador não encontrado: ${registro.nome}`);
      }

      if (registro.role && registro.role !== membroEncontrado.role) {
        throw new Error(
          `Registro destinado a ${registro.role}, mas o colaborador pertence a ${membroEncontrado.role}`
        );
      }

      await registrarPonto({
        membroId: membroEncontrado.id,
        usuarioId,
        tipo: registro.tipo,
        observacao: registro.observacao,
        dataHora: registro.dataHora
      });
      inseridos += 1;
    } catch (error) {
      erros.push({
        linha: registro.linha,
        nome: registro.nome,
        motivo: error.message
      });
    }
  }

  return {
    inseridos,
    erros,
    total: registros.length
  };
}

async function listarPontos({ role, membroId, limite = 30 }) {
  await garantirSchema();

  const params = [];
  let where = 'WHERE 1=1';
  if (membroId) {
    where += ' AND pr.membro_id = ?';
    params.push(membroId);
  }
  if (role) {
    where += ' AND em.role = ?';
    params.push(role);
  }

  const limiteSeguro = Math.max(5, Math.min(Number.parseInt(limite, 10) || 30, 200));

  const registros = await query(
    `SELECT pr.id,
            pr.membro_id AS membroId,
            COALESCE(pr.membro_nome, em.nome) AS membroNome,
            em.role,
            pr.usuario_id AS usuarioId,
            u.nome AS usuarioNome,
            pr.tipo,
            pr.observacao,
            pr.registrado_em AS registradoEm
     FROM pontos_registros pr
     LEFT JOIN equipe_membros em ON em.id = pr.membro_id
     LEFT JOIN usuarios u ON u.id = pr.usuario_id
     ${where}
     ORDER BY pr.registrado_em DESC
     LIMIT ${limiteSeguro}`,
    params
  );

  return registros;
}

async function obterMembroPorId(membroId) {
  await garantirSchema();
  if (!membroId) return null;

  const [registro] = await query(
    `SELECT id, usuario_id AS usuarioId, nome, role, ativo
     FROM equipe_membros
     WHERE id = ?`,
    [membroId]
  );

  return registro || null;
}

async function membroPertenceAoUsuario(membroId, usuarioId) {
  await garantirSchema();
  if (!membroId || !usuarioId) return false;

  const [registro] = await query(
    'SELECT id FROM equipe_membros WHERE id = ? AND usuario_id = ? LIMIT 1',
    [membroId, usuarioId]
  );

  return Boolean(registro);
}

module.exports = {
  garantirSchema,
  obterEquipePorUsuario,
  obterEquipePorRole,
  criarTarefa,
  listarTarefas,
  registrarValidacaoTarefa,
  registrarPonto,
  registrarPontosEmLote,
  listarPontos,
  obterMembroPorId,
  membroPertenceAoUsuario
};
