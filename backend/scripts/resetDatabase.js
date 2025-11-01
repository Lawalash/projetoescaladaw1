const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { hashPassword } = require('../src/utils/security');

// Tentar carregar variáveis de ambiente do backend e do projeto raiz
const backendEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: backendEnvPath, override: false });
dotenv.config();

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'qw1_relatorios'
} = process.env;

const BASE_DATA = new Date(Date.UTC(2024, 9, 31, 0, 0, 0));

const TABLES = [
  'usuarios',
  'logs_envio',
  'config_envio',
  'config_sistema',
  'estoque_planilhas',
  'estoque_alertas',
  'estoque_itens',
  'estoque_limpeza',
  'estoque_alimentos',
  'tarefas_execucoes',
  'tarefas',
  'pontos_registros',
  'equipe_membros',
  'cronograma_atividades',
  'agendamentos_clinicos',
  'consultorias_familiares',
  'consultas_medicas',
  'metricas_medicacao',
  'metricas_saude',
  'leitos',
  'residentes'
];

function diasAtras(base, dias) {
  const data = new Date(base);
  data.setDate(data.getDate() - dias);
  data.setHours(0, 0, 0, 0);
  return data;
}

async function criarEstrutura(connection) {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      role ENUM('patrao','asg','enfermaria','supervisora') NOT NULL DEFAULT 'asg',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS residentes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(120) NOT NULL,
      data_nascimento DATE NOT NULL,
      status ENUM('ativo','observacao','internado','inativo') DEFAULT 'ativo',
      ala VARCHAR(60) DEFAULT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS leitos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(20) NOT NULL,
      ala VARCHAR(60) DEFAULT NULL,
      ocupado TINYINT(1) DEFAULT 0,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS metricas_medicacao (
      id INT AUTO_INCREMENT PRIMARY KEY,
      data_ref DATE NOT NULL,
      ala VARCHAR(60) NOT NULL,
      taxa_aderencia DECIMAL(5,2) DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS metricas_saude (
      id INT AUTO_INCREMENT PRIMARY KEY,
      data_ref DATE NOT NULL,
      pressao_sistolica INT DEFAULT NULL,
      pressao_diastolica INT DEFAULT NULL,
      frequencia_cardiaca INT DEFAULT NULL,
      glicemia DECIMAL(6,2) DEFAULT NULL,
      incidentes_quedas INT DEFAULT 0,
      internacoes INT DEFAULT 0,
      pontuacao_bem_estar DECIMAL(4,1) DEFAULT NULL,
      taxa_ocupacao DECIMAL(5,2) DEFAULT NULL,
      taxa_obito DECIMAL(5,2) DEFAULT NULL,
      obitos INT DEFAULT 0,
      incidentes_clinicos INT DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS consultas_medicas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      residente_id INT DEFAULT NULL,
      data_agendada DATETIME NOT NULL,
      responsavel VARCHAR(120) DEFAULT NULL,
      especialidade VARCHAR(120) DEFAULT NULL,
      observacoes TEXT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS consultorias_familiares (
      id INT AUTO_INCREMENT PRIMARY KEY,
      residente_id INT DEFAULT NULL,
      data_agendada DATETIME NOT NULL,
      tema VARCHAR(120) DEFAULT NULL,
      responsavel VARCHAR(120) DEFAULT NULL,
      observacoes TEXT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS agendamentos_clinicos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      residente_id INT DEFAULT NULL,
      data_agendada DATETIME NOT NULL,
      tipo VARCHAR(120) DEFAULT NULL,
      responsavel VARCHAR(120) DEFAULT NULL,
      observacoes TEXT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS cronograma_atividades (
      id INT AUTO_INCREMENT PRIMARY KEY,
      data DATE NOT NULL,
      hora_inicio TIME DEFAULT NULL,
      hora_fim TIME DEFAULT NULL,
      atividade VARCHAR(160) NOT NULL,
      responsavel VARCHAR(120) DEFAULT NULL,
      ala VARCHAR(60) DEFAULT NULL,
      tipo VARCHAR(80) DEFAULT NULL,
      observacoes TEXT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS estoque_alimentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categoria VARCHAR(120) NOT NULL,
      quantidade_atual DECIMAL(10,2) DEFAULT 0,
      capacidade_maxima DECIMAL(10,2) DEFAULT 0,
      consumo_diario DECIMAL(10,2) DEFAULT 0,
      validade DATE DEFAULT NULL,
      nivel_minimo DECIMAL(10,2) DEFAULT 0,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS estoque_limpeza (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categoria VARCHAR(120) NOT NULL,
      quantidade_atual DECIMAL(10,2) DEFAULT 0,
      capacidade_maxima DECIMAL(10,2) DEFAULT 0,
      consumo_diario DECIMAL(10,2) DEFAULT 0,
      validade DATE DEFAULT NULL,
      nivel_minimo DECIMAL(10,2) DEFAULT 0,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS estoque_alertas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tipo_alerta VARCHAR(80) NOT NULL,
      mensagem VARCHAR(255) NOT NULL,
      severidade VARCHAR(20) DEFAULT 'medio',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolvido TINYINT(1) DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS estoque_planilhas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_original VARCHAR(160) NOT NULL,
      caminho_arquivo VARCHAR(255) NOT NULL,
      enviado_por VARCHAR(120) DEFAULT NULL,
      total_registros INT DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS estoque_itens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tipo_estoque VARCHAR(40) NOT NULL,
      categoria VARCHAR(120) DEFAULT NULL,
      nome_item VARCHAR(160) NOT NULL,
      unidade VARCHAR(40) DEFAULT NULL,
      quantidade_atual DECIMAL(10,2) DEFAULT 0,
      consumo_diario DECIMAL(10,2) DEFAULT 0,
      validade DATE DEFAULT NULL,
      lote VARCHAR(80) DEFAULT NULL,
      fornecedor VARCHAR(160) DEFAULT NULL,
      observacoes TEXT DEFAULT NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS equipe_membros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nome VARCHAR(150) NOT NULL,
      role ENUM('asg','enfermaria','supervisora') NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY equipe_membros_unique (usuario_id, nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS tarefas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(180) NOT NULL,
      descricao TEXT,
      role_destino ENUM('asg','enfermaria','supervisora') NOT NULL,
      recorrencia ENUM('unica','diaria','semanal') DEFAULT 'unica',
      destino_tipo ENUM('individual','equipe') DEFAULT 'individual',
      criado_por INT,
      data_limite DATE,
      documento_url VARCHAR(255),
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS tarefas_execucoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tarefa_id INT NOT NULL,
      membro_id INT,
      status ENUM('pendente','concluida','nao_realizada') DEFAULT 'pendente',
      observacao TEXT,
      anexo_url VARCHAR(255),
      concluido_em DATETIME DEFAULT NULL,
      destino_nome_snapshot VARCHAR(180),
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY tarefa_execucao_unica (tarefa_id, membro_id),
      CONSTRAINT fk_execucao_tarefa_seed FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS pontos_registros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      membro_id INT NOT NULL,
      usuario_id INT NOT NULL,
      membro_nome VARCHAR(150),
      tipo ENUM('entrada','saida','intervalo') DEFAULT 'entrada',
      registrado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      observacao VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS config_envio (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tipo_envio ENUM('email','whatsapp') NOT NULL,
      destinatario VARCHAR(160) NOT NULL,
      responsavel VARCHAR(120) DEFAULT NULL,
      ativo TINYINT(1) DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS logs_envio (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tipo VARCHAR(40) NOT NULL,
      destinatario VARCHAR(160) NOT NULL,
      status VARCHAR(40) NOT NULL,
      mensagem_erro TEXT DEFAULT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS config_sistema (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chave VARCHAR(120) NOT NULL UNIQUE,
      valor VARCHAR(255) NOT NULL,
      descricao VARCHAR(255) DEFAULT NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const statement of ddlStatements) {
    await connection.execute(statement);
  }
}

async function popularDados(connection) {
  const hoje = new Date(BASE_DATA);

  const residentes = [
    { nome: 'Maria das Dores', nascimento: '1941-05-14', status: 'ativo', ala: 'Ala Norte' },
    { nome: 'João Batista', nascimento: '1938-11-02', status: 'ativo', ala: 'Ala Norte' },
    { nome: 'Antônio Ribeiro', nascimento: '1945-03-28', status: 'observacao', ala: 'Ala Leste' },
    { nome: 'Helena Duarte', nascimento: '1939-07-09', status: 'internado', ala: 'Ala Sul' },
    { nome: 'Francisca Lima', nascimento: '1947-02-18', status: 'ativo', ala: 'Ala Sul' },
    { nome: 'Luiz Fernando', nascimento: '1943-09-30', status: 'observacao', ala: 'Ala Norte' },
    { nome: 'Célia Regina', nascimento: '1949-12-22', status: 'ativo', ala: 'Ala Leste' },
    { nome: 'Pedro Albuquerque', nascimento: '1942-06-05', status: 'ativo', ala: 'Ala Norte' }
  ];

  for (const residente of residentes) {
    await connection.execute(
      `INSERT INTO residentes (nome, data_nascimento, status, ala, criado_em)
       VALUES (?, ?, ?, ?, NOW())`,
      [residente.nome, residente.nascimento, residente.status, residente.ala]
    );
  }

  for (let i = 1; i <= 40; i += 1) {
    const alaIndex = i <= 15 ? 'Ala Norte' : i <= 30 ? 'Ala Sul' : 'Ala Leste';
    const ocupado = i <= 32 ? 1 : 0;
    await connection.execute(
      `INSERT INTO leitos (codigo, ala, ocupado, atualizado_em)
       VALUES (?, ?, ?, NOW())`,
      [`L${String(i).padStart(3, '0')}`, alaIndex, ocupado]
    );
  }

  const alas = ['Ala Norte', 'Ala Sul', 'Ala Leste'];
  for (let dia = 0; dia < 31; dia += 1) {
    const dataRef = diasAtras(hoje, dia);
    const fatorSazonal = Math.sin(dia / 6);

    const taxaOcupacao = Math.max(68, Math.min(98, 82 + fatorSazonal * 9));
    const obitos = dia % 18 === 0 ? 1 : 0;
    const internacoes = dia % 12 === 0 ? 1 : 0;
    const incidentes = dia % 8 === 0 ? 1 : 0;
    const quedas = dia % 10 === 0 ? 1 : 0;

    await connection.execute(
      `INSERT INTO metricas_saude (
        data_ref, pressao_sistolica, pressao_diastolica, frequencia_cardiaca, glicemia,
        incidentes_quedas, internacoes, pontuacao_bem_estar, taxa_ocupacao,
        taxa_obito, obitos, incidentes_clinicos, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        dataRef,
        118 + Math.round(fatorSazonal * 6),
        76 + Math.round(fatorSazonal * 4),
        72 + Math.round(fatorSazonal * 5),
        Number((102 + fatorSazonal * 5).toFixed(2)),
        quedas,
        internacoes,
        Number((7.2 + fatorSazonal * 0.6).toFixed(1)),
        Number(taxaOcupacao.toFixed(2)),
        Number(((obitos / 40) * 100).toFixed(2)),
        obitos,
        incidentes
      ]
    );

    for (const [index, ala] of alas.entries()) {
      const variacao = Math.sin((dia + index) / 4) * 6;
      const taxaAderencia = Math.max(70, Math.min(100, 88 + variacao - index));
      await connection.execute(
        `INSERT INTO metricas_medicacao (data_ref, ala, taxa_aderencia, criado_em)
         VALUES (?, ?, ?, NOW())`,
        [dataRef, ala, Number(taxaAderencia.toFixed(2))]
      );
    }
  }

  const consultas = [
    { dias: 2, hora: '09:30', especialidade: 'Geriatria', responsavel: 'Dra. Fernanda Lopes' },
    { dias: 5, hora: '14:00', especialidade: 'Fisioterapia', responsavel: 'Fábio Mendes' },
    { dias: 7, hora: '10:00', especialidade: 'Nutrição', responsavel: 'Marina Castro' },
    { dias: 9, hora: '11:30', especialidade: 'Cardiologia', responsavel: 'Dr. Vinícius Prado' }
  ];

  for (const consulta of consultas) {
    const data = diasAtras(hoje, -consulta.dias);
    const [horaH, horaM] = consulta.hora.split(':').map(Number);
    data.setHours(horaH, horaM, 0, 0);
    await connection.execute(
      `INSERT INTO consultas_medicas (data_agendada, responsavel, especialidade, observacoes)
       VALUES (?, ?, ?, ?)`,
      [data, consulta.responsavel, consulta.especialidade, 'Consulta programada']
    );
  }

  const encontrosFamilia = [
    { dias: 3, tema: 'Acompanhamento mensal', responsavel: 'Equipe Psicossocial' },
    { dias: 10, tema: 'Feedback terapêutico', responsavel: 'Psicóloga Juliana' }
  ];

  for (const encontro of encontrosFamilia) {
    const data = diasAtras(hoje, -encontro.dias);
    data.setHours(15, 0, 0, 0);
    await connection.execute(
      `INSERT INTO consultorias_familiares (data_agendada, tema, responsavel, observacoes)
       VALUES (?, ?, ?, ?)`,
      [data, encontro.tema, encontro.responsavel, 'Reunião com familiares']
    );
  }

  const atendimentos = [
    { dias: 1, tipo: 'Terapia ocupacional', responsavel: 'Equipe de Terapia' },
    { dias: 4, tipo: 'Avaliação nutricional', responsavel: 'Nutricionista' },
    { dias: 6, tipo: 'Fonoaudiologia', responsavel: 'Fonoaudióloga' }
  ];

  for (const atendimento of atendimentos) {
    const data = diasAtras(hoje, -atendimento.dias);
    data.setHours(16, 0, 0, 0);
    await connection.execute(
      `INSERT INTO agendamentos_clinicos (data_agendada, tipo, responsavel, observacoes)
       VALUES (?, ?, ?, ?)` ,
      [data, atendimento.tipo, atendimento.responsavel, 'Sessão programada']
    );
  }

  const atividades = [
    { dias: 0, inicio: '09:00', fim: '10:30', atividade: 'Ginástica leve', ala: 'Ala Norte', tipo: 'Física' },
    { dias: 1, inicio: '15:00', fim: '16:00', atividade: 'Oficina de memória', ala: 'Ala Sul', tipo: 'Cognitiva' },
    { dias: 2, inicio: '10:00', fim: '11:30', atividade: 'Coral terapêutico', ala: 'Ala Leste', tipo: 'Lazer' },
    { dias: 3, inicio: '14:00', fim: '15:30', atividade: 'Atividade intergeracional', ala: 'Área comum', tipo: 'Social' },
    { dias: 4, inicio: '09:30', fim: '11:00', atividade: 'Alongamento assistido', ala: 'Ala Norte', tipo: 'Física' }
  ];

  for (const atividade of atividades) {
    const data = diasAtras(hoje, -atividade.dias);
    await connection.execute(
      `INSERT INTO cronograma_atividades (data, hora_inicio, hora_fim, atividade, responsavel, ala, tipo, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data,
        atividade.inicio,
        atividade.fim,
        atividade.atividade,
        'Equipe A2 Data',
        atividade.ala,
        atividade.tipo,
        'Atividade planejada'
      ]
    );
  }

  const alimentos = [
    { categoria: 'Frutas frescas', quantidade: 85, capacidade: 120, consumo: 12, validade: diasAtras(hoje, -5), minimo: 40 },
    { categoria: 'Proteínas', quantidade: 65, capacidade: 100, consumo: 10, validade: diasAtras(hoje, 7), minimo: 30 },
    { categoria: 'Laticínios', quantidade: 30, capacidade: 80, consumo: 8, validade: diasAtras(hoje, 3), minimo: 25 },
    { categoria: 'Grãos integrais', quantidade: 95, capacidade: 140, consumo: 9, validade: diasAtras(hoje, -20), minimo: 35 }
  ];

  for (const item of alimentos) {
    await connection.execute(
      `INSERT INTO estoque_alimentos (categoria, quantidade_atual, capacidade_maxima, consumo_diario, validade, nivel_minimo, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [item.categoria, item.quantidade, item.capacidade, item.consumo, item.validade, item.minimo]
    );
  }

  const limpeza = [
    { categoria: 'Desinfetantes', quantidade: 18, capacidade: 40, consumo: 2.5, validade: diasAtras(hoje, 15), minimo: 12 },
    { categoria: 'Higiene pessoal', quantidade: 55, capacidade: 90, consumo: 4, validade: diasAtras(hoje, -30), minimo: 25 },
    { categoria: 'Lavanderia', quantidade: 22, capacidade: 60, consumo: 3.5, validade: diasAtras(hoje, 45), minimo: 18 }
  ];

  for (const item of limpeza) {
    await connection.execute(
      `INSERT INTO estoque_limpeza (categoria, quantidade_atual, capacidade_maxima, consumo_diario, validade, nivel_minimo, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [item.categoria, item.quantidade, item.capacidade, item.consumo, item.validade, item.minimo]
    );
  }

  const alertas = [
    { tipo: 'Estoque crítico', mensagem: 'Laticínios abaixo do nível mínimo.', severidade: 'alto', resolvido: 0 },
    { tipo: 'Vencimento próximo', mensagem: 'Desinfetantes vencem em menos de 10 dias.', severidade: 'medio', resolvido: 0 }
  ];

  for (const alerta of alertas) {
    await connection.execute(
      `INSERT INTO estoque_alertas (tipo_alerta, mensagem, severidade, resolvido, criado_em)
       VALUES (?, ?, ?, ?, NOW())`,
      [alerta.tipo, alerta.mensagem, alerta.severidade, alerta.resolvido]
    );
  }

  const planilhas = [
    { nome: 'estoque_alimentos_2025-10-01.xlsx', caminho: 'uploads/estoque/planilha_alimentos.xlsx', enviadoPor: 'Coordenadora Ana', dias: 2, total: 120 },
    { nome: 'estoque_limpeza_2025-09-20.xlsx', caminho: 'uploads/estoque/planilha_limpeza.xlsx', enviadoPor: 'Supervisor Carlos', dias: 12, total: 80 }
  ];

  for (const planilha of planilhas) {
    await connection.execute(
      `INSERT INTO estoque_planilhas (nome_original, caminho_arquivo, enviado_por, total_registros, criado_em)
       VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [planilha.nome, planilha.caminho, planilha.enviadoPor, planilha.total, planilha.dias]
    );
  }

  const usuarios = [
    { nome: 'Direção A2 Data', email: 'direcao@a2data.com.br', senha: 'patroes123', role: 'patrao' },
    { nome: 'Supervisora Vitória Barboza Silveira', email: 'supervisao@a2data.com.br', senha: 'supervisao123', role: 'supervisora' },
    { nome: 'Equipe ASG', email: 'asg@a2data.com.br', senha: 'limpeza123', role: 'asg' },
    { nome: 'Técnica de Enfermagem', email: 'enfermagem@a2data.com.br', senha: 'enfermagem123', role: 'enfermaria' }
  ];

  for (const usuario of usuarios) {
    await connection.execute(
      `INSERT INTO usuarios (nome, email, senha_hash, role, criado_em)
       VALUES (?, ?, ?, ?, NOW())`,
      [usuario.nome, usuario.email, hashPassword(usuario.senha), usuario.role]
    );
  }

  const [usuariosCriados] = await connection.execute(
    'SELECT id, role FROM usuarios'
  );

  const membrosASG = ['Carlos Alberto Duarte', 'Elaine Pacheco', 'Marcos Vinícius', 'Roberta Castro'];
  const membrosEnfermagem = ['Téc. Fernanda Costa'];

  for (const usuario of usuariosCriados) {
    if (usuario.role === 'asg' || usuario.role === 'supervisora') {
      for (const nome of membrosASG) {
        await connection.execute(
          `INSERT INTO equipe_membros (usuario_id, nome, role, ativo, criado_em)
           VALUES (?, ?, 'asg', 1, NOW())`,
          [usuario.id, nome]
        );
      }
    }

    if (usuario.role === 'enfermaria') {
      for (const nome of membrosEnfermagem) {
        await connection.execute(
          `INSERT INTO equipe_membros (usuario_id, nome, role, ativo, criado_em)
           VALUES (?, ?, 'enfermaria', 1, NOW())`,
          [usuario.id, nome]
        );
      }
    }

    if (usuario.role === 'supervisora') {
      await connection.execute(
        `INSERT INTO equipe_membros (usuario_id, nome, role, ativo, criado_em)
         VALUES (?, 'Vitória Barboza Silveira', 'supervisora', 1, NOW())`,
        [usuario.id]
      );
    }
  }

  const itensEstoque = [
    { tipo: 'alimentos', categoria: 'Frutas frescas', nome: 'Banana prata', unidade: 'kg', quantidade: 18, consumo: 3.5, validade: diasAtras(hoje, 6) },
    { tipo: 'alimentos', categoria: 'Proteínas', nome: 'Peito de frango', unidade: 'kg', quantidade: 25, consumo: 4.2, validade: diasAtras(hoje, 4) },
    { tipo: 'limpeza', categoria: 'Desinfetantes', nome: 'Álcool 70%', unidade: 'L', quantidade: 12, consumo: 1.2, validade: diasAtras(hoje, 20) }
  ];

  for (const item of itensEstoque) {
    await connection.execute(
      `INSERT INTO estoque_itens (tipo_estoque, categoria, nome_item, unidade, quantidade_atual, consumo_diario, validade, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [item.tipo, item.categoria, item.nome, item.unidade, item.quantidade, item.consumo, item.validade]
    );
  }

  const destinatarios = [
    { tipo: 'email', destinatario: 'gestao@auroracare.com', responsavel: 'Coordenadora Ana' },
    { tipo: 'whatsapp', destinatario: '+5511999990001', responsavel: 'Diretor Marcos' }
  ];

  for (const dest of destinatarios) {
    await connection.execute(
      `INSERT INTO config_envio (tipo_envio, destinatario, responsavel, ativo, criado_em)
       VALUES (?, ?, ?, 1, NOW())`,
      [dest.tipo, dest.destinatario, dest.responsavel]
    );
  }

  await connection.execute(
    `INSERT INTO logs_envio (tipo, destinatario, status, mensagem_erro, criado_em)
     VALUES ('email', 'gestao@auroracare.com', 'sucesso', NULL, DATE_SUB(NOW(), INTERVAL 1 DAY))`
  );

  await connection.execute(
    `INSERT INTO config_sistema (chave, valor, descricao)
     VALUES ('cron_frequencia', '0 9 * * *', 'Executar envio automático diariamente às 9h')`
  );
}

async function main() {
  console.log('🔄 Reiniciando banco de dados...');
  let connection;

  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: false
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${DB_NAME}\``);

    console.log('🏗️  Garantindo estrutura...');
    await criarEstrutura(connection);

    console.log('🧹 Limpando dados antigos (TRUNCATE)...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) {
      await connection.query(`TRUNCATE TABLE \`${table}\``).catch((error) => {
        if (error?.code !== 'ER_NO_SUCH_TABLE') {
          throw error;
        }
      });
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('🌱 Inserindo dados de exemplo...');
    await popularDados(connection);

    console.log('✅ Banco de dados reiniciado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao reiniciar o banco de dados:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
