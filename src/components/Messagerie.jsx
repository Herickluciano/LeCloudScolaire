// src/pages/Messagerie.jsx
import React from 'react';
import EnvoyerMessageUnique from '../components/EnvoyerMessageUnique';
import BoiteReceptionUnique from '../components/BoiteReceptionUnique';

const Messagerie = () => {
  return (
    <div className="bg-slate-950 min-h-screen p-4 sm:p-6 lg:p-8 animate-fadeIn">
      
      {/* CADRE ARCHITECTURALE EN GRILLE SUR 3 COLONNES */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNE GAUCHE (1/3) : LE FORMULAIRE D'ÉMISSION ORANGE */}
        <div className="lg:col-span-1">
          <EnvoyerMessageUnique />
        </div>

        {/* COLONNE DROITE (2/3) : LE REGISTRE DES MESSAGES REÇUS LIVE */}
        <div className="lg:col-span-2">
          <BoiteReceptionUnique />
        </div>

      </div>

    </div>
  );
};

export default Messagerie;
