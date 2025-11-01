const { verifyToken } = require('../utils/security');

const DEFAULT_SECRET = process.env.JWT_SECRET || 'auroracare-dev-secret';

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação não enviado.' });
    }

    const payload = verifyToken(token, DEFAULT_SECRET);
    req.user = {
      id: payload.sub,
      nome: payload.name,
      role: payload.role
    };

    next();
  } catch (error) {
    console.warn('Falha na autenticação:', error.message);
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = { authenticate };
