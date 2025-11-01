// Serviço de notificações - E-mail e WhatsApp
const nodemailer = require('nodemailer');
const { Vonage } = require('@vonage/server-sdk');
const { query } = require('../db/connection');

/**
 * Configurar transportador de e-mail
 */
const criarTransportadorEmail = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Enviar e-mail
 */
exports.enviarEmail = async (destinatario, assunto, htmlContent) => {
  try {
    const transporter = criarTransportadorEmail();
    
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'AuroraCare'}" <${process.env.EMAIL_FROM}>`,
      to: destinatario,
      subject: assunto,
      html: htmlContent
    });
    
    // Registrar log
    await query(
      'INSERT INTO logs_envio (tipo, destinatario, status) VALUES (?, ?, ?)',
      ['email', destinatario, 'sucesso']
    );
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    
    // Registrar erro
    await query(
      'INSERT INTO logs_envio (tipo, destinatario, status, mensagem_erro) VALUES (?, ?, ?, ?)',
      ['email', destinatario, 'erro', error.message]
    );
    
    throw error;
  }
};

/**
 * Enviar WhatsApp via Vonage
 */
exports.enviarWhatsApp = async (numeroDestinatario, mensagem) => {
  try {
    // Verificar se credenciais existem
    if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
      throw new Error('Credenciais Vonage não configuradas');
    }
    
    const vonage = new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET
    });
    
    const from = process.env.WHATSAPP_FROM;
    const to = numeroDestinatario.replace(/\D/g, ''); // Remover não-dígitos
    
    // Enviar mensagem
    const response = await vonage.messages.send({
      message_type: 'text',
      text: mensagem,
      to,
      from,
      channel: 'whatsapp'
    });
    
    // Registrar log
    await query(
      'INSERT INTO logs_envio (tipo, destinatario, status) VALUES (?, ?, ?)',
      ['whatsapp', numeroDestinatario, 'sucesso']
    );
    
    return { success: true, messageId: response.message_uuid };
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    
    // Registrar erro
    await query(
      'INSERT INTO logs_envio (tipo, destinatario, status, mensagem_erro) VALUES (?, ?, ?, ?)',
      ['whatsapp', numeroDestinatario, 'erro', error.message]
    );
    
    throw error;
  }
};

/**
 * Alternativa: Enviar WhatsApp via Twilio (comentado)
 */
exports.enviarWhatsAppTwilio = async (numeroDestinatario, mensagem) => {
  /*
  const twilio = require('twilio');
  
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  
  try {
    const message = await client.messages.create({
      body: mensagem,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${numeroDestinatario}`
    });
    
    await query(
      'INSERT INTO logs_envio (tipo, destinatario, status) VALUES (?, ?, ?)',
      ['whatsapp', numeroDestinatario, 'sucesso']
    );
    
    return { success: true, sid: message.sid };
  } catch (error) {
    await query(
      'INSERT INTO logs_envio (tipo, destinatario, status, mensagem_erro) VALUES (?, ?, ?, ?)',
      ['whatsapp', numeroDestinatario, 'erro', error.message]
    );
    throw error;
  }
  */
  throw new Error('Implementação Twilio comentada. Descomente o código acima para usar.');
};

/**
 * Gerar HTML do relatório para e-mail
 */
