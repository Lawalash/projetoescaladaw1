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
        <h1>Bem-vindo(a) ao A2 Data Monitoramento Ocupacional</h1>
        <p>Utilize seu acesso corporativo para acompanhar rotinas e indicadores do lar.</p>
      </div>

      <form className="login-card__form" onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail corporativo</label>
        <input
          id="email"
          type="email"
          placeholder="ex: direcao@a2data.com.br"
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
          <li>Direção — direcao@a2data.com.br / patroes123</li>
          <li>Supervisora — supervisao@a2data.com.br / supervisao123</li>
          <li>Serviços gerais — asg@a2data.com.br / limpeza123</li>
          <li>Enfermagem — enfermagem@a2data.com.br / enfermagem123</li>
        </ul>
      </div>
    </div>
  );
}

export default LoginForm;
