import React from 'react';
import './styles/DocumentacaoTime.css';

const ROLE_LABELS = {
  patrao: 'Direção',
  asg: 'Serviços Gerais',
  enfermaria: 'Enfermagem'
};

const SECOES = [
  {
    id: 'limpeza',
    titulo: 'Serviços gerais & limpeza',
    roles: ['asg', 'patrao'],
    descricao:
      'Organização de estoque de limpeza, cronograma de higienização das alas e suporte à recepção de materiais.',
    checklist: [
      'Atualizar planilha de limpeza e comprovar recebimento de materiais no final de cada turno.',
      'Executar ronda de higienização por ala, registrando fotos ou observações críticas.',
      'Conferir níveis de consumo versus cobertura mínima e acionar compras quando atingir 5 dias.',
      'Validar o cronograma semanal com a enfermagem em casos de interdição de leito.'
    ],
    entregaveis: [
      'Relatório de cobertura de limpeza publicado na segunda-feira.',
      'Checklist diário assinado e arquivado digitalmente.',
      'Lista de compras priorizadas enviada para a direção às quartas-feiras.'
    ]
  },
  {
    id: 'enfermagem',
    titulo: 'Enfermagem & farmácia',
    roles: ['enfermaria', 'patrao'],
    descricao:
      'Controle de medicações, organização da farmácia, acompanhamento de indicadores clínicos e comunicação com familiares.',
    checklist: [
      'Conferir doses críticas, validade de ampolas e estoque de fraldas na troca de plantão.',
      'Atualizar o mapa de medicação com aderência por ala e registrar intercorrências.',
      'Registrar no sistema ajustes de prescrição e sinalizar necessidade de médico plantonista.',
      'Enviar resumo de ocorrências à direção e registrar feedback individual por profissional.'
    ],
    entregaveis: [
      'Mapa diário de medicação com taxa de aderência por ala.',
      'Inventário semanal da farmácia com lote, validade e responsável.',
      'Checklist de pendências clínicas tratado em reunião quinzenal.'
    ]
  },
  {
    id: 'direcao',
    titulo: 'Direção & governança',
    roles: ['patrao'],
    descricao:
      'Definição de metas, acompanhamento dos planos de ação e comunicação com familiares e fornecedores estratégicos.',
    checklist: [
      'Validar indicadores críticos do painel (ocupação, aderência, alertas de estoque).',
      'Conduzir reuniões 1:1 com líderes de limpeza e enfermagem para feedback individual.',
      'Aprovar plano de compras e liberar pagamentos pendentes de fornecedores.',
      'Revisar documentação do time e atualizar responsabilidades registradas no playbook.'
    ],
    entregaveis: [
      'Resumo executivo semanal enviado aos sócios.',
      'Plano de ação mensal atualizado com status (no prazo, atenção, atrasado).',
      'Registro das decisões e pendências priorizadas em ata compartilhada.'
    ]
  }
];

const PENDENCIAS_DIRECAO = [
  'Conferir o estoque de limpeza e gerar pedido de reposição para itens críticos.',
  'Realizar o levantamento da dispensa para planejar a próxima feira de compras.',
  'Atualizar a documentação do time com responsabilidades e indicadores individuais.',
  'Validar as estratégias de acompanhamento que não foram aplicadas no mês anterior.',
  'Apresentar relatório individual com pontos de melhoria para cada colaborador.',
  'Revisar medicações, materiais hospitalares e organização completa da farmácia.'
];

function DocumentacaoTime({ role = 'patrao' }) {
  const roleLabel = ROLE_LABELS[role] || 'Equipe';

  return (
    <div className="documentacao-time">
      <header className="documentacao-time__header">
        <div>
          <h2>Documentação operacional do time</h2>
          <p>
            Consulte rotinas, checklists e indicadores necessários para manter o lar organizado. Você está visualizando as
            prioridades do perfil <strong>{roleLabel}</strong>.
          </p>
        </div>
      </header>

      <section className="documentacao-time__grid">
        {SECOES.map((secao) => {
          const ativo = secao.roles.includes(role);

          return (
            <article key={secao.id} className={`documentacao-time__card${ativo ? ' ativo' : ''}`}>
              <div className="documentacao-time__tag">
                {secao.roles.map((item) => ROLE_LABELS[item]).join(' • ')}
              </div>
              <h3>{secao.titulo}</h3>
              <p>{secao.descricao}</p>

              <div>
                <h4>Checklist operacional</h4>
                <ul>
                  {secao.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4>Indicadores e entregáveis</h4>
                <ul>
                  {secao.entregaveis.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </section>

      <section className="documentacao-time__card documentacao-time__card--pendencias">
        <h3>Pendências com a direção</h3>
        <p>Itens priorizados a partir das solicitações recebidas pelos gestores.</p>
        <ul>
          {PENDENCIAS_DIRECAO.map((pendencia) => (
            <li key={pendencia}>{pendencia}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default DocumentacaoTime;
