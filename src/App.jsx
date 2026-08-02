import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login'; 
import ProtectedRoute from './routes/ProtectedRoute';
import ChangerMotDePasse from './pages/ChangerMotDePasse.jsx';
// 🟢 CORRECTION : Importation ciblée vers son dossier Shared de composants communs
import NotificationCentre from './component/Shared/NotificationCentre.jsx';
import ModifierStatut from './features/admin/pages/ModifierStatut';
import HomeAdmin from './features/admin/pages/HomeAdmin.jsx';
import PageSecretariat from './features/admin/pages/PageSecretariat.jsx';






// --- IMPORTS DES COMPOSANTS ET PAGES DE PRODUCTION ---
import DashboardAdmin from './features/admin/pages/DashboardAdmin';
import AjouterEleve from './features/admin/pages/AjouterEleve';
import AjouterPersonnel from './features/admin/pages/AjouterPersonnel';
import ListeDesClasse from './features/admin/pages/listeDesClasse'; // 🟢 Ajout de la route d'affichage
import SaisieNotes from './features/professeur/pages/SaisieNotes';
import DashboardProf from './features/professeur/pages/DashboardProf';
import ListePromotion from './features/educateur/pages/ListePromotion';
import DashboardEleve from './features/eleve/pages/DashboardEleve';

// --- COMPOSANT DE SECOURS DE LA PLATEFORME ---
const PageNonAutorisee = () => (
  <div className="p-8 text-center font-sans">
    <h1 className="text-2xl font-bold text-red-500 mb-2">❌ Accès refusé</h1>
    <p className="text-gray-600">Vos privilèges actuels ne vous permettent pas de consulter cette page.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🔓 ROUTES PUBLIQUES */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<PageNonAutorisee />} />

       {/* 🎓 ESPACE ACCÈS ÉLÈVES & ÉTUDIANTS PROTEGÉ */}
<Route element={<ProtectedRoute allowedRoles={['eleve']} />}>
  <Route path="/eleve/dashboard" element={<DashboardEleve />} />
</Route>


        {/* 🔐 ESPACE ÉDUCATEUR ET PROMOTIONS */}
        <Route element={<ProtectedRoute allowedRoles={['educateur']} />}>
          <Route path="/educateur/promotion" element={<ListePromotion />} />
          <Route path="/educateur/promotion/:niveau" element={<ListePromotion />} />
        </Route>

        {/* 👨‍🏫 ESPACE ACCÈS ENSEIGNANTS & PROFESSEURS */}
<Route element={<ProtectedRoute allowedRoles={['professeur', 'prof_principal']} />}>
  <Route path="/prof/dashboardProf" element={<DashboardProf />} /> 
  <Route path="/prof/saisie-notes" element={<SaisieNotes />} />
</Route>

                {/* 🔐 ESPACE DIRECTION / ADMINISTRATEUR */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/secretariat" element={<PageSecretariat />} />
         <Route path="/admin/home" element={<HomeAdmin />} />
          <Route path="/admin/dashboard" element={<DashboardAdmin />} />
          <Route path="/admin/AjouterEleve" element={<AjouterEleve />} />
          <Route path="/admin/recrutement-personnel" element={<AjouterPersonnel />} />
          <Route path="/admin/registre-classes" element={<ListeDesClasse />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin', 'educateur', 'professeur', 'prof_principal', 'eleve']} />}>
  <Route path="/mon-compte/securite" element={<ChangerMotDePasse />} />
  <Route path="/notifications" element={<NotificationCentre />} />
  <Route path="/admin/modifier-statut" element={<ModifierStatut />} />
</Route>

        {/* 🔄 REDIRECTION AUTOMATIQUE SI CHEMIN INCORRECT */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
