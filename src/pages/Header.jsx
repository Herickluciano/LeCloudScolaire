// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/api'; // Ajustez le chemin selon votre structure de projet
import { useAuth } from '../context/AuthContext'; // Ajustez le chemin selon votre structure de projet

const Header = () => {
const { user, schoolId, schoolName } = useAuth();

  // extraction propre et dynamique de l'identifiant de l'établissement
  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    ''
  )
    .trim()
    .toLowerCase();

  // --- ÉTAT D'INTERNATIONALISATION COMPLÈTEMENT DYNAMIQUE ---
  const [metaSchool, setMetaSchool] = useState({
    nom: '',
    pays: '',
    devise: '',
    ministere: '',
    anneeScolaire: ''
  });

  // 🔄 ÉCOUTEUR CLOUD FIRESTORE EN TEMPS RÉEL
  useEffect(() => {
    if (!currentSchool) return undefined;

    const schoolRef = doc(db, 'schools', currentSchool);

    const unsubscribe = onSnapshot(
      schoolRef,
      (snap) => {
        if (!snap.exists()) {
          setMetaSchool({ nom: '', pays: '', devise: '', ministere: '', anneeScolaire: '' });
          return;
        }

        const data = snap.data() || {};
        setMetaSchool({
          nom: data.nom || '',
          pays: data.pays || '',
          devise: data.devise || '',
          ministere: data.ministere || '',
          anneeScolaire: data.anneeScolaire || data.annee_scolaire || ''
        });
      },
      (error) => {
        console.error("Erreur de synchronisation temps réel du Header :", error);
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // Résolution sémantique du nom réel de l'établissement rattaché
  const nomEtablissement = metaSchool.nom || schoolName || currentSchool || "Établissement Scolaire";

  return (
    <div className="headerbar bg-white max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 font-sans bg-gray-50 min-h-screen text-gray-700 text-left">
      <div className="barre-bi-couleurheader"></div>
      {/* NOM DE L'ÉTABLISSEMENT DYNAMIQUE */}
      <h1 className="lyceheader text-2xl md:text-3xl font-black tracking-tight mt-2 uppercase text-slate-900">
        🏛️ {nomEtablissement.toUpperCase()} 🏛️
      </h1>
      {/* BLOC ÉTAT & INTERNATIONALISATION */}
      <div className="entete mt-1  space-y-0.5">
        {metaSchool.pays && (
          <p className="pays text-xs font-black uppercase text-gray-800 tracking-wide">
            {metaSchool.pays}
          </p>
        )}

        {metaSchool.devise && (
          <p className="devise text-[10px] text-gray-400 italic font-medium">
            {metaSchool.devise}
          </p>
        )}

        {metaSchool.ministere && (
          <p className="ministereheader text-[10px] font-bold uppercase text-purple-700 max-w-xl mx-auto mt-2">
            {metaSchool.ministere}
          </p>
        )}
      </div>

      {/* FOOTER INTERNE DE L'EN-TÊTE */}
      <div className="manager mt-4 pt-4 border-t border-gray-100">
           <h2 className="tireajoute text-lg font-black text-gray-900 uppercase">Manager Général : <span className="text-orange-600 font-bold uppercase">{user?.name || user?.nom}</span> — Code Instance : <span className="font-mono text-purple-700 font-bold uppercase">{schoolId}</span></h2>
        {metaSchool.anneeScolaire && (
          <p className="text-[10px] text-gray-400 mt-1 font-mono uppercase tracking-wider">
            Session Académique : {metaSchool.anneeScolaire}
          </p>
        )}
      </div>

    </div>
  );
};

export default Header;
