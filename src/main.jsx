// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // 🟢 Ajustez le chemin vers votre contexte réel
import './index.css'; // Vos styles globaux

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 👑 LE VERROU CENTRAL : Enveloppe toute l'application pour distribuer la session */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
