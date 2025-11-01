// Controller com toda lógica de negócio
const { query } = require('../db/connection');
const etlService = require('../services/etlService');
const notificationService = require('../services/notificationService');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Listar vendas com filtros opcionais
exports.listarVendas = async (req, res) => {
  try {
    const { start, end, loja, produto, limit = 100, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM vendas WHERE 1=1';
    const params = [];
    
    if (start) {
      sql += ' AND data_venda >= ?';
      params.push(start);
    }
    
    if (end) {
      sql += ' AND data_venda <= ?';
      params.push(end);
    }
    
    if (loja) {
      sql += ' AND loja = ?';
      params.push(loja);
    }
    
    if (produto) {
      sql += ' AND produto LIKE ?';
      params.push(`%${produto}%`);
    }
    
    sql += ' ORDER BY data_venda DESC, hora_venda DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const vendas = await query(sql, params);
    
    // Contar total para paginação
    let countSql = 'SELECT COUNT(*) as total FROM vendas WHERE 1=1';
    const countParams = [];
    if (start) { countSql += ' AND data_venda >= ?'; countParams.push(start); }
    if (end) { countSql += ' AND data_venda <= ?'; countParams.push(end); }
    if (loja) { countSql += ' AND loja = ?'; countParams.push(loja); }
    if (produto) { countSql += ' AND produto LIKE ?'; countParams.push(`%${produto}%`); }
    
    const [{ total }] = await query(countSql, countParams);
    
    res.json({
      data: vendas,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
};

// Top produtos mais vendidos
// Top produtos mais vendidos (corrigido: data calculada em JS; LIMIT concatenado)
exports.topProdutos = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));
    const period = Math.max(1, parseInt(req.query.period || '30', 10));

    // calcular data inicial YYYY-MM-DD
    const d = new Date();
    d.setDate(d.getDate() - period);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dataInicio = `${yyyy}-${mm}-${dd}`;

    // OBS: concatenamos LIMIT porque alguns servidores MySQL não aceitam placeholder para LIMIT
    const sql = `
      SELECT 
        produto,
        COUNT(*) as num_vendas,
        SUM(quantidade) as quantidade_vendida,
        SUM(total) as receita_total,
        AVG(preco_unitario) as preco_medio
      FROM vendas
      WHERE data_venda >= ?
      GROUP BY produto
      ORDER BY receita_total DESC
      LIMIT ${limit}
    `;

    const rows = await query(sql, [dataInicio]);

    const produtos = rows.map(p => ({
      produto: p.produto,
      num_vendas: Number(p.num_vendas) || 0,
      quantidade_vendida: Number(p.quantidade_vendida) || 0,
      receita_total: parseFloat(p.receita_total || 0),
      preco_medio: parseFloat(p.preco_medio || 0)
    }));

    res.json({ data: produtos });
  } catch (error) {
    console.error('Erro ao buscar top produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar top produtos' });
  }
};


// Dados agregados para dashboard
exports.dadosAgregados = async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Vendas por dia
    const vendasPorDia = await query(`
      SELECT 
        data_venda,
        COUNT(*) as num_vendas,
        SUM(quantidade) as quantidade_total,
        SUM(total) as receita_total
      FROM vendas
      WHERE data_venda >= ? AND data_venda <= ?
      GROUP BY data_venda
      ORDER BY data_venda ASC
    `, [start, end]);
    
    // KPIs gerais
    const [kpis] = await query(`
      SELECT 
        COUNT(*) as total_vendas,
        SUM(total) as receita_total,
        AVG(total) as ticket_medio,
        SUM(quantidade) as itens_vendidos
      FROM vendas
      WHERE data_venda >= ? AND data_venda <= ?
    `, [start, end]);
    
    // Vendas por loja
    const vendasPorLoja = await query(`
      SELECT 
        loja,
        COUNT(*) as num_vendas,
        SUM(total) as receita_total
      FROM vendas
      WHERE data_venda >= ? AND data_venda <= ?
      GROUP BY loja
      ORDER BY receita_total DESC
    `, [start, end]);
    
    res.json({
      vendasPorDia,
      kpis,
      vendasPorLoja
    });
  } catch (error) {
    console.error('Erro ao buscar dados agregados:', error);
    res.status(500).json({ error: 'Erro ao buscar dados agregados' });
  }
};

