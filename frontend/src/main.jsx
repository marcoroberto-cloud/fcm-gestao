import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#f87171',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b0f17',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>⚠️ Erro na renderização do Painel</h2>
          <p style={{ color: '#cbd5e1', marginBottom: '16px' }}>
            Ocorreu um erro ao carregar a interface:
          </p>
          <pre style={{
            background: '#1e293b',
            color: '#fca5a5',
            padding: '16px',
            borderRadius: '8px',
            overflowX: 'auto',
            fontSize: '14px',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Recarregar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && (!root.children || root.children.length === 0)) {
    root.innerHTML = `
      <div style="padding:40px;color:#f87171;font-family:system-ui;background:#0b0f17;min-height:100vh">
        <h2 style="color:#ef4444">⚠️ Erro ao carregar script do painel</h2>
        <p style="color:#cbd5e1">${e.message || 'Erro desconhecido'}</p>
        <pre style="background:#1e293b;color:#fca5a5;padding:16px;border-radius:8px;font-size:13px">${e.error?.stack || e.message || ''}</pre>
      </div>
    `;
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
