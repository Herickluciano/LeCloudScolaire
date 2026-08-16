import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import NotificationCentre from '../../../component/Shared/NotificationCentre';
import ReceptionAdmin from './messages/ReceptionAdmin';
import FormulaireClasse from './FormulaireClasse';
import SecretariatAdmin from './SecretariatAdmin';

const HomeAdmin = () => {
  const { user, schoolName, schoolId, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="">
      <div className="barre-bi-couleur"></div>
      {/* En-tête de bienvenue institutionnel */}
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-950/40 px-3 py-1 ">
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
          className="bg-red-600 hover:bg-red-700  font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md self-end md:self-auto cursor-pointer"
        >
           Quitter la session
        </button>
      </div>

      {/* 🗂️ GRILLE DES GRANDS PÔLES DE REDIRECTION MULTI-RÔLES SAAS */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         
          {/* 🟢 CARTE 0 AJOUTÉE : REDIRECTION VERS LE DASHBOARD DE PILOTAGE GLOBAL */}
        <div className="bg-purple-900 text-purple-100 p-6 rounded-2xl shadow-md border border-purple-950 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black mt-4 uppercase tracking-tight">RH & GESTION DE CRISE</h3>
            <p className="text-xs text-purple-200 mt-1 leading-relaxed font-medium">
              Secretariat Generale l'etablisement.
            </p>
          </div>
          <Link 
            to="/admin/Secretariat" 
            className="w-full text-center bg-orange-500 hover:bg-orange-600 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-md transition mt-6 block cursor-pointer"
          >
             Dashboard Secretariat 
          </Link>
        </div>

        {/* 🟢 CARTE 1 AJOUTÉE : REDIRECTION VERS LE DASHBOARD DE PILOTAGE GLOBAL */}
        <div className="bg-purple-900 text-purple-100 p-6 rounded-2xl shadow-md border border-purple-950 flex flex-col justify-between">
          <div>

            <h3 className="text-base font-black mt-4 uppercase tracking-tight">RH & GESTION DE CRISE</h3>
            <p className="text-xs text-purple-200 mt-1 leading-relaxed font-medium">
              Consulter les rapports statistiques financiers, l'état global des effectifs et l'audit d'activité cloud de l'établissement [local].
            </p>
          </div>
          <Link 
            to="/admin/dashboard" 
            className="w-full text-center bg-orange-500 hover:bg-orange-600 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-md transition mt-6 block cursor-pointer"
          >
             Ouvrir le Dashboard
          </Link>
        </div>

        {/* Carte 2 : Communications & Alertes (Centre de Diffusion) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-500/20 transition flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Centre de Diffusion</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Diffuser des communiqués officiels par espace et expédier des e-mails avec pièces jointes de l'ordinateur.</p>
          </div>
          <Link to="/notifications" className="w-full text-center bg-purple-600 hover:bg-purple-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
             Rédiger un message
          </Link>
        </div>

        {/* Carte 3 : Inscription des Élèves & Badges */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-emerald-500/20 transition flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Inscriptions & Badges</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">Enregistrer de nouveaux élèves, renseigner le genre, le mail parental et générer leur reçu d'accès QR Code obligatoire.</p>
          </div>
          <Link to="/admin/ajouter-classe" className="w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
             Ajouter les classes
          </Link>
          <Link to="/admin/ajouter-eleve" className="w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
             Inscrire les Élèves
          </Link>
          <Link to="/admin/ajouter-personnel" className="w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
             Ajouter les personnels
          </Link>
        </div>
        {/* Carte 5 : GESTION TECHNIQUE DES EMPLOIS DU TEMPS */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-500/20 transition flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Emplois du Temps</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Concevoir, modifier et déployer les plannings de cours hebdomadaires par classe et par enseignant pour l'établissement.
            </p>
          </div>
          <Link to="/admin/list-classe" className="w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer">
             Liste les classes
          </Link>
          <Link 
            to="/admin/emploi-du-temps" 
            className="w-full text-center bg-purple-600 hover:bg-purple-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer"
          >
             Planifier les Cours
          </Link>
        </div>

        {/* Carte 6 : MOTEUR TEMPOREL ET CLÔTURE DES TRIMESTRES */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-500/20 transition flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Gestion des Trimestres</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Ouvrir, suspendre ou clôturer une période scolaire globale. Réinitialise automatiquement les compteurs d'absences en direct.
            </p>
          </div>
          <Link 
            to="/admin/gestion-trimestres" 
            className="w-full text-center bg-purple-600 hover:bg-purple-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition mt-6 block cursor-pointer"
          >
             Piloter l'Année Scolaire
          </Link>
        </div>

        {/* Carte 7 : PARAMÈTRES DE SÉCURITÉ */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-orange-500/20 transition flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Paramètres de Sécurité</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Modifier votre mot de passe administrateur en temps réel ou changer les informations de chiffrement confidentielles de l'école.
            </p>
          </div>
          <Link 
            to="/admin/security-settings" 
            className="w-full text-center bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition shadow-xs mt-6 block cursor-pointer"
          >
             Ouvrir la console de sécurité
          </Link>
        </div>

        {/* Carte 8 : SECRÉTARIAT INFORMATIQUE */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-500/20 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg font-bold"></div>
            <h3 className="text-base font-black text-gray-800 mt-4 uppercase tracking-tight">Secrétariat Informatique</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed font-medium">
              Enregistrement du Terminal Fixe : Configurez cet ordinateur comme poste d'émargement officiel des présences.
            </p>
          </div>
                   <Link 
            to="/admin/terminal" 
            className="w-full text-center bg-purple-600 hover:bg-purple-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition shadow-xs mt-6 block cursor-pointer"
          >
            Configurer ce Poste Fixe
          </Link>
        </div>
        <div>
        </div>
      </div>
    </div>
  );
};

export default HomeAdmin;
