// Serviço de ETL - importação e processamento de dados
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { query } = require('../db/connection');

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

module.exports = exports;

exports.processarPlanilhaEstoque = async (filePath, tipoEstoque = 'alimentos') => {
  try {
    let xlsx;
    const extensao = path.extname(filePath).toLowerCase();
    let registros = [];

    if (extensao === '.csv') {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      registros = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } else if (extensao === '.xlsx' || extensao === '.xls') {
      try {
        // eslint-disable-next-line global-require
        xlsx = require('xlsx');
      } catch (error) {
        throw new Error('Dependência "xlsx" não instalada. Execute npm install na pasta backend.');
      }
      const workbook = xlsx.readFile(filePath, { cellDates: true });
      const primeiraAba = workbook.SheetNames[0];
      const sheet = workbook.Sheets[primeiraAba];
      registros = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
    } else {
      throw new Error('Formato não suportado para planilha de estoque');
    }

    let inseridos = 0;
    let erros = 0;
    const errosDetalhes = [];

    for (const [indice, registro] of registros.entries()) {
      try {
        const categoria = registro.categoria || registro.Categoria || registro.setor || 'Geral';
        const item = registro.item || registro.Item || registro.nome || registro.Nome;
        const unidade = registro.unidade || registro.Unidade || registro.medida || null;
        const quantidade = Number.parseFloat(registro.quantidade || registro.Quantidade || 0) || 0;
        const consumoDiario = Number.parseFloat(
          registro.consumo_diario ||
            registro.consumoDiario ||
            registro['Consumo Diário'] ||
            0
        ) || 0;
        const validade = registro.validade || registro.Validade || null;
        const lote = registro.lote || registro.Lote || null;
        const fornecedor = registro.fornecedor || registro.Fornecedor || null;
        const observacoes = registro.observacoes || registro.Observacoes || registro['Observações'] || null;

        if (!item) {
          throw new Error('Coluna "item" não encontrada na planilha');
        }

        await query(
          `
            INSERT INTO estoque_itens
              (tipo_estoque, categoria, nome_item, unidade, quantidade_atual, consumo_diario, validade, lote, fornecedor, observacoes, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          `,
          [
            tipoEstoque,
            categoria,
            item,
            unidade,
            quantidade,
            consumoDiario,
            validade ? new Date(validade) : null,
            lote,
            fornecedor,
            observacoes
          ]
        );

        inseridos += 1;
      } catch (error) {
        erros += 1;
        errosDetalhes.push({ linha: indice + 2, erro: error.message });
      }
    }

    fs.unlinkSync(filePath);

    return {
      registros: registros.length,
      inseridos,
      erros,
      errosDetalhes: errosDetalhes.slice(0, 15)
    };
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw new Error(`Erro ao processar planilha de estoque: ${error.message}`);
  }
};