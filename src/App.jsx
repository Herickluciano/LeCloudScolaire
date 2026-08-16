// src/App.jsx
import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import './App.css';

// =====================================================
// CONTEXTES ET SÉCURITÉ
// =====================================================

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

// =====================================================
// ÉCRAN DE VEILLE
// =====================================================

import EcranEveilSecurite from './components/EcranEveilSecurite.jsx';

// =====================================================
// PUBLIC
// =====================================================

import Login from './pages/login';
import ChangerMotDePasse from './pages/ChangerMotDePasse.jsx';
import RecupererCleAcces from './pages/RecupererCleAcces.jsx';

// =====================================================
// COMMUN
// =====================================================

import NotificationCentre from './component/Shared/NotificationCentre.jsx';
import Footer from './pages/Footer.jsx';

// =====================================================
// ADMINISTRATION
// =====================================================

import ModifierStatut from './features/admin/pages/ModifierStatut';
import HomeAdmin from './features/admin/pages/HomeAdmin.jsx';
import PageSecretariat from './features/admin/pages/PageSecretariat.jsx';
import DashboardAdmin from './features/admin/pages/DashboardAdmin';
import AjouterEleve from './features/admin/pages/AjouterEleve';
import BaseDonneCentraleAdmin from './features/admin/pages/BaseDonneCentraleAdmin';
import AjouterPersonnel from './features/admin/pages/AjouterPersonnel';
import ListeDesClasse from './features/admin/pages/listeDesClasse';
import GestionTrimestres from './features/admin/pages/GestionTrimestres.jsx';
import ConfigurationTerminal from './features/admin/pages/ConfigurationTerminal.jsx';
import EmploiDuTempsAdmin from './features/admin/pages/EmploiDuTempsAdmin.jsx';
import GestionPubSaas from './pages/GestionPubSaas';
// =====================================================
// PROFESSEUR
// =====================================================

import MessagerieProf from './features/professeur/pages/MessagerieProf.jsx';
import RegistreAppelEleves from './features/professeur/pages/assiduite/RegistreAppelEleves.jsx';
import CahierTextes from './features/professeur/pages/classes/CahierTextes.jsx';
import MonPointage from './features/professeur/pages/assiduite/MonPointage.jsx';
import DashboardPP from './features/professeur/pages/espacePP/DashboardPP.jsx';
import SaisieNotes from './features/professeur/pages/evaluations/SaisieNotes.jsx';
import DashboardProf from './features/professeur/pages/DashboardProf';

// =====================================================
// ÉDUCATEUR
// =====================================================

import DashboardEducateur from './features/educateur/pages/DashboardEducateur.jsx';
import ListePromotion from './features/educateur/pages/ListePromotion';

// =====================================================
// ÉLÈVE
// =====================================================

import DashboardEleve from './features/eleve/pages/DashboardEleve';

// =====================================================
// SUPER ADMIN
// =====================================================

import SuperAdminSaaS from './pages/SuperAdminSaaS.jsx';
import HomeSuperAdmin from './pages/HomeSuperAdmin.jsx';
import AjouterPersonneSuperAdmin from './pages/AjouterPersonneSuperAdmin.jsx';
import HistoriqueMessage from './features/admin/pages/messages/HistoriqueMessage.jsx';

// =====================================================
// PUBLICITÉS
// =====================================================

import GestionPublicites from './components/GestionPublicites';
import FormulaireClasse from './features/admin/pages/FormulaireClasse.jsx';


