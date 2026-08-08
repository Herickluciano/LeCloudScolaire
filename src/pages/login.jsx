import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
// 🟢 RECTIFICATION : Réintégration de Link aux côtés du hook de navigation pour le mot de passe oublié
import { useNavigate, Link } from 'react-router-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // 👈 AJOUTEZ OU CORRIGEZ CETTE LIGNE


const Login = () => {
  const { login, setUser, setSchoolId, setSchoolName } = useAuth();
  const navigate = useNavigate();

  // --- ÉTATS ---
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🟢 EXECUTION SYNCHRONE DE CONTOURNEMENT DU COMPTE MAÎTRE
  const executerConnexionMaitreDirecte = () => {
    const profilMaster = {
      id: 'SUPERADMIN_MASTER',
      matricule: 'ROOT_LUHAMCODE_2024',
      nom: 'TRAORE',
      prenoms: 'Mamadou',
      role: 'super_admin',
      statut: 'actif',
      schoolId: 'saas_root_platform'
    };

    // Attribution synchrone et sécurisée des accès
    setUser(profilMaster);
    setSchoolId('saas_root_platform');
    setSchoolName('COMPAGNIE MIDNIGHT SAAS');
    
    sessionStorage.setItem("sgs_user", JSON.stringify(profilMaster));
    sessionStorage.setItem("sgs_school_id", "saas_root_platform");
    sessionStorage.setItem("sgs_school_name", "COMPAGNIE MIDNIGHT SAAS");
    localStorage.setItem('sgs_owner_root_key', 'mamadou_traore_root_access_secure_9921');

    navigate('/superadmin/home');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const checkMatricule = matricule.trim().toUpperCase(); 
    const checkPassword = password.trim();

    if (!checkMatricule || !checkPassword) {
      setError('Veuillez renseigner votre identifiant et votre mot de passe.');
      return;
    }

    if (checkMatricule === 'ROOT_LUHAMCODE_2024' && checkPassword === 'herick2024') {
      executerConnexionMaitreDirecte();
      return;
    }

    setIsSubmitting(true);
    try {
      sessionStorage.removeItem('sgs_user');
      const result = await login(checkMatricule, checkPassword);

      if (result && result.success) {
        if (result.role === 'admin') navigate('/admin/home');
        else if (result.role === 'educateur') navigate('/educateur/promotion');
        else if (result.role === 'prof_principal') navigate('/prof/dashboard-pp');
        else if (result.role === 'professeur') navigate('/prof/dashboardProf');
        else if (result.role === 'eleve') navigate('/eleve/dashboard');
      } else {
        setError('Identifiant ou mot de passe incorrect. Assurez-vous que le compte existe.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setError('Une erreur technique est survenue lors de la connexion.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDownPassword = (e) => {
    const checkMatricule = matricule.trim().toUpperCase();
    const checkPassword = password.trim();

    if (e.key === 'Enter' && checkMatricule === 'ROOT_LUHAMCODE_2024' && checkPassword === 'herick2024') {
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

        <div className="space-y-4">
          <div>
            <label className="block text-gray-600 text-xs font-bold uppercase mb-1">Identifiant / Matricule</label>
            <input
              type="text"
              placeholder="Ex: ADMIN, EDUC_6..."
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
          className="w-full bg-orange-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-md hover:shadow-lg flex justify-center items-center cursor-pointer"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            'Se connecter au portail'
          )}
        </button>
         <div className="mt-4 text-right">
          <Link 
            to="/recuperation-cle" 
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