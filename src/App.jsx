import React from 'react';
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
import AjouterPersonneSuperAdmin from './pages/AjouterPersonneSuperAdmin.jsx';

// 🟢 INTEGRATION SÉCURISÉE : Page de récupération des clés d'accès oubliées
import RecupererCleAcces from './pages/RecupererCleAcces.jsx';

// 🟢 ALIGNEMENT DE PRODUCTION : Registre d'appel électronique dynamique
import RegistreAppelEleves from './features/professeur/pages/assiduite/RegistreAppelEleves.jsx';

import CahierTextes from './features/professeur/pages/classes/CahierTextes.jsx';
import MonPointage from './features/professeur/pages/assiduite/MonPointage.jsx';
import ConfigurationTerminal from './features/admin/pages/ConfigurationTerminal.jsx';
import SuperAdminSaas from './pages/SuperAdminSaaS.jsx';
import HomeSuperAdmin from './pages/homeSuperAdmin.jsx'; 
import HistoriqueMessage from './features/admin/pages/messages/HistoriqueMessage.jsx';
import DashboardPP from './features/professeur/pages/espacePP/DashboardPP.jsx';
import GestionTrimestres from './features/admin/pages/GestionTrimestres.jsx';

// --- IMPORTS DES COMPOSANTS ET PAGES DE PRODUCTION ---
import DashboardAdmin from './features/admin/pages/DashboardAdmin';
import AjouterEleve from './features/admin/pages/AjouterEleve';
import AjouterPersonnel from './features/admin/pages/AjouterPersonnel';
import ListeDesClasse from './features/admin/pages/listeDesClasse'; 

// 🟢 RECTIFICATION CHEMIN ÉVALUATIONS : Pointage direct dans le répertoire existant evaluations/
import SaisieNotes from './features/professeur/pages/evaluations/SaisieNotes.jsx';
import DashboardProf from './features/professeur/pages/DashboardProf';
import ListePromotion from './features/educateur/pages/ListePromotion';

// 🟢 ALIGNEMENT ROUTAGE : Suivi de la vie scolaire de l'éducateur et des apprenants
import DashboardEducateur from './features/educateur/pages/DashboardEducateur.jsx';
import DashboardEleve from './features/eleve/pages/DashboardEleve';
import EmploiDuTempsAdmin from './features/admin/pages/EmploiDuTempsAdmin.jsx';
import './App.css';

// --- COMPOSANT DE SECOURS DE LA PLATEFORME ---
const PageNonAutorisee = () => (
  <div className="p-8 text-center font-sans max-w-md mx-auto bg-white border border-red-100 shadow-md rounded-xl mt-12 text-left text-gray-700 animate-fadeIn">
    <span className="text-2xl">❌</span>
    <h1 className="text-sm font-black text-red-500 mb-2 uppercase mt-3">Accès temporairement restreint</h1>
    <p className="text-xs text-gray-400 font-medium">Vos privilèges actuels ne couvrent pas la consultation de cette division.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🔓 ROUTES PUBLIQUES */}
        <Route path="/login" element={<Login />} />
        <Route path="/recuperation-cle" element={<RecupererCleAcces />} />
        <Route path="/unauthorized" element={<PageNonAutorisee />} />

        {/* 🏛️ ROUTAGE DES PÔLES ADMINISTRATIFS ET SÉCURITÉ SCELLÉS (SUPERADMIN) */}
        <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
          <Route path="/superadmin/configure-terminal" element={<ConfigurationTerminal />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminSaas />} />
          <Route path="/superadmin/home" element={<HomeSuperAdmin />} />
        </Route>

        {/* 🎓 ESPACE ACCÈS ÉLÈVES & ÉTUDIANTS PROTEGÉ (DÉCENTRALISÉ) */}
        <Route element={<ProtectedRoute allowedRoles={['eleve']} />}>
          <Route path="/eleve/dashboard" element={<DashboardEleve />} />
          <Route path="/eleve/bulletins" element={<DashboardEleve />} />
          <Route path="/eleve/messagerie" element={<DashboardEleve />} />
        </Route>

        {/* 🔐 ESPACE ÉDUCATEUR ET PROMOTIONS EXCLUSIVES */}
        <Route element={<ProtectedRoute allowedRoles={['educateur']} />}>
          <Route path="/educateur/promotion" element={<ListePromotion />} />
          <Route path="/educateur/promotion/:niveau" element={<ListePromotion />} />
          <Route path="/educateur/dashboard" element={<DashboardEducateur />} />
        </Route>

        {/* 👨‍🏫 ESPACE ACCÈS ENSEIGNANTS & PROFESSEURS */}
        <Route element={<ProtectedRoute allowedRoles={['professeur', 'prof_principal']} />}>
          <Route path="/prof/dashboardProf" element={<DashboardProf />} /> 
          <Route path="/prof/saisie-notes/:classIdUrl?" element={<SaisieNotes />} />
          <Route path="/prof/faire-appel/:classIdUrl?" element={<RegistreAppelEleves />} />
          <Route path="/prof/mes-classes" element={<MesClasses />} />
          <Route path="/prof/messagerie" element={<MessagerieProf />} /> 
          <Route path="/prof/mon-pointage" element={<MonPointage />} /> 
          <Route path="/prof/cahier-textes" element={<CahierTextes />} /> 
          <Route path="/prof/dashboard-pp" element={<DashboardPP />} /> 
        </Route>

        {/* 🔐 ESPACE DIRECTION / ADMINISTRATEUR */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
          <Route path="/admin/messages-history" element={<HistoriqueMessage />} />
          <Route path="/admin/configure-terminal" element={<ConfigurationTerminal />} />
          <Route path="/admin/secretariat" element={<PageSecretariat />} />
          <Route path="/admin/home" element={<HomeAdmin />} />
          <Route path="/admin/dashboard" element={<DashboardAdmin />} />
          <Route path="/admin/AjouterEleve" element={<AjouterEleve />} />
          <Route path="/admin/recrutement-personnel" element={<AjouterPersonnel />} />
          <Route path="/admin/registre-classes" element={<ListeDesClasse />} />
          <Route path="/admin/emploi-temps" element={<EmploiDuTempsAdmin />} />
          <Route path="/admin/gestion-trimestres" element={<GestionTrimestres />} />
          <Route path="/superadmin/ajouter-personnel" element={<AjouterPersonneSuperAdmin />} />
        </Route>

        {/* 🔐 ESPACE COMMUN PROTEGÉ POUR LES PARAMÈTRES COMPTES */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'educateur', 'professeur', 'prof_principal', 'eleve', 'super_admin']} />}>
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
