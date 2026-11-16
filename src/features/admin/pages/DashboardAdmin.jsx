// src/features/admin/pages/DashboardAdmin.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

import { db } from '../../../services/api';

import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
  getDoc,
  where,
  addDoc
} from 'firebase/firestore';

import { useAuth } from '../../../context/AuthContext';
import SignaturePadModal from '../../../components/SignaturePadModal';

// IMPORTATION DES DIFFÉRENTS ONGLETS INTERNES
import GestionStatut from './GestionStatut';
import EnvoiDocumentAdmin from './EnvoiDocumentAdmin';
import EmploiDuTempsAdmin from './EmploiDuTempsAdmin';
import ReceptionAdmin from './messages/ReceptionAdmin';

// REGISTRE DES PROMOTIONS
import ListePromotion from '../../educateur/pages/ListePromotion';

import ModifierStatut from './ModifierStatut';
import Header from '../../../pages/Header';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

import ModifierEleve from '../../../pages/ModifierEleve';
import ModifierProfesseur from '../../../pages/ModifierProfesseur';
import GestionProfils from './GestionProfils';
import SaisieNotes from '../../professeur/pages/evaluations/SaisieNotes';
import TestFirebase from '../../../pages/TestFirebase';


const DashboardAdmin = () => {
  const { user, schoolId, schoolName } = useAuth();
  const [searchParams] = useSearchParams();

  /*
   * ============================================================
   * ÉTABLISSEMENT ACTUEL
   * ============================================================
   *
   * Le schoolId vient en priorité du AuthContext.
   * sessionStorage sert uniquement de secours technique.
   *
   * Aucun nom d'établissement n'est inscrit ici.
   */
  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    ''
  )
    .trim()
    .toLowerCase();


  // ============================================================
  // ÉTATS
  // ============================================================

  const [tousUtilisateurs, setTousUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [sendingId, setSendingId] = useState('');

  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'vue_globale'
  );

  const [subTab, setSubTab] = useState('eleves');

  const [termeRecherche, setTermeRecherche] = useState('');

  /*
   * Le trimestre peut venir du sélecteur.
   * Il est utilisé uniquement pour choisir les données Firestore.
   */
  const [trimestreFiltre, setTrimestreFiltre] = useState('1');

  const [editingUser, setEditingUser] = useState(null);

  const [editNom, setEditNom] = useState('');
  const [editPrenoms, setEditPrenoms] = useState('');

  const [saving, setSaving] = useState(false);

  const [classeErronee, setClasseErronee] = useState('');
  const [classeCorrigee, setClasseCorrigee] = useState('');

  const [isFixing, setIsFixing] = useState(false);

  const [statistiques, setStatistiques] = useState({
    apprenants: 0,
    personnels: 0,
    suspendus: 0
  });


  // ============================================================
  // DÉTECTION SUPER ADMIN
  // ============================================================

  let activeSessionData = null;

  try {
    const session = sessionStorage.getItem('sgs_user');

    if (session) {
      activeSessionData = JSON.parse(session);
    }
  } catch (error) {
    console.error(
      'Impossible de lire la session utilisateur :',
      error
    );
  }

  const isSuperAdminLuhamcode =
    Boolean(activeSessionData?.id);


  // ============================================================
  // CHARGEMENT TEMPS RÉEL DES UTILISATEURS
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      setTousUtilisateurs([]);
      setLoading(false);
      return;
    }

    const usersRef = collection(db, 'users');

    const qSchool = query(
      usersRef,
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      qSchool,
      (snapshot) => {
        const list = [];

        let totalEleves = 0;
        let totalRH = 0;
        let totalSuspendus = 0;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          const utilisateur = {
            id: docSnap.id,
            ...data
          };

          list.push(utilisateur);

          if (
            String(data.role || '')
              .trim()
              .toLowerCase() === 'eleve'
          ) {
            totalEleves++;
          }

          const role = String(data.role || '')
            .trim()
            .toLowerCase();

          if (
            role === 'educateur' ||
            role === 'professeur' ||
            role === 'prof_principal'
          ) {
            totalRH++;
          }

          if (
            data.statut &&
            String(data.statut).toLowerCase() !== 'actif'
          ) {
            totalSuspendus++;
          }
        });

        setTousUtilisateurs(list);

        setStatistiques({
          apprenants: totalEleves,
          personnels: totalRH,
          suspendus: totalSuspendus
        });

        setLoading(false);
      },
      (err) => {
        console.error(
          'Erreur chargement utilisateurs :',
          err
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);


  // ============================================================
  // RECTIFICATION IDENTITÉ
  // ============================================================

  const handleRectifierIdentite = async (e) => {
    e.preventDefault();

    if (
      !editingUser ||
      !editNom.trim() ||
      !editPrenoms.trim()
    ) {
      return;
    }

    setSaving(true);

    try {
      await updateDoc(
        doc(db, 'users', editingUser.id),
        {
          nom: editNom.trim().toUpperCase(),

          prenoms: editPrenoms.trim(),

          name: `${editNom.trim().toUpperCase()} ${editPrenoms.trim()}`,

          updatedAt: new Date().toISOString()
        }
      );

      alert(
        "✨ Rectification d'identité enregistrée !"
      );

      setEditingUser(null);

    } catch (err) {
      console.error(
        'Erreur rectification identité :',
        err
      );

      alert(
        "❌ Impossible d'enregistrer la rectification."
      );

    } finally {
      setSaving(false);
    }
  };


  // ============================================================
  // ACTIVATION / SUSPENSION
  // ============================================================

  const handleBasculerStatutBadge = async (
    userId,
    statutActuel
  ) => {
    const nouveauStatut =
      statutActuel === 'actif'
        ? 'suspendu'
        : 'actif';

    if (
      !window.confirm(
        "Confirmez-vous le basculement des accès pour ce badge ?"
      )
    ) {
      return;
    }

    try {
      await updateDoc(
        doc(db, 'users', userId),
        {
          statut: nouveauStatut,
          updatedAt: new Date().toISOString()
        }
      );

    } catch (err) {
      console.error(
        'Erreur changement statut :',
        err
      );
    }
  };


  // ============================================================
  // MAINTENANCE CLASSES
  // ============================================================

  const handleLancerMaintenanceClassesAdmin = async (e) => {
    e.preventDefault();

    if (
      !classeErronee.trim() ||
      !classeCorrigee.trim()
    ) {
      return;
    }

    setIsFixing(true);

    try {
      const q = query(
        collection(db, 'users'),

        where(
          'schoolId',
          '==',
          currentSchool
        ),

        where(
          'role',
          '==',
          'eleve'
        ),

        where(
          'classeId',
          '==',
          classeErronee
            .trim()
            .toLowerCase()
        )
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        alert('Aucun élève trouvé.');

        setIsFixing(false);

        return;
      }

      const batch = writeBatch(db);

      snap.forEach((d) => {
        batch.update(
          doc(db, 'users', d.id),
          {
            classeId:
              classeCorrigee
                .trim()
                .toLowerCase(),

            updatedAt:
              new Date().toISOString()
          }
        );
      });

      await batch.commit();

      alert(
        '⚡ Correction effectuée !'
      );

      setClasseErronee('');
      setClasseCorrigee('');

    } catch (err) {
      console.error(
        'Erreur maintenance classes :',
        err
      );

      alert(
        '❌ Une erreur est survenue pendant la correction.'
      );

    } finally {
      setIsFixing(false);
    }
  };


  // ============================================================
  // OUTILS BULLETIN
  // ============================================================

  const obtenirValeurNumerique = (valeur) => {
    const nombre = Number(valeur);

    return Number.isFinite(nombre)
      ? nombre
      : 0;
  };


  const obtenirNomCompletEleve = (student) => {
    const nom = String(
      student?.nom || ''
    ).trim();

    const prenoms = String(
      student?.prenoms ||
      student?.prenom ||
      ''
    ).trim();

    return `${nom} ${prenoms}`
      .trim()
      .toUpperCase();
  };


  /*
   * Récupération de la moyenne trimestrielle directement
   * depuis les données existantes de l'élève.
   */
  const recupererMoyenneTrimestrielle = (
    student,
    trimestre
  ) => {
    const cle =
      `notes_trimestre_${trimestre}`;

    const sources = [
      student?.moyennesTrimestrielles?.[cle],
      student?.moyennes_trimestrielles?.[cle],
      student?.moyennes_matiere?.[cle]
    ];

    for (const valeur of sources) {
      if (
        typeof valeur === 'number' &&
        Number.isFinite(valeur)
      ) {
        return valeur;
      }

      if (
        typeof valeur === 'string' &&
        valeur.trim() !== ''
      ) {
        const nombre = Number(valeur);

        if (Number.isFinite(nombre)) {
          return nombre;
        }
      }
    }

    return null;
  };


  /*
   * Récupération des matières réellement enregistrées
   * dans moyennes_matiere.
   */
  const recupererMatieresBulletin = (
    student,
    trimestre
  ) => {
    const cle =
      `notes_trimestre_${trimestre}`;

    const moyennesMatiere =
      student?.moyennes_matiere?.[cle];

    if (
      !moyennesMatiere ||
      typeof moyennesMatiere !== 'object'
    ) {
      return [];
    }

    return Object.entries(
      moyennesMatiere
    ).map(([matiere, donnees]) => {
      const coefficient =
        obtenirValeurNumerique(
          donnees?.coefficientMatiere
        );

      const moyenne =
        obtenirValeurNumerique(
          donnees?.note
        );

      const moyennePonderee =
        donnees?.moyennePonderee !== undefined
          ? obtenirValeurNumerique(
              donnees.moyennePonderee
            )
          : moyenne * coefficient;

      return {
        matiere,

        coefficient,

        moyenne,

        moyennePonderee,

        appreciation:
          donnees?.appreciation || '',

        professeurId:
          donnees?.professeurId || '',

        professeurName:
          donnees?.professeurName || '',

        statut:
          donnees?.statut || '',

        signet:
          donnees?.signet ?? null
      };
    });
  };


  /*
   * Calcul de la moyenne générale à partir des données
   * réellement enregistrées dans Firestore.
   */
  const calculerMoyenneDepuisMatieres = (
    matieres
  ) => {
    let totalPondere = 0;
    let totalCoefficients = 0;

    matieres.forEach((matiere) => {
      const coefficient =
        obtenirValeurNumerique(
          matiere.coefficient
        );

      const moyennePonderee =
        obtenirValeurNumerique(
          matiere.moyennePonderee
        );

      if (coefficient > 0) {
        totalCoefficients += coefficient;

        totalPondere += moyennePonderee;
      }
    });

    if (totalCoefficients <= 0) {
      return 0;
    }

    return Number(
      (
        totalPondere /
        totalCoefficients
      ).toFixed(2)
    );
  };


  /*
   * Toutes les informations de l'établissement
   * viennent maintenant de schools/{schoolId}.
   */
  const recupererInformationsEtablissement = async (
    schoolIdPourBulletin
  ) => {
    if (!schoolIdPourBulletin) {
      throw new Error(
        "Identifiant de l'établissement introuvable."
      );
    }

    const schoolRef = doc(
      db,
      'schools',
      schoolIdPourBulletin
    );

    const schoolSnap =
      await getDoc(schoolRef);

    if (!schoolSnap.exists()) {
      throw new Error(
        "Les informations de l'établissement sont introuvables dans Firestore."
      );
    }

    return {
      id: schoolSnap.id,
      ...schoolSnap.data()
    };
  };


  /*
   * ============================================================
   * ENVOI DU BULLETIN AU PARENT
   * ============================================================
   *
   * IMPORTANT :
   *
   * Le document élève est relu dans Firestore au moment de
   * l'envoi.
   *
   * On ne dépend donc plus uniquement de la liste affichée
   * dans le tableau.
   */
  const handleDeclencherEnvoiBulletin = async (
    student
  ) => {
    const studentId =
      student?.id ||
      student?.matricule;

    if (!studentId) {
      alert(
        "❌ Identifiant de l'élève introuvable."
      );

      return;
    }

    setSendingId(studentId);

    try {

      // ========================================================
      // 1. RELECTURE DIRECTE DE L'ÉLÈVE DANS FIRESTORE
      // ========================================================

      const studentRef = doc(
        db,
        'users',
        studentId
      );

      const studentSnap =
        await getDoc(studentRef);

      if (!studentSnap.exists()) {
        throw new Error(
          "La fiche de l'élève n'existe plus dans Firestore."
        );
      }

      const studentFirestore = {
        id: studentSnap.id,
        ...studentSnap.data()
      };


      // ========================================================
      // 2. IDENTIFIANT DE L'ÉTABLISSEMENT
      // ========================================================

      const schoolIdPourBulletin =
        String(
          studentFirestore?.schoolId ||
          currentSchool ||
          ''
        )
          .trim()
          .toLowerCase();

      if (!schoolIdPourBulletin) {
        throw new Error(
          "L'établissement de l'élève est introuvable."
        );
      }


      // ========================================================
      // 3. RÉCUPÉRATION DIRECTE DE L'ÉTABLISSEMENT
      // ========================================================

      const school =
        await recupererInformationsEtablissement(
          schoolIdPourBulletin
        );


      // ========================================================
      // 4. DONNÉES RÉELLES DE L'ÉLÈVE
      // ========================================================

      const trimestre =
        String(trimestreFiltre);

      const cleTrimestre =
        `notes_trimestre_${trimestre}`;

      const nomEleve =
        obtenirNomCompletEleve(
          studentFirestore
        );

      const matricule =
        String(
          studentFirestore?.matricule ||
          studentFirestore?.id ||
          studentId
        );

      const classe =
        String(
          studentFirestore?.classeNom ||
          studentFirestore?.classe ||
          ''
        ).trim();

      const classeId =
        String(
          studentFirestore?.classeId ||
          ''
        ).trim();

      const promotion =
        String(
          studentFirestore?.promotion ||
          ''
        ).trim();

      const anneeScolaire =
        String(
          studentFirestore?.anneeScolaire ||
          studentFirestore?.anneeArrivee ||
          ''
        ).trim();

      const emailParent =
        String(
          studentFirestore?.emailParent ||
          ''
        ).trim();


      if (!emailParent) {
        throw new Error(
          "Aucune adresse e-mail parent n'est enregistrée sur la fiche de cet élève."
        );
      }


      // ========================================================
      // 5. MATIÈRES ET MOYENNES FIRESTORE
      // ========================================================

      const matieres =
        recupererMatieresBulletin(
          studentFirestore,
          trimestre
        );


      /*
       * On privilégie la moyenne générale déjà enregistrée
       * dans Firestore.
       *
       * Si elle n'existe pas, on la calcule à partir des
       * matières réellement enregistrées.
       */
      let moyenneGenerale =
        recupererMoyenneTrimestrielle(
          studentFirestore,
          trimestre
        );

      if (
        moyenneGenerale === null
      ) {
        moyenneGenerale =
          calculerMoyenneDepuisMatieres(
            matieres
          );
      }


      // ========================================================
      // 6. DONNÉES DU CONSEIL DE CLASSE
      // ========================================================

      const appreciationPP =
        String(
          studentFirestore?.appreciationPP ||
          studentFirestore
            ?.conseilClasse
            ?.appreciations_conseil
            ?.appreciationPP ||
          ''
        ).trim();

      const professeurPrincipalNom =
        String(
          studentFirestore
            ?.professeurPrincipalNom ||
          studentFirestore
            ?.conseilClasse
            ?.professeurPrincipalNom ||
          ''
        ).trim();
      // ========================================================
      // 6. BIS : LECTURE EN TEMPS RÉEL DU CONSEIL DE CLASSE NoSQL (STABLE)
      // ========================================================
      // Force l'extraction du numéro (si trimestre vaut "Trimestre 1" ou "1", on obtient "1")
      const numTrimestreNettoye = String(trimestre || trimestreFiltre || '1').replace(/[^0-9]/g, '') || "1";
      
      const cleRootTrimestre = `trimestre_${numTrimestreNettoye}`; // "trimestre_1"
      const cleNotesTrimestre = `notes_trimestre_${numTrimestreNettoye}`; // "notes_trimestre_1"

      // Extraction des différents blocs de votre console Firebase
      const rootBlocData = studentFirestore?.[cleRootTrimestre] || {};
      const ccBlocData = studentFirestore?.conseilClasse?.[cleNotesTrimestre] || {};
      const ccRootBlocData = studentFirestore?.conseilClasse?.[cleRootTrimestre] || {};

      // 🎯 CHASSE MULTI-NIVEAUX : On cherche partout où la décision a pu être stockée
      const decisionExtraiteNoSQL = 
        String(rootBlocData?.decision || '').trim() ||
        String(ccBlocData?.decision || '').trim() ||
        String(ccRootBlocData?.decision || '').trim() ||
        String(studentFirestore?.decisionConseil || '').trim() ||
        String(studentFirestore?.decision || '').trim();

      // 🟢 FORMATAGE EN OBJET POUR VOTRE QR CODE (.decision.toUpperCase())
      const decisionConseil = {
        decision: decisionExtraiteNoSQL || "EN ATTENTE"
      };

      // EXTRACTION DU STATUT EN TEMPS RÉEL
      const statutExtraitNoSQL = 
        String(rootBlocData?.statut || '').trim() ||
        String(ccBlocData?.statut || '').trim() ||
        String(studentFirestore?.statut || '').trim();

      // RÈGLE LOGIQUE STRICTE : Statut prend sa valeur NoSQL, si vide il devient ÉGAL à la décision
      const statutConseil = statutExtraitNoSQL || decisionConseil.decision;

      // ========================================================
      // 7. INFORMATIONS ÉTABLISSEMENT
      // ========================================================

      const nomEtablissement =
        String(
          school?.nom ||
          ''
        ).trim();

      const pays =
        String(
          school?.pays ||
          ''
        ).trim();

      const ministere =
        String(
          school?.ministere ||
          ''
        ).trim();

      const devise =
        String(
          school?.devise ||
          ''
        ).trim();

      const premierResponsable =
        String(
          school?.premierResponsable ||
          ''
        ).trim();


      // ========================================================
      // 8. MISE À JOUR DU BULLETIN SUR LA FICHE ÉLÈVE
      // ========================================================

      await updateDoc(
        studentRef,
        {
          [`bulletin_somme_t${trimestre}`]:
            Number(moyenneGenerale),

          [`bulletin_statut_t${trimestre}`]:
            'transmis_aux_parents',

          [`bulletin_envoye_parent_t${trimestre}`]:
            emailParent,

          [`bulletin_envoye_t${trimestre}`]:
            true,

          updatedAt:
            new Date().toISOString()
        }
      );


      // ========================================================
      // 9. NOTIFICATION FIRESTORE
      // ========================================================

      await addDoc(
        collection(db, 'notifications'),
        {
          schoolId:
            schoolIdPourBulletin,

          type:
            'BULLETIN_DISPONIBLE',

          titre:
            `Bulletin ${cleTrimestre} disponible`,

          message:
            `Le bulletin de ${nomEleve} est disponible.`,

          destinataireId:
            studentId,

          destinataireEmail:
            emailParent,

          eleveId:
            studentId,

          matricule:
            matricule,

          trimestre:
            Number(trimestre),

          anneeScolaire:
            anneeScolaire,

          createdAt:
            new Date().toISOString()
        }
      );


      // ========================================================
      // 10. CRÉATION DU PDF
      // ========================================================

      const docPDF =
        new jsPDF();


      // --------------------------------------------------------
      // EN-TÊTE ÉTABLISSEMENT
      // --------------------------------------------------------

      docPDF.setFont(
        'Helvetica',
        'bold'
      );

      docPDF.setFontSize(15);

      docPDF.setTextColor(
        15,
        23,
        42
      );

      docPDF.text(
        nomEtablissement,
        15,
        18
      );


      docPDF.setFont(
        'Helvetica',
        'normal'
      );

      docPDF.setFontSize(9);

      docPDF.setTextColor(
        71,
        85,
        105
      );

      let positionY = 25;


      if (pays) {
        docPDF.text(
          pays,
          15,
          positionY
        );

        positionY += 5;
      }


      if (ministere) {
        docPDF.text(
          ministere,
          15,
          positionY
        );

        positionY += 5;
      }


      if (devise) {
        docPDF.text(
          devise,
          15,
          positionY
        );

        positionY += 5;
      }


      docPDF.setDrawColor(
        226,
        232,
        240
      );

      docPDF.line(
        15,
        positionY + 2,
        195,
        positionY + 2
      );


      // --------------------------------------------------------
      // TITRE
      // --------------------------------------------------------

      positionY += 13;

      docPDF.setFont(
        'Helvetica',
        'bold'
      );

      docPDF.setFontSize(15);

      docPDF.setTextColor(
        30,
        58,
        138
      );

      const titreBulletin =
        `RELEVÉ DE NOTES - TRIMESTRE ${trimestre}`;

      docPDF.text(
        titreBulletin,
        15,
        positionY
      );


      positionY += 12;


      // --------------------------------------------------------
      // IDENTITÉ DE L'ÉLÈVE
      // --------------------------------------------------------

      docPDF.setFont(
        'Helvetica',
        'normal'
      );

      docPDF.setFontSize(10);

      docPDF.setTextColor(
        15,
        23,
        42
      );

      docPDF.text(
        `Élève : ${nomEleve}`,
        15,
        positionY
      );

      docPDF.text(
        `Matricule : ${matricule}`,
        120,
        positionY
      );

      positionY += 7;

      docPDF.text(
        `Classe : ${classe}`,
        15,
        positionY
      );

      docPDF.text(
        `Classe ID : ${classeId}`,
        120,
        positionY
      );

      positionY += 7;

      docPDF.text(
        `Promotion : ${promotion}`,
        15,
        positionY
      );

      docPDF.text(
        `Année scolaire : ${anneeScolaire}`,
        120,
        positionY
      );


      positionY += 12;


      // --------------------------------------------------------
      // TABLEAU DES MATIÈRES
      // --------------------------------------------------------

      const lignesMatieres =
        matieres.map(
          (matiere) => [
            matiere.matiere,

            matiere.professeurName,

            Number(
              matiere.coefficient || 0
            ).toString(),

            Number(
              matiere.moyenne || 0
            ).toFixed(2),

            Number(
              matiere.moyennePonderee || 0
            ).toFixed(2),

            matiere.appreciation || ''
          ]
        );


      if (lignesMatieres.length > 0) {

        autoTable(
          docPDF,
          {
            startY: positionY,

            head: [[
              'Matière',
              'Professeur',
              'Coef.',
              'Moyenne',
              'Pondérée',
              'Appréciation'
            ]],

            body:
              lignesMatieres,

            styles: {
              fontSize: 8,
              cellPadding: 3,
              textColor: [
                15,
                23,
                42
              ]
            },

            headStyles: {
              fillColor: [
                15,
                23,
                42
              ],

              textColor: [
                255,
                255,
                255
              ],

              fontStyle: 'bold'
            },

            alternateRowStyles: {
              fillColor: [
                248,
                250,
                252
              ]
            }
          }
        );

        positionY =
          docPDF.lastAutoTable.finalY + 12;

      } else {

        docPDF.setFontSize(10);

        docPDF.setTextColor(
          100,
          116,
          139
        );

        docPDF.text(
          'Aucune matière enregistrée pour cette période.',
          15,
          positionY
        );

        positionY += 15;
      }


      // --------------------------------------------------------
      // SYNTHÈSE
      // --------------------------------------------------------

      docPDF.setFont(
        'Helvetica',
        'bold'
      );

      docPDF.setFontSize(11);

      docPDF.setTextColor(
        15,
        23,
        42
      );

      docPDF.text(
        `MOYENNE GÉNÉRALE : ${Number(
          moyenneGenerale
        ).toFixed(2)}`,
        15,
        positionY
      );


      positionY += 8;


      if (professeurPrincipalNom) {
        docPDF.setFont(
          'Helvetica',
          'normal'
        );

        docPDF.setFontSize(9);

        docPDF.text(
          `Professeur principal : ${professeurPrincipalNom}`,
          15,
          positionY
        );

        positionY += 7;
      }


      if (appreciationPP) {
        docPDF.text(
          `Appréciation : ${appreciationPP}`,
          15,
          positionY
        );

        positionY += 9;
      }

               // --------------------------------------------------------
      // DÉCISION DU CONSEIL EN DIRECT (PLUS DE "EN ATTENTE" FORCE)
      // --------------------------------------------------------
      docPDF.setFont("Helvetica", "bold");
      docPDF.setFontSize(8);
      docPDF.setTextColor(14, 165, 233); // Rendu de la police en bleu ciel

      docPDF.text(`DÉCISION DU CONSEIL DE CLASSE : ${decisionConseil.decision.toUpperCase()}`, 15, positionY);
      positionY += 6;
      docPDF.text(`STATUT : ${statutConseil.toUpperCase()}`, 15, positionY);
      positionY += 6;
      
      // 🟢 RECALCULÉ : Utilise rootBlocData et ccBlocData à la place de blocTrimestre
      const vMoyenneValidee = Number(rootBlocData?.moyenneValidee || ccBlocData?.moyenneValidee || moyenneGenerale).toFixed(2);
      docPDF.text(`MOYENNE VALIDÉE : ${vMoyenneValidee} / 20`, 15, positionY);
      positionY += 10;


      // --------------------------------------------------------
      // RESPONSABLE DE L'ÉTABLISSEMENT
      // --------------------------------------------------------

      if (premierResponsable) {

        docPDF.setFont(
          'Helvetica',
          'normal'
        );

        docPDF.setFontSize(9);

        docPDF.text(
          `Responsable : ${premierResponsable}`,
          15,
          positionY
        );

        positionY += 10;
      }


      // --------------------------------------------------------
      // QR CODE
      // --------------------------------------------------------

      const qrData = JSON.stringify({
        studentId:
          studentId,

        matricule:
          matricule,

        schoolId:
          schoolIdPourBulletin,

        anneeScolaire:
          anneeScolaire,

        trimestre:
          Number(trimestre),

        moyenne:
          Number(moyenneGenerale)
      });


      const qrCodeDataUrl =
        await QRCode.toDataURL(
          qrData,
          {
            margin: 1,
            width: 100
          }
        );


      docPDF.addImage(
        qrCodeDataUrl,
        'PNG',
        155,
        positionY,
        35,
        35
      );


      docPDF.setFontSize(7);

      docPDF.setTextColor(
        100,
        116,
        139
      );

      docPDF.text(
        matricule,
        155,
        positionY + 39
      );


      // --------------------------------------------------------
      // PIED DE PAGE
      // --------------------------------------------------------

      const hauteurPage =
        docPDF.internal.pageSize.height;

      docPDF.setFontSize(7);

      docPDF.setTextColor(14, 165, 233); // Couleur bleu ciel

      docPDF.text(
        nomEtablissement,
        15,
        hauteurPage - 12
      );
       
      
     docPDF.text(
        `Trimestre ${trimestre}`,
        195,
        hauteurPage - 12,
        {
          align: 'right' 
        }
      );

      // ========================================================
// REPOSITIONNEMENT DES ÉLÉMENTS AU CENTRE DU PIED DE PAGE (NETTOYÉ)
// ========================================================
// 🟢 REPRIS : On utilise les variables déjà créées plus haut sans remettre "const"
const largeurPage = docPDF.internal.pageSize.width;

// 1. Déplacement du QR Code au centre horizontal
const qrSize = 24;
const qrX = (largeurPage / 2) - (qrSize / 2); 
const qrY = hauteurPage - 38; // Utilise la hauteurPage déjà déclarée à la ligne 1426


// 2. Légende "Edulink — Cloud Connected" centrée juste en dessous
docPDF.setFont("helvetica", "bold");
docPDF.setFontSize(6);
docPDF.setTextColor(14, 165, 233); // Couleur bleu ciel
docPDF.text(
  "Edulink — Cloud Connected — Version Logicielle : v2.0.26 ", 
  largeurPage / 2, 
  hauteurPage - 11, 
  { align: "center" }
);

// 3. Mention du Trimestre centrée tout en bas de la page
docPDF.setFont("helvetica", "bold");
docPDF.setFontSize(7);
docPDF.text(
  `Système SaaS International Intégré de Gestion Scolaire`,
  largeurPage / 2,
  hauteurPage - 8,
  { align: "center" }
);

// 3. Mention du Trimestre centrée tout en bas de la page
docPDF.setFont("helvetica", "bold");
docPDF.setFontSize(7);
docPDF.text(
  `Une seule plateforme pour connecter, suivre et sécuriser toute votre etablisement scolaire`,
  largeurPage / 2,
  hauteurPage - 4,
  { align: "center" }
);


      // ========================================================
      // 11. TRANSFORMATION PDF EN BASE64
      // ========================================================

      const base64ContenuPDF =
        docPDF.output(
          'datauristring'
        );


      // ========================================================
      // 12. ENVOI EMAIL
      // ========================================================

      /*
       * L'adresse du backend reste configurable par variable
       * d'environnement.
       *
       * Exemple Vite :
       *
       * VITE_BACKEND_URL=http://localhost:10000
       *
       * Aucun serveur SMTP ou établissement n'est écrit en dur.
       */
      const backendUrl =
        (
          import.meta.env.VITE_BACKEND_URL ||
          'http://localhost:10000'
        ).replace(
          /\/$/,
          ''
        );


      const textMessageSimple =
        [
          `Bonjour,`,

          '',

          `Le bulletin trimestriel de ${nomEleve} est disponible.`,

          `Établissement : ${nomEtablissement}`,

          classe
            ? `Classe : ${classe}`
            : '',

          anneeScolaire
            ? `Année scolaire : ${anneeScolaire}`
            : '',

          `Trimestre : ${trimestre}`,
          `Moyenne générale : ${Number(moyenneGenerale).toFixed(2)} / 20`,
          `Décision du Conseil : ${decisionConseil.decision.toUpperCase()}`,
          `Nouveau Statut Scolaire : ${statutConseil.toUpperCase()}`, // 👈 Devient égal à la décision si vide
          '',


          '',

          `Le relevé de notes officiel est joint à cet e-mail.`,

          '',

          `Cordialement,`,

          nomEtablissement
            ? `La Direction de ${nomEtablissement}`
            : 'La Direction'
        ]
          .filter(Boolean)
          .join('\n');


      console.log(
        '🚀 Envoi du bulletin vers le backend :',
        {
          studentId,
          schoolId:
            schoolIdPourBulletin,
          trimestre,
          emailParent
        }
      );


      const response =
        await fetch(
          `${backendUrl}/api/send-notification-email`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              recipients: [
                emailParent
              ],

              schoolName:
                nomEtablissement,

              title:
                `Bulletin - ${nomEleve}`,

              message:
                textMessageSimple,

              senderName:
                premierResponsable ||
                'Direction',

              type:
                'bulletin',

              appUrl:
                window.location.origin,

              attachmentData:
                base64ContenuPDF,

              attachmentName:
                `bulletin_${matricule}_t${trimestre}.pdf`
            })
          }
        );


      const dataResponse =
        await response
          .json()
          .catch(() => ({}));


      if (!response.ok) {

        console.error(
          'Réponse backend :',
          dataResponse
        );

        throw new Error(
          dataResponse?.message ||
          dataResponse?.error ||
          "Le serveur n'a pas accepté l'envoi du bulletin."
        );
      }


      console.log(
        '✔️ Bulletin transmis au backend :',
        dataResponse
      );


      // ========================================================
      // 13. CONFIRMATION
      // ========================================================

      alert(
        [
          `🚀 Bulletin du trimestre ${trimestre} traité avec succès.`,
          '',
          `Élève : ${nomEleve}`,
          `Matricule : ${matricule}`,
          `Classe : ${classe}`,
          `Moyenne : ${Number(
            moyenneGenerale
          ).toFixed(2)}`,
          '',
          `Parent : ${emailParent}`
        ].join('\n')
      );

    } catch (err) {

      console.error(
        '❌ Erreur complète bulletin :',
        err
      );

      alert(
        `❌ Impossible d'envoyer le bulletin.\n\n${err.message}`
      );

    } finally {

      setSendingId('');
    }
  };


  // ============================================================
  // FILTRAGE DES UTILISATEURS
  // ============================================================

  const fichesFiltrees =
    useMemo(() => {

      return tousUtilisateurs

        .filter((u) => {

          const role =
            String(
              u.role || ''
            )
              .trim()
              .toLowerCase();

          const estPersonnel =
            role === 'professeur' ||
            role === 'prof_principal' ||
            role === 'educateur';

          const matcheType =
            subTab === 'eleves'
              ? role === 'eleve'
              : estPersonnel;

          const nomComplet =
            `${u.nom || ''} ${
              u.prenoms || ''
            } ${
              u.matricule ||
              u.id ||
              ''
            }`
              .toLowerCase();

          return (
            matcheType &&
            nomComplet.includes(
              termeRecherche
                .toLowerCase()
                .trim()
            )
          );
        })

        .map((u) => {

          if (
            String(u.role || '')
              .toLowerCase() !==
            'eleve'
          ) {
            return {
              ...u,
              sommePoints: 0
            };
          }

          const cle =
            `notes_trimestre_${trimestreFiltre}`;

          /*
           * Priorité à la moyenne générale déjà enregistrée
           * dans Firestore.
           */
          const moyenneFirestore =
            recupererMoyenneTrimestrielle(
              u,
              trimestreFiltre
            );

          /*
           * Sinon calcul depuis les matières.
           */
          let moyenne =
            moyenneFirestore;

          if (moyenne === null) {

            const matieres =
              recupererMatieresBulletin(
                u,
                trimestreFiltre
              );

            moyenne =
              calculerMoyenneDepuisMatieres(
                matieres
              );
          }

          return {
            ...u,

            sommePoints:
              Number(
                moyenne || 0
              ),

            cleTrimestre:
              cle
          };
        });

    }, [
      tousUtilisateurs,
      subTab,
      termeRecherche,
      trimestreFiltre
    ]);

