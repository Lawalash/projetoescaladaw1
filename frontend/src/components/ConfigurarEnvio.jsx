import React, { useState, useEffect } from 'react';
import {
  obterConfigEnvio,
  salvarConfigEnvio,
  removerDestinatario,
  testarNotificacao
} from '../services/api';
import './styles/ConfigurarEnvio.css';

function ConfigurarEnvio() {
  const [tipo, setTipo] = useState('email');
  const [destinatario, setDestinatario] = useState('');
  const [destinatarios, setDestinatarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [testando, setTestando] = useState(null);

  useEffect(() => {
    carregarDestinatarios();
  }, []);

  const carregarDestinatarios = async () => {
    try {
      const dados = await obterConfigEnvio();
      setDestinatarios(dados.destinatarios || []);
    } catch (error) {
      console.error('Erro ao carregar:', error);
    }
  };

  const handleAdicionar = async (e) => {
    e.preventDefault();

    if (!destinatario.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Digite um destinatário' });
      return;
    }

    // Validar email
    if (tipo === 'email') {
      const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regexEmail.test(destinatario)) {
        setMensagem({ tipo: 'erro', texto: 'E-mail inválido' });
        return;
      }
    }

    // Validar WhatsApp
    if (tipo === 'whatsapp') {
      const regexWhatsApp = /^\d{10,15}$/;
      if (!regexWhatsApp.test(destinatario.replace(/\D/g, ''))) {
        setMensagem({ tipo: 'erro', texto: 'Número WhatsApp inválido (10-15 dígitos)' });
        return;
      }
    }

    setLoading(true);
    try {
      await salvarConfigEnvio(tipo, destinatario);
      setMensagem({ tipo: 'sucesso', texto: 'Destinatário adicionado com sucesso!' });
      setDestinatario('');
      carregarDestinatarios();
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao adicionar: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover?')) return;

    try {
      await removerDestinatario(id);
      setMensagem({ tipo: 'sucesso', texto: 'Destinatário removido!' });
      carregarDestinatarios();
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao remover: ' + error.message });
    }
  };

  const handleTestar = async (destTipo, destValue) => {
    setTestando(destValue);
    try {
      await testarNotificacao(destTipo, destValue);
      setMensagem({ tipo: 'sucesso', texto: `Notificação de teste enviada para ${destValue}!` });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao enviar teste: ' + error.message });
    } finally {
      setTestando(null);
    }
  };

  return (
    <div className="config-container">
      <div className="config-card">
        <h2>⚙️ Configurar Notificações Automáticas</h2>

        {mensagem && (
          <div className={`mensagem ${mensagem.tipo}`}>
            {mensagem.tipo === 'sucesso' ? '✅' : '❌'} {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleAdicionar} className="form-config">
          <div className="form-group">
            <label>Tipo de Envio:</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="input-select"
            >
              <option value="email">📧 E-mail</option>
              <option value="whatsapp">💬 WhatsApp</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              {tipo === 'email' ? 'E-mail:' : 'Número WhatsApp:'}
            </label>
            <input
              type="text"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder={tipo === 'email' ? 'seu.email@gmail.com' : '5585999999999'}
              className="input-text"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-adicionar"
          >
            {loading ? '⏳' : '➕'} Adicionar Destinatário
          </button>
        </form>
      </div>

      {destinatarios.length > 0 && (
        <div className="config-card">
          <h3>📋 Destinatários Configurados</h3>

          <div className="tabela-scroll">
            <table className="tabela-config">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Destinatário</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {destinatarios.map((dest) => (
                  <tr key={dest.id}>
                    <td>
                      <span className="badge">
                        {dest.tipo_envio === 'email' ? '📧 Email' : '💬 WhatsApp'}
                      </span>
                    </td>
                    <td className="dest-text">{dest.destinatario}</td>
                    <td>
                      <span className={`status ${dest.ativo ? 'ativo' : 'inativo'}`}>
                        {dest.ativo ? '🟢 Ativo' : '🔴 Inativo'}
                      </span>
                    </td>
                    <td className="acoes-cell">
                      <button
                        className="btn-testar"
                        onClick={() => handleTestar(dest.tipo_envio, dest.destinatario)}
                        disabled={testando === dest.destinatario}
                      >
                        {testando === dest.destinatario ? '⏳' : '📤'} Testar
                      </button>
                      <button
                        className="btn-remover"
                        onClick={() => handleRemover(dest.id)}
                      >
                        🗑️ Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="info-box">
            <h4>ℹ️ Informações</h4>
            <ul>
              <li>✅ Destinatários com status "Ativo" receberão relatórios automáticos</li>
              <li>📧 E-mails são enviados com HTML formatado</li>
              <li>💬 WhatsApp usa a API Vonage (configure as credenciais no .env)</li>
              <li>📤 Clique em "Testar" para enviar uma notificação de teste</li>
              <li>🔄 Relatórios são enviados automaticamente conforme agendamento do cron</li>
            </ul>
          </div>
        </div>
      )}

      {destinatarios.length === 0 && (
        <div className="empty-state">
          <p>📭 Nenhum destinatário configurado ainda</p>
          <p>Adicione e-mail ou número de WhatsApp acima para começar</p>
        </div>
      )}
    </div>
  );
}

export default ConfigurarEnvio;