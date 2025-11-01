const { query } = require('../db/connection');

let schemaPronta = false;

async function garantirSchema() {
  if (schemaPronta) return;

  await query(
    `CREATE TABLE IF NOT EXISTS equipe_membros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nome VARCHAR(150) NOT NULL,
      role ENUM('asg','enfermaria') NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY equipe_membros_unique (usuario_id, nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS tarefas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(180) NOT NULL,
      descricao TEXT,
      role_destino ENUM('asg','enfermaria') NOT NULL,
      criado_por INT,
      data_limite DATE,
      documento_url VARCHAR(255),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS tarefas_execucoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tarefa_id INT NOT NULL,
      membro_id INT,
      status ENUM('pendente','concluida','nao_realizada') DEFAULT 'pendente',
      observacao TEXT,
      anexo_url VARCHAR(255),
      concluido_em TIMESTAMP NULL,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY tarefa_execucao_unica (tarefa_id, membro_id),
      CONSTRAINT fk_execucao_tarefa FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS pontos_registros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      membro_id INT NOT NULL,
      usuario_id INT NOT NULL,
      tipo ENUM('entrada','saida','intervalo') DEFAULT 'entrada',
      registrado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      observacao VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  schemaPronta = true;
}

async function seedEquipeBasica(usuarioId, role) {
  const membrosPadrao = {
    asg: ['Maria Souza', 'João Lima', 'Patrícia Duarte'],
    enfermaria: ['Enf. Carla Mendes', 'Téc. Paulo Nogueira', 'Enf. Júlia Freitas']
  };

  const lista = membrosPadrao[role] || [];
  if (!lista.length) return;

  const existentes = await query(
    'SELECT COUNT(*) AS total FROM equipe_membros WHERE usuario_id = ? AND role = ?',
    [usuarioId, role]
  );

  if (existentes?.[0]?.total) {
    return;
  }

  const placeholders = lista.map(() => '(?, ?, ?)').join(', ');
  const valores = lista.flatMap((nome) => [usuarioId, nome, role]);
  await query(
    `INSERT INTO equipe_membros (usuario_id, nome, role) VALUES ${placeholders}`,
    valores
  );
}

async function obterEquipePorUsuario(usuarioId, role) {
  await garantirSchema();
  if (!usuarioId) return [];

  if (role === 'asg' || role === 'enfermaria') {
    await seedEquipeBasica(usuarioId, role);
  }

  return query(
    `SELECT id, nome, role, ativo, criado_em AS criadoEm
     FROM equipe_membros
     WHERE usuario_id = ? AND ativo = 1
     ORDER BY nome ASC`,
    [usuarioId]
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

async function criarTarefa({ titulo, descricao, roleDestino, criadoPor, dataLimite, documentoUrl }) {
  await garantirSchema();

  const resultado = await query(
    `INSERT INTO tarefas (titulo, descricao, role_destino, criado_por, data_limite, documento_url)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [titulo, descricao || null, roleDestino, criadoPor || null, dataLimite || null, documentoUrl || null]
  );

  return resultado.insertId;
}

async function listarTarefas({ role, membroId, incluirValidacoes = false }) {
  await garantirSchema();

  const params = [];
  let where = 'WHERE 1=1';
  if (role) {
    where += ' AND t.role_destino = ?';
    params.push(role);
  }

  let queryTexto = `
    SELECT
      t.id,
      t.titulo,
      t.descricao,
      t.role_destino AS roleDestino,
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
  `;

  const linhas = await query(queryTexto, params);

  let mapaValidacoes = {};
  if (incluirValidacoes && linhas.length) {
    const ids = linhas.map((item) => item.id);
    const placeholders = ids.map(() => '?').join(',');
    const validacoes = await query(
      `SELECT te.id, te.tarefa_id AS tarefaId, te.membro_id AS membroId, te.status, te.observacao, te.anexo_url AS anexoUrl,
              te.concluido_em AS concluidoEm, em.nome AS membroNome
       FROM tarefas_execucoes te
       LEFT JOIN equipe_membros em ON em.id = te.membro_id
       WHERE te.tarefa_id IN (${placeholders})
       ORDER BY te.concluido_em DESC`,
      ids
    );

    mapaValidacoes = validacoes.reduce((acc, item) => {
      if (!acc[item.tarefaId]) {
        acc[item.tarefaId] = [];
      }
      acc[item.tarefaId].push(item);
      return acc;
    }, {});
  }

  if (membroId) {
    const ids = linhas.map((item) => item.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const execucoesMembro = await query(
        `SELECT tarefa_id AS tarefaId, status, observacao, anexo_url AS anexoUrl, concluido_em AS concluidoEm
         FROM tarefas_execucoes
         WHERE membro_id = ? AND tarefa_id IN (${placeholders})`,
        [membroId, ...ids]
      );
      const mapa = execucoesMembro.reduce((acc, item) => {
        acc[item.tarefaId] = item;
        return acc;
      }, {});
      linhas.forEach((item) => {
        item.validacaoAtual = mapa[item.id] || null;
      });
    }
  }

  return linhas.map((item) => ({
    ...item,
    validacoes: mapaValidacoes[item.id] || []
  }));
}

async function registrarValidacaoTarefa({ tarefaId, membroId, status, observacao, anexoUrl }) {
  await garantirSchema();

  const agora = new Date();
  const concluidoEm = status === 'concluida' ? agora : null;

  await query(
    `INSERT INTO tarefas_execucoes (tarefa_id, membro_id, status, observacao, anexo_url, concluido_em)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       observacao = VALUES(observacao),
       anexo_url = VALUES(anexo_url),
       concluido_em = VALUES(concluido_em),
       atualizado_em = CURRENT_TIMESTAMP`,
    [tarefaId, membroId || null, status, observacao || null, anexoUrl || null, concluidoEm]
  );

  const [registro] = await query(
    `SELECT te.id, te.tarefa_id AS tarefaId, te.membro_id AS membroId, te.status, te.observacao,
            te.anexo_url AS anexoUrl, te.concluido_em AS concluidoEm, te.atualizado_em AS atualizadoEm
     FROM tarefas_execucoes te
     WHERE te.tarefa_id = ? AND te.membro_id <=> ?`,
    [tarefaId, membroId || null]
  );

  return registro;
}

async function registrarPonto({ membroId, usuarioId, tipo, observacao, dataHora }) {
  await garantirSchema();

  await query(
    `INSERT INTO pontos_registros (membro_id, usuario_id, tipo, observacao, registrado_em)
     VALUES (?, ?, ?, ?, ?)` ,
    [
      membroId,
      usuarioId,
      tipo || 'entrada',
      observacao || null,
      dataHora ? new Date(dataHora) : new Date()
    ]
  );
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
            em.nome AS membroNome,
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
  listarPontos,
  obterMembroPorId,
  membroPertenceAoUsuario
};
