import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NavbarAdmin = () => {
  const { user, schoolName, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // N'afficher la barre de navigation que si l'utilisateur est un admin ou un éducateur connecté
  if (!user || !['admin', 'educateur'].includes(user.role)) return null;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm font-sans mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          
          {/* Gauche : Nom de l'école */}
          <div className="flex items-center">
            <span className="text-xl mr-2">🏛️</span>
            <span className="font-black text-gray-800 tracking-tight text-base sm:text-lg">
              {schoolName || "Gestion Scolaire SaaS"}
            </span>
          </div>

          {/* Centre : Liens de navigation */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            <Link to="/admin/dashboard" className="text-gray-600 hover:text-orange-500 px-2 py-1 text-xs font-bold uppercase tracking-wider transition">
              🏠 Dashboard
            </Link>
            <Link to="/admin/AjouterEleve" className="text-gray-600 hover:text-orange-500 px-2 py-1 text-xs font-bold uppercase tracking-wider transition">
              👤 Inscrire Élève
            </Link>
            <Link to="/admin/recrutement-personnel" className="text-gray-600 hover:text-orange-500 px-2 py-1 text-xs font-bold uppercase tracking-wider transition">
              💼 Recruter Personnel
            </Link>
            <Link to="/educateur/promotion" className="text-gray-600 hover:text-orange-500 px-2 py-1 text-xs font-bold uppercase tracking-wider transition">
              📚 Liste Promotion
            </Link>

            {/* 🟢 PLACEMENT CORRECT : Le bouton de sécurité est inséré ici, dans le menu privé */}
            <Link 
              to="/mon-compte/securite" 
              className="text-gray-500 hover:text-orange-600 border-l pl-3 px-2 py-1 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1"
            >
              🔒 Sécurité
            </Link>
          </div>

          {/* Droite : Profil & Déconnexion */}
          <div className="flex items-center space-x-4">
            <span className="text-xs font-bold text-gray-400 hidden md:inline">
              {user.name}
            </span>
            <button 
              onClick={handleLogout}
              className="text-xs font-bold text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
            >
              🚪 Quitter
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
};

export default NavbarAdmin;
