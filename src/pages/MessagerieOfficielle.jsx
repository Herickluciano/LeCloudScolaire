import React from 'react';
import EnvoyerMessageUnique from '../components/EnvoyerMessageUnique';
import BoiteReceptionUnique from '../components/BoiteReceptionUnique';

const MessagerieOfficielle = () => {
  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8 animate-fadeIn font-sans">
      <div className="max-w-7xl mx-auto border-b border-slate-800 pb-3 mb-6">
        <h2 className="text-lg font-black uppercase  tracking-tight flex items-center gap-2">
          💬 Centre de Communication Centralisé
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Consultez vos messages reçus et diffusez vos alertes officielles selon vos privilèges de sécurité NoSQL.
        </p>
      </div>

      {/* Rendu double réactif adaptatif : Côte à côte sur PC, l'un sur l'autre sur Smartphone */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <EnvoyerMessageUnique />
        <BoiteReceptionUnique />
      </div>
    </div>
  );
};

export default MessagerieOfficielle;
