// src/pages/login.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  // Récupération des mutations de session du contexte central
  const { login, setUser, setSchoolId, setSchoolName } = useAuth();
  const navigate = useNavigate();

  // --- ÉTATS PURS ET VIERGES AU DÉMARRAGE ---
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🟢 COMPTE MAÎTRE DU PROPRIÉTAIRE INFRASTRUCTURE
  const executerConnexionMaitreDirecte = () => {
    const profilMaster = {
      id: 'SUPERADMIN_MASTER',
      matricule: 'ROOT_LUHAMCODE_2024',
      nom: 'TRAORE',
      prenoms: 'Mamadou',
      role: 'super_admin',
      statut: 'actif',
      schoolId: 'lycee_saint_bernard'
    };

    setUser(profilMaster);
    setSchoolId('lycee_saint_bernard');
    setSchoolName('COMPAGNIE MIDNIGHT SAAS');
    
    sessionStorage.setItem("sgs_user", JSON.stringify(profilMaster));
    sessionStorage.setItem("sgs_school_id", "lycee_saint_bernard");
    sessionStorage.setItem("sgs_school_name", "COMPAGNIE MIDNIGHT SAAS");
    sessionStorage.setItem("sgs_user_role", "super_admin");

    navigate('/superadmin/home');
  };

  const handleSubmit = async (e) => {
    // 🔒 ARRÊTE LE COMPORTEMENT DE RECHARGEMENT NATIF DU NAVIGATEUR
    e.preventDefault();
    setError('');
    
    const checkMatricule = matricule.trim(); 
    const checkPassword = password.trim();

    if (!checkMatricule || !checkPassword) {
      setError('Veuillez renseigner votre identifiant et votre mot de passe.');
      return;
    }

    // Bypass du compte ROOT d'urgence local (Cas insensible au formulaire)
    if (checkMatricule.toUpperCase() === 'ROOT_LUHAMCODE_2024' && checkPassword === 'HERICK2024') {
      executerConnexionMaitreDirecte();
      return;
    }

    setIsSubmitting(true);
    try {
      // Nettoyage préventif des sessions expirées
      sessionStorage.removeItem('sgs_user');
      
      // 📡 APPEL DYNAMIQUES DE L'INFRASTRUCTURE NoSQL
      const result = await login(checkMatricule, checkPassword);

      // 🟢 OPTIMISATION CRITIQUE : Analyse de la promesse ou du stockage mis à jour
      const savedUserStr = sessionStorage.getItem('sgs_user');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      
      if ((result && result.success) || savedUser) {
        const roleActif = (result?.role || savedUser?.role || 'professeur').toString().toLowerCase().trim();
        console.log("🚀 Authentification validée. Routage vers :", roleActif);

        // Libération préventive de l'état de soumission avant le changement de page
        setIsSubmitting(false);

        // 🟢 ALIGNEMENT DE TOUTES LES TRAJECTOIRES DE REDIRECTION CORRIGÉES
        if (roleActif === 'super_admin') navigate('/superadmin/home');
        else if (roleActif === 'admin') navigate('/admin/home');
        
        // 🟢 REDIRECTION COMPILÉE : L'éducateur atterrit directement sur la Liste des Promotions
        else if (roleActif === 'educateur') navigate('/educateur/promotions'); 
        
        else if (roleActif === 'prof_principal') navigate('/professeur/principal');
        else if (roleActif === 'professeur') navigate('/professeur/dashboard');
        else if (roleActif === 'eleve') navigate('/eleve/dashboard');
        else navigate('/login');
        
      } else {
        setError(result?.msg || 'Identifiant ou mot de passe incorrect. Assurez-vous que le compte existe.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Erreur critique attrapée lors du routage :", err);
      setError('Une erreur technique est survenue lors de la connexion avec le cloud.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDownPassword = (e) => {
    const checkMatricule = matricule.trim();
    const checkPassword = password.trim();

    if (e.key === 'Enter' && checkMatricule.toUpperCase() === 'ROOT_LUHAMCODE_2024' && checkPassword === 'HERICK2024') {
      e.preventDefault();
      executerConnexionMaitreDirecte();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 font-sans animate-fadeIn">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        <div className="text-center mb-6">
          <div className="flex justify-center space-x-1 mb-3">
            <span className="w-10 h-1.5 bg-orange-500 rounded-full"></span>
            <span className="w-10 h-1.5 bg-gray-200 rounded-full"></span>
            <span className="w-10 h-1.5 bg-green-500 rounded-full"></span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Portail Scolaire Numérique</h2>
          <p className="text-xs text-gray-400 mt-1 font-semibold uppercase tracking-wider">
            Système SaaS Ivoirien & International
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-medium rounded">
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-gray-600 text-xs font-bold uppercase mb-1">Identifiant / Matricule</label>
            <input
              type="text"
              placeholder="Ex: EDUC_N'GUESSAN_243..."
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 transition font-bold"
            />
          </div>

          <div>
            <label className="block text-gray-600 text-xs font-bold uppercase mb-1">Mot de passe</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDownPassword} 
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none text-base cursor-pointer"
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-orange-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-md hover:shadow-lg flex justify-center items-center cursor-pointer mb-4"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            'Se connecter au portail'
          )}
        </button>

        <div className="text-right">
          <Link 
            to="/recuperer-cle" 
            className="text-[11px] font-black text-purple-600 hover:text-purple-700 transition uppercase tracking-wider"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Login;
