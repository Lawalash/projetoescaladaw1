// Jobs agendados com node-cron
require('dotenv').config();
const cron = require('node-cron');
const { query } = require('../src/db/connection');
const notificationService = require('../src/services/notificationService');

console.log('🕐 Iniciando serviço de agendamento QW1...');

// Verificar se cron está habilitado
if (process.env.ENABLE_CRON !== 'true') {
  console.log('⚠️  Cron desabilitado via variável ENABLE_CRON');
  process.exit(0);
}

/**
 * Gerar dados do relatório
 */
async function gerarDadosRelatorio(dias = 7) {
  try {
    // KPIs
    const [kpis] = await query(`
      SELECT 
        COUNT(*) as total_vendas,
        SUM(total) as receita_total,
        AVG(total) as ticket_medio,
        SUM(quantidade) as itens_vendidos
      FROM vendas
      WHERE data_venda >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [dias]);
    
    // Top produtos
    const topProdutos = await query(`
      SELECT 
        produto,
        SUM(total) as receita,
        SUM(quantidade) as quantidade
      FROM vendas
      WHERE data_venda >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY produto
      ORDER BY receita DESC
      LIMIT 5
    `, [dias]);
    
    return {
      periodo: `Últimos ${dias} dias`,
      kpis,
      topProdutos,
      geradoEm: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao gerar dados:', error);
    throw error;
  }
}

/**
 * Job principal: enviar relatórios
 */
async function jobEnviarRelatorios() {
  console.log(`\n📊 [${new Date().toLocaleString()}] Executando job de envio de relatórios...`);
  
  try {
    // Gerar dados
    const dados = await gerarDadosRelatorio(7);
    
    // Enviar para todos os destinatários
    const resultado = await notificationService.enviarRelatorioAutomatico(dados);
    
    if (resultado.success) {
      console.log('✅ Relatórios enviados com sucesso!');
      console.log(`   - Total de envios: ${resultado.resultados.length}`);
      console.log(`   - Sucesso: ${resultado.resultados.filter(r => r.status === 'enviado').length}`);
      console.log(`   - Erros: ${resultado.resultados.filter(r => r.status === 'erro').length}`);
    } else {
      console.log('⚠️  Nenhum destinatário configurado');
    }
  } catch (error) {
    console.error('❌ Erro ao executar job:', error.message);
  }
}

/**
 * Obter expressão cron do banco ou env
 */
async function obterExpressaoCron() {
  try {
    const [config] = await query(
      "SELECT valor FROM config_sistema WHERE chave = 'cron_frequencia' LIMIT 1"
    );
    
    if (config && config.valor) {
      return config.valor;
    }
  } catch (error) {
    console.warn('Não foi possível buscar config do banco, usando .env');
  }
  
  return process.env.CRON_EXPRESSION || '0 * * * *'; // Padrão: a cada hora
}

/**
 * Inicializar cron
 */
(async () => {
  try {
    const expressaoCron = await obterExpressaoCron();
    
    console.log(`📅 Agendamento configurado: "${expressaoCron}"`);
    console.log('   Exemplos de expressões:');
    console.log('   - */30 * * * *   = A cada 30 minutos');
    console.log('   - 0 * * * *      = A cada hora');
    console.log('   - 0 9 * * *      = Diariamente às 9h');
    console.log('   - 0 9 * * 1      = Toda segunda às 9h');
    console.log('   - 0 9,17 * * *   = Às 9h e 17h todos os dias\n');
    
    // Validar expressão cron
    if (!cron.validate(expressaoCron)) {
      throw new Error(`Expressão cron inválida: ${expressaoCron}`);
    }
    
    // Agendar job
    const job = cron.schedule(expressaoCron, jobEnviarRelatorios, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });
    
    console.log('✅ Job agendado com sucesso!');
    console.log('⏳ Aguardando próxima execução...\n');
    
    // Executar imediatamente ao iniciar (opcional)
    if (process.env.RUN_ON_START === 'true') {
      console.log('🚀 Executando job inicial...');
      await jobEnviarRelatorios();
    }
    
    // Manter processo rodando
    process.on('SIGTERM', () => {
      console.log('\n⚠️  SIGTERM recebido. Parando jobs...');
      job.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('\n⚠️  SIGINT recebido. Parando jobs...');
      job.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Erro ao inicializar cron:', error.message);
    process.exit(1);
  }
})();

// Exportar para testes
module.exports = { jobEnviarRelatorios, gerarDadosRelatorio };