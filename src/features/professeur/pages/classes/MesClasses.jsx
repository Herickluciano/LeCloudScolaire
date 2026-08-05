import { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';

const MesClasses = () => {
  const { user, schoolId } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔄 ÉCOUTEUR CLOUD : Récupérer les classes de l'établissement
  useEffect(() => {
    if (!currentSchool) return;

    // Dans un modèle SaaS avancé, on filtre les classes où ce prof est assigné
    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClasses(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse">Chargement de vos attributions...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 font-sans">
      
      {/* Fil d'Ariane / Retour */}
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
          ⬅️ Bureau Virtuel
        </Link>
      </div>

      {/* En-tête */}
      <div className="border-b pb-4 mb-6">
        <h2 className="text-xl font-black text-gray-800 tracking-tight">📚 Mes Classes & Divisions Pédagogiques</h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Cliquez sur une classe pour gérer le cahier de textes, faire l'appel ou ouvrir le carnet de notes.</p>
      </div>

      {/* Grid des cartes de classes */}
      {classes.length === 0 ? (
        <div className="p-8 text-center text-xs font-bold text-gray-400 border border-dashed rounded-xl">
          Aucune classe ne vous a encore été attribuée par la Direction.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((c) => {
            const classCleanName = c.id.replace(`${currentSchool}_`, '').toUpperCase();
            return (
              <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-2xl">🏫</span>
                    <span className="text-[10px] font-black bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-md">
                      {c.elevesCount || 0} / 50 ÉLÈVES
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-black text-gray-900 mt-3">Classe : {classCleanName}</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">Niveau : {c.niveau || 'Secondaire'}</p>
                </div>

                {/* Boutons d'actions rapides par classe */}
                <div className="grid grid-cols-2 gap-2 mt-6 border-t border-gray-50 pt-4">
                  <Link 
                    to="/prof/saisie-notes" 
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] text-center py-2 rounded-lg transition"
                  >
                    📝 Noter
                  </Link>
                  <Link 
                    to="/prof/saisie-notes" // Sera redirigé vers FaireAppel.jsx à l'étape suivante
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] text-center py-2 rounded-lg transition"
                  >
                    🛑 Faire l'Appel
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default MesClasses;
