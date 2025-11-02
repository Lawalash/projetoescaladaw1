import React, { useState } from 'react';
import './styles/Enfermagem.css';

const MODELOS = [
  {
    id: 'pacientes',
    titulo: 'Cadastro de pacientes',
    arquivo: '/modelos/pacientes.xlsx',
    passos: [
      'Preencha uma linha por paciente, mantendo o cabeçalho original.',
      'Informe nome completo, data de nascimento e documento para identificação.',
      'Registre contato do responsável legal e observações relevantes de saúde.'
    ]
  },
  {
    id: 'medicacoes',
    titulo: 'Controle de medicações',
    arquivo: '/modelos/medicacoes.xlsx',
    passos: [
      'Utilize o mesmo identificador do paciente presente na planilha de cadastro.',
      'Registre medicamento, dosagem, frequência e profissional que validou a prescrição.',
      'Informe datas de início e revisão para acompanhar ajustes.'
    ]
  },
  {
    id: 'ocorrencias',
    titulo: 'Ocorrências clínicas',
    arquivo: '/modelos/ocorrencias.xlsx',
    passos: [
      'Classifique o tipo de ocorrência (queda, alteração de sinais, emergência etc.).',
      'Descreva o fato de forma objetiva, com data e horário.',
      'Finalize informando o encaminhamento adotado e responsável pelo registro.'
    ]
  }
];

function EnfermagemPlanilhas() {
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const handleUpload = (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setArquivoSelecionado(arquivo);
    setMensagem({ tipo: 'info', texto: 'Após o envio, a equipe de dados validará as informações.' });
  };

  return (
    <div className="enfermagem-layout">
      <header className="enfermagem-header">
        <div>
          <h2>Modelos de planilhas da enfermagem</h2>
          <p>
            Utilize os modelos oficiais para padronizar o envio de informações. Após a importação, as métricas
            alimentam automaticamente os indicadores das demais equipes.
          </p>
        </div>
        <label className="enfermagem-upload">
          {arquivoSelecionado ? `Selecionado: ${arquivoSelecionado.name}` : 'Selecionar planilha para envio'}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} />
        </label>
      </header>

      {mensagem && <div className={`enfermagem-alerta ${mensagem.tipo}`}>{mensagem.texto}</div>}

      <section className="enfermagem-grid">
        {MODELOS.map((modelo) => (
          <article key={modelo.id} className="enfermagem-card">
            <div className="enfermagem-card__titulo">
              <h3>{modelo.titulo}</h3>
              <a href={modelo.arquivo} download>
                Baixar modelo
              </a>
            </div>
            <ol>
              {modelo.passos.map((passo, index) => (
                <li key={passo}>
                  <span className="enfermagem-card__etapa">Passo {index + 1}</span>
                  <p>{passo}</p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </div>
  );
}

export default EnfermagemPlanilhas;
