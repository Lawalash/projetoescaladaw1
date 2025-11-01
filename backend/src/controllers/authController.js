const { query } = require('../db/connection');
const { verifyPassword, generateToken } = require('../utils/security');
const operacionalService = require('../services/operacionalService');

const DEFAULT_SECRET = process.env.JWT_SECRET || 'auroracare-dev-secret';

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body || {};

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const [usuario] = await query(
      'SELECT id, nome, email, senha_hash AS senhaHash, role FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );

    if (!usuario || !verifyPassword(senha, usuario.senhaHash)) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = generateToken(
      { sub: usuario.id, name: usuario.nome, role: usuario.role },
      DEFAULT_SECRET
    );

    const membrosEquipe = await operacionalService.obterEquipePorUsuario(usuario.id, usuario.role);

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role
      },
      membrosEquipe
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Não foi possível autenticar o usuário.' });
  }
};
