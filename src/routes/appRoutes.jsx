import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// --- PAGES GÉNÉRALES ---
import Login from '../pages/login'; // Assurez-vous d'avoir ce fichier ou ajustez le chemin
import AjouterEleve from '../features/admin/pages/AjouterEleve';
import AjouterPersonnel from '../features/admin/pages/AjouterPersonnel';

// --- PAGES FEATURE ADMIN (À créer) ---
const DashboardAdmin = () => <div className="p-6">Tableau de bord Administrateur (Gestion totale)</div>;
const ConfigClasses = () => <div className="p-6">Configuration des Classes et Coefficients</div>;

// --- PAGES FEATURE ÉDUCATEUR ---
// Remplacer par vos vrais imports ultérieurement :
const ListePromotion = () => <div className="p-6">Espace Éducateur : Gestion de la promotion</div>;

// --- PAGES FEATURE PROFESSEUR ---
const CahierAppel = () => <div className="p-6">Cahier d'appel de la classe</div>;
const SaisieNotes = () => <div className="p-6">Saisie des notes par matière (IE, DS, DC)</div>;

// --- PAGES FEATURE PROF PRINCIPAL ---
const ClotureBulletin = () => <div className="p-6">Calcul des rangs et clôture des bulletins</div>;

// --- PAGES FEATURE ÉLÈVE (À créer) ---
const DashboardEleve = () => <div className="p-6">Mon espace élève : Mes notes et mes rangs</div>;

// --- PAGE ERREUR DE SÉCURITÉ ---
const Unauthorized = () => (
  <div className="flex h-screen flex-col items-center justify-center bg-gray-100 p-6 text-center">
    <h1 className="text-3xl font-bold text-red-600">Accès Refusé</h1>
    <p className="mt-2 text-gray-600">Vous n'avez pas les autorisations nécessaires pour accéder à cet espace.</p>
  </div>
);

const AppRoutes = () => {
  return (
    <Routes>
      {/* 🔓 Routes Publiques */}
      <Route path="/test-db" element={<TestFirebase />} />
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* 🔐 Routes réservées à l'ADMINISTRATEUR */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/dashboard" element={<DashboardAdmin />} />
        <Route path="/admin/configuration" element={<ConfigClasses />} />
      </Route>

      {/* 🔐 Routes réservées aux ÉDUCATEURS (L'admin y a aussi accès grâce au bypass) */}
      <Route element={<ProtectedRoute allowedRoles={['educateur']} />}>
        <Route path="/educateur/promotion" element={<ListePromotion />} />
      </Route>

      {/* 🔐 Routes réservées aux PROFESSEURS (Simples ET Principaux) */}
      <Route element={<ProtectedRoute allowedRoles={['professeur', 'prof_principal']} />}>
        <Route path="/prof/cahier-appel" element={<CahierAppel />} />
        <Route path="/prof/saisie-notes" element={<SaisieNotes />} />
      </Route>

      {/* 🔐 Routes EXCLUSIVES au PROFESSEUR PRINCIPAL */}
      <Route element={<ProtectedRoute allowedRoles={['prof_principal']} />}>
        <Route path="/prof-principal/bulletins" element={<ClotureBulletin />} />
      </Route>

      {/* 🔐 Routes réservées aux ÉLÈVES */}
      <Route element={<ProtectedRoute allowedRoles={['eleve']} />}>
        <Route path="/eleve/dashboard" element={<DashboardEleve />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/pages/AjouterEleve" element={<AjouterEleve />} />
      </Route>
       <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/pages/AjouterPersonnel" element={<AjouterPersonnel />} />
      </Route>
      

      {/* 🔄 Redirection par défaut si la route n'existe pas */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
