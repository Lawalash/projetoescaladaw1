// A2 Data Monitoramento Ocupacional - Servidor Principal
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// Rotas
const larRoutes = require('./routes/lar');
const authRoutes = require('./routes/auth');
const { authenticate } = require('./middleware/authMiddleware');

// Inicializar app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware de segurança
app.use(helmet());

// CORS - permitir apenas origem específica
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting para prevenir abuso
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Muitas requisições deste IP, tente novamente mais tarde.'
});
app.use('/api/', limiter);

// Logging de requisições
app.use(morgan('combined'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Garantir pastas de upload
const uploadsDir = path.join(__dirname, '..', 'uploads');
const planilhasDir = path.join(uploadsDir, 'planilhas');
const pontosDir = path.join(uploadsDir, 'pontos');
[uploadsDir, planilhasDir, pontosDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Pasta de uploads
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/lar', authenticate, larRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    name: 'A2 Data Monitoramento Ocupacional - API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      painel: '/api/lar/painel',
      auth: '/api/auth/login',
      inventario: '/api/lar/inventario/upload',
      notificacoes: '/api/lar/notificacoes/testar',
      configNotificacoes: '/api/lar/config/notificacoes'
    }
  });
});

// Tratamento de rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.path,
    method: req.method
  });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Erro capturado:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   A2 Data · Monitoramento Ocupacional  ║
║   Porta: ${PORT}                         ║
║   Ambiente: ${process.env.NODE_ENV || 'development'}              ║
║   CORS: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}   ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido. Encerrando servidor...');
  process.exit(0);
});

module.exports = app;
