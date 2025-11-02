import React, { useState } from 'react';
import './styles/Enfermagem.css';

const CAMPOS_INICIAIS = {
  nome: '',
  dataEntrada: '',
  dataNascimento: '',
  documento: '',
  responsavel: '',
  contato: '',
  diagnosticos: '',
  cuidados: ''
};

function CadastroPacientes({ membroAtivo }) {
  const [formulario, setFormulario] = useState(CAMPOS_INICIAIS);
  const [mensagem, setMensagem] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormulario((anterior) => ({ ...anterior, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setMensagem({ tipo: 'sucesso', texto: 'Registro salvo localmente. Envie a planilha para consolidar no painel.' });
    setFormulario(CAMPOS_INICIAIS);
  };

  return (
    <div className="enfermagem-layout">
      <header className="enfermagem-header">
        <div>
          <h2>Cadastro individual de pacientes</h2>
          <p>
            Registre informações essenciais para garantir continuidade de cuidado. Utilize este formulário para
            consultas rápidas e mantenha o envio periódico da planilha consolidada.
          </p>
        </div>
        {membroAtivo && <span className="enfermagem-meta">Responsável ativo: {membroAtivo.nome}</span>}
      </header>

      {mensagem && <div className={`enfermagem-alerta ${mensagem.tipo}`}>{mensagem.texto}</div>}

      <form className="enfermagem-form" onSubmit={handleSubmit}>
        <div className="enfermagem-form__grid">
          <div className="enfermagem-form__campo">
            <label htmlFor="nome">Nome completo</label>
            <input id="nome" name="nome" type="text" value={formulario.nome} onChange={handleChange} required />
          </div>
          <div className="enfermagem-form__campo">
            <label htmlFor="dataEntrada">Data de entrada</label>
            <input
              id="dataEntrada"
              name="dataEntrada"
              type="date"
              value={formulario.dataEntrada}
              onChange={handleChange}
              required
            />
          </div>
          <div className="enfermagem-form__campo">
            <label htmlFor="dataNascimento">Data de nascimento</label>
            <input
              id="dataNascimento"
              name="dataNascimento"
              type="date"
              value={formulario.dataNascimento}
              onChange={handleChange}
            />
          </div>
          <div className="enfermagem-form__campo">
            <label htmlFor="documento">Documento de identificação</label>
            <input
              id="documento"
              name="documento"
              type="text"
              value={formulario.documento}
              onChange={handleChange}
            />
          </div>
          <div className="enfermagem-form__campo">
            <label htmlFor="responsavel">Responsável legal</label>
            <input
              id="responsavel"
              name="responsavel"
              type="text"
              value={formulario.responsavel}
              onChange={handleChange}
            />
          </div>
          <div className="enfermagem-form__campo">
            <label htmlFor="contato">Contato do responsável</label>
            <input id="contato" name="contato" type="tel" value={formulario.contato} onChange={handleChange} />
          </div>
          <div className="enfermagem-form__campo enfermagem-form__campo--full">
            <label htmlFor="diagnosticos">Diagnósticos principais</label>
            <textarea
              id="diagnosticos"
              name="diagnosticos"
              rows={3}
              value={formulario.diagnosticos}
              onChange={handleChange}
              placeholder="Descreva condições crônicas, alergias e outras informações relevantes."
            />
          </div>
          <div className="enfermagem-form__campo enfermagem-form__campo--full">
            <label htmlFor="cuidados">Cuidados e observações</label>
            <textarea
              id="cuidados"
              name="cuidados"
              rows={3}
              value={formulario.cuidados}
              onChange={handleChange}
              placeholder="Orientações de manejo, restrições e necessidades especiais."
            />
          </div>
        </div>
        <footer className="enfermagem-form__acoes">
          <button type="reset" onClick={() => setFormulario(CAMPOS_INICIAIS)}>
            Limpar campos
          </button>
          <button type="submit">Salvar informações</button>
        </footer>
      </form>
    </div>
  );
}

export default CadastroPacientes;
