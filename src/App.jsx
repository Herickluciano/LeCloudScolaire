import React from 'react';
// 🟢 RECTIFICATION COMPLÈTE : Importation propre et directe pour éviter l'erreur de référence
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/login'; 
import ProtectedRoute from './routes/ProtectedRoute';
import ChangerMotDePasse from './pages/ChangerMotDePasse.jsx';
import NotificationCentre from './component/Shared/NotificationCentre.jsx';
import ModifierStatut from './features/admin/pages/ModifierStatut';
import HomeAdmin from './features/admin/pages/HomeAdmin.jsx';
import PageSecretariat from './features/admin/pages/PageSecretariat.jsx';
import MesClasses from './features/professeur/pages/classes/MesClasses.jsx';
import MessagerieProf from './features/professeur/pages/MessagerieProf.jsx';
import FaireAppel from './features/professeur/pages/assiduite/FaireAppel.jsx';
import CahierTextes from './features/professeur/pages/classes/CahierTextes.jsx';
import MonPointage from './features/professeur/pages/assiduite/MonPointage.jsx';
import ConfigurationTerminal from './features/admin/pages/ConfigurationTerminal.jsx';
import SuperAdminSaas from './pages/SuperAdminSaaS.jsx';
import HomeSuperAdmin from './pages/homeSuperAdmin.jsx'; 
import DashboardPP from './features/professeur/pages/espacePP/DashboardPP.jsx';

// --- IMPORTS DES COMPOSANTS ET PAGES DE PRODUCTION ---
import DashboardAdmin from './features/admin/pages/DashboardAdmin';
import AjouterEleve from './features/admin/pages/AjouterEleve';
import AjouterPersonnel from './features/admin/pages/AjouterPersonnel';
import ListeDesClasse from './features/admin/pages/listeDesClasse'; 
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

        {/* 🏛️ ROUTAGE DES PÔLES ADMINISTRATIFS ET SÉCURITÉ SCELLÉS (SUPERADMIN) */}
        <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
          <Route path="/superadmin/configure-terminal" element={<ConfigurationTerminal />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminSaas />} />
          <Route path="/superadmin/home" element={<HomeSuperAdmin />} />
        </Route>

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
          <Route path="/prof/mes-classes" element={<MesClasses />} />
          <Route path="/prof/messagerie" element={<MessagerieProf />} /> 
          <Route path="/prof/mon-pointage" element={<MonPointage />} /> 
          <Route path="/prof/cahier-textes" element={<CahierTextes />} /> 
          <Route path="/prof/faire-appel" element={<FaireAppel />} /> 
          <Route path="/prof/dashboard-pp" element={<DashboardPP />} /> 
        </Route>

        {/* 🔐 ESPACE DIRECTION / ADMINISTRATEUR */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/configure-terminal" element={<ConfigurationTerminal />} />
          <Route path="/admin/secretariat" element={<PageSecretariat />} />
          <Route path="/admin/home" element={<HomeAdmin />} />
          <Route path="/admin/dashboard" element={<DashboardAdmin />} />
          <Route path="/admin/AjouterEleve" element={<AjouterEleve />} />
          <Route path="/admin/recrutement-personnel" element={<AjouterPersonnel />} />
          <Route path="/admin/registre-classes" element={<ListeDesClasse />} />
        </Route>

        {/* 🔐 ESPACE COMMUN PROTEGÉ POUR LES PARAMÈTRES COMPTES */}
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