exports.gerarHTMLRelatorio = (dados) => {
  const {
    periodo,
    residentesAtivos,
    taxaOcupacao,
    taxaMedicacao,
    obitosPeriodo,
    internacoesPeriodo,
    ocupacaoSemanal = [],
    adesaoAla = [],
    estoqueCritico = {}
  } = dados;

  const listaOcupacao = ocupacaoSemanal
    .map((item) => `<li><strong>${item.semana}</strong>: ${item.taxa_ocupacao || 0}%</li>`)
    .join('');

  const listaAderencia = adesaoAla
    .map((item) => `<li>${item.ala}: ${item.taxa || 0}%</li>`)
    .join('');

  const listaEstoque = [
    ...(estoqueCritico.alimentos || []).map(
      (item) => `<li>🍎 ${item.categoria}: ${item.dias || 0} dias</li>`
    ),
    ...(estoqueCritico.limpeza || []).map(
      (item) => `<li>🧼 ${item.categoria}: ${item.dias || 0} dias</li>`
    )
  ].join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f7fb; margin: 0; padding: 32px; }
          .wrapper { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(66, 87, 178, 0.15); }
          .header { background: linear-gradient(135deg, #5ca4a9 0%, #4257b2 100%); color: #fff; padding: 28px; }
          .header h1 { margin: 0 0 4px 0; font-size: 24px; }
          .header p { margin: 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 28px; color: #1f2d3d; }
          .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
          .kpi { background: #f8fafc; border-radius: 14px; padding: 16px; border: 1px solid rgba(66, 87, 178, 0.12); }
          .kpi span { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 6px; }
          .kpi strong { font-size: 22px; color: #1f2d3d; }
          h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.6px; color: #4257b2; margin-top: 24px; margin-bottom: 12px; }
          ul { padding-left: 18px; margin: 0 0 16px 0; color: #475569; }
          .footer { background: #f8fafc; padding: 20px 28px; font-size: 12px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>Relatório AuroraCare</h1>
            <p>${periodo || 'Período atual'} · ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          <div class="content">
            <div class="kpi-grid">
              <div class="kpi"><span>Residentes ativos</span><strong>${residentesAtivos || 0}</strong></div>
              <div class="kpi"><span>Taxa de ocupação</span><strong>${taxaOcupacao}%</strong></div>
              <div class="kpi"><span>Adesão à medicação</span><strong>${taxaMedicacao}%</strong></div>
              <div class="kpi"><span>Óbitos no período</span><strong>${obitosPeriodo || 0}</strong></div>
            </div>

            <h2>Variação semanal de ocupação</h2>
            <ul>${listaOcupacao || '<li>Sem dados registrados</li>'}</ul>

            <h2>Aderência por ala</h2>
            <ul>${listaAderencia || '<li>Sem dados registrados</li>'}</ul>

            <h2>Alertas de cobertura de estoque</h2>
            <ul>${listaEstoque || '<li>Nenhum item crítico detectado</li>'}</ul>
          </div>
          <div class="footer">
            AuroraCare · Tecnologia para cuidado humanizado · ${new Date().toLocaleString('pt-BR')}
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Enviar relatório para todos os destinatários configurados
 */
exports.enviarRelatorioAutomatico = async (dadosRelatorio) => {
  try {
    // Buscar destinatários ativos
    const destinatarios = await query(
      'SELECT * FROM config_envio WHERE ativo = 1'
    );
    
    if (destinatarios.length === 0) {
      console.log('Nenhum destinatário configurado para envio automático');
      return { success: false, message: 'Nenhum destinatário configurado' };
    }
    
    const resultados = [];
    
    for (const dest of destinatarios) {
      try {
        if (dest.tipo_envio === 'email') {
          const html = exports.gerarHTMLRelatorio(dadosRelatorio);
          await exports.enviarEmail(
            dest.destinatario,
            'AuroraCare · Atualização automatizada',
            html
          );
          resultados.push({ tipo: 'email', destinatario: dest.destinatario, status: 'enviado' });
        } else if (dest.tipo_envio === 'whatsapp') {
          const mensagem = `
📊 *AuroraCare - Resumo do lar*

*Período:* ${dadosRelatorio.periodo}
*Residentes ativos:* ${dadosRelatorio.residentesAtivos}
*Ocupação:* ${dadosRelatorio.taxaOcupacao}%
*Adesão à medicação:* ${dadosRelatorio.taxaMedicacao}%
*Óbitos / Internações:* ${dadosRelatorio.obitosPeriodo} / ${dadosRelatorio.internacoesPeriodo}

*Ocupação semanal:*
${(dadosRelatorio.ocupacaoSemanal || [])
  .map((item) => `• ${item.semana}: ${item.taxa_ocupacao || 0}%`)
  .join('\n')}

*Estoques críticos:*
${[...(dadosRelatorio.estoqueCritico?.alimentos || []), ...(dadosRelatorio.estoqueCritico?.limpeza || [])]
  .map((item) => `• ${item.categoria}: ${item.dias || 0} dias`)
  .join('\n') || '• Cobertura regular'}

_Gerado automaticamente em ${new Date().toLocaleString('pt-BR')}_
          `.trim();
          
          await exports.enviarWhatsApp(dest.destinatario, mensagem);
          resultados.push({ tipo: 'whatsapp', destinatario: dest.destinatario, status: 'enviado' });
        }
      } catch (error) {
        console.error(`Erro ao enviar para ${dest.destinatario}:`, error);
        resultados.push({ 
          tipo: dest.tipo_envio, 
          destinatario: dest.destinatario, 
          status: 'erro',
          erro: error.message 
        });
      }
    }
    
    return { success: true, resultados };
  } catch (error) {
    console.error('Erro no envio automático:', error);
    throw error;
  }
};

module.exports = exports;