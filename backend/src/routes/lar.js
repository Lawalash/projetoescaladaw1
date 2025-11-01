const express = require('express');
const multer = require('multer');
const path = require('path');
const larController = require('../controllers/larController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/planilhas');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado. Envie CSV ou Excel.'));
    }
  }
});

router.get('/painel', larController.obterPainelCompleto);
router.post('/inventario/upload', upload.single('arquivo'), larController.uploadPlanilhaEstoque);
router.post('/notificacoes/testar', larController.testarNotificacao);
router.get('/config/notificacoes', larController.obterConfigNotificacoes);
router.post('/config/notificacoes', larController.salvarConfigNotificacao);
router.delete('/config/notificacoes/:id', larController.removerNotificacao);

module.exports = router;
