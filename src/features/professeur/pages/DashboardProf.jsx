import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';

const DashboardProf = () => {
  const { user, schoolId, logout } = useAuth();
  const navigate = useNavigate();

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa').trim().toLowerCase();
  const idProf = user?.matricule || user?.id || 'PROF_UNKNOWN';
  
  // DÉTECTION DU DOUBLE STATUT (Prof Normal + Prof Principal)
  const estProfPrincipal = user?.role?.trim().toLowerCase() === 'prof_principal' || !!user?.classeId;
  const classeTitulaire = (user?.classeId || 'tle_d_1').trim().toUpperCase();

  // --- ÉTATS CLOUD ---
  const [classesAssignees, setClassesAssignees] = useState([]);
  const [totalPointages, setTotalPointages] = useState(0);
  const [loading, setLoading] = useState(true);

  // 🔄 ÉCOUTEUR RÉACTIF TEMPS RÉEL
  useEffect(() => {
    if (!idProf || !currentSchool) {
      setLoading(false);
      return;
    }

    // A. Lecture live des classes d'enseignement de l'école
    const qClasses = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.professeursIds?.includes(idProf) || data.id?.includes(classeTitulaire.toLowerCase())) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setClassesAssignees(list);
    });

    // B. Lecture live des émargements RH personnels
    const qPointages = query(
      collection(db, "pointages_professeurs"),
      where("schoolId", "==", currentSchool),
      where("professeurId", "==", idProf)
    );
    const unsubPointages = onSnapshot(qPointages, (snapshot) => {
      setTotalPointages(snapshot.size);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubPointages();
    };
  }, [idProf, currentSchool, classeTitulaire]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center font-sans bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-bold uppercase animate-pulse">Sychronisation en temps réel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn text-gray-700">
      
      {/* BARRE DE SESSIONS & ACTIONS GLOBALES */}
      <div className="max-w-6xl mx-auto flex justify-between items-center border-b pb-4 mb-6">
        <div className="text-left">
          <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
            Espace Pédagogique Enseignant
          </span>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 mt-2">
            Bonjour, M. {user?.nom || "BLEGUY"}
          </h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Discipline : <span className="font-bold text-gray-600">{user?.matiereEnseignee || "Français"}</span> — Grade : {user?.grade || "A3"}</p>
        </div>
        
        <button 
          type="button" 
          onClick={() => { logout(); navigate('/login'); }} 
          className="bg-gray-100 hover:bg-gray-200 border text-gray-700 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          🚪 Déconnexion
        </button>
      </div>

      {/* COMPTEURS DE SUIVI RH EN TEMPS RÉEL */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 text-left">
        <div className="bg-white p-5 rounded-2xl border shadow-2xs">
          <p className="text-[10px] font-black uppercase text-gray-400">Vos Heures de Vacation Effectuées</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalPointages * 2} <span className="text-xs font-bold text-gray-400">Heures Validées</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-2xs">
          <p className="text-[10px] font-black uppercase text-gray-400">Classes Affectées cette semaine</p>
          <p className="text-2xl font-black text-purple-700 mt-1">{classesAssignees.length} <span className="text-xs font-bold text-gray-400">Divisions</span></p>
        </div>
      </div>

      {/* TITRE DE LA GRILLE MÉTIERS RESTRUCTURÉE */}
      <div className="max-w-6xl mx-auto text-left mb-6">
        <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Activités Pédagogiques</h2>
        <p className="text-xs text-gray-400 mt-0.5 font-medium">Consigner les résumés de leçons dans le cahier de textes, émarger les présences élèves et attribuer les devoirs.</p>
      </div>

      {/* ================= GRILLE DES ACTIVITÉS EN TEMPS RÉEL ================= */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        
        {/* BOUTON MÉTIER 1 : REGISTRE D'APPEL */}
        <div className="bg-white p-6 rounded-2xl border shadow-2xs flex flex-col justify-between">
          <div>
            <div className="h-9 w-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">📋</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight mt-4">Registre d'Appel (Élèves)</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Marquer les élèves présents, absents ou en retard heure par heure avec alerte parentale instantanée.
            </p>
          </div>
          <Link to="/prof/faire-appel" className="w-full text-center bg-gray-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition mt-5 block cursor-pointer">
            📝 Ouvrir le Registre
          </Link>
        </div>

        {/* BOUTON MÉTIER 2 : CAHIER DE TEXTES */}
        <div className="bg-white p-6 rounded-2xl border shadow-2xs flex flex-col justify-between">
          <div>
            <div className="h-9 w-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center text-sm">📖</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight mt-4">Cahier de Textes Numérique</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Consigner les résumés de séances de cours et associer les exercices ou devoirs de maison rattachés.
            </p>
          </div>
          <Link to="/prof/cahier-textes" className="w-full text-center bg-gray-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition mt-5 block cursor-pointer">
            📖 Émarger Cahier Textes
          </Link>
        </div>

        {/* BOUTON MÉTIER 3 : SAISIR NOTES */}
        <div className="bg-white p-6 rounded-2xl border shadow-2xs flex flex-col justify-between">
          <div>
            <div className="h-9 w-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center text-sm">📊</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight mt-4">Saisir Notes Évaluations</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Remplir la grille des notes pour les interrogations, devoirs surveillés et devoirs communs du trimestre.
            </p>
          </div>
          <Link to="/prof/saisie-notes" className="w-full text-center bg-gray-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition mt-5 block cursor-pointer">
            📊 Saisir Notes
          </Link>
        </div>

        {/* ================= 👑 INTERCONNEXION DIRECTE DU PROFESSEUR PRINCIPAL SÉCURISÉE ================= */}
        {estProfPrincipal && (
          <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-200 flex flex-col justify-between shadow-2xs animate-fadeIn">
            <div>
              <div className="h-9 w-9 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center text-sm">👑</div>
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight mt-4">Conseil & Titularisation ({classeTitulaire})</h3>
              <p className="text-xs text-amber-700 mt-1 font-medium leading-relaxed">
                Accéder au radar d'assiduité complet et contrôler la progression pédagogique globale des collègues pour votre classe.
              </p>
            </div>
            {/* 🟢 ACTION LIQUIDATION IMPÉRATIVE : Redirection directe et sans bogue vers le DashboardPP via navigate */}
            <button 
              type="button"
              onClick={() => navigate("/prof/dashboard-pp")}
              className="w-full text-center bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition mt-5 block cursor-pointer"
            >
              👑 Espace Prof Principal
            </button>
          </div>
        )}

                {/* BOUTON MÉTIER 5 : POINTAGE RH DES VACATIONS */}
        <div className="bg-white p-6 rounded-2xl border shadow-2xs flex flex-col justify-between">
          <div>
            <div className="h-9 w-9 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center text-sm">⏰</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight mt-4">Émargement Présence RH</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Enregistrer votre feuille de vacation à l'arrivée pour certifier vos heures de cours en mode démo.
            </p>
          </div>
          <Link to="/prof/mon-pointage" className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 border font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition mt-5 block cursor-pointer">
            ⏰ Pointer Ma Présence
          </Link>
        </div>

        {/* BOUTON MÉTIER 6 : MESSAGERIE ADMINISTRATIVE */}
        <div className="bg-white p-6 rounded-2xl border shadow-2xs flex flex-col justify-between">
          <div>
            <div className="h-9 w-9 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-sm">✉️</div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight mt-4">Centre de Messagerie</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Consulter les circulaires transmises par la direction ou envoyer une alerte aux parents d'élèves.
            </p>
          </div>
          <Link to="/prof/messagerie" className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 border font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition mt-5 block cursor-pointer">
            ✉️ Ouvrir la Réception
          </Link>
        </div>

      </div>
    </div>
  );
};

export default DashboardProf;
