import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/api';

import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

const HomeSuperAdmin = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ============================================================
  // SÉCURITÉ
  // ============================================================

  const [autorise, setAutorise] = useState(false);

  // ============================================================
  // ECOLES
  // ============================================================

  const [etablissements, setEtablissements] = useState([]);
  const [chargementEcoles, setChargementEcoles] = useState(true);

  // ============================================================
  // UTILISATEURS / ADMINISTRATEURS
  // ============================================================

  const [administrateurs, setAdministrateurs] = useState({});

  // ============================================================
  // EFFECTIFS DES ÉLÈVES PAR ÉTABLISSEMENT
  // ============================================================

  const [effectifsEleves, setEffectifsEleves] = useState({});

  // ============================================================
  // MESSAGES
  // ============================================================

  const [actionMsg, setActionMsg] = useState('');

  // ============================================================
  // FORMULAIRE DE DEPLOIEMENT
  // ============================================================

  const [instanceId, setInstanceId] = useState('');
  const [nomEcole, setNomEcole] = useState('');
  const [proviseur, setProviseur] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [pays, setPays] = useState('');
  const [devise, setDevise] = useState('');
  const [tutelle, setTutelle] = useState('');

  // Tarif annuel par élève.
  // Il doit être renseigné au moment du déploiement.
  const [tarifParEleve, setTarifParEleve] = useState('');

  // ============================================================
  // VERIFICATION DU ROLE SUPER ADMIN
  // ============================================================

  useEffect(() => {
    const roleActif =
      user?.role ||
      sessionStorage.getItem('sgs_user_role');

    if (roleActif === 'super_admin') {
      setAutorise(true);
    } else {
      setAutorise(false);

      alert(
        "🛑 ACCÈS RESTREINT : Réservé exclusivement à l'administration centrale SaaS."
      );

      navigate('/login');
    }
  }, [user, navigate]);

  // ============================================================
  // ECOUTE TEMPS REEL DE LA COLLECTION SCHOOLS
  // ============================================================

  useEffect(() => {
    if (!autorise) {
      return undefined;
    }

    setChargementEcoles(true);

    const unsubscribeSchools = onSnapshot(
      collection(db, 'schools'),

      (snapshot) => {
        const listeEcoles = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        setEtablissements(listeEcoles);
        setChargementEcoles(false);
      },

      (error) => {
        console.error(
          'Erreur de synchronisation des écoles :',
          error
        );

        setChargementEcoles(false);
      }
    );

    return () => {
      unsubscribeSchools();
    };
  }, [autorise]);

  // ============================================================
  // ECOUTE TEMPS REEL DE TOUS LES USERS
  // ============================================================
  //
  // Cette écoute permet :
  // - de retrouver les administrateurs
  // - de compter les élèves
  // - de mettre automatiquement l'effectif à jour
  //
  // Si tous les élèves sont supprimés :
  // effectif = 0 immédiatement.
  // ============================================================

  useEffect(() => {
    if (!autorise) {
      return undefined;
    }

    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'),

      (snapshot) => {
        const admins = {};
        const compteEleves = {};

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();

          const schoolId = String(
            data.schoolId ||
            data.school_id ||
            ''
          )
            .trim()
            .toLowerCase();

          if (!schoolId) {
            return;
          }

          // ======================================================
          // ADMINISTRATEURS
          // ======================================================

          if (data.role === 'admin') {
            admins[schoolId] = {
              id: docSnap.id,
              ...data
            };
          }

          // ======================================================
          // ÉLÈVES
          // ======================================================

          const role = String(
            data.role || ''
          )
            .trim()
            .toLowerCase();

          const estEleve =
            role === 'eleve' ||
            role === 'élève' ||
            role === 'etudiant' ||
            role === 'étudiant';

          if (estEleve) {
            compteEleves[schoolId] =
              (compteEleves[schoolId] || 0) + 1;
          }
        });

        setAdministrateurs(admins);
        setEffectifsEleves(compteEleves);
      },

      (error) => {
        console.error(
          'Erreur de synchronisation des utilisateurs :',
          error
        );
      }
    );

    return () => {
      unsubscribeUsers();
    };
  }, [autorise]);

  // ============================================================
  // MESSAGE TEMPORAIRE
  // ============================================================

  const afficherMessage = (message, duree = 5000) => {
    setActionMsg(message);

    setTimeout(() => {
      setActionMsg('');
    }, duree);
  };

  // ============================================================
  // FORMATAGE DU MONTANT
  // ============================================================

  const formaterMontant = (montant, deviseMonetaire = '') => {
    if (
      montant === null ||
      montant === undefined ||
      montant === ''
    ) {
      return 'Non configuré';
    }

    const valeur = Number(montant);

    if (!Number.isFinite(valeur)) {
      return String(montant);
    }

    const montantFormate = new Intl.NumberFormat(
      'fr-FR'
    ).format(valeur);

    return deviseMonetaire
      ? `${montantFormate} ${deviseMonetaire}`
      : montantFormate;
  };

  // ============================================================
  // RECUPERATION DU TARIF PAR ELEVE
  // ============================================================

  const obtenirTarifParEleve = (ecole) => {
    const tarif =
      ecole.tarifParEleve ??
      ecole.tarifEleve ??
      ecole.prixParEleve ??
      ecole.redevanceParEleve ??
      ecole.montantParEleve ??
      null;

    if (
      tarif === null ||
      tarif === undefined ||
      tarif === ''
    ) {
      return null;
    }

    const valeur = Number(tarif);

    return Number.isFinite(valeur)
      ? valeur
      : null;
  };

  // ============================================================
  // CALCUL DE LA REDEVANCE
  // ============================================================

  const calculerRedevance = (ecole, effectif) => {
    const tarif = obtenirTarifParEleve(ecole);

    if (tarif === null) {
      return null;
    }

    return effectif * tarif;
  };

  // ============================================================
  // CREATION / DEPLOIEMENT D'UNE ECOLE
  // ============================================================

  const handleDeployerEcole = async (e) => {
    e.preventDefault();

    const cleanId = instanceId
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');

    const nomPropre = nomEcole.trim();
    const proviseurPropre = proviseur.trim();
    const passwordPropre = adminPassword.trim();

    const paysPropre = pays.trim();
    const devisePropre = devise.trim();
    const tutellePropre = tutelle.trim();

    const tarifPropre = tarifParEleve.trim();

    if (
      !cleanId ||
      !nomPropre ||
      !proviseurPropre ||
      !passwordPropre ||
      !paysPropre ||
      !devisePropre ||
      !tutellePropre ||
      !tarifPropre
    ) {
      afficherMessage(
        '⚠️ Veuillez renseigner tous les champs obligatoires.'
      );

      return;
    }

    const tarifNumerique = Number(tarifPropre);

    if (
      !Number.isFinite(tarifNumerique) ||
      tarifNumerique < 0
    ) {
      afficherMessage(
        '⚠️ Le tarif annuel par élève doit être un montant valide.'
      );

      return;
    }

    const adminId =
      `ADMIN_${cleanId.toUpperCase()}`;

    afficherMessage(
      `⏳ Déploiement de l'instance cloud [${cleanId}]...`,
      10000
    );

    try {
      // ========================================================
      // 1. CREATION DE L'ECOLE
      // ========================================================

      await setDoc(
        doc(db, 'schools', cleanId),
        {
          id: cleanId,

          name: nomPropre,
          nom: nomPropre,

          proviseur: proviseurPropre,

          pays: paysPropre,
          devise: devisePropre,
          tutelle: tutellePropre,

          licenceType: 'Premium unifié',
          formuleSaaS: 'Premium unifié',

          statut: 'actif',

          // ====================================================
          // FACTURATION DYNAMIQUE
          // ====================================================

          tarifParEleve: tarifNumerique,

          // L'effectif réel sera calculé depuis users.
          // On ne stocke plus "14 élèves".
          effectif: 0,

          // La redevance sera calculée :
          // nombre réel d'élèves × tarifParEleve.
          redevance: 0,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      // ========================================================
      // 2. CREATION DU COMPTE ADMINISTRATEUR
      // ========================================================

      await setDoc(
        doc(db, 'users', adminId),
        {
          id: adminId,

          matricule: adminId,

          nom: [
            'M.',
            proviseurPropre
          ],

          name: proviseurPropre,

          // NOTE :
          // Pour la production, il faut migrer vers Firebase Auth
          // et ne plus conserver les mots de passe en clair
          // dans Firestore.
          password: passwordPropre,

          role: 'admin',

          statut: 'actif',

          schoolId: cleanId,
          school_id: cleanId,

          etablissementActuel: nomPropre,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      // ========================================================
      // 3. RESET DU FORMULAIRE
      // ========================================================

      setInstanceId('');
      setNomEcole('');
      setProviseur('');
      setAdminPassword('');

      setPays('');
      setDevise('');
      setTutelle('');
      setTarifParEleve('');

      afficherMessage(
        `🎉 Instance ${nomPropre} déployée ! Compte administrateur créé : ${adminId}`,
        8000
      );

    } catch (error) {
      console.error(
        'Erreur de déploiement :',
        error
      );

      afficherMessage(
        `❌ Erreur technique : ${error.message}`,
        8000
      );
    }
  };

  // ============================================================
  // BLOQUER UNE ECOLE
  // ============================================================

  const handleBloquerEcole = async (
    schoolId,
    name
  ) => {
    if (
      !window.confirm(
        `⚠️ Couper l'infrastructure et suspendre les accès de : ${name} ?`
      )
    ) {
      return;
    }

    afficherMessage(
      `⏳ Suspension de l'instance de ${name}...`
    );

    try {
      await updateDoc(
        doc(db, 'schools', schoolId),
        {
          statut: 'suspendu_impaye',
          updatedAt: serverTimestamp()
        }
      );

      afficherMessage(
        `🔒 Établissement ${name} suspendu avec succès.`,
        5000
      );

    } catch (error) {
      console.error(error);

      afficherMessage(
        `❌ Échec de suspension : ${error.message}`,
        7000
      );
    }
  };

  // ============================================================
  // DEBLOQUER UNE ECOLE
  // ============================================================

  const handleDebloquerEcole = async (
    schoolId,
    name
  ) => {
    afficherMessage(
      `⏳ Restauration de l'instance de ${name}...`
    );

    try {
      await updateDoc(
        doc(db, 'schools', schoolId),
        {
          statut: 'actif',
          updatedAt: serverTimestamp()
        }
      );

      afficherMessage(
        `🔓 Licence cloud réactivée avec succès pour ${name}.`,
        5000
      );

    } catch (error) {
      console.error(error);

      afficherMessage(
        `❌ Échec de réactivation : ${error.message}`,
        7000
      );
    }
  };

  // ============================================================
  // SUPPRIMER ECOLE + ADMIN
  // ============================================================

  const handleSupprimerEcole = async (
    schoolId,
    name
  ) => {
    if (
      !window.confirm(
        `🚨 DANGER CRITIQUE : Dissoudre définitivement le partenariat avec ${name} ?`
      )
    ) {
      return;
    }

    afficherMessage(
      `⏳ Suppression définitive de ${name}...`,
      10000
    );

    try {
      // ========================================================
      // 1. SUPPRESSION DE L'ECOLE
      // ========================================================

      await deleteDoc(
        doc(db, 'schools', schoolId)
      );

      // ========================================================
      // 2. SUPPRESSION DU COMPTE ADMIN
      // ========================================================

      const adminId =
        `ADMIN_${String(schoolId).toUpperCase()}`;

      await deleteDoc(
        doc(db, 'users', adminId)
      );

      afficherMessage(
        `🗑️ Établissement ${name} et compte administrateur retirés du réseau central SaaS.`,
        7000
      );

    } catch (error) {
      console.error(
        'Erreur de suppression :',
        error
      );

      afficherMessage(
        `❌ Échec de suppression : ${error.message}`,
        7000
      );
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    logout();

    sessionStorage.removeItem(
      'sgs_user_role'
    );

    navigate('/login');
  };

  // ============================================================
  // RECUPERATION DU NOM DU RESPONSABLE
  // ============================================================

  const obtenirNomResponsable = (ecole) => {
    if (
      ecole.proviseur &&
      typeof ecole.proviseur === 'string'
    ) {
      return ecole.proviseur;
    }

    if (
      Array.isArray(ecole.nom) &&
      ecole.nom.length > 0
    ) {
      return ecole.nom
        .filter(Boolean)
        .join(' ');
    }

    if (
      Array.isArray(ecole.name) &&
      ecole.name.length > 0
    ) {
      return ecole.name
        .filter(Boolean)
        .join(' ');
    }

    if (
      typeof ecole.name === 'string'
    ) {
      return ecole.name;
    }

    return 'Non renseigné';
  };

  // ============================================================
  // NOM ECOLE
  // ============================================================

  const obtenirNomEcole = (ecole) => {
    if (
      ecole.etablissementActuel
    ) {
      return ecole.etablissementActuel;
    }

    if (
      typeof ecole.name === 'string'
    ) {
      return ecole.name;
    }

    if (
      typeof ecole.nom === 'string'
    ) {
      return ecole.nom;
    }

    return ecole.id || 'Établissement';
  };

  // ============================================================
  // ETAT D'AUTORISATION
  // ============================================================

  if (!autorise) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs text-gray-500 font-bold uppercase tracking-widest">
        Vérification de sécurité...
      </div>
    );
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8 select-none text-left w-full">

      {/* ======================================================
          HEADER SUPER ADMIN
      ====================================================== */}

      <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">
            ESPACE SUPER ADMIN
          </h1>

          <p className="text-[11px] text-slate-400 mt-1 font-bold uppercase tracking-wide">
            🔓 LeCloudScolaire Informatisé et Centralisé
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">

          <button
            type="button"
            onClick={handleLogout}
            className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md"
          >
            🚪 Quitter le Noyau
          </button>

        </div>
      </div>

      {/* ======================================================
          NAVIGATION
      ====================================================== */}

      <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md">

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">

          <Link
            to="/superadmin/saas"
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-orange-400 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition text-center w-full sm:w-auto"
          >
            🏢 Config SaaS
          </Link>

          <Link
            to="/superadmin/ajouter"
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-purple-400 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition text-center w-full sm:w-auto"
          >
            ➕ Ajouter Personnel
          </Link>

          <Link
            to="/superadmin/configure-terminal"
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-blue-400 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition text-center w-full sm:w-auto"
          >
            🔐 Scellage Matériel
          </Link>

        </div>

        <div className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 font-black px-3 py-1.5 rounded-lg uppercase tracking-wide">
          ● Synchronisation Firestore Active
        </div>

      </div>

      {/* ======================================================
          MESSAGE ACTION
      ====================================================== */}

      {actionMsg && (
        <div className="max-w-7xl mx-auto mb-6 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-xl border-l-4 border-orange-500 animate-pulse">
          {actionMsg}
        </div>
      )}

      {/* ======================================================
          ZONE PRINCIPALE
      ====================================================== */}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

        {/* ====================================================
            FORMULAIRE ECOLE
        ==================================================== */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">

          <h2 className="text-sm font-black text-white uppercase border-b border-slate-800 pb-2 mb-4">
            🏛️ Déployer une Nouvelle École
          </h2>

          <form
            onSubmit={handleDeployerEcole}
            className="space-y-3.5 text-xs text-slate-200"
          >

            {/* INSTANCE */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                Identifiant Instance *
              </label>

              <input
                type="text"
                placeholder="Ex: lycee_saint_bernard"
                value={instanceId}
                onChange={(e) =>
                  setInstanceId(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono uppercase focus:outline-none focus:border-orange-500 font-bold"
                required
              />

            </div>

            {/* ECOLE */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                Nom Officiel Établissement *
              </label>

              <input
                type="text"
                placeholder="Ex: Lycée Saint Bernard"
                value={nomEcole}
                onChange={(e) =>
                  setNomEcole(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-orange-500 font-bold"
                required
              />

            </div>

            {/* PROVISEUR */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                Responsable / Proviseur *
              </label>

              <input
                type="text"
                placeholder="Nom du responsable"
                value={proviseur}
                onChange={(e) =>
                  setProviseur(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-orange-500 font-bold"
                required
              />

            </div>

            {/* PASSWORD */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                🔑 Mot de passe Admin initial *
              </label>

              <input
                type="password"
                placeholder="Mot de passe"
                value={adminPassword}
                onChange={(e) =>
                  setAdminPassword(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-orange-500 font-bold"
                required
              />

            </div>

            {/* PAYS */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                Désignation du Pays *
              </label>

              <input
                type="text"
                placeholder="Pays de l'établissement"
                value={pays}
                onChange={(e) =>
                  setPays(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-orange-500 font-bold"
                required
              />

            </div>

            {/* TUTELLE */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                Ministère de Tutelle *
              </label>

              <input
                type="text"
                placeholder="Ministère de tutelle"
                value={tutelle}
                onChange={(e) =>
                  setTutelle(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-orange-500 font-bold"
                required
              />

            </div>

            {/* DEVISE */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                Devise *
              </label>

              <input
                type="text"
                placeholder="Devise officielle"
                value={devise}
                onChange={(e) =>
                  setDevise(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-orange-500 font-bold"
                required
              />

            </div>

            {/* TARIF */}

            <div>

              <label className="block text-slate-400 font-bold uppercase mb-1">
                💰 Tarif annuel par élève *
              </label>

              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ex: 350"
                value={tarifParEleve}
                onChange={(e) =>
                  setTarifParEleve(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-orange-500 font-bold"
                required
              />

              <p className="text-[9px] text-slate-500 mt-1">
                Ce montant sera multiplié par le nombre réel d'élèves.
              </p>

            </div>

            {/* BOUTON */}

            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl uppercase tracking-wider transition cursor-pointer mt-2 shadow-md"
            >
              ⚡ Activer l'Établissement Client
            </button>

          </form>

        </div>

        {/* ====================================================
            REGISTRE
        ==================================================== */}

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">

          <h2 className="text-sm font-black text-white uppercase border-b border-slate-800 pb-2 mb-4">
            📋 Registre de Contrôle & Facturation Matrice
          </h2>

          {/* CHARGEMENT */}

          {chargementEcoles ? (

            <div className="text-center py-10 text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
              Extraction des licences cloud...
            </div>

          ) : etablissements.length === 0 ? (

            <div className="text-center py-10 text-xs font-bold text-red-400 uppercase bg-slate-950 rounded-xl border border-slate-800">
              ⚠️ Aucun établissement enregistré.
            </div>

          ) : (

            <div className="overflow-x-auto w-full">

              <table className="min-w-[1000px] w-full text-left text-xs border-collapse">

                <thead>

                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[9px] tracking-wider font-black">

                    <th className="py-2.5 px-3">
                      Instance / Pays
                    </th>

                    <th className="py-2.5 px-3">
                      Premier Responsable
                    </th>

                    <th className="py-2.5 px-3">
                      Accès Admin
                    </th>

                    <th className="py-2.5 px-3">
                      Effectif réel
                    </th>

                    <th className="py-2.5 px-3">
                      Redevance
                    </th>

                    <th className="py-2.5 px-3 text-right">
                      Actions Restreintes
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-800/40 font-semibold text-slate-300">

                  {etablissements.map((ecole) => {

                    const schoolId =
                      String(ecole.id || '')
                        .trim()
                        .toLowerCase();

                    const admin =
                      administrateurs[schoolId];

                    const effectif =
                      effectifsEleves[schoolId] || 0;

                    const tarif =
                      obtenirTarifParEleve(ecole);

                    const redevance =
                      calculerRedevance(
                        ecole,
                        effectif
                      );

                    const estBloque =
                      ecole.statut === 'suspendu_impaye' ||
                      ecole.statut === 'inactif';

                    const nomEcoleAffiche =
                      obtenirNomEcole(ecole);

                    const proviseurAffiche =
                      obtenirNomResponsable(ecole);

                    const adminId =
                      admin?.id ||
                      `ADMIN_${String(schoolId).toUpperCase()}`;

                    const adminName =
                      admin?.name ||
                      admin?.nom?.join?.(' ') ||
                      proviseurAffiche;

                    return (

                      <tr
                        key={schoolId}
                        className="hover:bg-slate-950/30 transition text-[11px]"
                      >

                        {/* ECOLE */}

                        <td className="py-3 px-3">

                          <p className="font-black text-white uppercase tracking-tight">
                            {nomEcoleAffiche}
                          </p>

                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wide">
                            🌍 {schoolId}
                          </p>

                          <p className="text-[9px] text-slate-500 mt-1">
                            {ecole.pays || 'Non renseigné'}
                          </p>

                        </td>

                        {/* RESPONSABLE */}

                        <td className="py-3 px-3">

                          <p className="font-bold text-slate-200 uppercase">
                            {adminName}
                          </p>

                          <p className="text-[10px] text-slate-500 truncate max-w-[180px] font-medium">
                            {ecole.tutelle || 'Non renseigné'}
                          </p>

                        </td>

                        {/* ADMIN */}

                        <td className="py-3 px-3 font-mono">

                          <p className="text-slate-300 font-bold">
                            👤 {adminId}
                          </p>

                          <p className="text-[10px] text-slate-500">
                            Rôle : {admin?.role || 'admin'}
                          </p>

                          <p className="text-[10px] text-emerald-400">
                            Statut : {admin?.statut || ecole.statut || 'Non renseigné'}
                          </p>

                        </td>

                        {/* EFFECTIF RÉEL */}

                        <td className="py-3 px-3">

                          <p className="font-black text-blue-400 font-mono">
                            {effectif}
                          </p>

                          <p className="text-[9px] text-slate-500 mt-1">
                            élève{effectif > 1 ? 's' : ''}
                          </p>

                          <p className="text-[9px] text-emerald-400 mt-1">
                            ● Temps réel
                          </p>

                        </td>

                        {/* FACTURATION */}

                        <td className="py-3 px-3">

                          <p className="font-black text-orange-400 font-mono">

                            {redevance !== null
                              ? formaterMontant(
                                  redevance,
                                  ecole.deviseMonetaire ||
                                  ecole.deviseFacturation ||
                                  ecole.monnaie ||
                                  ''
                                )
                              : 'Non configuré'}

                          </p>

                          {tarif !== null && (

                            <p className="text-[9px] text-slate-500 mt-1">

                              {formaterMontant(
                                tarif,
                                ecole.deviseMonetaire ||
                                ecole.deviseFacturation ||
                                ecole.monnaie ||
                                ''
                              )}

                              {' / élève / an'}

                            </p>

                          )}

                          <p className="text-[9px] text-slate-500 mt-1">
                            {ecole.statut || 'Non renseigné'}
                          </p>

                        </td>

                        {/* ACTIONS */}

                        <td className="py-3 px-3 text-right">

                          <div className="flex justify-end gap-1.5 flex-wrap">

                            {estBloque ? (

                              <button
                                type="button"
                                onClick={() =>
                                  handleDebloquerEcole(
                                    schoolId,
                                    nomEcoleAffiche
                                  )
                                }
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
                              >
                                🔓 Débloquer
                              </button>

                            ) : (

                              <button
                                type="button"
                                onClick={() =>
                                  handleBloquerEcole(
                                    schoolId,
                                    nomEcoleAffiche
                                  )
                                }
                                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
                              >
                                🔒 Bloquer
                              </button>

                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleSupprimerEcole(
                                  schoolId,
                                  nomEcoleAffiche
                                )
                              }
                              className="bg-red-600/20 hover:bg-red-600 hover:text-white text-red-400 border border-red-900/40 font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              🗑️ Supprimer
                            </button>

                          </div>

                        </td>

                      </tr>

                    );
                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <div className="max-w-7xl mx-auto mt-10 p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">

        <span>
          Version LeCloudScolaire :
          <strong className="text-slate-400">
            {' '}v1.2.0 — Live Core
          </strong>
        </span>

        <span>
          Synchronisation :
          <strong className="text-emerald-400">
            {' '}FIRESTORE LIVE
          </strong>
        </span>

      </div>

    </div>
  );
};

export default HomeSuperAdmin;