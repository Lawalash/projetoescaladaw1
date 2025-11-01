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
          <h1>📊 QW1 - Automação de Relatórios</h1>
          <p className="subtitle">Sistema de análise de vendas e relatórios automáticos</p>
        </div>
        
        <nav className="tabs">
          <button
            className={abaAtiva === 'dashboard' ? 'tab active' : 'tab'}
            onClick={() => setAbaAtiva('dashboard')}
          >
            📈 Dashboard
          </button>
          <button
            className={abaAtiva === 'config' ? 'tab active' : 'tab'}
            onClick={() => setAbaAtiva('config')}
          >
            ⚙️ Configurações
          </button>
        </nav>
      </header>

      <main className="App-main">
        {abaAtiva === 'dashboard' && <Dashboard />}
        {abaAtiva === 'config' && <ConfigurarEnvio />}
      </main>

      <footer className="App-footer">
        <p>QW1 © 2025 - Desenvolvido em Campina Grande, PB</p>
      </footer>
    </div>
  );
}

export default App;