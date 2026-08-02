import { Link } from 'react-router-dom';
import SecretariatAdmin from './SecretariatAdmin.jsx';

const PageSecretariat = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="mb-4 max-w-4xl mx-auto">
        <Link to="/admin/home" className="inline-flex items-center text-xs font-bold bg-slate-900 hover:bg-slate-800 text-orange-400 px-4 py-2 rounded-lg transition shadow-sm">
          ⬅️ Retour à l'Accueil Direction
        </Link>
      </div>
      <div className="max-w-4xl mx-auto">
        <SecretariatAdmin />
      </div>
    </div>
  );
};

export default PageSecretariat;
