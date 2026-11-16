// src/features/professeur/pages/assiduite/RegistreAppelEleves.jsx

import React, {
  useState,
  useEffect,
  useMemo,
} from 'react';

import { db } from '../../../../services/api';

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../../../../pages/Header';


const RegistreAppelEleves = () => {

  const {
    user,
    schoolId,
    schoolName,
  } = useAuth();


  // ============================================================
  // CONFIGURATION DYNAMIQUE
  // ============================================================

  const currentSchool = useMemo(() => {
    return String(
      user?.schoolId ||
      schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
    )
      .trim()
      .toLowerCase();
  }, [
    user?.schoolId,
    schoolId,
  ]);


  const monIdProf = useMemo(() => {
    return String(
      user?.id ||
      user?.matricule ||
      user?.uid ||
      ''
    ).trim();
  }, [
    user?.id,
    user?.matricule,
    user?.uid,
  ]);


  const nomEnseignant = useMemo(() => {

    const nom =
      user?.nom ||
      user?.lastName ||
      '';

    const prenoms =
      user?.prenoms ||
      user?.prenom ||
      user?.firstName ||
      '';

    const nomComplet =
      `${nom} ${prenoms}`.trim();

    return (
      nomComplet ||
      user?.name ||
      user?.displayName ||
      ''
    );

  }, [
    user,
  ]);


  const disciplineProf = useMemo(() => {
    return String(
      user?.matiereEnseignee ||
      user?.matiere ||
      ''
    ).trim();
  }, [
    user?.matiereEnseignee,
    user?.matiere,
  ]);


  // ============================================================
  // URL DU SERVEUR
  //
  // AUCUNE URL EN DUR.
  //
  // .env :
  // VITE_API_URL=http://localhost:10000
  // ============================================================

  const API_BASE_URL = useMemo(() => {

    return String(
      import.meta.env.VITE_API_URL ||
      ''
    )
      .trim()
      .replace(/\/+$/, '');

  }, []);


  // ============================================================
  // ETATS
  // ============================================================

  const [
    listeClassesAutorisees,
    setListeClassesAutorisees,
  ] = useState([]);


  const [
    classeCibleActive,
    setClasseCibleActive,
  ] = useState('');


  const [
    classeNomAffiche,
    setClasseNomAffiche,
  ] = useState('');


  const [
    matiereActive,
    setMatiereActive,
  ] = useState(disciplineProf);


  const [
    listeEleves,
    setListeEleves,
  ] = useState([]);


  const [
    trimestreActif,
    setTrimestreActif,
  ] = useState('');


  const [
    anneeScolaire,
    setAnneeScolaire,
  ] = useState('');


  const [
    registrePresences,
    setRegistrePresences,
  ] = useState({});


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);


  // ============================================================
  // JOUR COURANT
  // ============================================================

  const jourAujourdhui = useMemo(() => {

    const joursFR = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];

    return joursFR[
      new Date().getDay()
    ];

  }, []);


  // ============================================================
  // 1. RECUPERATION DE L'EMPLOI DU TEMPS
  //
  // Aucun professeur / classe / matière en dur.
  // ============================================================

  useEffect(() => {

    if (
      !currentSchool ||
      !monIdProf
    ) {
      setListeClassesAutorisees([]);
      setClasseCibleActive('');
      setClasseNomAffiche('');
      setMatiereActive('');
      setLoading(false);

      return undefined;
    }


    setLoading(true);


    const qEDT = query(
      collection(
        db,
        'emplois_du_temps'
      ),
      where(
        'schoolId',
        '==',
        currentSchool
      )
    );


    const unsubEDT = onSnapshot(
      qEDT,

      (snap) => {

        const mapClassesFiltrees = {};


        snap.forEach((docSnap) => {

          const data =
            docSnap.data() || {};


          if (
            !Array.isArray(
              data?.creneaux
            )
          ) {
            return;
          }


          data.creneaux.forEach(
            (creneau) => {

              const professeurCreneau =
                String(
                  creneau?.professeurId ||
                  creneau?.profId ||
                  creneau?.enseignantId ||
                  ''
                )
                  .trim()
                  .toLowerCase();


              if (
                professeurCreneau !==
                monIdProf
                  .trim()
                  .toLowerCase()
              ) {
                return;
              }


              const targetClassId =
                creneau?.classeId ||
                data?.classeId ||
                data?.idClasse ||
                '';


              if (!targetClassId) {
                return;
              }


              const targetClassName =
                creneau?.nomClasse ||
                creneau?.classeNom ||
                data?.classeNom ||
                data?.nomClasse ||
                data?.classe ||
                '';


              const matiere =
                creneau?.matiere ||
                creneau?.discipline ||
                data?.matiere ||
                data?.discipline ||
                disciplineProf ||
                '';


              mapClassesFiltrees[
                targetClassId
              ] = {

                id:
                  targetClassId,

                nom:
                  targetClassName,

                matiere,

                jour:
                  creneau?.jour ||
                  creneau?.jourSemaine ||
                  '',

                heureDebut:
                  creneau?.heureDebut ||
                  creneau?.debut ||
                  '',

                heureFin:
                  creneau?.heureFin ||
                  creneau?.fin ||
                  '',

              };

            }
          );

        });


        const resultatsFinaux =
          Object.values(
            mapClassesFiltrees
          ).sort(
            (a, b) =>
              String(a.nom).localeCompare(
                String(b.nom),
                'fr',
                {
                  sensitivity: 'base',
                }
              )
          );


        setListeClassesAutorisees(
          resultatsFinaux
        );


        // --------------------------------------------------------
        // CONSERVATION DE LA CLASSE ACTUELLE
        // --------------------------------------------------------

        setClasseCibleActive(
          (ancienneClasse) => {

            const existe =
              ancienneClasse &&
              resultatsFinaux.some(
                (classe) =>
                  String(classe.id) ===
                  String(ancienneClasse)
              );


            if (existe) {
              return ancienneClasse;
            }


            return (
              resultatsFinaux[0]?.id ||
              ''
            );

          }
        );


        // --------------------------------------------------------
        // INFOS DE LA CLASSE ACTIVE
        // --------------------------------------------------------

        setClasseNomAffiche(
          (ancienneNom) => {

            if (
              ancienneNom &&
              resultatsFinaux.some(
                (classe) =>
                  String(classe.nom) ===
                  String(ancienneNom)
              )
            ) {
              return ancienneNom;
            }

            return (
              resultatsFinaux[0]?.nom ||
              ''
            );

          }
        );


        setMatiereActive(
          (ancienneMatiere) => {

            if (ancienneMatiere) {
              return ancienneMatiere;
            }

            return (
              resultatsFinaux[0]?.matiere ||
              disciplineProf ||
              ''
            );

          }
        );


        setLoading(false);

      },

      (err) => {

        console.error(
          'Erreur emploi du temps :',
          err
        );

        setListeClassesAutorisees([]);
        setClasseCibleActive('');
        setClasseNomAffiche('');
        setMatiereActive('');

        setLoading(false);

      }
    );


    return () => unsubEDT();

  }, [
    currentSchool,
    monIdProf,
    disciplineProf,
  ]);


  // ============================================================
  // 2. RECUPERATION DES ELEVES
  // ============================================================

  useEffect(() => {

    if (
      !currentSchool ||
      !classeCibleActive
    ) {
      setListeEleves([]);
      setRegistrePresences({});

      return undefined;
    }


    setLoading(true);


    const qEleves = query(
      collection(
        db,
        'users'
      ),
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
        classeCibleActive
      )
    );


    const unsubEleves = onSnapshot(
      qEleves,

      (snap) => {

        const list = [];
        const initialStates = {};


        snap.forEach(
          (docSnap) => {

            const data =
              docSnap.data() || {};


            const eleve = {
              id:
                docSnap.id,

              ...data,
            };


            list.push(
              eleve
            );


            initialStates[
              docSnap.id
            ] = 'present';

          }
        );


        list.sort(
          (a, b) =>
            String(
              a.nom || ''
            ).localeCompare(
              String(
                b.nom || ''
              ),
              'fr',
              {
                sensitivity: 'base',
              }
            )
        );


        setListeEleves(
          list
        );


        setRegistrePresences(
          initialStates
        );


        setLoading(false);

      },

      (error) => {

        console.error(
          'Erreur écoute élèves :',
          error
        );

        setListeEleves([]);
        setRegistrePresences({});

        setLoading(false);

      }
    );


    return () => unsubEleves();

  }, [
    currentSchool,
    classeCibleActive,
  ]);


  // ============================================================
  // 3. RECUPERATION DYNAMIQUE DE L'ECOLE
  // ============================================================

  useEffect(() => {

    if (!currentSchool) {
      setTrimestreActif('');
      setAnneeScolaire('');

      return undefined;
    }


    const schoolRef =
      doc(
        db,
        'schools',
        currentSchool
      );


    const unsubSchool =
      onSnapshot(
        schoolRef,

        (docSnap) => {

          if (!docSnap.exists()) {
            setTrimestreActif('');
            setAnneeScolaire('');

            return;
          }


          const data =
            docSnap.data() || {};


          setTrimestreActif(
            String(
              data?.trimestreActif ||
              data?.trimestre ||
              data?.trimestreEnCours ||
              ''
            ).trim()
          );


          setAnneeScolaire(
            String(
              data?.anneeScolaire ||
              data?.anneeAcademique ||
              ''
            ).trim()
          );

        },

        (error) => {

          console.error(
            'Erreur récupération école :',
            error
          );

        }
      );


    return () => unsubSchool();

  }, [
    currentSchool,
  ]);


  // ============================================================
  // CHANGEMENT DE CLASSE
  // ============================================================

  const handleChangerClasseSelectionnee = (
    e
  ) => {

    const selectedId =
      String(
        e.target.value || ''
      ).trim();


    setClasseCibleActive(
      selectedId
    );


    const classObj =
      listeClassesAutorisees.find(
        (c) =>
          String(c.id) ===
          selectedId
      );


    if (classObj) {

      setClasseNomAffiche(
        String(
          classObj.nom || ''
        ).trim()
      );


      setMatiereActive(
        String(
          classObj.matiere || ''
        ).trim()
      );

    } else {

      setClasseNomAffiche('');
      setMatiereActive('');

    }

  };


  // ============================================================
  // CHANGEMENT DE STATUT
  // ============================================================

  const handleChangerStatutPresences = (
    eleveId,
    nouvelEtat
  ) => {

    setRegistrePresences(
      (prev) => ({
        ...prev,
        [eleveId]:
          nouvelEtat,
      })
    );

  };


  // ============================================================
  // RECUPERATION DU NOM COMPLET
  // ============================================================

  const obtenirNomCompletEleve = (
    eleve
  ) => {

    const nom =
      String(
        eleve?.nom ||
        ''
      ).trim();


    const prenoms =
      String(
        eleve?.prenoms ||
        eleve?.prenom ||
        ''
      ).trim();


    return `${nom} ${prenoms}`
      .trim()
      .toUpperCase();

  };


  // ============================================================
  // RECHERCHE DU COMPTE PARENT
  //
  // L'élève possède emailParent.
  // Si un compte parent existe dans users avec ce mail,
  // on récupère son document.
  // ============================================================

  const recupererCompteParent = async (
    emailParent
  ) => {

    const email =
      String(
        emailParent || ''
      )
        .trim()
        .toLowerCase();


    if (!email) {
      return null;
    }


    const qParent = query(
      collection(
        db,
        'users'
      ),
      where(
        'schoolId',
        '==',
        currentSchool
      ),
      where(
        'email',
        '==',
        email
      )
    );


    const snap =
      await getDocs(
        qParent
      );


    if (
      snap.empty
    ) {
      return null;
    }


    const parentDoc =
      snap.docs[0];


    return {
      id:
        parentDoc.id,

      ...parentDoc.data(),
    };

  };


  // ============================================================
  // ENVOI EMAIL PARENT
  //
  // AUCUNE ADRESSE EN DUR.
  // ============================================================

  const envoyerEmailAlerteAbsence = async ({
    emailParent,
    nomEleve,
    prenomsEleve,
    classe,
    dateAbsence,
    motif,
  }) => {

    const email =
      String(
        emailParent || ''
      )
        .trim()
        .toLowerCase();


    if (!email) {

      return {
        success: false,
        skipped: true,
        reason:
          'email_parent_absent',
      };

    }


    if (!API_BASE_URL) {

      console.warn(
        'VITE_API_URL n’est pas configurée. Email parent non envoyé.'
      );


      return {
        success: false,
        skipped: true,
        reason:
          'api_url_absente',
      };

    }


    const response =
      await fetch(
        `${API_BASE_URL}/api/send-parent-absence-alert`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({

              emailParent:
                email,

              nomEleve:
                nomEleve || '',

              prenomsEleve:
                prenomsEleve || '',

              classe:
                classe || '',

              dateAbsence:
                dateAbsence || '',

              motif:
                motif || '',

            }),
        }
      );


    const result =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (!response.ok) {

      throw new Error(
        result?.message ||
        `Erreur serveur ${response.status}`
      );

    }


    return result;

  };


  // ============================================================
  // CREATION DE LA NOTIFICATION FIRESTORE PARENT
  //
  // Si le parent possède un compte users.
  // ============================================================

  const creerNotificationParent = async ({
    eleve,
    parent,
    classe,
    dateAbsence,
    nombreAbsences,
  }) => {

    if (!parent?.id) {
      return false;
    }


    const nomEleve =
      obtenirNomCompletEleve(
        eleve
      );


    const parentNom =
      String(
        parent?.nom ||
        parent?.name ||
        parent?.displayName ||
        parent?.prenoms ||
        ''
      ).trim();


    await addDoc(
      collection(
        db,
        'notifications'
      ),
      {

        schoolId:
          currentSchool,

        expediteurId:
          monIdProf,

        expediteurNom:
          nomEnseignant,

        expediteurRole:
          String(
            user?.role || ''
          ).trim(),

        expediteurClasseId:
          classeCibleActive,

        expediteurClasse:
          classe,

        expediteurPromotion:
          String(
            eleve?.promotion ||
            user?.promotion ||
            ''
          ).trim(),

        destinataireId:
          parent.id,

        destinataireNom:
          parentNom,

        destinataireRole:
          String(
            parent?.role ||
            'parent'
          ).trim(),

        destinataireEmail:
          String(
            parent?.email ||
            eleve?.emailParent ||
            ''
          )
            .trim()
            .toLowerCase(),

        eleveId:
          eleve.id,

        eleveNom:
          nomEleve,

        classeId:
          String(
            eleve?.classeId ||
            classeCibleActive ||
            ''
          ).trim(),

        classe:
          classe,

        promotion:
          String(
            eleve?.promotion ||
            ''
          ).trim(),

        titre:
          'Alerte assiduité',

        message:
          `L'élève ${nomEleve} a dépassé le seuil de 3 heures d'absence. Le cumul enregistré est de ${nombreAbsences} heure(s).`,

        cible:
          'parent',

        type:
          'alerte_absence',

        statut:
          'non_lue',

        lu:
          false,

        motif:
          'Seuil de 3 heures d’absence dépassé.',

        dateAbsence:
          dateAbsence,

        nombreAbsences:
          nombreAbsences,

        trimestre:
          trimestreActif,

        anneeScolaire:
          anneeScolaire,

        masquePour:
          [],

        createdAt:
          serverTimestamp(),

      }
    );


    return true;

  };


  // ============================================================
  // DECLENCHEMENT DE L'ABSENCE
  //
  // IMPORTANT :
  //
  // Le compteur actuel du projet est en heures :
  // une absence validée = +1.
  //
  // Le seuil demandé est strictement > 3.
  // Donc :
  //
  // 1 H -> rien
  // 2 H -> rien
  // 3 H -> rien
  // 4 H -> alerte
  //
  // La transaction protège le passage du seuil contre
  // les écritures concurrentes.
  // ============================================================

  const traiterAbsenceEleve = async (
    eleve
  ) => {

    if (!eleve?.id) {
      return {
        alertNeeded: false,
      };
    }


    const eleveRef =
      doc(
        db,
        'users',
        eleve.id
      );


    const resultat =
      await runTransaction(
        db,
        async (transaction) => {

          const snap =
            await transaction.get(
              eleveRef
            );


          if (!snap.exists()) {

            throw new Error(
              `La fiche élève ${eleve.id} n'existe plus.`
            );

          }


          const data =
            snap.data() || {};


          const absencesAvant =
            Number(
              data?.absences || 0
            );


          const absencesApres =
            absencesAvant + 1;


          const alerteDejaEnvoyee =
            Boolean(
              data?.absenceAlerte3hEnvoyee
            );


          const depasseSeuil =
            absencesApres > 3;


          const doitAlerter =
            depasseSeuil &&
            !alerteDejaEnvoyee;


          const updates = {

            absences:
              absencesApres,

            updatedAt:
              serverTimestamp(),

          };


          if (doitAlerter) {

            updates.absenceAlerte3hEnvoyee =
              true;

            updates.absenceAlerte3hValeur =
              absencesApres;

            updates.absenceAlerte3hDate =
              serverTimestamp();

          }


          transaction.update(
            eleveRef,
            updates
          );


          return {

            doitAlerter,

            absencesAvant,

            absencesApres,

            emailParent:
              String(
                data?.emailParent ||
                ''
              ).trim(),

            nom:
              String(
                data?.nom ||
                ''
              ).trim(),

            prenoms:
              String(
                data?.prenoms ||
                data?.prenom ||
                ''
              ).trim(),

            classeId:
              String(
                data?.classeId ||
                ''
              ).trim(),

            classeNom:
              String(
                data?.classeNom ||
                data?.classe ||
                ''
              ).trim(),

            promotion:
              String(
                data?.promotion ||
                ''
              ).trim(),

            schoolId:
              String(
                data?.schoolId ||
                currentSchool
              ).trim(),

          };

        }
      );


    return resultat;

  };


  // ============================================================
  // VALIDATION DE LA FICHE D'APPEL
  // ============================================================

  const handleValiderFicheAppel = async (
    e
  ) => {

    e.preventDefault();


    if (
      !currentSchool
    ) {

      alert(
        "❌ L'établissement connecté est introuvable."
      );

      return;
    }


    if (
      !monIdProf
    ) {

      alert(
        "❌ L'identifiant de l'enseignant connecté est introuvable."
      );

      return;
    }


    if (
      !classeCibleActive
    ) {

      alert(
        "❌ Aucune classe valide n'est sélectionnée."
      );

      return;
    }


    if (
      !listeEleves.length
    ) {

      alert(
        "❌ Validation impossible : la liste d'appel est vide."
      );

      return;
    }


    if (
      !matiereActive
    ) {

      alert(
        "❌ La matière du cours n'a pas pu être récupérée depuis l'emploi du temps."
      );

      return;
    }


    setIsSubmitting(true);


    try {

      // ========================================================
      // PREPARATION DE L'APPEL
      // ========================================================

      const tableauNomsAbsents = [];
      const tableauNomsRetards = [];
      const listeElevesAbsents = [];


      listeEleves.forEach(
        (eleve) => {

          const etatEleve =
            registrePresences[
              eleve.id
            ] ||
            'present';


          const nomComplet =
            obtenirNomCompletEleve(
              eleve
            );


          if (
            etatEleve ===
            'absent'
          ) {

            tableauNomsAbsents.push(
              nomComplet
            );


            listeElevesAbsents.push(
              eleve
            );

          }


          if (
            etatEleve ===
            'retard'
          ) {

            tableauNomsRetards.push(
              nomComplet
            );

          }

        }
      );
    

      // ========================================================
      // DATE / HEURE
      // ========================================================

      const maintenant =
        new Date();


      const dateAujourdhui =
        maintenant.toLocaleDateString(
          'fr-FR'
        );


      const heureActuelle =
        maintenant.toLocaleTimeString(
          'fr-FR',
          {
            hour:
              '2-digit',

            minute:
              '2-digit',
          }
        );


      // ========================================================
      // DONNEES DYNAMIQUES DU COURS
      // ========================================================

      const classeSelectionnee =
        listeClassesAutorisees.find(
          (classe) =>
            String(
              classe.id
            ) ===
            String(
              classeCibleActive
            )
        );


      const nomClasseFinal =
        String(
          classeSelectionnee?.nom ||
          classeNomAffiche ||
          listeEleves[0]?.classeNom ||
          listeEleves[0]?.classe ||
          ''
        ).trim();


      const promotionFinale =
        String(
          user?.assigned_promotion ||
          user?.promotion ||
          listeEleves[0]?.promotion ||
          ''
        ).trim();


      // ========================================================
      // 1. ENREGISTREMENT DU REGISTRE D'APPEL
      // ========================================================

      await addDoc(
        collection(
          db,
          'registre_appels'
        ),
        {

          schoolId:
            currentSchool,

          classeId:
            classeCibleActive,

          classeNom:
            nomClasseFinal,

          promotion:
            promotionFinale,

          matiere:
            matiereActive,

          professeurId:
            monIdProf,

          professeurNom:
            nomEnseignant,

          jour:
            jourAujourdhui,

          date:
            dateAujourdhui,

          heureArrivee:
            heureActuelle,

          createdAt:
            serverTimestamp(),

          elevesAbsents:
            tableauNomsAbsents,

          elevesRetards:
            tableauNomsRetards,

          trimestre:
            trimestreActif,

          anneeScolaire:
            anneeScolaire,

          nombreAbsents:
            tableauNomsAbsents.length,

          nombreRetards:
            tableauNomsRetards.length,

        }
      );


      // ========================================================
      // 2. TRAITEMENT DES ABSENCES
      // ========================================================

      const alertesAEnvoyer = [];


      for (
        const eleve
        of listeElevesAbsents
      ) {

        const resultat =
          await traiterAbsenceEleve(
            eleve
          );


        if (
          resultat?.doitAlerter
        ) {

          alertesAEnvoyer.push({

            eleveId:
              eleve.id,

            emailParent:
              resultat.emailParent,

            nom:
              resultat.nom,

            prenoms:
              resultat.prenoms,

            classeNom:
              resultat.classeNom ||
              nomClasseFinal,

            classeId:
              resultat.classeId ||
              classeCibleActive,

            promotion:
              resultat.promotion ||
              promotionFinale,

            nombreAbsences:
              resultat.absencesApres,

          });

        }

      }


      // ========================================================
      // 3. ALERTES PARENTS
      // ========================================================

      let nombreEmailsEnvoyes = 0;
      let nombreNotificationsCreees = 0;


      for (
        const alerte
        of alertesAEnvoyer
      ) {

        const eleveSource =
          listeEleves.find(
            (eleve) =>
              String(
                eleve.id
              ) ===
              String(
                alerte.eleveId
              )
          );


        const emailParent =
          String(
            alerte.emailParent ||
            eleveSource?.emailParent ||
            ''
          )
            .trim()
            .toLowerCase();


        const nomEleve =
          String(
            alerte.nom ||
            eleveSource?.nom ||
            ''
          ).trim();


        const prenomsEleve =
          String(
            alerte.prenoms ||
            eleveSource?.prenoms ||
            eleveSource?.prenom ||
            ''
          ).trim();


        const classe =
          String(
            alerte.classeNom ||
            eleveSource?.classeNom ||
            eleveSource?.classe ||
            nomClasseFinal ||
            ''
          ).trim();


        // ------------------------------------------------------
        // EMAIL
        // ------------------------------------------------------

        try {

          const emailResult =
            await envoyerEmailAlerteAbsence({
              emailParent,

              nomEleve,

              prenomsEleve,

              classe,

              dateAbsence:
                dateAujourdhui,

              motif:
                `Seuil de 3 heures d'absence dépassé. Cumul : ${alerte.nombreAbsences} heure(s).`,
            });


          if (
            emailResult?.success
          ) {

            nombreEmailsEnvoyes++;

          }

        } catch (emailError) {

          console.error(
            'Erreur envoi email parent :',
            emailError
          );

        }


        // ------------------------------------------------------
        // NOTIFICATION DANS EDULINK
        // ------------------------------------------------------

        try {

          if (
            emailParent
          ) {

            const parent =
              await recupererCompteParent(
                emailParent
              );


            if (parent) {

              const creee =
                await creerNotificationParent({
                  eleve:
                    eleveSource || {
                      id:
                        alerte.eleveId,

                      nom:
                        nomEleve,

                      prenoms:
                        prenomsEleve,

                      classeId:
                        alerte.classeId,

                      classeNom:
                        classe,

                      promotion:
                        alerte.promotion,

                    },

                  parent,

                  classe,

                  dateAbsence:
                    dateAujourdhui,

                  nombreAbsences:
                    alerte.nombreAbsences,
                });


              if (creee) {
                nombreNotificationsCreees++;
              }

            }

          }

        } catch (notificationError) {

          console.error(
            'Erreur notification parent Firestore :',
            notificationError
          );

        }

      }


      // ========================================================
      // RESET
      // ========================================================

      const resetStates = {};


      listeEleves.forEach(
        (eleve) => {

          resetStates[
            eleve.id
          ] = 'present';

        }
      );


      setRegistrePresences(
        resetStates
      );


      // ========================================================
      // MESSAGE DE CONFIRMATION
      // ========================================================

      let messageConfirmation =
        `📝 APPEL VALIDÉ ET ENREGISTRÉ\n\n` +
        `• ${tableauNomsAbsents.length} absent(s)\n` +
        `• ${tableauNomsRetards.length} retard(s)\n` +
        `• ${nomClasseFinal}\n` +
        `• ${matiereActive}\n` +
        `• ${heureActuelle}`;


      if (
        alertesAEnvoyer.length
      ) {

        messageConfirmation +=
          `\n\n⚠️ SEUIL D'ABSENCE DÉPASSÉ` +
          `\n• ${alertesAEnvoyer.length} élève(s) ont dépassé 3 heures.` +
          `\n• ${nombreEmailsEnvoyes} e-mail(s) parent envoyé(s).` +
          `\n• ${nombreNotificationsCreees} notification(s) Edulink créée(s).`;

      }


      alert(
        messageConfirmation
      );


    } catch (err) {

      console.error(
        'Erreur commit appel :',
        err
      );


      alert(
        err?.message ||
        "❌ Échec technique : impossible d'enregistrer la fiche d'appel."
      );

    } finally {

      setIsSubmitting(
        false
      );

    }

  };


  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (
    loading &&
    listeClassesAutorisees.length === 0
  ) {

    return (
      <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase tracking-wider">

        Synchronisation des données de l'établissement...

      </div>
    );

  }


  // ============================================================
  // INTERFACE
  // ============================================================

  return (

    <div className="max-w-4xl mx-auto sm:p-6 font-sans text-gray-700 text-left bg-white min-h-screen animate-fadeIn">
      <Header />
      {/* ========================================================
          RETOUR
      ======================================================== */}

      <div className="mb-4">

        <Link
          to="/professeur/dashboard"
          className="signret inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg transition shadow-2xs no-underline"
        >
          ⬅ Bureau Enseignant
        </Link>

      </div>


      {/* ========================================================
          BANDEAU
      ======================================================== */}

      <div className="bg-white  mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div className="text-left">

          <span className="horaire text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded">

            Émargement horaire synchrone — EDULINK

          </span>


          <h2 className="horaire-1 text-base font-black text-gray-800 uppercase mt-1">

            Registre d'Appel Numérique par Heure de Cours

          </h2>


          <p className="horaire-2 text-[11px] text-gray-400 font-medium">

            Classe active :{' '}

            <span className="text-orange-600 font-black uppercase">

              {classeNomAffiche || '—'}

            </span>

            {' — '}

            Discipline :{' '}

            <span className="text-purple-600 font-black uppercase">

              {matiereActive || '—'}

            </span>

            {' — '}

            Prof :{' '}

            <span className="font-bold text-gray-600">

              {nomEnseignant || '—'}

            </span>

          </p>


          {trimestreActif && (

            <p className="horaire-3 text-[10px] text-gray-400 mt-1">

              Trimestre active :{' '}

              <strong className="text-gray-600">

                {trimestreActif}

              </strong>

              {anneeScolaire && (

                <>
                  {' — '}
                  Année scolaire :{' '}
                  <strong className="text-gray-600">
                    {anneeScolaire}
                  </strong>
                </>

              )}

            </p>

          )}

        </div>


        {/* ======================================================
            SELECTEUR
        ====================================================== */}

        <div className="selec-clas w-full sm:w-auto text-left">

          <label className="change-div block text-[9px] font-black text-gray-400 uppercase mb-1">

            Changer de division :

          </label>


          <select
            value={classeCibleActive}
            onChange={
              handleChangerClasseSelectionnee
            }
            className="bg-gray-50 border border-gray-200 p-2 text-xs font-black uppercase rounded-xl outline-none text-gray-800 cursor-pointer bg-white"
          >

            {listeClassesAutorisees.length === 0 ? (

              <option value="">

                Aucune classe récupérée depuis l'EDT

              </option>

            ) : (

              listeClassesAutorisees.map(
                (classe) => (

                  <option
                    key={classe.id}
                    value={classe.id}
                  >

                    🏛️ CLASSE :{' '}

                    {String(
                      classe.nom || ''
                    ).toUpperCase()}

                  </option>

                )
              )

            )}

          </select>

        </div>

      </div>


      {/* ========================================================
          REGISTRE
      ======================================================== */}

      <form
        onSubmit={
          handleValiderFicheAppel
        }
        className="bg-white rounded-2xl border border-gray-200 p-4 shadow-3xs space-y-4"
      >

        <div className="overflow-x-auto">

          <table className="appeltab w-full text-left text-xs font-bold text-gray-700 border-collapse">

            <thead>

              <tr className="bg-gray-50 text-gray-400 uppercase border-b text-[10px] tracking-wider border-gray-100">

                <th className="p-3">
                  Code Matricule
                </th>

                <th className="p-3">
                  Nom & Prénoms de l'Élève
                </th>

                <th className="p-3 text-center">
                  Cumul Absences
                </th>

                <th className="p-3 text-right">
                  Statut d'Émargement
                </th>

              </tr>

            </thead>


            <tbody>

              {listeEleves.length === 0 ? (

                <tr>

                  <td
                    colSpan="4"
                    className="p-12 text-center text-gray-400 italic"
                  >

                    Aucun élève récupéré pour cette division.

                  </td>

                </tr>

              ) : (

                listeEleves.map(
                  (student) => {

                    const statutActuel =
                      registrePresences[
                        student.id
                      ] ||
                      'present';


                    return (

                      <tr
                        key={student.id}
                        className="border-b border-gray-100 hover:bg-slate-50/40 transition items-center"
                      >

                        <td className="p-3 font-mono text-purple-700 uppercase truncate max-w-[120px]">

                          {student.matricule ||
                            student.id}

                        </td>


                        <td className="p-3 text-gray-900 uppercase font-black">

                          {student.nom || ''}{' '}

                          {student.prenoms || ''}

                        </td>


                        <td className="p-3 text-center font-mono text-red-600 bg-red-50/10 font-black text-sm">

                          {Number(
                            student.absences || 0
                          )}{' '}

                          H

                        </td>


                        <td className="p-3 text-right">

                          <div className="inline-flex p-0.5 bg-gray-100 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-tight shadow-2xs">

                            {/* PRESENT */}

                            <button
                              type="button"
                              onClick={() =>
                                handleChangerStatutPresences(
                                  student.id,
                                  'present'
                                )
                              }
                              className={`presence px-2 py-1.5 rounded-lg transition cursor-pointer font-black ${
                                statutActuel === 'present'
                                  ? 'bg-success text-white shadow-2xs'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >

                              ✓ Présent

                            </button>


                            {/* ABSENT */}

                            <button
                              type="button"
                              onClick={() =>
                                handleChangerStatutPresences(
                                  student.id,
                                  'absent'
                                )
                              }
                              className={`absent px-3 py-1.5 rounded-lg transition cursor-pointer font-black ${
                                statutActuel === 'absent'
                                  ? 'bg-success text-white shadow-2xs'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >

                              ❌ Absent

                            </button>


                            {/* RETARD */}

                            <button
                              type="button"
                              onClick={() =>
                                handleChangerStatutPresences(
                                  student.id,
                                  'retard'
                                )
                              }
                              className={`retard px-3 py-1.5 rounded-lg transition cursor-pointer font-black ${
                                statutActuel === 'retard'
                                  ? 'bg-success text-white shadow-2xs'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >

                              ⏱️ Retard

                            </button>

                          </div>

                        </td>

                      </tr>

                    );

                  }
                )

              )}

            </tbody>

          </table>

        </div>


        {/* ======================================================
            INFORMATION
        ====================================================== */}

        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">

          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-[10px] text-danger leading-relaxed font-medium max-w-lg text-left">

            💡{' '}

            <strong>
              Fonctionnement automatique :
            </strong>{' '}

            chaque absence validée augmente le cumul récupéré
            dans la fiche Firestore de l'élève.

            Lorsque le cumul dépasse 3 heures,
            un message d'alerte automatique  est déclenchée vers le parent pour lui signifier les absences cumulées
            à partir de l'adresse récupérée dans 
            <strong className='emailparent'>
              emailParent
            </strong>.

          </div>


          <button
            type="submit"
            disabled={
              isSubmitting ||
              listeEleves.length === 0 ||
              !classeCibleActive
            }
            className="bgvalid hover:bg-slate-800 font-black text-xs uppercase px-2 py-1 rounded-xl shadow-md transition cursor-pointer border-0 disabled:bg-gray-200"
          >

            {isSubmitting
              ? 'Enregistrement Cloud...'
              : "🚀 Valider et Clôturer l'Appel du Cours"}

          </button>

        </div>

      </form>

    </div>

  );

};


export default RegistreAppelEleves;