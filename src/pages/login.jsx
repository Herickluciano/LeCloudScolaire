import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // --- ÉTATS DU FORMULAIRE ---
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 🟢 État pour basculer la visibilité du mot de passe
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    sessionStorage.clear();
      localStorage.clear();
    const checkMatricule = matricule.trim();
    const checkPassword = password.trim();

    if (!checkMatricule || !checkPassword) {
      setError('Veuillez renseigner votre identifiant et votre mot de passe.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await login(checkMatricule, checkPassword);

      if (result && result.success) {
        if (result.role === 'admin') {
          navigate('/admin/home');
        } else if (result.role === 'educateur') {
          navigate('/educateur/promotion');
        } else if (result.role === 'prof_principal') {
          navigate('/prof-principal/bulletins');
        } else if (result.role === 'professeur') {
          navigate('/prof/dashboardProf');
        } else if (result.role === 'eleve') {
          navigate('/eleve/dashboard');
        }
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 font-sans">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        {/* En-tête du portail 🇨🇮 */}
        <div className="text-center mb-6">
          <div className="flex justify-center space-x-1 mb-3">
            <span className="w-10 h-1.5 bg-orange-500 rounded-full"></span>
            <span className="w-10 h-1.5 bg-gray-200 rounded-full"></span>
            <span className="w-10 h-1.5 bg-green-500 rounded-full"></span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Portail Scolaire Numérique</h2>
          <p className="text-xs text-gray-400 mt-1 font-semibold uppercase">
            Système SaaS Ivoirien
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
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 transition"
            />
          </div>

          <div>
            <label className="block text-gray-600 text-xs font-bold uppercase mb-1">Mot de passe</label>
            {/* Conteneur relatif pour positionner l'œil par-dessus l'input */}
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"} // 🟢 Type dynamique
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 transition"
              />
              {/* Bouton icône de l'œil interactif */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none text-base"
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-lg hover:bg-orange-600 transition duration-200 shadow-md hover:shadow-lg flex justify-center items-center disabled:bg-orange-300 mt-6"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            'Se connecter au portail'
          )}
        </button>

        {/* BOUTON DE REDIRECTION VERS LE PANNEAU SUPER ADMIN SAAS */}
        <div className="mt-6 border-t border-gray-100 pt-4 text-center">
          <button
            type="button"
            onClick={() => navigate('/saas-control-panel')}
            className="text-xs font-bold text-slate-500 hover:text-orange-500 transition duration-150 uppercase tracking-wider"
          >
            ⚙️ Accéder au Panneau Super Admin SaaS
          </button>
        </div>

      </form>
    </div>
  );
};

export default Login;
