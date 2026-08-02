import React, { useState, useEffect,link } from 'react';
import { db } from '../../../services/api';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const ListeDesClasse = () => {
  const { schoolId, schoolName } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔄 Écoute en temps réel de la table 'classes' filtrée par école (SaaS)
  useEffect(() => {
    // Si schoolId n'est pas encore chargé, on utilise le fallback par défaut de votre projet
    const currentSchool = schoolId || "lycee_classique_abidjan";

    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classesList = [];
      snapshot.forEach((doc) => {
        classesList.push({ id: doc.id, ...doc.data() });
      });
      
      // 🛠️ CORRECTION 1 : Tri alphabétique basé sur le champ "niveau" au lieu de "promotion"
      classesList.sort((a, b) => (a.niveau || '').localeCompare(b.niveau || ''));
      
      setClasses(classesList);
      setLoading(false);
    }, (err) => {
      console.error("Erreur d'écoute des structures cloud :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 font-sans">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mr-2"></div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Mise à jour du registre...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-md font-sans">
      <div className="border-b pb-3 mb-5 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            📋 Registre Global des Classes Physiques ({classes.length})
          </h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Établissement : {schoolName || 'Lycee Classique Abidjan'}</p>
        </div>
        <span className="text-[10px] font-mono bg-orange-50 text-orange-600 px-2.5 py-1 rounded font-bold uppercase tracking-wide">
          Cloud Synchronisé
        </span>
        <Link to="/admin/home">⬅️ Retour à l'Accueil</Link>

      </div>

      {classes.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-400 font-medium border border-dashed rounded-xl">
          Aucune structure pédagogique n'est ouverte pour le moment dans cet établissement.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(c => {
            // 🛠️ CORRECTION 2 : Alignement sur la clé exacte "elevesCount" (avec C majuscule)
            const currentCount = c.elevesCount || 0;
            const maxCapacity = c.maxEleves || 50;
            const remplissagePercent = (currentCount / maxCapacity) * 100;
            
            return (
              <div key={c.id} className="p-5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-lg transition duration-200">
                
                {/* Libellé et Badge Promotion */}
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-black text-gray-800 text-lg tracking-tight">{c.nom || 'Sans nom'}</h4>
                  <span className="bg-gray-100 text-gray-800 text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wide">
                    {c.niveau ? c.niveau.replace(/_/g, ' ') : 'N/A'}
                  </span>
                </div>

                {/* Encadrement et Responsables rattachés */}
                <div className="space-y-1 text-xs text-gray-600 mb-4 font-medium">
                  <p>👤 <span className="text-gray-400">Éducateur :</span> <span className="font-semibold text-gray-700">{c.educateur_id || 'Non assigné'}</span></p>
                  <p>👑 <span className="text-gray-400">Prof. Principal :</span> <span className="font-semibold text-purple-700">{c.prof_principal_id || 'Non assigné'}</span></p>
                </div>

                {/* Jauge d'effectif réglementaire MENA (Plafond 50 max) */}
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${currentCount >= 48 ? 'bg-red-600' : currentCount >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                    style={{ width: `${Math.min(remplissagePercent, 100)}%` }}
                  ></div>
                </div>

                {/* Pied de carte d'effectif */}
                <div className="flex justify-between items-center mt-2.5 text-xs font-bold text-gray-500">
                  <span>Effectif : <span className="text-gray-800 font-extrabold">{currentCount}</span> / {maxCapacity} inscrits</span>
                  {currentCount >= 50 && (
                    <span className="text-red-600 text-[10px] font-black uppercase animate-pulse">⚠️ Classe Saturée</span>
                  )}
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
