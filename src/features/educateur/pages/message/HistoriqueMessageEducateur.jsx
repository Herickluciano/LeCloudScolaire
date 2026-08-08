import { useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';
import ReceptionAdmin from './ReceptionAdmin';
import EnvoieAdmin from './EnvoieAdmin';

const HistoriqueMessageEducateur = () => {
  const { schoolId, schoolName } = useAuth();
  
  // 🟢 RECTIFICATION ABSOLUE : On conserve la casse d'origine sans forcer les minuscules (.toLowerCase() supprimé)
  // pour correspondre exactement à l'ID "lycee_Moderne_Gagnoa" stocké dans vos documents Firestore
  const schoolIdRaw = schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa';
  const currentSchool = schoolIdRaw.trim(); 

  const nomEcoleAffiche = schoolName || sessionStorage.getItem('sgs_school_name') || 'LYCEE MODERNE GAGNOA';

  // Onglet actif : 'reception' ou 'envoie'
  const [ongletActif, setOngletActif] = useState('reception');

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen animate-fadeIn">
      
      {/* BANDEAU RETOUR */}

      {/* EN-TÊTE CENTRALISÉ */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md mb-8 text-center sm:text-left">
        <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-950/60 px-2.5 py-1 rounded-full">
          📜 Flux des Communications Cloud
        </span>
        <h1 className="text-xl md:text-2xl font-black mt-2">Archives & Messagerie Administrative</h1>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          Établissement connecté : <span className="font-bold text-white uppercase">{nomEcoleAffiche}</span>
        </p>
      </div>

      {/* BARRE D'ONGLETS INTERACTIFS */}
      <div className="flex border-b border-gray-200 mb-6 gap-2 text-xs font-black uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setOngletActif('reception')}
          className={`px-4 py-2.5 rounded-t-xl transition duration-150 cursor-pointer ${
            ongletActif === 'reception'
              ? 'bg-white border-t border-x border-gray-200 text-orange-600 font-black shadow-xs'
              : 'text-gray-400 hover:text-gray-700 font-bold'
          }`}
        >
          📥 Boîte de Réception (Élèves)
        </button>

        <button
          type="button"
          onClick={() => setOngletActif('envoie')}
          className={`px-4 py-2.5 rounded-t-xl transition duration-150 cursor-pointer ${
            ongletActif === 'envoie'
              ? 'bg-white border-t border-x border-gray-200 text-purple-600 font-black shadow-xs'
              : 'text-gray-400 hover:text-gray-700 font-bold'
          }`}
        >
          📤 Courriers Envoyés (Circulaires)
        </button>
      </div>

      {/* DOUBLE INTERRUPTEUR DE ROUTAGE GRAPHIQUE SYNCHRONE */}
      <div className="mt-4">
        {ongletActif === 'reception' ? (
          <ReceptionAdmin currentSchool={currentSchool} />
        ) : (
          <EnvoieAdmin currentSchool={currentSchool} />
        )}
      </div>

    </div>
  );
};

export default HistoriqueMessageEducateur;
