import React, { useEffect, useState } from 'react';
import {
  obterConfigNotificacoes,
  salvarConfigNotificacao,
  removerNotificacao,
  testarNotificacao
} from '../services/api';
import './styles/ConfigurarEnvio.css';

function ConfigurarEnvio() {
  const [tipo, setTipo] = useState('email');
  const [destinatario, setDestinatario] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [destinatarios, setDestinatarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [testando, setTestando] = useState(null);

  useEffect(() => {
    carregarDestinatarios();
  }, []);

  const carregarDestinatarios = async () => {
    try {
      const dados = await obterConfigNotificacoes();
      setDestinatarios(dados.destinatarios || []);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar os contatos cadastrados.' });
    }
  };

  const handleAdicionar = async (event) => {
    event.preventDefault();

    if (!destinatario.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe um e-mail ou número de telefone.' });
      return;
    }

    if (tipo === 'email') {
      const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regexEmail.test(destinatario)) {
        setMensagem({ tipo: 'erro', texto: 'E-mail inválido.' });
        return;
      }
    }

    if (tipo === 'whatsapp') {
      const regexWhatsApp = /^\d{10,15}$/;
      const somenteNumeros = destinatario.replace(/\D/g, '');
      if (!regexWhatsApp.test(somenteNumeros)) {
        setMensagem({ tipo: 'erro', texto: 'Informe o WhatsApp no formato DDI+DDD+Número (10-15 dígitos).' });
        return;
      }
    }

    setLoading(true);
    try {
      await salvarConfigNotificacao({ tipoEnvio: tipo, destinatario, responsavel });
      setMensagem({ tipo: 'sucesso', texto: 'Contato cadastrado com sucesso!' });
      setDestinatario('');
      setResponsavel('');
      carregarDestinatarios();
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao cadastrar contato: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id) => {
    if (!window.confirm('Deseja realmente remover este contato?')) {
      return;
    }

    try {
      await removerNotificacao(id);
      setMensagem({ tipo: 'sucesso', texto: 'Contato removido.' });
      carregarDestinatarios();
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao remover contato: ' + error.message });
    }
  };

  const handleTestar = async (tipoEnvio, destino) => {
    setTestando(destino);
    try {
      await testarNotificacao({ tipo: tipoEnvio, destinatario: destino });
      setMensagem({ tipo: 'sucesso', texto: `Mensagem de teste enviada para ${destino}.` });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao enviar teste: ' + error.message });
    } finally {
      setTestando(null);
    }
  };

  return (
    <div className="config-container">
      <div className="config-card">
        <h2>📣 Comunicações e Alertas do Lar</h2>

        {mensagem && (
          <div className={`mensagem ${mensagem.tipo}`}>
            {mensagem.tipo === 'sucesso' ? '✅' : '⚠️'} {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleAdicionar} className="form-config">
          <div className="form-group">
            <label>Canal de envio</label>
            <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="input-select">
              <option value="email">📧 E-mail</option>
              <option value="whatsapp">💬 WhatsApp</option>
            </select>
          </div>

          <div className="form-group">
            <label>{tipo === 'email' ? 'E-mail' : 'WhatsApp'}</label>
            <input
              type="text"
              value={destinatario}
              onChange={(event) => setDestinatario(event.target.value)}
              placeholder={tipo === 'email' ? 'familia@exemplo.com' : '5583988887777'}
              className="input-text"
            />
          </div>

          <div className="form-group">
            <label>Responsável / vínculo</label>
            <input
              type="text"
              value={responsavel}
              onChange={(event) => setResponsavel(event.target.value)}
              placeholder="Filho(a), cuidador, médico, equipe de nutrição..."
              className="input-text"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-adicionar">
            {loading ? '⏳' : '➕'} Cadastrar contato
          </button>
        </form>
      </div>

      {destinatarios.length > 0 && (
        <div className="config-card">
          <h3>📋 Canais cadastrados</h3>

          <div className="tabela-scroll">
            <table className="tabela-config">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Contato</th>
                  <th>Responsável</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {destinatarios.map((dest) => (
                  <tr key={dest.id}>
                    <td>
                      <span className="badge">{dest.tipo_envio === 'email' ? '📧 E-mail' : '💬 WhatsApp'}</span>
                    </td>
                    <td className="dest-text">{dest.destinatario}</td>
                    <td>{dest.responsavel || '—'}</td>
                    <td>
                      <span className={`status ${dest.ativo ? 'ativo' : 'inativo'}`}>
                        {dest.ativo ? '🟢 Ativo' : '🔴 Inativo'}
                      </span>
                    </td>
                    <td className="acoes-cell">
                      <button
                        type="button"
                        className="btn-testar"
                        onClick={() => handleTestar(dest.tipo_envio, dest.destinatario)}
                        disabled={testando === dest.destinatario}
                      >
                        {testando === dest.destinatario ? '⏳' : '📤'} Testar
                      </button>
                      <button type="button" className="btn-remover" onClick={() => handleRemover(dest.id)}>
                        🗑️ Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="info-box">
            <h4>ℹ️ Como utilizamos estes contatos?</h4>
            <ul>
              <li>👨‍👩‍👧 Familiares recebem boletins de saúde, agenda e alertas importantes.</li>
              <li>🩺 Profissionais são avisados sobre ajustes de medicação e consultas agendadas.</li>
              <li>💬 Envie WhatsApp no formato DDI+DDD+Número (ex: 5583988887777).</li>
              <li>📤 O botão "Testar" envia imediatamente um resumo do dia para validação.</li>
              <li>🕒 Disparos automáticos seguem o cronograma definido pela coordenação do lar.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigurarEnvio;
