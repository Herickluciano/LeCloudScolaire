import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const DashboardProf = () => {
  const { user, schoolName, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8">
      
      {/* 🏛️ BANDEAU PROFIL ENSEIGNANT */}
      <div className="max-w-6xl mx-auto bg-purple-900 rounded-2xl p-6 md:p-8 text-white shadow-lg mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-950/60 px-3 py-1 rounded-full">
            Espace Enseignant Sécurisé Active
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2 uppercase">
            👨‍🏫 M. {user?.nom} <span className="font-normal lowercase first-letter:uppercase text-purple-200">{user?.prenoms || user?.prenom}</span>
          </h1>
          <p className="text-xs text-purple-200 mt-1.5 font-bold uppercase tracking-wide">
            🏫 {schoolName || "Établissement Partenaire SaaS"} — Discipline : <span className="text-orange-400 font-extrabold">{user?.matiereEnseignee || "Mathématiques"}</span>
          </p>
        </div>
        
        <button 
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md self-end md:self-auto"
        >
          🚪 Déconnexion
        </button>
      </div>

      {/* 🗂️ PANNEAU DE NAVIGATION ET OUTILS MÉTIERS */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARTE 1 : EVALUATION & SAISIE DES NOTES */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">📊</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Saisie des Notes & Évaluations</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Accéder au registre d'évaluation trimestriel pour attribuer les notes d'interrogations, devoirs surveillés et compositions de vos classes affectées.
            </p>
          </div>
          <Link 
            to="/prof/saisie-notes" 
            className="w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block"
          >
            Ouvrir le Carnet de Notes
          </Link>
        </div>

        {/* CARTE 2 : COMMUNICATIONS DE LA DIRECTION */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-lg font-bold">🔔</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Notes d'Information & Communiqués</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Consulter les notes d'informations de la direction, les circulaires administratives de l'établissement et télécharger les pièces jointes importantes.
            </p>
          </div>
          <Link 
            to="/notifications" 
            className="w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block"
          >
            Consulter les Messages
          </Link>
        </div>

      </div>

      {/* FOOTER STATUT RH */}
      <div className="max-w-6xl mx-auto mt-8 p-4 bg-gray-100/70 border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
        <span>Grade d'affectation : <strong className="text-gray-600">{user?.grade || "A3 / Certifié"}</strong></span>
        <span>Ancienneté Cloud : <strong className="text-gray-600">{user?.anneesExperience || 0} Ans d'Expérience</strong></span>
      </div>

    </div>
  );
};

export default DashboardProf;
