import { useState } from 'react'; // 🟢 Inclus pour la sélection de promotion
import { useAuth } from '../../../context/AuthContext'; 
import FormulaireClasse from './FormulaireClasse.jsx'; 
import ListeDesClasse from './listeDesClasse.jsx'; 
import { Link } from 'react-router-dom'; // 🟢 Inclus pour faire fonctionner tous les boutons
import SecretariatAdmin from './SecretariatAdmin.jsx';
import RechercheEleveAdmin from './RechercheEleveAdmin.jsx'; //
import GestionStatut from './GestionStatut.jsx';
import EnvoiDocumentAdmin from './EnvoiDocumentAdmin.jsx';


const DashboardAdmin = () => {
  const { user, schoolName, schoolId } = useAuth(); 
  const [promoSelectionnee, setPromoSelectionnee] = useState('6eme'); 

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      
      {/* 🇨🇮 BANDEAU DE NAVIGATION UNIQUE & EN-TÊTE ÉTABLISSEMENT */}
      <div className="mb-6 border-b pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">
            🏛️ {schoolName || "Espace Administration"}
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Premier responsable : <span className="text-orange-600 font-bold">{user?.name}</span> — Code Instance : <span className="font-mono text-gray-400 font-bold uppercase">{schoolId}</span>
          </p>
        </div>
        
        {/* 🚀 Menu d'accès rapides de la direction */}
        <div className="flex flex-wrap items-center gap-3">
          <Link 
            to="/admin/AjouterEleve" 
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition"
          >
            👤 Inscrire un Élève
          </Link>
          
          <Link 
            to="/admin/recrutement-personnel" 
            className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition"
          >
            💼 Recruter du Personnel
          </Link>

          {/* 🟢 LE LIEN DE REDACTION SE TROUVE ICI (Bouton Violet) */}
          <Link 
            to="/notifications" 
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition"
          >
            📢 Diffuser un message
          </Link>

          {/* Sélecteur interactif temps réel */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-xs">
            <select 
              value={promoSelectionnee} 
              onChange={(e) => setPromoSelectionnee(e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-700 px-2 py-2 focus:outline-none cursor-pointer"
            >
              <option value="6eme">6ème</option>
              <option value="5eme">5ème</option>
              <option value="4eme">4ème</option>
              <option value="3eme">3ème</option>
              <option value="2nd_A">2nd A</option>
              <option value="2nd_C">2nd C</option>
              <option value="1ere_A">1ere A</option>
              <option value="1ere_C">1ere C</option>
              <option value="T_A1">Tle A1</option>
              <option value="T_A2">Tle A2</option>
              <option value="T_D">Tle D</option>
              <option value="T_C">Tle C</option>
            </select>

            <Link 
              to={`/educateur/promotion/${promoSelectionnee}`} 
              className="bg-orange-500 hover:bg-orange-600  px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shadow-xs flex items-center"
            >
              📚 Voir Promotion
            </Link>
          </div>
          
        </div>
      </div>
      {/* ➕ MODULE 1 : BLOC D'OUVERTURE DE CLASSE */}
      <div className="mb-8">
        <RechercheEleveAdmin />
      </div>
      <div className="mb-8">
        <GestionStatut />
      </div>
      <div className="mb-8">
        <EnvoiDocumentAdmin />
      </div>
      <div className="mb-8">
        <SecretariatAdmin />
      </div>
      <div className="mb-8">
        <FormulaireClasse />
      </div>
    </div>
  );

};

export default DashboardAdmin;
