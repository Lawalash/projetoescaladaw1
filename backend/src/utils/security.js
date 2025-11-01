const crypto = require('crypto');

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 horas

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  if (!password) {
    throw new Error('Senha obrigatória para hash.');
  }

  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash) {
    return false;
  }

  const candidate = storedHash.trim();

  // Formato "salt:hash" gerado por scrypt
  if (candidate.includes(':')) {
    const [salt, hash] = candidate.split(':');
    if (!salt || !hash) {
      return false;
    }

    try {
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const storedKey = Buffer.from(hash, 'hex');

      if (derivedKey.length !== storedKey.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedKey, storedKey);
    } catch (error) {
      return false;
    }
  }

  // Fallback para hashes SHA-256 (ex.: gerados via `SHA2('senha', 256)` no MySQL)
  try {
    const derivedKey = crypto.createHash('sha256').update(password, 'utf8').digest();
    const storedKey = Buffer.from(candidate, 'hex');

    if (derivedKey.length !== storedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, storedKey);
  } catch (error) {
    return false;
  }
}

function encodeBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function decodeBase64Url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function generateToken({ sub, name, role }, secret, expiresInSeconds = DEFAULT_TOKEN_TTL_SECONDS) {
  if (!secret) {
    throw new Error('Segredo do token não configurado.');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    name,
    role,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds
  };

  const headerEncoded = encodeBase64Url(JSON.stringify(header));
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function verifyToken(token, secret) {
  if (!token || !secret) {
    throw new Error('Token ou segredo ausente.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token malformado.');
  }

  const [headerEncoded, payloadEncoded, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');

  const providedSig = Buffer.from(signature, 'base64url');
  const expectedSig = Buffer.from(expectedSignature, 'base64url');

  if (providedSig.length !== expectedSig.length || !crypto.timingSafeEqual(providedSig, expectedSig)) {
    throw new Error('Assinatura inválida.');
  }

  const payload = JSON.parse(decodeBase64Url(payloadEncoded));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expirado.');
  }

  return payload;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken
};
