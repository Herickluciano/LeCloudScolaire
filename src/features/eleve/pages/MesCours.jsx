// src/features/eleve/pages/MesCours.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../../../pages/Header';

const MesCours = () => {
  const { user } = useAuth();
  
  // Normalisation des variables d'environnement de l'apprenant
  const currentSchool = (user?.schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();
  const classeIdEleve = (user?.classeId || '5eme_1').trim().toLowerCase();

  // --- ÉTATS RÉACTIFS ---
  const [lecons, setLecons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matiereFiltre, setMatiereFiltre] = useState('ALL');
  const [rechercheTexte, setRechercheContact] = useState('');

  // 📡 ÉCOUTEUR CLOUD TIME-SYNC : Capture en temps réel de la progression pédagogique
  useEffect(() => {
    if (!currentSchool || !classeIdEleve) return;

    const qCahier = query(
      collection(db, "cahier_textes"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", classeIdEleve)
    );

    const unsubscribe = onSnapshot(qCahier, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Tri chronologique strict côté client (Du cours le plus récent au plus ancien)
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setLecons(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur d'extraction du grand livre des cours NoSQL :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool, classeIdEleve]);

  // 🎛️ EXTRACTEUR DYNAMIQUE DE LA LISTE DES MATIÈRES ACTIVES DE LA CLASSE
  const listeMatieresDisponibles = Array.from(
    new Set(lecons.map(l => String(l.matiere || '').trim().toUpperCase()))
  ).filter(Boolean);

  // 🔍 FILTRAGE CHIRURGICAL ET BARRE DE RECHERCHE INTELLIGENTE
  const coursFiltresEtVérifiés = lecons.filter(l => {
    const matchMatiere = matiereFiltre === 'ALL' || String(l.matiere).toUpperCase().trim() === matiereFiltre;
    const texteRechercheNet = rechercheTexte.toUpperCase().trim();
    const matchTexte = !texteRechercheNet || 
                       String(l.titre || '').toUpperCase().includes(texteRechercheNet) || 
                       String(l.contenu || '').toUpperCase().includes(texteRechercheNet);

    return matchMatiere && matchTexte;
  });

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs font-bold text-orange-400 animate-pulse uppercase tracking-widest">Synchronisation de vos cahiers de leçons...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans  sm:p-6 lg:p-8 animate-fadeIn text-left w-full select-none">
      <Header/>
      {/* BOUTON RETOUR RESPONSIVE */}
      <div className="max-w-6xl mx-auto mb-4">
        <Link to="/eleve/dashboard" className="w-full sm:w-auto inline-flex justify-center items-center text-xs font-bold bg-white hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl border transition shadow-2xs">
          ⬅️ Retour au Tableau de Bord
        </Link>
      </div>

      {/* EN-TÊTE ÉPURÉ CONFORMITÉ MINISTERIELLE */}
      <div className="max-w-6xl mx-auto bg-white border rounded-2xl p-4 sm:p-5 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <span className="bg-orange-100 text-orange-700 font-extrabold text-[9px] uppercase px-2.5 py-1 rounded-md border border-orange-200">📖 Espace Révisions & Rattrapages</span>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1 uppercase">Mes Cours En Ligne</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Retrouvez l'objectif du cours, révisez vos chapitres et complétez vos devoirs en cas d'absence.</p>
        </div>
        <div className="bg-slate-900 text-white font-mono font-bold text-xs px-3 py-2 rounded-xl border border-slate-800 uppercase">
          Classe active : {classeIdEleve}
        </div>
      </div>

      {/* BARRE DE TRI ET FILTRES RAPIDES SÉCURISÉE */}
      <div className="max-w-6xl mx-auto bg-white border rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
        
        {/* Filtre 1 : Recherche textuelle par mots-clés */}
        <div className="md:col-span-2">
          <label className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide mb-1">Rechercher par Titre ou Chapitre</label>
          <input 
            type="text" 
            placeholder="🔍 Ex: Équations, Discriminant, Notion de fonction..." 
            value={rechercheTexte}
            onChange={(e) => setRechercheContact(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        {/* Filtre 2 : Tri par discipline d'enseignement */}
        <div>
          <label className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide mb-1">Filtrer par Matière</label>
          <select 
            value={matiereFiltre} 
            onChange={(e) => setMatiereFiltre(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="ALL">📚 Toutes les Disciplines ({lecons.length})</option>
            {listeMatieresDisponibles.map(mat => (
              <option key={mat} value={mat}>{mat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* RENDU DES FICHES DE COURS CHRONOLOGIQUES */}
      <div className="max-w-6xl mx-auto space-y-4">
        {coursFiltresEtVérifiés.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wide bg-white rounded-2xl border border-dashed p-6">
            ⚠️ Aucun contenu pédagogique ne correspond à vos critères de recherche pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {coursFiltresEtVérifiés.map((cours) => (
              <div key={cours.id} className="bg-white border border-slate-200/60 rounded-2xl p-4 sm:p-5 shadow-xs relative hover:border-orange-400/30 transition duration-150 animate-fadeIn">
                
                {/* En-tête de la fiche de leçon */}
                <div className="flex justify-between items-start flex-wrap gap-2 border-b pb-2 mb-3">
                  <div>
                    <span className="bg-purple-100 text-purple-700 font-black text-[9px] uppercase px-2 py-0.5 rounded border border-purple-200 mr-2">{cours.matiere || 'Discipline'}</span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight inline-block mt-1 sm:mt-0">{cours.titre}</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-100 border px-2.5 py-1 rounded-xl shadow-2xs">
                    📅 Dispensé le : {cours.date}
                  </span>
                </div>

                {/* Corps et Résumé de l'Enseignant */}
                <div className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap pl-1">
                  {cours.contenu}
                </div>

                {/* Bloc d'exercices à faire (Travail maison) */}
                <div className="mt-4 p-3 bg-amber-50/60 border border-dashed border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium flex items-start gap-2">
                  <span className="text-sm">🎯</span>
                  <div>
                    <span className="font-black uppercase text-[9px] tracking-wide text-amber-950 block mb-0.5">Travail de maison et révisions exigés :</span>
                    {cours.devoir}
                  </div>
                </div>

                {/* Bloc signature cryptographique de validation */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-wider">
                  <span>Signé numériquement : M. {cours.profName || 'L’Enseignant'}</span>
                  <span className="text-[8px] text-slate-300 font-mono tracking-normal capitalize">{cours.id}</span>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default MesCours;
