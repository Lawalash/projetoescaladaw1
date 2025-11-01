import React, { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ConfigurarEnvio from './components/ConfigurarEnvio';

function App() {
  const [abaAtiva, setAbaAtiva] = useState('dashboard');

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>🏡 AuroraCare - Gestão do Lar de Idosos</h1>
          <p className="subtitle">Acompanhe saúde, bem-estar e estoques críticos em um só lugar.</p>
        </div>

        <nav className="tabs">
          <button
            type="button"
            className={abaAtiva === 'dashboard' ? 'tab active' : 'tab'}
            onClick={() => setAbaAtiva('dashboard')}
          >
            📊 Painel Integrado
          </button>
          <button
            type="button"
            className={abaAtiva === 'config' ? 'tab active' : 'tab'}
            onClick={() => setAbaAtiva('config')}
          >
            📣 Comunicações
          </button>
        </nav>
      </header>

      <main className="App-main">
        {abaAtiva === 'dashboard' && <Dashboard />}
        {abaAtiva === 'config' && <ConfigurarEnvio />}
      </main>

      <footer className="App-footer">
        <p>AuroraCare © {new Date().getFullYear()} — cuidado humanizado apoiado por dados.</p>
      </footer>
    </div>
  );
}

export default App;