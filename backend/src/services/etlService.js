// Serviço de ETL - importação e processamento de dados
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { query } = require('../db/connection');

/**
 * Processa CSV usando Node.js (alternativa ao Python)
 */
exports.processarCSVNode = async (filePath) => {
  try {
    // Ler arquivo CSV
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    let inseridos = 0;
    let erros = 0;
    const errosDetalhes = [];
    
    // Inserir cada registro
    for (const record of records) {
      try {
        // Validar campos obrigatórios
        if (!record.data_venda || !record.produto || !record.preco_unitario) {
          erros++;
          errosDetalhes.push({ linha: inseridos + erros, erro: 'Campos obrigatórios faltando' });
          continue;
        }
        
        // Calcular total se não existir
        const quantidade = parseInt(record.quantidade) || 1;
        const precoUnitario = parseFloat(record.preco_unitario);
        const total = record.total ? parseFloat(record.total) : quantidade * precoUnitario;
        
        // Inserir no banco
        await query(`
          INSERT INTO vendas (data_venda, hora_venda, loja, produto, quantidade, preco_unitario, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          record.data_venda,
          record.hora_venda || null,
          record.loja || 'Loja Padrão',
          record.produto,
          quantidade,
          precoUnitario,
          total
        ]);
        
        inseridos++;
      } catch (error) {
        erros++;
        errosDetalhes.push({ 
          linha: inseridos + erros, 
          erro: error.message 
        });
      }
    }
    
    // Remover arquivo após processamento
    fs.unlinkSync(filePath);
    
    return {
      processados: records.length,
      inseridos,
      erros,
      ...(erros > 0 && { errosDetalhes: errosDetalhes.slice(0, 10) }) // Mostrar até 10 erros
    };
  } catch (error) {
    throw new Error(`Erro ao processar CSV: ${error.message}`);
  }
};

/**
 * Executa script Python para ETL
 */
exports.executarETLPython = (filePath) => {
  return new Promise((resolve, reject) => {
    // Caminho para o script Python
    const scriptPath = path.join(__dirname, '../../..', 'etl', 'etl.py');
    
    // Verificar se arquivo existe
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error('Script Python ETL não encontrado'));
    }
    
    // Executar Python
    const pythonProcess = spawn('python', [scriptPath, '--file', filePath]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ETL Python falhou: ${stderr}`));
      }
      
      try {
        // Parse da saída JSON do Python
        const resultado = JSON.parse(stdout);
        resolve(resultado);
      } catch (error) {
        resolve({ 
          message: 'ETL executado com sucesso', 
          output: stdout 
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Erro ao executar Python: ${error.message}`));
    });
  });
};

/**
 * Validar estrutura do CSV
 */
exports.validarCSV = (filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      to_line: 5 // Ler apenas 5 linhas para validação
    });
    
    const colunasObrigatorias = ['data_venda', 'produto', 'preco_unitario'];
    const colunas = records.length > 0 ? Object.keys(records[0]) : [];
    
    const colunasFaltando = colunasObrigatorias.filter(col => !colunas.includes(col));
    
    if (colunasFaltando.length > 0) {
      return {
        valido: false,
        erro: `Colunas obrigatórias faltando: ${colunasFaltando.join(', ')}`
      };
    }
    
    return { valido: true, colunas };
  } catch (error) {
    return { valido: false, erro: error.message };
  }
};

module.exports = exports;