const recupererSignatureEducateurPourBulletin = async (student = {}) => {
  try {
    const schoolId = String(
      student.schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
    ).trim();

    if (!schoolId) return null;

    const educateurId =
      student.educateurId ||
      student.educateurID ||
      student.assignedEducateurId ||
      student.educateur_id ||
      '';

    const extraireSignature = (data = {}) =>
      data.signatureDessinImage ||
      data.signatureEducateur ||
      data.signature_educateur ||
      data.signatureEducateurBase64 ||
      data.signature_educateur_base64 ||
      data.signatureDessinEducateur ||
      data.signatureImage ||
      data.signatureBase64 ||
      data.signature ||
      '';

    if (educateurId) {
      const educateurSnap = await getDoc(
        doc(db, 'users', String(educateurId).trim())
      );

      if (educateurSnap.exists()) {
        const educateur = educateurSnap.data() || {};

        if (
          String(educateur.schoolId || '').trim() === schoolId &&
          ['educateur', 'educateur_principal'].includes(
            String(educateur.role || '').trim().toLowerCase()
          )
        ) {
          return extraireSignature(educateur);
        }
      }
    }

    const snapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('schoolId', '==', schoolId)
      )
    );

    const educateurs = snapshot.docs.filter((d) => {
      const data = d.data() || {};
      return ['educateur', 'educateur_principal'].includes(
        String(data.role || '').trim().toLowerCase()
      );
    });

    const classeId = String(student.classeId || '').trim().toLowerCase();
    const classe = String(
      student.classeNom || student.classe || ''
    ).trim().toLowerCase();
    const promotion = String(
      student.promotion || student.assigned_promotion || ''
    ).trim().toLowerCase();

    const educateurCorrespondant = educateurs.find((d) => {
      const data = d.data() || {};

      const classes = [
        ...(Array.isArray(data.classes) ? data.classes : []),
        data.classeId,
        data.classe,
        data.classeNom,
        data.assigned_classe,
        data.assignedClasse,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());

      const promotions = [
        ...(Array.isArray(data.promotions) ? data.promotions : []),
        data.assigned_promotion,
        data.assignedPromotion,
        data.promotion,
        data.niveau,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());

      return (
        (classeId && classes.includes(classeId)) ||
        (classe && classes.some((value) => value === classe)) ||
        (promotion && promotions.includes(promotion))
      );
    });

    if (educateurCorrespondant) {
      return extraireSignature(educateurCorrespondant.data());
    }

    const educateurAvecSignature = educateurs.find((d) =>
      Boolean(extraireSignature(d.data() || {}))
    );

    if (educateurAvecSignature) {
      return extraireSignature(educateurAvecSignature.data());
    }

    return sessionStorage.getItem('sgs_educ_canvas_img') || '';
  } catch (error) {
    console.error(
      'Erreur récupération signature éducateur pour le bulletin :',
      error
    );

    return sessionStorage.getItem('sgs_educ_canvas_img') || '';
  }
};
  // ============================================================
  // STATISTIQUES
  // ============================================================

  const totalEleves =
    statistiques.apprenants;

  const totalPersonnel =
    statistiques.personnels;

  const totalBadgesSuspendus =
    statistiques.suspendus;


  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">
        Ouverture de la console...
      </div>
    );
  }


  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="p-6 bg-white min-h-screen font-sans text-gray-700 text-left animate-fadeIn">
      <Header />
      <h2 className="direction">
        DIRECTION CENTRALISEE  DES RESSOURCES HUMAINES
      </h2>


      {/* =====================================================
          NAVIGATION
      ====================================================== */}

      <div className="blockrh">

        <div className="flex flex-wrap uppercase shadow-2xs">

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'vue_globale'
              )
            }
            className={`vueglobal-1 px-3 py-2 rounded-lg  cursor-pointer ${
              activeTab ===
              'vue_globale'
                ? 'bg-slate-900 text-orange-400 shadow-sm'
                : 'text-gray-400'
            }`}
          >
            Vue Globale & Registres
          </button>


          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'bulletins_statuts'
              )
            }
            className={`vueglobal-2 px-1 py-2 rounded-lg  cursor-pointer ${
              activeTab ===
              'bulletins_statuts'
                ? 'bg-slate-900 text-orange-400 shadow-sm'
                : ''
            }`}
          >
           Gestion des bulletins & des Statuts
          </button>


          <button
            type="button"
            onClick={() =>
              setActiveTab(
                'diffusion'
              )
            }
            className={`vueglobal-3 px-8 py-2 rounded-lg  cursor-pointer ${
              activeTab ===
              'diffusion'
                ? 'bg-slate-900 text-orange-400 shadow-sm'
                : 'text-gray-400'
            }`}
          >
            Diffusion bulletin , Convocation & Justification
          </button>


          <Link
            to="/admin/home"
            className="btn-admin-1 px-3 py-2  whitespace-nowrap self-center no-underline"
          >
            Quitter le Bureau
          </Link>
          
        </div>
      </div>

 {/* =====================================================
          MODULES EXISTANTS
      ====================================================== */}
      <div className=" pt-2 border-t border-gray-100 text-center">

                  <button
                    type="button"
                    onClick={() =>
                      setIsSignatureModalOpen(
                        true
                      )
                    }
                    className="btn-admin-2 w-full text-[10px] font-black text-purple-700 uppercase bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-xl border border-purple-200 cursor-pointer transition"
                  >
                    ✍️  Signature du proviseur
                  </button>

                </div>
      <SignaturePadModal
        isOpen={
          isSignatureModalOpen
        }
        onClose={() =>
          setIsSignatureModalOpen(
            false
          )
        }
      />
      {/* =====================================================
          ONGLETS
      ====================================================== */}

      {activeTab ===
        'bulletins_statuts' && (
        <div className="animate-fadeIn">
          <GestionStatut />
        </div>
      )}


      {activeTab ===
        'diffusion' && (
        <div className="animate-fadeIn">
          <EnvoiDocumentAdmin />
        </div>
      )}


      {/* =====================================================
          VUE GLOBALE
      ====================================================== */}

      {activeTab ===
        'vue_globale' && (

        <div className="space-y-6 animate-fadeIn">

          {/* COMPTEURS */}

          <div className="vueglobale grid grid-cols-1 sm:grid-cols-3 gap-6">

            <div className="effective  shadow-2xs">

              <p className="text-[10px] font-black uppercase text-gray-400">
                Effectif Global Apprenants
              </p>

              <p className="text-2xl text-danger font-black text-gray-900 mt-1">
                {totalEleves}

                <span className="text-xs  font-bold text-gray-400 p-2 text-danger">
                  {' '}
                  Élèves
                </span>
              </p>

            </div>


            <div className="viescolaire">

              <p className="text-[10px] font-black uppercase text-gray-400">
                Corps Pédagogique & Vie Scolaire
              </p>

              <p className="text-2xl text-danger font-black text-purple-700 mt-1">
                {totalPersonnel}

                <span className="text-xs text-danger font-bold text-gray-400">
                  {' '}
                  Membres RH
                </span>
              </p>

            </div>


            <div className="bagacces  p-2 ">

              <p className="text-[10px] font-black uppercase text-red-600">
                Badges et Accès Bloqués
              </p>

              <p className="text-2xl  text-danger font-black text-red-700 mt-1">
                {totalBadgesSuspendus}

                <span className="text-xs text-danger font-bold ">
                  {' '}
                  Fiches suspendues
                </span>
              </p>

            </div>

          </div>
          {/* =================================================
              BARRE FILTRES
          ================================================== */}

          <div className="bg-white p-4  sm:flex-row ">

            <div className=" p-1  text-xs font-bold uppercase ">

             {/*  <button
                type="button"
                onClick={() => {
                  setSubTab(
                    'promotions'
                  );

                  setEditingUser(null);
                }}
                className={`px-4 py-2 rounded-lg transition cursor-pointer text-[11px] border-0 ${
                  subTab ===
                  'promotions'
                    ? 'bg-slate-900 text-orange-400 font-black'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                👤 Listes des promotions
              </button>
            */}
              <button
                type="button"
                onClick={() => {
                  setSubTab(
                    'personnel'
                  );

                  setEditingUser(null);
                }}
                className={`vueglobal-4 px-4 py-2 rounded-lg transition cursor-pointer text-[11px] border-0 ${
                  subTab ===
                  'personnel'
                    ? 'bg-slate-900 text-orange-400 font-black'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Personnels & RH
              </button>


              {(isSuperAdminLuhamcode ||
                String(
                  user?.role
                )
                  .trim()
                  .toLowerCase() ===
                  'super_admin') && (

                <button
                  type="button"
                  onClick={() => {
                    setSubTab(
                      'luhamcode_admin_fix'
                    );

                    setEditingUser(null);
                  }}
                  className={`vueglobal-5 px-4 py-2 rounded-lg cursor-pointer font-black text-[11px] border-0 ${
                    subTab ===
                    'luhamcode_admin_fix'
                      ? 'bg-orange-600  animate-pulse shadow-sm'
                      : 'text-orange-500 bg-orange-50'
                  }`}
                >
                 Maintenance des classes
                </button>

              )}
            <Link
            to="/admin/modifier-un-statut"
            className="vueglobal-6 px-8 py-2 border rounded-lg  cursor-pointer bg-orange-60"
            >
             Mise à jour de Statut du personnel
            </Link>

            <Link
             to="/admin/message-reçu"
             className="vueglobal-11 px-3 py-2 border rounded-lg  cursor-pointer bg-orange-60"
             >
              Boite des reception
             </Link>

             <Link
             to="/admin/gestion-des-profil"
              className="vueglobal-8 px-8 py-2 border rounded-lg  cursor-pointer bg-orange-60"
              >
               Fiches & Modification des Statuts
              </Link>

              <Link
               to="/admin/base-centralise"
               className="vueglobal-9 px-3 py-2 border rounded-lg  "
               >
                Base de Données Centrale
               </Link>

               <Link
               to="/admin/Rechercher-un-eleve"
               className="vueglobal-7 px-8 py-2 border rounded-lg  cursor-pointer bg-orange-60"
               >
               Rechercher un eleve
               </Link>
            </div>

             <Link
               to="/admin/nouveau-message"
               className="vueglobal-10 px-3 py-2 border rounded-lg  cursor-pointer bg-orange-60"
               >
               Nouveau nessage reçu
               </Link>

            {/* TRIMESTRE */}

            {subTab ===
              'eleves' && (

              <div className="periode flex items-center gap-2">

                <span className="text-[16px]  text-gray-400 uppercase tracking-tight">
                  Période :
                </span>

                <select
                  value={
                    trimestreFiltre
                  }
                  onChange={(e) =>
                    setTrimestreFiltre(
                      e.target.value
                    )
                  }
                  className=" Trimestre bg-gray-50 border text-danger bolder p-1.5 text-xs font-black rounded-lg cursor-pointer outline-none"
                >
                  <option value="1">
                    1er Trimestre
                  </option>

                  <option value="2">
                    2ème Trimestre
                  </option>

                  <option value="3">
                    3ème Trimestre
                  </option>
                </select>

              </div>

            )}


            {/* RECHERCHE */}

            {subTab !==
              'luhamcode_admin_fix' &&
              subTab !==
                'promotions' && (

              <input
                type="text"
                placeholder="Rechercher par nom, prénom ou matricule..."
                value={
                  termeRecherche
                }
                onChange={(e) =>
                  setTermeRecherche(
                    e.target.value
                  )
                }
                className="recherche form-control w-full sm:max-w-md bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold text-gray-800 focus:ring-2 focus:ring-orange-500"
              />

            )}

          </div>


          {/* =================================================
              PROMOTIONS
          ================================================== */}

          {String(subTab)
            .trim()
            .toLowerCase() ===
          'promotions' ? (

            <div className="bg-white rounded-2xl border shadow-sm p-2 animate-fadeIn">
              <ListePromotion />
            </div>

          ) : String(subTab)
              .trim()
              .toLowerCase() ===
              'luhamcode_admin_fix' &&
            (
              isSuperAdminLuhamcode ||
              String(user?.role)
                .trim()
                .toLowerCase() ===
                'super_admin'
            ) ? (

            /* =================================================
               MAINTENANCE
            ================================================== */

            <div className="bg-white rounded-2xl border border-orange-200 p-6 shadow-sm space-y-4 animate-fadeIn">

              <div className="border-b border-orange-100 pb-3 text-left">

                <span className="text-[10px] font-black uppercase bg-orange-600  px-2 py-0.5 rounded font-mono">
                  Luhamcode Administration Engine
                </span>

                <h3 className="text-base font-black text-slate-900 uppercase mt-2">
                  🛠️ Outil de correction des classes
                </h3>

                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Outil de maintenance permettant de corriger les identifiants de classes enregistrés dans Firestore.
                </p>

              </div>


              <form
                onSubmit={
                  handleLancerMaintenanceClassesAdmin
                }
                className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end text-xs font-bold text-gray-700 text-left"
              >

                <div>

                  <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">
                    Identifiant erroné
                  </label>

                  <input
                    type="text"
                    value={
                      classeErronee
                    }
                    onChange={(e) =>
                      setClasseErronee(
                        e.target.value
                      )
                    }
                    className="w-full bg-gray-50 border border-red-200 p-3 rounded-xl outline-none font-mono text-red-700"
                    required
                  />

                </div>


                <div>

                  <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">
                    Identifiant corrigé
                  </label>

                  <input
                    type="text"
                    value={
                      classeCorrigee
                    }
                    onChange={(e) =>
                      setClasseCorrigee(
                        e.target.value
                      )
                    }
                    className="w-full bg-gray-50 border border-green-200 p-3 rounded-xl outline-none font-mono text-green-700"
                    required
                  />

                </div>


                <div>

                  <button
                    type="submit"
                    disabled={
                      isFixing
                    }
                    className="w-full bg-orange-600 hover:bg-orange-700  font-black py-3.5 rounded-xl uppercase tracking-wider transition cursor-pointer border-0 shadow-sm disabled:bg-gray-200"
                  >
                    {isFixing
                      ? 'Migration Firestore...'
                      : '⚡ Exécuter la correction'}
                  </button>

                </div>

              </form>

            </div>

          ) : (

            /* =================================================
               REGISTRE
            ================================================== */

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">

              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                <div className="table overflow-x-auto">

                  <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">

                    <thead>

                      <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100 text-[10px] tracking-wider">

                        <th className="text-success p-3">
                          Matricule / ID
                        </th>

                        {subTab ===
                          'eleves' && (
                          <th className="text-info p-3">
                            Classe
                          </th>
                        )}

                        {subTab ===
                          'personnel' && (
                          <th className="text-warning p-3">
                            Spécialité
                          </th>
                        )}

                        <th className="p-3">
                          Nom complet
                        </th>

                        <th className="text-danger p-3 text-center">
                          Moyenne
                        </th>

                        <th className="p-3 text-center">
                          Fiche statut
                        </th>

                        <th className="p-3 text-right text-danger">
                          Actions
                        </th>

                      </tr>

                    </thead>


                    <tbody className="divide-y divide-gray-100 bg-white font-bold text-[11px]">

                      {fichesFiltrees.length ===
                      0 ? (

                        <tr>

                          <td
                            colSpan="7"
                            className="p-12 text-center text-gray-400 italic font-medium"
                          >
                            Aucun profil correspondant.
                          </td>

                        </tr>

                      ) : (

                        fichesFiltrees.map(
                          (u) => {

                            const estActif =
                              u.statut ===
                                'actif' ||
                              !u.statut;

                            return (

                              <tr
                                key={u.id}
                                className="border-b border-gray-100 hover:bg-gray-50/50 transition"
                              >

                                <td className="p-3 font-mono text-gray-400 text-[11px] uppercase">
                                  {u.matricule ||
                                    u.id}
                                </td>


                                {subTab ===
                                  'eleves' && (

                                  <td className="p-3 font-mono text-purple-700 uppercase font-black">
                                    {u.classeNom ||
                                      u.classe ||
                                      'N/A'}
                                  </td>

                                )}


                                {subTab ===
                                  'personnel' && (

                                  <td className="p-3 text-gray-500 uppercase text-[10px]">
                                    {u.matiereEnseignee ||
                                      u.role ||
                                      'Général'}
                                  </td>

                                )}


                                <td className="p-3 text-slate-900 uppercase font-black">

                                  {u.nom || ''}{' '}

                                  {u.prenoms ||
                                    u.prenom ||
                                    ''}

                                </td>


                                <td className="p-3 text-center font-mono text-slate-900">

                                  {subTab ===
                                  'eleves' ? (

                                    <span className="text-sm font-black text-slate-950">

                                      {Number(
                                        u.sommePoints ||
                                          0
                                      ).toFixed(2)}

                                    </span>

                                  ) : (

                                    <span className="text-gray-300">
                                      —
                                    </span>

                                  )}

                                </td>


                                <td className="p-3 text-center">

                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                      estActif
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {u.statut ||
                                      'actif'}
                                  </span>

                                </td>


                                <td className="p-3 text-right space-x-1.5 whitespace-nowrap">

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUser(
                                        u
                                      );

                                      setEditNom(
                                        u.nom ||
                                          ''
                                      );

                                      setEditPrenoms(
                                        u.prenoms ||
                                          u.prenom ||
                                          ''
                                      );
                                    }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded font-black text-[10px] uppercase cursor-pointer border-0"
                                  >
                                    ✏️ Éditer
                                  </button>


                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleBasculerStatutBadge(
                                        u.id,
                                        u.statut ||
                                          'actif'
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded font-black text-[10px] uppercase cursor-pointer border-0  ${
                                      estActif
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                  >
                                    {estActif
                                      ? '🔒 Suspendre'
                                      : '🔓 Activer'}
                                  </button>


                                  {subTab ===
                                    'eleves' && (

                                    <button
                                      type="button"
                                      disabled={
                                        sendingId ===
                                        u.id
                                      }
                                      onClick={() =>
                                        handleDeclencherEnvoiBulletin(
                                          u
                                        )
                                      }
                                      className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-[10px] uppercase px-2.5 py-1 rounded cursor-pointer border-0 transition disabled:bg-gray-100 disabled:text-gray-400"
                                    >
                                      {sendingId ===
                                      u.id
                                        ? 'Envoi...'
                                        : '🚀 Envoyer Bulletin'}
                                    </button>

                                  )}

                                </td>

                              </tr>

                            );
                          }
                        )

                      )}

                    </tbody>

                  </table>

                </div>

              </div>


              {/* =================================================
                  PANNEAU RECTIFICATION
              ================================================== */}

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">

                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">
                  Panneau de Rectification
                </h3>


                {editingUser ? (

                  <form
                    onSubmit={
                      handleRectifierIdentite
                    }
                    className="space-y-4 text-xs font-bold text-gray-700 text-left"
                  >

                    <p className="text-[10px] text-purple-600 font-mono">
                      Fiche cible :{' '}
                      {editingUser.id}
                    </p>


                    <div>

                      <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">
                        Nom de famille
                      </label>

                      <input
                        type="text"
                        value={editNom}
                        onChange={(e) =>
                          setEditNom(
                            e.target.value
                          )
                        }
                        className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl outline-none uppercase font-black"
                        required
                      />

                    </div>


                    <div>

                      <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">
                        Prénoms
                      </label>

                      <input
                        type="text"
                        value={
                          editPrenoms
                        }
                        onChange={(e) =>
                          setEditPrenoms(
                            e.target.value
                          )
                        }
                        className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl outline-none font-bold"
                        required
                      />

                    </div>


                    <div className="flex gap-2 pt-2">

                      <button
                        type="button"
                        onClick={() =>
                          setEditingUser(
                            null
                          )
                        }
                        className="flex-1 bg-gray-100 border border-gray-200 py-2 rounded-xl text-[10px] cursor-pointer"
                      >
                        Annuler
                      </button>


                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 bg-purple-600  py-2 rounded-xl text-[10px] border-0 cursor-pointer disabled:bg-gray-200"
                      >
                        {saving
                          ? 'Sauvegarde...'
                          : 'Sauvegarder'}
                      </button>

                    </div>

                  </form>

                ) : (

                  <p className="text-center py-12 text-gray-400 italic text-[11px] bg-gray-50/50 border border-dashed rounded-xl border-gray-200">
                    Sélectionnez un profil dans le registre.
                  </p>

                )}


                {/* SIGNATURE */}

                

              </div>

            </div>

          )}

        </div>

      )}
    </div>
  );
};


export default DashboardAdmin;