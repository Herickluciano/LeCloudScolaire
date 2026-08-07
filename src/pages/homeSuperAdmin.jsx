import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import SuperAdminSaaS from './SuperAdminSaaS';
import AjouterPersonneSuperAdmin from './AjouterPersonneSuperAdmin';

const HomeSuperAdmin = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [autorise, setAutorise] = useState(false);

  // 🔒 VERIFICATION DU POSTE MAITRE SANS CONFLIT ASYNCHRONE
  useEffect(() => {
    const cleSecreteMamadou = localStorage.getItem('sgs_owner_root_key');

    if (cleSecreteMamadou === 'mamadou_traore_root_access_secure_9921') {
      setAutorise(true);
    } else {
      alert("🛑 ACCÈS INTERDIT : Cette zone est réservée exclusivement au propriétaire de l'infrastructure SaaS.");
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!autorise) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs text-gray-500 font-bold uppercase tracking-widest">
        Authentification de la clé maîtresse...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn">
      
      {/* 🏛️ BANDEAU PROFIL SÉCURISÉ */}
      <div className="max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2 uppercase">
            👑 M. LUCIANO <span className="font-normal text-slate-400 font-sans lowercase first-letter:uppercase"> HAMILTOM</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-wide">
            🔓 LeCloudScolaire Informatisém et Centalisé 
          </p>
        </div>
        <SuperAdminSaaS/>
        <button 
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md self-end md:self-auto cursor-pointer"
        >
          🚪 Fermer la session Maître
        </button>
      </div>

      {/* 🗂️ PANNEAU DES ACCÈS DIRECTS */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* BOUTON ACCÈS 1 : LE CONTROLEUR D'ABONNEMENTS */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-md hover:border-orange-500/40 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-orange-950 text-orange-400 rounded-xl flex items-center justify-center text-lg font-bold">🏢</div>
            <h3 className="text-base font-black text-slate-200 mt-4">Gestion des Établissements & Licences</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed font-medium">
              Créer les espaces cloud des nouvelles écoles partenaires, gérer les abonnements des fondateurs et suspendre les accès en cas d'impayés.
            </p>
          </div>
          <Link 
            to="/superadmin/dashboard" 
            className="w-full text-center bg-orange-500 hover:bg-orange-600 font-black text-xs uppercase tracking-wider py-3 rounded-xl shadow-md transition mt-6 block"
          >
            🚀 Ouvrir le Panel Licences SaaS
          </Link>
        </div>

        {/* BOUTON ACCÈS 2 : LE SCELLAGE DES PC */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-md hover:border-purple-500/40 transition flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-950 text-purple-400 rounded-xl flex items-center justify-center text-lg font-bold">🔐</div>
            <h3 className="text-base font-black text-slate-200 mt-4">Scellage Matériel & Sécurité</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed font-medium">
              Enregistrer et certifier les ordinateurs fixes de l'école directement dans les salles de classe pour détruire les tentatives d'émargement frauduleuses au maquis.
            </p>
          </div>
          <Link 
            to="/superadmin/configure-terminal" 
            className="w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider py-3 rounded-xl shadow-md transition mt-6 block"
          >
            🔒 Ouvrir le Scellage Matériel
          </Link>
        </div>
        <AjouterPersonneSuperAdmin/>
      </div>

      <div className="max-w-5xl mx-auto mt-12 p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
        <span>Version LeCloudScolaire : <strong className="text-slate-400">v1.2.0 - Stable Core </strong></span>
        <span>Statut de l'appareil : <strong className="text-emerald-400">Poste d'administration d'origine certifié</strong></span>
      </div>
    </div>
  );
};

export default HomeSuperAdmin;
