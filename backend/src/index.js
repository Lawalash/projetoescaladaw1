// QW1 Backend - Servidor Principal
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Rotas
const vendasRoutes = require('./routes/vendas');

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

// Pasta de uploads
app.use('/uploads', express.static('uploads'));

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
app.use('/api/vendas', vendasRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    name: 'QW1 API - Automação de Relatórios',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      vendas: '/api/vendas',
      topProdutos: '/api/vendas/top-produtos',
      snapshot: '/api/relatorio/snapshot',
      export: '/api/export/csv',
      etl: '/api/etl/run',
      upload: '/api/upload-csv',
      notificacoes: '/api/notificacao/testar'
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
║   QW1 Backend API                      ║
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