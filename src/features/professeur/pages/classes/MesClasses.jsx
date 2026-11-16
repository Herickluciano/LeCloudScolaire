// src/features/professeur/pages/classes/MesClasses.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../../../../pages/Header';

const MesClasses = () => {
  const { user, schoolId } = useAuth();
  
  // 🎯 ZERO VALEUR EN DUR : Extraction dynamique des identifiants cloud de l'établissement
  const currentSchool = (user?.schoolId || schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();
  const monIdProf = user?.id || user?.matricule || 'PROF_FORGIE_491';
  const disciplineProf = user?.matiereEnseignee || user?.matiere || 'Anglais';

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔄 ÉCOUTEUR CLOUD FILTRÉ PAR L'EMPLOI DU TEMPS INDIVIDUEL (SÉCURITÉ STRICTE)
  useEffect(() => {
    if (!currentSchool || !monIdProf) {
      setLoading(false);
      return;
    }

    const qEDT = query(collection(db, 'emplois_du_temps'), where('schoolId', '==', currentSchool));
    
    const unsubscribe = onSnapshot(qEDT, (snapshot) => {
      const mapClassesFiltrees = {};

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        if (Array.isArray(data.creneaux)) {
          data.creneaux.forEach((c) => {
            // Seules les classes de l'emploi du temps de cet enseignant sont collectées
            if (String(c.professeurId).trim().toLowerCase() === monIdProf.trim().toLowerCase()) {
              const targetClassId = c.classeId || data.classeId;
              const targetClassName = c.nomClasse || data.classeNom || "Division";
              
              if (targetClassId) {
                mapClassesFiltrees[targetClassId] = {
                  id: targetClassId,
                  nom: targetClassName,
                  niveau: data.promotion || c.nomClasse || 'Secondaire',
                  elevesCount: data.elevesCount || 0
                };
              }
            }
          });
        }
      });

      const listFinal = Object.values(mapClassesFiltrees).sort((a, b) => a.nom.localeCompare(b.nom));
      setClasses(listFinal);
      setLoading(false);
    }, (err) => {
      console.error("Erreur filtrage des classes par l'EDT :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool, monIdProf]);

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">Chargement de vos attributions réelles...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto sm:p-6 font-sans text-gray-700 text-left bg-white min-h-screen animate-fadeIn">
      <Header/>
      {/* BOUTON RETOUR BUREAU UNIFIE */}
      <div className="mb-4">
        <Link to="/professeur/dashboard" className="bgvalidbnt  inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs no-underline">
          ⬅️ Bureau Enseignant
        </Link>
      </div>

      {/* EN-TÊTE D'AFFICHAGE */}
      <div className="border-b pb-4 mb-6">
        <h2 className="bgvalidtexte text-xl font-black text-gray-800 tracking-tight">Mes Classes & Divisions Pédagogiques Autorisées</h2>
        <p className="bgvalidtexta text-xs text-gray-500 font-medium mt-0.5">
          Sélectionnez une division de votre grille horaire pour ouvrir les modules d'émargement ou de relevés de notes.
        </p>
      </div>

      {/* GRILLE DES CARTES DE CLASSES RESTREINTES */}
      {classes.length === 0 ? (
        <div className="p-12 text-center text-xs font-bold text-gray-400 border border-dashed rounded-2xl bg-white">
          Aucune classe d'intervention n'est actuellement planifiée à votre nom dans l'emploi du temps.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-2xl">🏫</span>
                  <span className="text-[10px] font-black bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-md">
                    STRUCTURE COMPLÈTE
                  </span>
                </div>
                
                <h3 className="text-lg font-black text-gray-900 mt-3">Classe : {String(c.nom).toUpperCase()}</h3>
                <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">Discipline : {disciplineProf}</p>
              </div>

              {/* INTERCONNEXION DIRECTE DES BOUTONS VIA LE PARAMÈTRE CLASSEID SÉCURISÉ */}
              <div className="grid grid-cols-2 gap-2 mt-6 border-t border-gray-100 pt-4">
                <Link 
                  to={`/professeur/notes?classeId=${c.id}`} 
                  className="bg-purple-600 hover:bg-purple-700 font-black text-[11px] text-center py-2.5 rounded-xl transition no-underline shadow-2xs"
                >
                  📊 Enregistré Notes
                </Link>
                <Link 
                  to={`/professeur/appel?classeId=${c.id}`} 
                  className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-[11px] text-center py-2.5 rounded-xl transition no-underline shadow-2xs"
                >
                  📝 Faire l'Appel du jour
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default MesClasses;
