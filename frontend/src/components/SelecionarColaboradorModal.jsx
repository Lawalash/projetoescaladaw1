import React from 'react';
import './styles/SelecionarColaboradorModal.css';

const ROLE_LABELS = {
  asg: 'Serviços Gerais',
  enfermaria: 'Enfermagem'
};

function SelecionarColaboradorModal({
  aberto,
  membros = [],
  membroSelecionadoId,
  carregando = false,
  erro = null,
  podeGerenciar = false,
  onFechar,
  onSelecionar,
  onAtualizar
}) {
  if (!aberto) {
    return null;
  }

  const temMembros = membros && membros.length > 0;

  return (
    <div className="modal-equipe__backdrop" role="presentation" onClick={onFechar}>
      <div
        className="modal-equipe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-equipe-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-equipe__header">
          <div>
            <h3 id="modal-equipe-titulo">Escolha quem está no turno</h3>
            <p>
              {podeGerenciar
                ? 'Registre qual colaborador está operando neste turno para vincular atividades, pontos e anexos.'
                : 'Visualização disponível apenas para perfis com múltiplos colaboradores.'}
            </p>
          </div>
          <button type="button" className="modal-equipe__fechar" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </header>

        {erro && <div className="modal-equipe__alerta erro">{erro}</div>}

        {carregando ? (
          <div className="modal-equipe__carregando">Carregando equipe...</div>
        ) : temMembros ? (
          <ul className="modal-equipe__lista">
            {membros.map((membro) => {
              const ativo = Number(membroSelecionadoId) === Number(membro.id);
              return (
                <li key={membro.id}>
                  <button
                    type="button"
                    className={ativo ? 'modal-equipe__item ativo' : 'modal-equipe__item'}
                    onClick={() => onSelecionar?.(membro.id)}
                  >
                    <strong>{membro.nome}</strong>
                    <span>{ROLE_LABELS[membro.role] || 'Equipe'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="modal-equipe__vazio">
            Nenhum colaborador cadastrado para este acesso. Atualize a equipe ou converse com a direção.
          </div>
        )}

        <footer className="modal-equipe__footer">
          {podeGerenciar && onAtualizar && (
            <button type="button" className="secondary-button" onClick={onAtualizar}>
              Atualizar lista
            </button>
          )}
          <button type="button" className="btn-primaria" onClick={onFechar}>
            Continuar
          </button>
        </footer>
      </div>
    </div>
  );
}

export default SelecionarColaboradorModal;
