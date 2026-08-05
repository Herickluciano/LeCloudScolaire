import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import ConfigurationTerminal from './ConfigurationTerminal';

const HomeAdmin = () => {
  const { user, schoolName, schoolId, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8">
      
      {/* En-tête de bienvenue institutionnel 🇨🇮 */}
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-orange-400 bg-orange-950/50 px-3 py-1 rounded-full">
            Session Direction SaaS Active
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2">
            🏛️ {schoolName || "Établissement Scolaire Partenaire"}
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            Bienvenue, M. le Responsable <strong className="text-white font-bold">{user?.name || "Administrateur"}</strong> — ID Instance : <span className="font-mono text-orange-300 font-bold uppercase">{schoolId}</span>
          </p>
        </div>
        
        <button 
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md self-end md:self-auto"
        >
          🚪 Quitter la session
        </button>
      </div>

      {/* 🗂️ GRILLE DES GRANDS PÔLES DE REDIRECTION ET LIENS ADMIN */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Carte 1 : Pilotage & Classes */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-lg font-bold">🏛️</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Pilotage Établissement</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Ouvrir de nouvelles classes, affecter des quotas d'élèves et lister la cartographie structurelle.</p>
          </div>
          <Link to="/admin/dashboard" className="w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            Accéder aux Classes
          </Link>
        </div>

                {/* Carte 2 : Secrétariat & Courriers */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-lg font-bold">✉️</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Secrétariat Numérique</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Consulter les requêtes des élèves, valider les dossiers et imprimer les Certificats de Fréquentation PDF.</p>
          </div>
          {/* 🟢 CORRECTION : Redirection ciblée vers la page Secrétariat */}
          <Link to="/admin/secretariat" className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            Dashboard(Tableau de Bord)
          </Link>
        </div>


        {/* Carte 3 : Communications & Alertes */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">📢</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Centre de Diffusion</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Diffuser des communiqués officiels par espace et expédier des e-mails avec pièces jointes de l'ordinateur.</p>
          </div>
          <Link to="/notifications" className="w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            Rédiger un message
          </Link>
        </div>

        {/* Carte 4 : Inscription des Élèves */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-lg font-bold">👤</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Inscriptions & Badges</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Enregistrer de nouveaux élèves, renseigner le genre et générer leur badge d'accès QR Code obligatoire.</p>
          </div>
          <Link to="/admin/AjouterEleve" className="w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            Inscrire un Élève
          </Link>
        </div>

        {/* Carte 5 : Recrutement Personnel RH */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center text-lg font-bold">💼</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Ressources Humaines</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Recruter et enregistrer les professeurs et les éducateurs de niveau pour cet établissement scolaire.</p>
          </div>
          <Link to="/admin/recrutement-personnel" className="w-full text-center bg-slate-700 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            Recruter du Personnel
          </Link>
        </div>

        {/* Carte 6 : Sécurité & Profils */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center text-lg font-bold">🔒</div>
            <h3 className="text-base font-black text-gray-800 mt-4">Paramètres de Sécurité</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Modifier votre mot de passe administrateur en temps réel ou changer les informations confidentielles.</p>
          </div>
          <Link to="/mon-compte/securite" className="w-full text-center bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block">
            Éspace Sécurité
          </Link>
        </div>

      </div>
      <ConfigurationTerminal/>
    </div>
  );
};

export default HomeAdmin;
