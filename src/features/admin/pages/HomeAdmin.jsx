import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const HomeAdmin = () => {
  const { user, schoolName, schoolId, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn">
      
      {/* En-tête de bienvenue institutionnel 🇨ICI */}
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-950/40 px-3 py-1 rounded-full">
            Console d'Administration Centrale
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2">
            🏛️ {schoolName || "Établissement Scolaire Partenaire"}
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            Bienvenue, M. le Responsable <strong className="text-orange-400 font-black">{user?.name || "Administrateur"}</strong> — ID Instance : <span className="font-mono text-orange-300 font-bold uppercase">{schoolId}</span>
          </p>
        </div>
        
        <button 
          type="button"
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md self-end md:self-auto cursor-pointer"
        >
          🚪 Quitter la session
        </button>
      </div>

      {/* 🗂️ GRILLE DES GRANDS PÔLES DE REDIRECTION MULTI-RÔLES SAAS */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Carte 1 : Communications & Alertes (Centre de Diffusion) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-500/20 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">📢</div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Centre de Diffusion</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Diffuser des communiqués officiels par espace et expédier des e-mails avec pièces jointes de l'ordinateur.</p>
          </div>
          <Link to="/notifications" className="w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
            🚀 Rédiger un message
          </Link>
        </div>

        {/* Carte 2 : Inscription des Élèves & Badges */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-emerald-500/20 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-lg font-bold">👤</div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Inscriptions & Badges</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Enregistrer de nouveaux élèves, renseigner le genre, le mail parental et générer leur reçu d'accès QR Code obligatoire.</p>
          </div>
          <Link to="/admin/AjouterEleve" className="w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
            👤 Inscrire un Élève
          </Link>
        </div>

        {/* Carte 3 : Recrutement Personnel RH (Professeurs & Éducateurs) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-slate-500/30 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center text-lg font-bold">💼</div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Ressources Humaines</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Recruter et enregistrer les professeurs et les éducateurs de niveau pour cet établissement scolaire.</p>
          </div>
          <Link to="/admin/recrutement-personnel" className="w-full text-center bg-slate-700 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
            💼 Recruter du Personnel
          </Link>
        </div>
                {/* Carte : GESTION TECHNIQUE DES EMPLOIS DU TEMPS */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-500/20 transition flex flex-col justify-between animate-fadeIn">
          <div>
            <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">📅</div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Emplois du Temps</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Concevoir, modifier et déployer les plannings de cours hebdomadaires par classe et par enseignant pour l'établissement.
            </p>
          </div>
          <Link 
            to="/admin/emploi-temps" 
            className="w-full text-center bg-purple-600 hover:bg-purple-700 text-slate-100 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer"
          >
            📅 Planifier les Cours
          </Link>
        </div>


        {/* Carte 4 : PARAMÈTRES DE SÉCURITÉ ACCÈS CLOUD (DÉBLOQUÉE 🔓) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-orange-500/20 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-lg font-bold">🛡️</div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Paramètres de Sécurité</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Modifier votre mot de passe administrateur en temps réel ou changer les informations de chiffrement confidentielles de l'école.
            </p>
          </div>
          <Link 
            to="/admin/security-settings" 
            className="w-full text-center bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition shadow-xs mt-6 block cursor-pointer"
          >
            ⚙️ Ouvrir la console de sécurité
          </Link>
        </div>

        {/* Carte 5 : ENREGISTREMENT DU TERMINAL FIXE MACHINE BIOMÉTRIQUE (DÉBLOQUÉE 🔓) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-500/20 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">📟</div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Secrétariat Informatique</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Enregistrement du Terminal Fixe : Configurez cet ordinateur comme poste d'émargement officiel des présences.
            </p>
          </div>
          <Link 
            to="/admin/configure-terminal" 
            className="w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition shadow-xs mt-6 block cursor-pointer"
          >
            📟 Configurer ce Poste Fixe
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomeAdmin;
