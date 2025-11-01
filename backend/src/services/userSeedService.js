const { query } = require('../db/connection');
const { hashPassword } = require('../utils/security');

const USER_ROLE_ENUM = "ENUM('patrao','asg','enfermaria','supervisora')";

const DEFAULT_USERS = [
  { nome: 'Direção A2 Data', email: 'direcao@a2data.com.br', senha: 'patroes123', role: 'patrao' },
  { nome: 'Supervisora Vitória Barboza Silveira', email: 'supervisao@a2data.com.br', senha: 'supervisao123', role: 'supervisora' },
  { nome: 'Equipe ASG', email: 'asg@a2data.com.br', senha: 'limpeza123', role: 'asg' },
  { nome: 'Técnica de Enfermagem', email: 'enfermagem@a2data.com.br', senha: 'enfermagem123', role: 'enfermaria' }
];

async function ensureUsuarioRoleEnum() {
  try {
    await query(
      `ALTER TABLE usuarios MODIFY role ${USER_ROLE_ENUM} NOT NULL DEFAULT 'asg'`
    );
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR' || error?.code === 'ER_NO_SUCH_TABLE') {
      return;
    }

    if (error?.code !== 'ER_DUP_FIELDNAME') {
      console.warn('Não foi possível ajustar enum de roles da tabela usuarios:', error.message);
    }
  }
}

async function ensureDefaultUsers() {
  try {
    const tabelaUsuarios = await query("SHOW TABLES LIKE 'usuarios'");
    if (!tabelaUsuarios.length) {
      return;
    }

    await ensureUsuarioRoleEnum();

    for (const usuario of DEFAULT_USERS) {
      const existente = await query(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        [usuario.email]
      );

      if (existente.length) {
        continue;
      }

      await query(
        `INSERT INTO usuarios (nome, email, senha_hash, role, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [usuario.nome, usuario.email, hashPassword(usuario.senha), usuario.role]
      );
    }
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') {
      console.warn('Não foi possível garantir usuários padrão:', error.message);
    }
  }
}

module.exports = {
  ensureUsuarioRoleEnum,
  ensureDefaultUsers
};
