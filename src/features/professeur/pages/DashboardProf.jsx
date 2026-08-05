import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const DashboardProf = () => {
  const { user, schoolName, logout } = useAuth();
  const navigate = useNavigate();

  // 🟢 FORÇAGE DU RE-RENDU : Force l'écran à s'actualiser dès que le profil Cloud arrive
  const [profilLocal, setProfilLocal] = useState(null);

  useEffect(() => {
    if (user) {
      setProfilLocal(user);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Sécurités de repli textuel
  const nomEnseignant = profilLocal?.nom || user?.nom || 'Enseignant';
  const prenomEnseignant = profilLocal?.prenoms || profilLocal?.prenom || user?.prenoms || '';
  const matiereEnseignee = profilLocal?.matiereEnseignee || user?.matiereEnseignee || 'Français';
  const gradeRH = profilLocal?.grade || user?.grade || 'A3 / Certifié';
  const experienceRH = profilLocal?.experience !== undefined ? profilLocal.experience : (user?.experience || 0);
  const classeAttribuee = profilLocal?.classeId || user?.classeId || '';

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8">
      
      {/* 🏛️ BANDEAU PROFIL ENSEIGNANT */}
      <div className="max-w-6xl mx-auto bg-purple-900 rounded-2xl p-6 md:p-8 text-white shadow-lg mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-950/60 px-3 py-1 rounded-full">
            Espace Enseignant Sécurisé Actif
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2 uppercase">
            👨‍🏫 M. {nomEnseignant} <span className="font-normal lowercase first-letter:uppercase text-purple-200">{prenomEnseignant}</span>
          </h1>
          <p className="text-xs text-purple-200 mt-1.5 font-bold uppercase tracking-wide">
            🏫 {schoolName || "Établissement Partenaire SaaS"} — Discipline : <span className="text-orange-400 font-extrabold">{matiereEnseignee}</span>
          </p>
      <div className="max-w-6xl mx-auto mt-8 p-4 bg-gray-100/70 border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
        <span>Grade d'affectation : <strong className="text-gray-600">{gradeRH}</strong></span>
        <span>Ancienneté Cloud : <strong className="text-gray-600">{experienceRH} Ans d'Expérience</strong></span>
      </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md self-end md:self-auto cursor-pointer"
        >
          🚪 Déconnexion
        </button>
      </div>

      {/* 🗂️ PANNEAU DE NAVIGATION ET OUTILS MÉTIERS */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* CARTE 1 : ACTIVITÉS PÉDAGOGIQUES */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">📚</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Activités Pédagogiques</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Consigner les résumés de leçons dans le cahier de textes, émarger les séances et attribuer les devoirs de maison.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-6 border-t border-gray-50 pt-4">
            <Link to="/prof/cahier-textes" className="bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] text-center py-2.5 rounded-xl transition">
              📖 Cahier Textes
            </Link>
            <Link to="/prof/saisie-notes" className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-[11px] text-center py-2.5 rounded-xl transition shadow-xs">
              📊 Saisir Notes
            </Link>
          </div>
        </div>

        {/* CARTE 2 : POINTAGE BIOMÉTRIQUE */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-lg font-bold">⏱️</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Pointage & Vacations RH</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Émarger vos heures de début et de fin de séance en un clic pour certifier votre volume horaire mensuel auprès de l'administration.
            </p>
          </div>
          <Link to="/prof/mon-pointage" className="w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            ⏱️ Émarger ma Présence
          </Link>
        </div>

        {/* CARTE 3 : MESSAGERIE */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-lg font-bold">✉️</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Communication & Alertes</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Consulter instantanément les circulaires de la direction, télécharger les pièces jointes, et rédiger des alertes de classe.
            </p>
          </div>
          <Link to="/prof/messagerie" className="w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            Ouvrir la Messagerie
          </Link>
        </div>

        {/* 👑 CARTE 4 : ACCÈS EXCLUSIF AU PROFESSEUR PRINCIPAL TITULAIRE */}
        {(classeAttribuee || profilLocal?.role === 'prof_principal' || profilLocal?.role === 'super_admin') && (
          <div className="bg-white p-6 rounded-2xl border border-purple-200 bg-gradient-to-b from-white to-purple-50/30 shadow-sm hover:shadow-md transition flex flex-col justify-between animate-fadeIn md:col-span-2 lg:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="h-10 w-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center text-lg font-bold">👑</div>
                <h3 className="text-base font-black text-purple-950 mt-4">Espace Professeur Principal (Titulaire)</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
                  Piloter le conseil de classe virtuel de la division <strong className="text-purple-700 uppercase">{(classeAttribuee || '5eme_1')}</strong>, analyser l'assiduité, suivre la moyenne générale et sceller le livret scolaire trimestriel [local].
                </p>
              </div>
              <Link 
                to="/prof/dashboard-pp" 
                className="bg-purple-700 hover:bg-purple-800 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl shadow-md transition whitespace-nowrap self-end sm:self-auto cursor-pointer"
              >
                👑 Ouvrir la Tour de Contrôle PP
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DashboardProf;
