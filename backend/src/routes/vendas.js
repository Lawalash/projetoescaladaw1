// Rotas para vendas e relatórios
const express = require('express');
const router = express.Router();
const multer = require('multer');
const vendasController = require('../controllers/vendasController');

// Configurar multer para upload de CSV
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || 
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos CSV são permitidos!'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 } // 10MB
});

// GET /api/vendas - Listar vendas com filtros
router.get('/', vendasController.listarVendas);

// GET /api/vendas/top-produtos - Top produtos mais vendidos
router.get('/top-produtos', vendasController.topProdutos);

// GET /api/vendas/agregado - Dados agregados para dashboard
router.get('/agregado', vendasController.dadosAgregados);

// POST /api/vendas/upload - Upload de CSV
router.post('/upload', upload.single('arquivo'), vendasController.uploadCSV);

// GET /api/relatorio/snapshot - Snapshot para envio
router.get('/relatorio/snapshot', vendasController.gerarSnapshot);

// GET /api/export/csv - Exportar dados como CSV
router.get('/export/csv', vendasController.exportarCSV);

// POST /api/etl/run - Executar ETL manualmente
router.post('/etl/run', vendasController.executarETL);

// POST /api/notificacao/testar - Testar envio de notificações
router.post('/notificacao/testar', vendasController.testarNotificacao);

// GET /api/config/envio - Obter configurações de envio
router.get('/config/envio', vendasController.obterConfigEnvio);

// POST /api/config/envio - Salvar configurações de envio
router.post('/config/envio', vendasController.salvarConfigEnvio);

// DELETE /api/config/envio/:id - Remover destinatário
router.delete('/config/envio/:id', vendasController.removerDestinatario);

module.exports = router;