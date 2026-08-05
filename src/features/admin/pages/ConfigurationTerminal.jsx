import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';

const ConfigurationTerminal = () => {
  const { schoolId, schoolName } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  const [classeSalle, setClasseSalle] = useState('5eme_1');
  const [success, setSuccess] = useState(false);

  // 🔒 GENERATION DU JETON MATÉRIEL SUR LE NAVIGATEUR LOCAL DE LA CLASSE
  const handleRegisterPC = (e) => {
    e.preventDefault();
    
    // Structure du jeton unique : code_ecole + code_classe + marqueur_secat
    const secureToken = `${currentSchool}_pc_${classeSalle.trim().toLowerCase()}_verified_hardware`;
    
    // Fige le jeton dans la mémoire profonde de cet ordinateur précis
    localStorage.setItem('sgs_terminal_autorise', secureToken);
    
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  return (
    <div className="max-w-md mx-auto p-6 font-sans bg-white border rounded-2xl shadow-xl mt-12">
      <div className="border-b pb-3 mb-4 text-center">
        <span className="text-[10px] font-black uppercase bg-orange-100 text-orange-700 px-3 py-1 rounded-full">Secrétariat Informatique</span>
        <h2 className="text-base font-black text-gray-800 mt-2 uppercase">🔒 Enregistrement du Terminal Fixe</h2>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5">Configurez cet ordinateur comme poste d'émargement officiel de l'établissement.</p>
      </div>

      <div className="mb-4 text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
        🏫 Établissement détecté : <span className="text-purple-700 uppercase">{schoolName || currentSchool.replace(/_/g, ' ')}</span>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-emerald-950 text-emerald-400 text-xs font-bold rounded-lg border-l-4 border-emerald-500 animate-pulse">
          🎯 TERMINAL APPROUVÉ AVEC SUCCÈS ! Cet ordinateur est désormais validé pour enregistrer les pointages de la classe {classeSalle.toUpperCase()}.
        </div>
      )}

      <form onSubmit={handleRegisterPC} className="space-y-4 text-xs font-bold text-gray-700">
        <div>
          <label className="block text-gray-400 uppercase mb-1">Attribuer cet appareil à la classe :</label>
          <input 
            type="text" 
            placeholder="Ex: 5eme_1, 3eme_A, Tle_D" 
            value={classeSalle} 
            onChange={(e) => setClasseSalle(e.target.value)}
            className="w-full p-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-gray-800 font-black uppercase"
            required
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-3 rounded-xl uppercase tracking-wider transition shadow-sm cursor-pointer"
        >
          🔐 Activer et Sceller ce PC
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/admin/home" className="text-[10px] text-gray-400 hover:text-gray-600 font-black uppercase tracking-wide">
          ⬅️ Retour au Secrétariat
        </Link>
      </div>
    </div>
  );
};

export default ConfigurationTerminal;
