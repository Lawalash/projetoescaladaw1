import Reachttps://github.com/Lawalash/projetoescaladaw1/wikit, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ConfigurarEnvio from './components/ConfigurarEnvio';
import LoginForm from './components/LoginForm';
import RelatorioEquipe from './components/RelatorioEquipe';
import SelecionarColaboradorModal from './components/SelecionarColaboradorModal';
import EnfermagemPlanilhas from './components/EnfermagemPlanilhas';
import CadastroPacientes from './components/CadastroPacientes';
import AsgPlanilhas from './components/AsgPlanilhas';
import { login as loginService, obterEquipeOperacional, setAuthToken } from './services/api';

const ROLE_LABELS = {
  patrao: 'Direção',
  asg: 'Serviços Gerais',
  enfermaria: 'Enfermagem',
  supervisora: 'Supervisão ASG'
};

const ROLE_SUBTITLES = {
  patrao: 'Acompanhe indicadores estratégicos e o desempenho de toda a equipe.',
  asg: 'Organize rotinas de limpeza, estoque e suporte operacional do lar.',
  enfermaria: 'Monitore cuidados clínicos, escalas e medicações com segurança.',
  supervisora: 'Coordene as entregas da equipe de serviços gerais e acompanhe os apontamentos.'
};

const STORAGE_KEY = 'a2data.monitoramento.auth';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [membrosEquipe, setMembrosEquipe] = useState([]);
  const [membroAtivo, setMembroAtivo] = useState(null);
  const [modalMembrosAberto, setModalMembrosAberto] = useState(false);
  const [carregandoEquipe, setCarregandoEquipe] = useState(false);
  const [erroEquipe, setErroEquipe] = useState(null);

  const precisaSelecionarMembro = useCallback((role) => role === 'asg' || role === 'enfermaria', []);

  const sincronizarMembroAtivo = useCallback((user, lista = []) => {
    if (!user || !precisaSelecionarMembro(user.role)) {
      setMembroAtivo(null);
      return;
    }

    const storageKey = `${STORAGE_KEY}:membro:${user.id}`;
    const storedId = localStorage.getItem(storageKey);
    const membroExistente = lista.find((item) => String(item.id) === storedId);

    if (membroExistente) {
      setMembroAtivo(membroExistente);
      return;
    }

    if (lista.length === 1) {
      setMembroAtivo(lista[0]);
      localStorage.setItem(storageKey, String(lista[0].id));
      return;
    }

    if (!lista.length) {
      setMembroAtivo(null);
      setModalMembrosAberto(true);
      return;
    }

    setMembroAtivo(null);
    setModalMembrosAberto(true);
  }, [precisaSelecionarMembro]);

  const carregarEquipe = useCallback(async (roleDestino) => {
    if (!usuario) return;

    setCarregandoEquipe(true);
    setErroEquipe(null);
    try {
      const resposta = await obterEquipeOperacional({ role: roleDestino });
      const lista = resposta?.membros || [];
      setMembrosEquipe(lista);
      sincronizarMembroAtivo(usuario, lista);
    } catch (error) {
      console.error('Erro ao carregar equipe operacional:', error);
      setErroEquipe('Não foi possível carregar a lista de colaboradores.');
    } finally {
      setCarregandoEquipe(false);
    }
  }, [sincronizarMembroAtivo, usuario]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.token && parsed?.usuario) {
          setUsuario(parsed.usuario);
          setAuthToken(parsed.token);
          setAbaAtiva('dashboard');
          const equipeArmazenada = parsed?.membrosEquipe || [];
          setMembrosEquipe(equipeArmazenada);
          sincronizarMembroAtivo(parsed.usuario, equipeArmazenada);
        }
      }
    } catch (error) {
      console.warn('Falha ao restaurar sessão:', error);
    }
  }, [sincronizarMembroAtivo]);

  useEffect(() => {
    if (!usuario) {
      setAuthToken(null);
    }
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;

    if (!precisaSelecionarMembro(usuario.role)) {
      setMembroAtivo(null);
      return;
    }

    if (membrosEquipe.length) {
      sincronizarMembroAtivo(usuario, membrosEquipe);
    } else {
      carregarEquipe(usuario.role);
    }
  }, [usuario, membrosEquipe, carregarEquipe, sincronizarMembroAtivo, precisaSelecionarMembro]);

  useEffect(() => {
    if (!usuario) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      parsed.membrosEquipe = membrosEquipe;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.warn('Falha ao sincronizar equipe localmente:', error);
    }
  }, [membrosEquipe, usuario]);

  const handleSelecionarMembro = useCallback((membroId) => {
    if (!usuario) return;
    const idNumero = Number(membroId);
    const selecionado = membrosEquipe.find((item) => Number(item.id) === idNumero);
    if (!selecionado) return;

    const storageKey = `${STORAGE_KEY}:membro:${usuario.id}`;
    localStorage.setItem(storageKey, String(selecionado.id));
    setMembroAtivo(selecionado);
    setModalMembrosAberto(false);
  }, [membrosEquipe, usuario]);

  const handleAbrirModalEquipe = useCallback(() => {
    if (!usuario || !precisaSelecionarMembro(usuario.role)) return;
    setModalMembrosAberto(true);
    if (!membrosEquipe.length) {
      carregarEquipe(usuario.role);
    }
  }, [carregarEquipe, membrosEquipe.length, precisaSelecionarMembro, usuario]);

  const tabs = useMemo(() => {
    if (!usuario) return [];

    if (usuario.role === 'patrao') {
      return [
        { id: 'dashboard', label: 'Painel integrado' },
        { id: 'relatorio', label: 'Relatório da equipe' },
        { id: 'config', label: 'Comunicações' }
      ];
    }

    if (usuario.role === 'supervisora') {
      return [
        { id: 'dashboard', label: 'Painel da supervisão' },
        { id: 'planilhas-asg', label: 'Modelos e importação' },
        { id: 'relatorio', label: 'Relatório da equipe' }
      ];
    }

    if (usuario.role === 'enfermaria') {
      return [
        { id: 'dashboard', label: 'Cuidados clínicos' },
        { id: 'planilhas', label: 'Modelos e importação' },
        { id: 'pacientes', label: 'Cadastro de pacientes' }
      ];
    }

    return [{ id: 'dashboard', label: 'Operações e estoque' }];
  }, [usuario]);

  const handleLogin = async ({ email, senha }) => {
    const data = await loginService({ email, senha });
    setUsuario(data.usuario);
    setAuthToken(data.token);
    const equipe = data?.membrosEquipe || [];
    setMembrosEquipe(equipe);

    if (precisaSelecionarMembro(data.usuario.role)) {
      const storageKey = `${STORAGE_KEY}:membro:${data.usuario.id}`;
      localStorage.removeItem(storageKey);
      setMembroAtivo(null);
      setModalMembrosAberto(true);
    }

    sincronizarMembroAtivo(data.usuario, equipe);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAbaAtiva('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUsuario(null);
    setAbaAtiva('dashboard');
    setMembrosEquipe([]);
    setMembroAtivo(null);
    setModalMembrosAberto(false);
    setErroEquipe(null);
    setCarregandoEquipe(false);
  };

  if (!usuario) {
    return (
      <div className="login-screen">
        <LoginForm onSubmit={handleLogin} />
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[usuario.role] || 'Equipe';
  const subtitle = ROLE_SUBTITLES[usuario.role] || ROLE_SUBTITLES.patrao;

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>A2 Data · Monitoramento Ocupacional</h1>
          <p className="subtitle">{subtitle}</p>
        </div>

        <div className="user-card">
          <div>
            <strong>Olá, {usuario.nome.split(' ')[0]}</strong>
            <span className="user-role">Perfil: {roleLabel}</span>
            {precisaSelecionarMembro(usuario.role) && (
              <span className="user-role user-role--colaborador">
                Colaborador: {membroAtivo ? membroAtivo.nome : 'Selecione quem está no turno'}
              </span>
            )}
          </div>
          <div className="user-card__actions">
            {precisaSelecionarMembro(usuario.role) && (
              <button type="button" className="secondary-button" onClick={handleAbrirModalEquipe}>
                Trocar colaborador
              </button>
            )}
            <button type="button" className="logout-button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>

        <nav className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={abaAtiva === tab.id ? 'tab active' : 'tab'}
              onClick={() => setAbaAtiva(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="App-main">
        {abaAtiva === 'dashboard' && (
          <Dashboard
            role={usuario.role}
            membroAtivo={membroAtivo}
            membrosEquipe={membrosEquipe}
            onSolicitarTrocaMembro={handleAbrirModalEquipe}
            onAtualizarEquipe={() =>
              carregarEquipe(usuario.role === 'patrao' ? undefined : usuario.role)
            }
          />
        )}
        {abaAtiva === 'config' && usuario.role === 'patrao' && <ConfigurarEnvio />}
        {abaAtiva === 'relatorio' && (usuario.role === 'patrao' || usuario.role === 'supervisora') && (
          <RelatorioEquipe role={usuario.role} />
        )}
        {abaAtiva === 'planilhas-asg' && usuario.role === 'supervisora' && <AsgPlanilhas />}
        {abaAtiva === 'planilhas' && usuario.role === 'enfermaria' && (
          <EnfermagemPlanilhas />
        )}
        {abaAtiva === 'pacientes' && usuario.role === 'enfermaria' && (
          <CadastroPacientes membroAtivo={membroAtivo} />
        )}
      </main>

      <footer className="App-footer">
        <p>
          A2 Data Monitoramento Ocupacional · {new Date().getFullYear()} · Tecnologia a serviço do cuidado.
        </p>
      </footer>

      {usuario && (
        <SelecionarColaboradorModal
          aberto={modalMembrosAberto}
          carregando={carregandoEquipe}
          erro={erroEquipe}
          membros={membrosEquipe}
          membroSelecionadoId={membroAtivo?.id}
          podeGerenciar={precisaSelecionarMembro(usuario.role)}
          onFechar={() => setModalMembrosAberto(false)}
          onSelecionar={handleSelecionarMembro}
          onAtualizar={() =>
            carregarEquipe(usuario.role === 'patrao' ? undefined : usuario.role)
          }
        />
      )}
    </div>
  );
}

export default App;
