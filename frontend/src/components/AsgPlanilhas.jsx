import React, { useState } from 'react';
import './styles/AsgPlanilhas.css';

const MODELOS = [
  {
    id: 'planejamento-cardapio',
    titulo: 'Planejamento semanal de cardápio',
    arquivo: '/modelos/asg-cardapio.xlsx',
    passos: [
      'Registre uma linha para cada refeição servida (desjejum, almoço, lanche etc.) e indique o dia da semana.',
      'Detalhe ingredientes principais, responsáveis pela preparação e observações sobre restrições alimentares.',
      'Informe o total de porções oferecidas para que os indicadores de consumo alimentem o dashboard.'
    ]
  },
  {
    id: 'estoque-alimentos',
    titulo: 'Inventário de estoque de alimentos',
    arquivo: '/modelos/asg-estoque-alimentos.xlsx',
    passos: [
      'Utilize o código do item conforme a planilha de cadastro mestre e mantenha o cabeçalho original.',
      'Preencha quantidade disponível, ponto de reposição e validade para cada produto.',
      'Destacar itens em alerta (abaixo do mínimo ou vencendo) garante atualização correta dos KPIs.'
    ]
  },
  {
    id: 'controle-desperdicio',
    titulo: 'Controle de desperdício e sobras',
    arquivo: '/modelos/asg-desperdicio.xlsx',
    passos: [
      'Relate a data, refeição, motivo do desperdício e colaborador responsável pelo apontamento.',
      'Informe o volume estimado descartado para calcular os índices de aproveitamento.',
      'Adicione observações relevantes para orientar ações corretivas com a equipe.'
    ]
  }
];

function AsgPlanilhas() {
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const handleUpload = (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setArquivoSelecionado(arquivo);
    setMensagem({
      tipo: 'info',
      texto: 'Assim que a planilha for validada, os KPIs de acompanhamento de alimentos serão atualizados.'
    });
  };

  return (
    <div className="asg-planilhas">
      <header className="asg-planilhas__header">
        <div>
          <h2>Modelos de abastecimento e KPIs da ASG</h2>
          <p>
            Centralize o envio das informações de cardápio, estoque e desperdício. Esses dados alimentam os
            indicadores de consumo exibidos para a direção e para a supervisão.
          </p>
        </div>
        <label className="asg-planilhas__upload">
          {arquivoSelecionado ? `Selecionado: ${arquivoSelecionado.name}` : 'Selecionar planilha para envio'}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} />
        </label>
      </header>

      <div className="asg-planilhas__meta">
        <strong>Orientação:</strong> mantenha o cabeçalho original de cada modelo para garantir a importação correta.
      </div>

      {mensagem && <div className={`asg-planilhas__alerta ${mensagem.tipo}`}>{mensagem.texto}</div>}

      <section className="asg-planilhas__grid">
        {MODELOS.map((modelo) => (
          <article key={modelo.id} className="asg-planilhas__card">
            <div className="asg-planilhas__card-header">
              <h3>{modelo.titulo}</h3>
              <a href={modelo.arquivo} download>
                Baixar modelo
              </a>
            </div>
            <ol className="asg-planilhas__lista">
              {modelo.passos.map((passo, index) => (
                <li key={passo}>
                  <span className="asg-planilhas__etapa">Passo {index + 1}</span>
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

export default AsgPlanilhas;
