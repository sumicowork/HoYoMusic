import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ── Self-hosted fonts (no Google CDN) ──────────────────────
// Plus Jakarta Sans — latin only, weights used in UI
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';

// Noto Serif SC — latin + chinese-simplified, display weights only
import '@fontsource/noto-serif-sc/latin-400.css';
import '@fontsource/noto-serif-sc/latin-700.css';
import '@fontsource/noto-serif-sc/chinese-simplified-400.css';
import '@fontsource/noto-serif-sc/chinese-simplified-700.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

