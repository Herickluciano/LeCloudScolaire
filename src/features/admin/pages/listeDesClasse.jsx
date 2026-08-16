// src/features/admin/pages/listeDesClasse.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../../services/api';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const ListeDesClasse = () => {
  const { schoolId, schoolName } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ÉTATS DU MOTEUR DE RECHERCHE ET FILTRAGE ---
  const [rechercheClasse, setRechercheClasse] = useState('');

  // 🔄 Écoute en temps réel de la table 'classes' filtrée par école (SaaS)
  useEffect(() => {
    const currentSchool = schoolId || sessionStorage.getItem('sgs_school_id') || "lycee_saint_bernard";

    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool.trim().toLowerCase()));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classesList = [];
      snapshot.forEach((doc) => {
        classesList.push({ id: doc.id, ...doc.data() });
      });
      
      // Tri alphabétique basé sur le nom officiel de la classe
      classesList.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      
      setClasses(classesList);
      setLoading(false);
    }, (err) => {
      console.error("Erreur d'écoute des structures cloud :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  // 🔍 MOTEUR DE FILTRAGE INSTANTANÉ EN LOCAL
  const classesFiltrees = classes.filter(c => {
    const nomClasse = `${c.nom || ''} ${c.idBrute || ''} ${c.promotion || ''}`.toLowerCase();
    return nomClasse.includes(rechercheClasse.toLowerCase().trim());
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 font-sans bg-white rounded-xl border">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mr-2"></div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Mise à jour du registre des structures...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-md font-sans text-left animate-fadeIn">
      
      {/* 🏛️ BARRE D'EN-TÊTE DU REGISTRE GENERAL */}
      <div className="border-b pb-4 mb-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">
            📋 Registre Global des Classes Physiques ({classes.length})
          </h3>
          <p className="text-[11px] text-gray-400 font-bold mt-0.5 uppercase tracking-wide">
            Établissement : <span className="text-slate-700">{schoolName || 'Lycée Saint Bernard'}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded font-bold uppercase tracking-wide">
            ● Cloud Live Sync
          </span>
          <Link 
            to="/admin/dashboard" 
            className="inline-flex items-center text-xs font-black bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition no-underline shadow-2xs border"
          >
            ⬅️ Retour au Tableau
          </Link>
        </div>
      </div>

      {/* 🔍 NOVELLE RECTIFICATION : BARRE DE RECHERCHE DÉDIÉE PAR NOM DE CLASSE */}
      <div className="mb-6 bg-gray-50 border p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Filtre de recherche rapide :
        </div>
        <input 
          type="text" 
          placeholder="🔍 Rechercher une classe (Ex: 2nde C 1, 3ème, t_a1)..." 
          value={rechercheClasse}
          onChange={(e) => setRechercheClasse(e.target.value)}
          className="w-full sm:max-w-md bg-white border p-2.5 rounded-xl outline-none text-xs font-black text-gray-800 focus:ring-2 focus:ring-orange-500 shadow-2xs" 
        />
      </div>

      {/* COMPARTIMENT CONDITIONNEL DE GRILLE */}
      {classesFiltrees.length === 0 ? (
        <div className="p-12 text-center text-xs text-gray-400 font-bold uppercase tracking-wider border border-dashed rounded-xl bg-gray-50/50">
          {classes.length === 0 
            ? "Aucune structure pédagogique n'est ouverte pour le moment dans cet établissement."
            : "Aucune classe ne correspond à votre recherche."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classesFiltrees.map(c => {
            // ALIGNEMENT CHIRURGICAL SUR LES CLÉS DE VOTRE FIRESTORE
            const currentCount = Number(c.elevesCount || 0);
            const maxCapacity = Number(c.maxEleves || 50);
            const remplissagePercent = (currentCount / maxCapacity) * 100;
            
            return (
              <div key={c.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:shadow-lg transition duration-200 flex flex-col justify-between">
                
                {/* Libellé de la Division et son Code Brute */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-black text-gray-900 text-base tracking-tight uppercase">{c.nom || 'Sans nom'}</h4>
                    <p className="text-[9px] font-mono font-bold text-gray-400 mt-0.5">Code : {c.idBrute || 'N/A'}</p>
                  </div>
                  <span className="bg-purple-50 text-purple-700 border border-purple-100 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                    {c.promotion ? c.promotion.replace(/_/g, ' ') : 'GENERAL'}
                  </span>
                </div>

                {/* ALIGNEMENT DES ROLES ET RESPONSABLES ASSIGNÉS */}
                <div className="space-y-1.5 text-xs text-gray-600 mb-5 font-bold">
                  <p className="flex items-center gap-1.5">
                    <span>👤</span> 
                    <span className="text-gray-400 uppercase text-[10px]">Éducateur :</span> 
                    <span className="text-slate-800 uppercase font-black truncate max-w-[180px]">
                      {c.educateurName || "Non assigné"}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span>👑</span> 
                    <span className="text-gray-400 uppercase text-[10px]">Prof. Principal :</span> 
                    <span className="text-purple-700 uppercase font-black truncate max-w-[160px]">
                      {c.profPrincipalName || "Non assigné"}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5 border-t pt-1.5 mt-1.5 text-[11px]">
                    <span>📢</span>
                    <span className="text-gray-400 uppercase text-[10px]">Délégué :</span>
                    <span className="text-orange-600 font-black uppercase">
                      {c.delegueName || "Non désigné"}
                    </span>
                  </p>
                </div>

                {/* Jauge d'effectif MENA */}
                <div className="space-y-1.5">
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${currentCount >= maxCapacity ? 'bg-red-600' : currentCount >= 42 ? 'bg-yellow-500' : 'bg-purple-600'}`} 
                      style={{ width: `${Math.min(remplissagePercent, 100)}%` }}
                    ></div>
                  </div>

                  {/* Pied de carte d'effectif */}
                  <div className="flex justify-between items-center text-[11px] font-black text-gray-400">
                    <span>Effectif : <span className="text-gray-900 font-black">{currentCount}</span> / {maxCapacity}</span>
                    {currentCount >= maxCapacity && (
                      <span className="text-red-600 text-[9px] font-black uppercase bg-red-50 border border-red-200 px-1.5 py-0.5 rounded animate-pulse">⚠️ Saturée</span>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ListeDesClasse;
