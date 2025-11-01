import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ConfigurarEnvio from './components/ConfigurarEnvio';
import LoginForm from './components/LoginForm';
import RelatorioEquipe from './components/RelatorioEquipe';
import DocumentacaoTime from './components/DocumentacaoTime';
import { login as loginService, setAuthToken } from './services/api';

const ROLE_LABELS = {
  patrao: 'Direção',
  asg: 'Serviços Gerais',
  enfermaria: 'Enfermagem'
};

const ROLE_SUBTITLES = {
  patrao: 'Acompanhe indicadores estratégicos e o desempenho de toda a equipe.',
  asg: 'Organize a limpeza, estoques e tarefas operacionais do lar.',
  enfermaria: 'Monitore cuidados clínicos, escalas e medicações sem perder o controle.'
};

const STORAGE_KEY = 'auroracare.auth';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('dashboard');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.token && parsed?.usuario) {
          setUsuario(parsed.usuario);
          setAuthToken(parsed.token);
          setAbaAtiva('dashboard');
        }
      }
    } catch (error) {
      console.warn('Falha ao restaurar sessão:', error);
    }
  }, []);

  useEffect(() => {
    if (!usuario) {
      setAuthToken(null);
    }
  }, [usuario]);

  const tabs = useMemo(() => {
    if (!usuario) return [];

    if (usuario.role === 'patrao') {
      return [
        { id: 'dashboard', label: '📊 Painel Integrado' },
        { id: 'relatorio', label: '🗂️ Relatório da equipe' },
        { id: 'config', label: '📣 Comunicações' },
        { id: 'documentacao', label: '📘 Documentação' }
      ];
    }

    return [
      { id: 'dashboard', label: usuario.role === 'asg' ? '🧼 Operações e estoque' : '🩺 Cuidados clínicos' },
      { id: 'documentacao', label: '📘 Documentação' }
    ];
  }, [usuario]);

  const handleLogin = async ({ email, senha }) => {
    const data = await loginService({ email, senha });
    setUsuario(data.usuario);
    setAuthToken(data.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAbaAtiva('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUsuario(null);
    setAbaAtiva('dashboard');
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
          <h1>🏡 AuroraCare — Portal Operacional</h1>
          <p className="subtitle">{subtitle}</p>
        </div>

        <div className="user-card">
          <div>
            <strong>Olá, {usuario.nome.split(' ')[0]}</strong>
            <span className="user-role">Perfil: {roleLabel}</span>
          </div>
          <button type="button" className="logout-button" onClick={handleLogout}>
            Sair
          </button>
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
        {abaAtiva === 'dashboard' && <Dashboard role={usuario.role} />}
        {abaAtiva === 'config' && usuario.role === 'patrao' && <ConfigurarEnvio />}
        {abaAtiva === 'relatorio' && usuario.role === 'patrao' && <RelatorioEquipe />}
        {abaAtiva === 'documentacao' && <DocumentacaoTime role={usuario.role} />}
      </main>

      <footer className="App-footer">
        <p>
          AuroraCare ©
          {' '}
          {new Date().getFullYear()}
          {' — '}
          cuidado humanizado apoiado por dados.
        </p>
      </footer>
    </div>
  );
}

export default App;