// Upload e processamento de CSV
exports.uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    const filePath = req.file.path;
    const resultado = await etlService.processarCSVNode(filePath);
    
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    console.error('Erro ao processar CSV:', error);
    res.status(500).json({ error: 'Erro ao processar CSV: ' + error.message });
  }
};

// Gerar snapshot do relatório
exports.gerarSnapshot = async (req, res) => {
  try {
    const periodParam = req.query.period || '7';
    const dias = Math.max(1, parseInt(periodParam, 10));

    const d = new Date();
    d.setDate(d.getDate() - dias);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dataInicio = `${yyyy}-${mm}-${dd}`;

    const [kpis] = await query(`
      SELECT 
        COUNT(*) as total_vendas,
        SUM(total) as receita_total,
        AVG(total) as ticket_medio
      FROM vendas
      WHERE data_venda >= ?
    `, [dataInicio]);

    const topProdutos = await query(`
      SELECT produto, SUM(total) as receita
      FROM vendas
      WHERE data_venda >= ?
      GROUP BY produto
      ORDER BY receita DESC
      LIMIT 5
    `, [dataInicio]);

    res.json({
      periodo: `Últimos ${dias} dias`,
      kpis,
      topProdutos,
      geradoEm: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao gerar snapshot:', error);
    res.status(500).json({ error: 'Erro ao gerar snapshot' });
  }
};

// Exportar dados como CSV
exports.exportarCSV = async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const vendas = await query(`
      SELECT 
        data_venda,
        hora_venda,
        loja,
        produto,
        quantidade,
        preco_unitario,
        total
      FROM vendas
      WHERE data_venda >= ? AND data_venda <= ?
      ORDER BY data_venda DESC
    `, [start, end]);
    
    const csv = stringify(vendas, {
      header: true,
      columns: ['data_venda', 'hora_venda', 'loja', 'produto', 'quantidade', 'preco_unitario', 'total']
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio_${start}_${end}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    res.status(500).json({ error: 'Erro ao exportar CSV' });
  }
};

// Executar ETL via Python
exports.executarETL = async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Caminho do arquivo é obrigatório' });
    }
    
    const resultado = await etlService.executarETLPython(filePath);
    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('Erro ao executar ETL:', error);
    res.status(500).json({ error: 'Erro ao executar ETL: ' + error.message });
  }
};

// Testar envio de notificações
exports.testarNotificacao = async (req, res) => {
  try {
    const { tipo, destinatario } = req.body;
    
    const snapshot = await query(`
      SELECT COUNT(*) as total, SUM(total) as receita
      FROM vendas
      WHERE data_venda >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);
    
    if (tipo === 'email') {
      await notificationService.enviarEmail(
        destinatario,
        'Teste - Relatório QW1',
        `<h1>Relatório de Teste</h1><p>Total: ${snapshot[0].total} vendas</p>`
      );
    } else if (tipo === 'whatsapp') {
      await notificationService.enviarWhatsApp(
        destinatario,
        `📊 Relatório QW1 - Teste\nVendas: ${snapshot[0].total}\nReceita: R$ ${snapshot[0].receita}`
      );
    }
    
    res.json({ success: true, message: 'Notificação enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar: ' + error.message });
  }
};

// Obter configurações de envio
exports.obterConfigEnvio = async (req, res) => {
  try {
    const configs = await query('SELECT * FROM config_envio WHERE ativo = 1');
    const sistema = await query('SELECT * FROM config_sistema');
    
    res.json({ destinatarios: configs, sistema });
  } catch (error) {
    console.error('Erro ao obter configs:', error);
    res.status(500).json({ error: 'Erro ao obter configurações' });
  }
};

// Salvar configurações de envio
exports.salvarConfigEnvio = async (req, res) => {
  try {
    const { tipo_envio, destinatario } = req.body;
    
    await query(
      'INSERT INTO config_envio (tipo_envio, destinatario) VALUES (?, ?)',
      [tipo_envio, destinatario]
    );
    
    res.json({ success: true, message: 'Destinatário adicionado' });
  } catch (error) {
    console.error('Erro ao salvar config:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
};

// Remover destinatário
exports.removerDestinatario = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM config_envio WHERE id = ?', [id]);
    res.json({ success: true, message: 'Destinatário removido' });
  } catch (error) {
    console.error('Erro ao remover:', error);
    res.status(500).json({ error: 'Erro ao remover destinatário' });
  }
};