// src/features/admin/pages/HomeAdmin.jsx

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';

// Importations des contextes et services de l'infrastructure LuhamCode
import { db } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

// Importations des composants annexes
import NotificationCentre from '../../../component/Shared/NotificationCentre';
import ReceptionAdmin from './messages/ReceptionAdmin';
import FormulaireClasse from './FormulaireClasse';
import SecretariatAdmin from './SecretariatAdmin';
import ListeDesClasse from './listeDesClasse';
import GestionStatut from './GestionStatut';
import TestFirebase from '../../../pages/TestFirebase';
import Header from '../../../pages/Header';

const HomeAdmin = () => {
  const { user, logout, schoolName, schoolId } = useAuth();
  const navigate = useNavigate();

  // Extraction et normalisation des identifiants d'instances
  const currentSchool = (schoolId || user?.schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();
  const adminDocId = `ADMIN_${currentSchool.toUpperCase()}`;

  // --- ÉTATS CRITIQUES EN TEMPS RÉEL ---
  const [nomAdministrateurLive, setNomAdministrateurLive] = useState('Chargement...');

  // 📡 ÉCOUTEUR CLOUD EN TEMPS RÉEL (onSnapshot) INTERNE
  useEffect(() => {
    if (!currentSchool) return;

    const docAdminRef = doc(db, "users", adminDocId);

    const unsubscribe = onSnapshot(docAdminRef, (docSnap) => {
      if (docSnap.exists()) {
        const dataAdmin = docSnap.data();
        let nomExtrait = "Administrateur";
        
        if (dataAdmin.name) {
          nomExtrait = dataAdmin.name;
        } else if (Array.isArray(dataAdmin.nom)) {
          nomExtrait = dataAdmin.nom.filter(Boolean).join(' ');
        }

        // Nettoyage de la virgule Firebase ("M, François" ➔ "M. François")
        setNomAdministrateurLive(nomExtrait.replace(',', '.').toUpperCase());
      } else {
        setNomAdministrateurLive("ADMINISTRATEUR CENTRAL");
      }
    }, (err) => {
      console.error("Erreur de synchronisation NoSQL du header :", err);
      setNomAdministrateurLive("ADMINISTRATEUR");
    });

    return () => unsubscribe();
  }, [adminDocId, currentSchool]);

  const handleLogout = async () => {
    if (!window.confirm("🔒 Souhaitez-vous fermer la console d'administration ?")) return;
    await logout();
    navigate('/login');
  };

  return (
    <div className="homeAdmin min-h-screen w-full bg-white p-4 sm:p-6 lg:p-8 font-sans text-slate-800 text-left select-none animate-fadeIn">
      {/* INTÉGRATION DU HEADER */}
       <Header/>
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <h2 className="centrale  uppercase">
        CONSOLE CENTRALISEE , GESTION DE L'ADMISTRATION & RH
      </h2>
      </div>

      {/* 🗂️ GRILLE DES GRANDS PÔLES DE REDIRECTION MULTI-RÔLES SAAS */}
      <div className="titre-groupe max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <h2 className='menu'>Menu Central de l'etablissement</h2> 

        <div className="btn-block2 flex flex-col justify-between">
      <button 
          type="button"
          onClick={handleLogout}
          className="btn-admin text-write self-end md:self-auto cursor-pointer">
            Quitter la session
          </button>
         <h2 className="btnadmin">II - Gestion des trimestres, Configurez cet ordinateur, Console de sécurité & Se deconnecter</h2>
       <Link 
            to="/admin/gestion-trimestres" 
            className="btn-secs w-full text-center "
          >
            Getion des trimestres
          </Link>
           <Link 
            to="/admin/terminal" 
            className="btn-secsc w-full text-center text-orange-400 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition shadow-xs mt-6 block cursor-pointer"
          >
             Console de sécurité
          </Link>
           <Link 
            to="/admin/terminal" 
            className="btn-secscc w-full text-center hover:bg-purple-700 font-black text-xs uppercase tracking-wider py-2.5 mt-6 block cursor-pointer"
          >
            Configurer cet ordinateur
          </Link>
      </div>
       {/* CARTE 0 : DASHBOARD SECRÉTARIAT (AVEC ALIGNEMENT EXPLICIT DES 4 MISSIONS) */}
        <div className='corect'>
        <div className="dasboardSecretariat ">
          <div>
            <h3 className="titre-0ca text-base font-black mt-4 uppercase tracking-tight">V - SECRETARIEL GENERAL</h3>
            {/* Fragments courts et guidés pour l'orientation utilisateur */}
            <div className="mt-3 space-y-1 text-[11px] text-purple-300 bg-purple-950/40 p-2.5 ">
              <p className='titre-1cs2'>• Console Globale d'Administration</p>
              <p className='titre-1ca1'>• Base de donnee centralisée</p>
              <p className='titre-2ca'>• Recherche de tous les effectifs</p>
              <p className='titre-3ca'>• Expedition & Documents Personnels </p>
              <p className='titre-1ca'>• Confection des emplois du temps</p>
              <p className='titre-1cs'>• Registre Global des Classes</p>
            </div>
          </div>
          <Link 
            to="/admin/Secretariat" 
            className="btn-secre  cursor-pointer"
          >
             Dashboard Secretariat 
          </Link>
        </div>
        </div>
        {/* CARTE 1 : STATISTIQUES FINANCIÈRES ET AUDIT CLOUD */}
        <div className="dashboardAdmin bg-white text-purple-100 p-6  flex flex-col justify-between">
          <div >
            <h3 className="titre-01-1 ">III - RESOURCES HUMAINES</h3>
            <div className="recadmin mt-3 space-y-1 text-[11px] text-purple-300 ">
              <p className='titre-1-1'>• Registre d' inscriptions &  Rectification</p>
              <p className='titre-2-2'>• Gestion des bulletin & statut</p>
              <p className='titre-3-3'>• Liste et gestion de tout le personnel</p>
              <p className='titre-4-4'>•  Centre de diffusion des document</p>
              <p className='titre-5-5'>• Zone de Dessin de la Signature</p>
            </div>
          </div>
          <Link 
            to="/admin/dashboard" 
            className="btn-secr w-full text-center  cursor-pointer"
          >
             Dashboard RH
          </Link>
        </div>

        {/* CARTE 2 : COMMUNICATIONS & DIFFUSION GÉNÉRALE */}
        <div className="Rédigermessage ">
          <div>
            <h3 className="titre-03 ">IV - Communications & Centre de Diffusion</h3>
            <div className="titrerediger mt-3 space-y-1 text-[11px] text-slate-500 ">
              <p className='titre-1c'>• Correspondances Scolaires</p>
              <p className='titre-2c'>• Circulaires & mails parentaux</p>
              <p className='titre-3-a'>• Les alertes de convocations</p>
              <p className='titre-4c'>• Archives & Messagerie Administrative</p>
            </div>
          </div>
          <Link to="/notifications" className="btn-sec w-full text-center  cursor-pointer">
             Envoyer une notification
          </Link>
           <Link to="/components/communication" className="btn-secmsg w-full text-center  cursor-pointer">
             Rédiger un message
          </Link>
        </div>

        {/* CARTE 3 : REGISTRE CIVIL APPRENANTS ET MATRICULES BADGES */}
        <div className="btn-block flex flex-col justify-between">
          <div>
            <h3 className="titre-04 text-base font-black text-gray-800 mt-4 uppercase tracking-tight">I - Ajouter du personnel, Creation des classes,  Inscriptions & Badges</h3>
            {/* <div className="mt-3 space-y-1 text-[11px] text-slate-500 ">
              <p className='titre-1'>• Structuration des nouvelles divisions pédagogiques</p>
              <p className='titre-2'>• Saisie des informations civiles de chaque apprenant</p>
              <p className='titre-3'>• Provisionnement des profils administratifs vie scolaire</p>
            </div> */}
          </div>
          <div className=" space-y-2 mt-6">
            <Link to="/admin/ajouter-classe" className="btn-se1 w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition block cursor-pointer">
               Creer les classes
            </Link>
            <Link to="/admin/ajouter-eleve" className="btn-se2 w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition block cursor-pointer">
               Inscrire des Élèves 
            </Link>
            <Link to="/admin/ajouter-personnel" className="btn-se3 w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition block cursor-pointer">
               Ajouter du personnels
            </Link>
             <Link 
              to="/admin/emploi-du-temps" 
              className="btn-emploi w-full text-center bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition block cursor-pointer"
            >
               Creer Emploi des temps
            </Link>
            <Link to="/admin/list-classe" className="btn-class w-full text-center  text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-xs transition block cursor-pointer">
               Liste des classes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeAdmin;
