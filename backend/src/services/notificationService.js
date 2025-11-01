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
      from: `"${process.env.EMAIL_FROM_NAME || 'QW1 Relatórios'}" <${process.env.EMAIL_FROM}>`,
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
  const { kpis, topProdutos, periodo } = dados;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .kpi { background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .kpi-label { font-size: 14px; color: #666; }
        .kpi-value { font-size: 24px; font-weight: bold; color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #4CAF50; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📊 Relatório QW1 - ${periodo || 'Período Atual'}</h1>
        
        <div class="kpi">
          <div class="kpi-label">Total de Vendas</div>
          <div class="kpi-value">${kpis.total_vendas || 0}</div>
        </div>
        
        <div class="kpi">
          <div class="kpi-label">Receita Total</div>
          <div class="kpi-value">R$ ${parseFloat(kpis.receita_total || 0).toFixed(2)}</div>
        </div>
        
        <div class="kpi">
          <div class="kpi-label">Ticket Médio</div>
          <div class="kpi-value">R$ ${parseFloat(kpis.ticket_medio || 0).toFixed(2)}</div>
        </div>
        
        <h2 style="margin-top: 30px;">🏆 Top 5 Produtos</h2>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Receita</th>
            </tr>
          </thead>
          <tbody>
            ${topProdutos.map(p => `
              <tr>
                <td>${p.produto}</td>
                <td>R$ ${parseFloat(p.receita || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Relatório gerado automaticamente por QW1 - Automação de Relatórios</p>
          <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
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
            'Relatório Automático QW1',
            html
          );
          resultados.push({ tipo: 'email', destinatario: dest.destinatario, status: 'enviado' });
        } else if (dest.tipo_envio === 'whatsapp') {
          const mensagem = `
📊 *Relatório QW1*

*Período:* ${dadosRelatorio.periodo}
*Total de Vendas:* ${dadosRelatorio.kpis.total_vendas}
*Receita Total:* R$ ${parseFloat(dadosRelatorio.kpis.receita_total || 0).toFixed(2)}
*Ticket Médio:* R$ ${parseFloat(dadosRelatorio.kpis.ticket_medio || 0).toFixed(2)}

*Top 3 Produtos:*
${dadosRelatorio.topProdutos.slice(0, 3).map((p, i) => 
  `${i + 1}. ${p.produto} - R$ ${parseFloat(p.receita).toFixed(2)}`
).join('\n')}

_Gerado em ${new Date().toLocaleString('pt-BR')}_
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