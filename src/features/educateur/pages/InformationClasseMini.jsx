// src/features/educateur/pages/InformationClasseMini.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const InformationClasseMini = () => {
  const { user } = useAuth();
  
  // 🟢 NORMALISATION DES FILTRES DE PROMOTION LUHAMCODE
  const currentSchool = (user?.schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();
  const promotionEducateur = (user?.promotion || sessionStorage.getItem('sgs_user_promotion') || '5eme').trim().toLowerCase();

  // --- ÉTATS CRITIQUES ---
  const [listeClassesPromotion, setListeClassesPromotion] = useState([]);
  const [classeSelectionneeId, setClasseSelectionneeId] = useState('');
  const [classeData, setClasseData] = useState(null);
  const [matiereEnseigneePP, setMatiereEnseigneePP] = useState('Chargement...');
  const [loading, setLoading] = useState(true);

  // 🔄 ÉCOUTEUR 1 : Extraction en temps réel UNIQUEMENT des classes de la promotion de l'éducateur
  useEffect(() => {
    if (!currentSchool || !promotionEducateur) return;

    const qClasses = query(
      collection(db, "classes"),
      where("schoolId", "==", currentSchool),
      where("promotion", "==", promotionEducateur) // 🔒 BARRIÈRE DE SÉCURITÉ : Bloque les autres promotions
    );

    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      setListeClassesPromotion(list);
      
      // Sélection automatique de la première classe de sa promotion si aucune n'est active
      if (list.length > 0 && !classeSelectionneeId) {
        setClasseSelectionneeId(list[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error("Erreur filtrage classes par promotion :", err);
      setLoading(false);
    });

    return () => unsubscribeClasses();
  }, [currentSchool, promotionEducateur, classeSelectionneeId]);

  // 🔄 ÉCOUTEUR 2 : Extraction en temps réel des métadonnées de la classe sélectionnée
  useEffect(() => {
    if (!classeSelectionneeId) return;

    const docClasseRef = doc(db, "classes", classeSelectionneeId);
    
    const unsubscribeDoc = onSnapshot(docClasseRef, (docSnap) => {
      if (docSnap.exists()) {
        const dataReçue = docSnap.data();
        setClasseData(dataReçue);

        // Écoute de la matière du Professeur Principal
        if (dataReçue.profPrincipalId) {
          const docProfRef = doc(db, "users", dataReçue.profPrincipalId);
          const unsubscribeProf = onSnapshot(docProfRef, (profSnap) => {
            if (profSnap.exists()) {
              setMatiereEnseigneePP(profSnap.data().matiereEnseignee || "Général");
            } else {
              setMatiereEnseigneePP("Non renseignée");
            }
          });
          return () => unsubscribeProf();
        } else {
          setMatiereEnseigneePP("Aucun");
        }
      }
    }, (err) => {
      console.error("Erreur chargement document classe :", err);
    });

    return () => unsubscribeDoc();
  }, [classeSelectionneeId]);

  if (loading) return <div className="text-slate-400 font-bold p-4 animate-pulse uppercase text-[10px]">Filtrage du périmètre de promotion...</div>;

  return (
    <div className="w-full space-y-4 p-4 font-sans text-xs text-slate-300">
      
      {/* SÉLECTEUR BARRE HORIZONTALE DE NAVIGATION DES DIVISIONS AUTORISÉES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="text-left">
          <span className="text-[9px] font-black uppercase text-orange-400 tracking-wider">Périmètre exclusif</span>
          <h4 className="text-xs font-black text-white uppercase mt-0.5">Classes de la Promotion {promotionEducateur.toUpperCase()}</h4>
        </div>
        
        <select 
          value={classeSelectionneeId} 
          onChange={(e) => setClasseSelectionneeId(e.target.value)}
          className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl p-2 font-bold text-white outline-none cursor-pointer focus:border-orange-500"
        >
          {listeClassesPromotion.map(c => (
            <option key={c.id} value={c.id}>Classe : {String(c.nom || c.idBrute || '').toUpperCase()}</option>
          ))}
          {listeClassesPromotion.length === 0 && <option value="">Aucune classe créée pour ce niveau</option>}
        </select>
      </div>

      {/* COMPTEURS HORIZONTAUX COMPACTS EN MODE SOMBRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* CARD 1 : EFFECTIF DE LA CLASSE FILTRÉE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left shadow-md">
          <p className="text-[10px] font-black text-slate-500 stream uppercase tracking-wider">Effectif Réel Classé</p>
          <p className="text-2xl font-black text-white mt-1 font-mono">
            {classeData ? classeData.elevesCount : 0}
          </p>
          <p className="text-[9px] text-slate-500 font-medium mt-0.5">
            Sur {classeData ? classeData.maxEleves : 50} places réglementaires
          </p>
        </div>

        {/* CARD 2 : PROFESSEUR PRINCIPAL & DISCIPLINE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left shadow-md flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Professeur Principal</p>
            <p className="text-sm font-black text-white mt-1 truncate uppercase">
              {classeData?.profPrincipalName || "Non assigné"}
            </p>
          </div>
          <span className="w-fit mt-1 bg-purple-950 border border-purple-900 text-purple-400 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase">
            Discipline : {matiereEnseigneePP}
          </span>
        </div>

        {/* CARD 3 : ÉTAT DES DROITS ADMINISTRATIFS DU DÉLÉGUÉ CLASSE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left shadow-md flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Délégué de classe de Section</p>
            <p className="text-sm font-black text-orange-400 mt-1 uppercase truncate">
              👑 {classeData?.delegueName || "Non désigné"}
            </p>
          </div>
          <p className="text-[9px] text-slate-600 font-mono uppercase mt-1 tracking-widest">ID Unique NoSQL : {classeData?.idBrute || 'N/A'}</p>
        </div>

      </div>

    </div>
  );
};

export default InformationClasseMini;