const App = () => {
  return (
    
    <AuthProvider>

      <BrowserRouter>

        {/* =================================================
            ÉCRAN DE VEILLE GLOBAL
            Il affiche children normalement.
            Il affiche le verrou uniquement après inactivité.
        ================================================= */}

        <EcranEveilSecurite>

          <div className="App flex flex-col min-h-screen">

            <main className="flex-grow">

              <Routes>


                {/* =================================================
                    ROUTES PUBLIQUES
                ================================================= */}

                <Route
                  path="/"
                  element={
                    <Navigate
                      to="/login"
                      replace
                    />
                  }
                />

                <Route
                  path="/login"
                  element={<Login />}
                />

                <Route
                  path="/recuperer-cle"
                  element={<RecupererCleAcces />}
                />

                 <Route
                  path="/components/pub-notification"
                  element={<GestionPublicites />}
                />
                {/* =================================================
                    ROUTES COMMUNES SÉCURISÉES
                ================================================= */}

                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={[
                        'admin',
                        'super_admin',
                        'professeur',
                        'educateur',
                        'eleve',
                      ]}
                    />
                  }
                >

                  <Route
                    path="/modifier-mot-de-passe"
                    element={<ChangerMotDePasse />}
                  />

                  <Route
                    path="/notifications"
                    element={<NotificationCentre />}
                  />

                </Route>


                {/* =================================================
                    ESPACE ADMIN
                ================================================= */}

                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['admin']}
                    />
                  }
                >
                 <Route path="/superadmin/publicites" element={<GestionPubSaas />} />
                  <Route
                    path="/admin/home"
                    element={<HomeAdmin />}
                  />

                  <Route
                    path="/admin/secretariat"
                    element={<PageSecretariat />}
                  />

                  <Route
                    path="/admin/dashboard"
                    element={<DashboardAdmin />}
                  />

                  <Route
                    path="/admin/ajouter-eleve"
                    element={<AjouterEleve />}
                  />

                  <Route
                    path="/admin/base-centralise"
                    element={<BaseDonneCentraleAdmin />}
                  />

                  <Route
                    path="/admin/ajouter-personnel"
                    element={<AjouterPersonnel />}
                  />

                  <Route
                    path="/admin/list-classe"
                    element={<ListeDesClasse />}
                  />

                   <Route
                    path="/admin/ajouter-classe"
                    element={<FormulaireClasse />}
                  />


                  <Route
                    path="/admin/gestion-trimestres"
                    element={<GestionTrimestres />}
                  />

                  <Route
                    path="/admin/statuts"
                    element={<ModifierStatut />}
                  />

                  <Route
                    path="/admin/terminal"
                    element={<ConfigurationTerminal />}
                  />

                  <Route
                    path="/admin/emploi-du-temps"
                    element={<EmploiDuTempsAdmin />}
                  />

                </Route>


                {/* =================================================
                    ESPACE PROFESSEUR
                ================================================= */}

                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['professeur']}
                    />
                  }
                >

                  <Route
                    path="/professeur/dashboard"
                    element={<DashboardProf />}
                  />

                  <Route
                    path="/professeur/notes"
                    element={<SaisieNotes />}
                  />

                  <Route
                    path="/professeur/appel"
                    element={<RegistreAppelEleves />}
                  />

                  <Route
                    path="/professeur/cahier-textes"
                    element={<CahierTextes />}
                  />

                  <Route
                    path="/professeur/pointage"
                    element={<MonPointage />}
                  />

                  <Route
                    path="/professeur/messagerie"
                    element={<MessagerieProf />}
                  />

                  <Route
                    path="/professeur/principal"
                    element={<DashboardPP />}
                  />

                  <Route
                    path="/professeur/emploi-du-temps"
                    element={<EmploiDuTempsAdmin />}
                  />

                </Route>


                {/* =================================================
                    ESPACE ÉDUCATEUR
                ================================================= */}

                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['educateur']}
                    />
                  }
                >

                  <Route
                    path="/educateur/dashboard"
                    element={<DashboardEducateur />}
                  />

                  <Route
                    path="/educateur/promotions"
                    element={<ListePromotion />}
                  />

                </Route>


                {/* =================================================
                    ESPACE ÉLÈVE
                ================================================= */}

                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['eleve']}
                    />
                  }
                >

                  <Route
                    path="/eleve/dashboard"
                    element={<DashboardEleve />}
                  />

                </Route>


                {/* =================================================
                    ESPACE SUPER ADMIN
                ================================================= */}

                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['super_admin']}
                    />
                  }
                >

                  <Route
                    path="/superadmin/home"
                    element={<HomeSuperAdmin />}
                  />

                  <Route
                    path="/superadmin/saas"
                    element={<SuperAdminSaaS />}
                  />

                  <Route
                    path="/superadmin/ajouter"
                    element={<AjouterPersonneSuperAdmin />}
                  />

                  <Route
                    path="/superadmin/logs"
                    element={<HistoriqueMessage />}
                  />

                  <Route
                    path="/superadmin/publicites"
                    element={<ChangerMotDePasse />}
                  />
                 
                  <Route
                    path="/superadmin/configure-terminal"
                    element={<ConfigurationTerminal />}
                  />
                </Route>


                {/* =================================================
                    ROUTE INCONNUE
                ================================================= */}

                <Route
                  path="*"
                  element={
                    <Navigate
                      to="/login"
                      replace
                    />
                  }
                />

              </Routes>

            </main>

            <Footer />

          </div>

        </EcranEveilSecurite>

      </BrowserRouter>

    </AuthProvider>
  );
};

export default App;