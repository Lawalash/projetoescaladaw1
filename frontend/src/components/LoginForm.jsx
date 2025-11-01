import React, { useState } from 'react';
import './styles/LoginForm.css';

function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      await onSubmit({ email, senha });
    } catch (error) {
      const mensagem = error?.response?.data?.error || 'Falha ao autenticar. Verifique suas credenciais.';
      setErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-card__header">
        <h1>Bem-vindo(a) ao AuroraCare</h1>
        <p>Faça login para acessar o portal operacional do lar.</p>
      </div>

      <form className="login-card__form" onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail corporativo</label>
        <input
          id="email"
          type="email"
          placeholder="ex: direcao@auroracare.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          placeholder="Digite sua senha"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          autoComplete="current-password"
          required
        />

        {erro && <span className="login-card__error">{erro}</span>}

        <button type="submit" disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="login-card__tips">
        <h2>Perfis disponíveis</h2>
        <ul>
          <li>Direção — direcao@auroracare.com / patroes123</li>
          <li>Serviços gerais — asg@auroracare.com / limpeza123</li>
          <li>Enfermagem — enfermaria@auroracare.com / enfermaria123</li>
        </ul>
      </div>
    </div>
  );
}

export default LoginForm;
