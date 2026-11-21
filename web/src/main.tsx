import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';
import { setupGlobalFetchInterceptor } from './utils/api.js';

// Activate automatic API routing & credentials inclusion for cross-origin deployments
setupGlobalFetchInterceptor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
