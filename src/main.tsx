import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/ToastProvider';
import './styles.css';
import './landing.css';
import './landing-reference.css';
import './cashier.css';
import './workspace-polish.css';
import './public-polish.css';
import './landing-modern.css';
import './workspace-hallmark.css';
import './cashier-pos-theme.css';
import './cashier-dashboard.css';
import './stock-index.css';
import './pos-controls.css';
import './control-deck.css';
import './components/landing/workflow-cards.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
