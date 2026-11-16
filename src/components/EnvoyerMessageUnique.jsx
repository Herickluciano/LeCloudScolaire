// src/components/EnvoyerMessageUnique.jsx

import React, { useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';

import { db } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Header from '../pages/Header';
import MessagesNotifications from './MessagesNotifications';

const EnvoyerMessageUnique = () => {
  const { user, schoolId } = useAuth();

  // ============================================================
  // OUTILS
  // ============================================================

  const normaliser = (valeur) => {
    return String(valeur || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const normaliserId = (valeur) => {
    return normaliser(valeur);
  };

  const normaliserClasse = (valeur) => {
    return normaliser(valeur)
      .replace(/[\s_-]+/g, '_');
  };

  // ============================================================
  // IDENTIFIANTS DE L'UTILISATEUR CONNECTÉ
  // ============================================================

  const identifiantsUtilisateur = useMemo(() => {
    const valeurs = [
      user?.matricule,
      user?.id,
      user?.uid,
      user?.userId,
      user?.professeurId,
      user?.profId
    ];

    return [
      ...new Set(
        valeurs
          .filter(Boolean)
          .map((valeur) => normaliserId(valeur))
          .filter(Boolean)
      )
    ];
  }, [user]);

  const myId = useMemo(() => {
    return String(
      user?.matricule ||
      user?.id ||
      user?.uid ||
      user?.userId ||
      user?.professeurId ||
      user?.profId ||
      ''
    ).trim();
  }, [user]);

  // ============================================================
  // ROLE
  // ============================================================

  const currentRole = useMemo(() => {
    return normaliser(user?.role);
  }, [user]);

  // ============================================================
  // ECOLE
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
  }, [user, schoolId]);

  // ============================================================
  // DONNEES ELEVE CONNECTÉ
  // ============================================================

  const classeEleve = useMemo(() => {
    return String(
      user?.classeId ||
      user?.classePrincipaleId ||
      user?.idClasse ||
      user?.classe ||
      ''
    ).trim();
  }, [user]);

  // ============================================================
  // NOM DE LA CLASSE DE L'ELEVE
  // ============================================================

  const nomClasseEleve = useMemo(() => {
    return String(
      user?.classeNom ||
      user?.nomClasse ||
      user?.classeName ||
      user?.classeLibelle ||
      user?.classe ||
      ''
    ).trim();
  }, [user]);

  // ============================================================
  // PROMOTION DE L'ELEVE
  // ============================================================

  const promoEleve = useMemo(() => {
    return String(
      user?.promotion ||
      user?.promotionId ||
      user?.promo ||
      ''
    ).trim();
  }, [user]);

  // ============================================================
  // NOM DE LA PROMOTION
  // ============================================================

  const nomPromotionEleve = useMemo(() => {
    return String(
      user?.promotionNom ||
      user?.nomPromotion ||
      user?.promotion ||
      user?.promotionId ||
      ''
    ).trim();
  }, [user]);

  // ============================================================
  // MATRICULE DE L'ELEVE
  // ============================================================

  const matriculeEleve = useMemo(() => {
    return String(
      user?.matricule ||
      myId ||
      ''
    ).trim();
  }, [user, myId]);

  // ============================================================
  // ETATS
  // ============================================================

  const [titre, setTitre] = useState('');
  const [message, setMessage] = useState('');
  const [typeCible, setTypeCible] = useState('');
  const [statut, setStatutMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // ============================================================
  // NOM EXPEDITEUR
  // ============================================================

  const nomExpediteur = useMemo(() => {
    const prenom =
      user?.prenoms ||
      user?.prenom ||
      user?.firstName ||
      '';

    const nom =
      user?.nom ||
      user?.name ||
      user?.lastName ||
      '';

    const resultat = `${prenom} ${nom}`.trim();

    if (resultat) {
      return resultat;
    }

    return (
      user?.displayName ||
      user?.email ||
      ''
    );
  }, [user]);

  // ============================================================
  // CANAUX AUTORISES
  // ============================================================

  const optionsCibles = useMemo(() => {

    // ----------------------------------------------------------
    // ADMINISTRATION
    // ----------------------------------------------------------

    if (
      currentRole === 'super_admin' ||
      currentRole === 'admin' ||
      currentRole === 'secretaire'
    ) {
      return [
        {
          value: 'all',
          label: "📢 Tout l'établissement"
        },
        {
          value: 'eleve',
          label: '🧑‍🎓 Élèves & Parents'
        },
        {
          value: 'professeur',
          label: '👨‍🏫 Corps enseignant'
        },
        {
          value: 'educateur',
          label: '👮 Personnel éducateur'
        }
      ];
    }

    // ----------------------------------------------------------
    // EDUCATEUR
    // ----------------------------------------------------------

    if (currentRole === 'educateur') {
      return [
        {
          value: 'eleve',
          label: '🧑‍🎓 Mes élèves & leurs parents'
        },
        {
          value: 'admin',
          label: '🏛️ La Direction'
        }
      ];
    }

    // ----------------------------------------------------------
    // PROFESSEUR / PROFESSEUR PRINCIPAL
    // ----------------------------------------------------------

    if (
      currentRole === 'professeur' ||
      currentRole === 'prof' ||
      currentRole === 'prof_principal' ||
      currentRole === 'professeur_principal' ||
      currentRole === 'profprincipal'
    ) {
      return [
        {
          value: 'eleve',
          label: '🧑‍🎓 Les élèves de mes classes'
        },
        {
          value: 'admin',
          label: '🏛️ La Direction'
        }
      ];
    }

    // ----------------------------------------------------------
    // ELEVE
    // ----------------------------------------------------------

    if (currentRole === 'eleve') {
      return [
        {
          value: 'admin',
          label: '🏛️ Réclamation / Demande officielle'
        },
        {
          value: 'classe',
          label: '👥 Mes camarades de classe'
        },
        {
          value: 'promotion',
          label: '🌍 Ma promotion'
        }
      ];
    }

    // ----------------------------------------------------------
    // PARENT
    // ----------------------------------------------------------

    if (
      currentRole === 'parent' ||
      currentRole === 'parents'
    ) {
      return [
        {
          value: 'admin',
          label: '🏛️ La Direction'
        }
      ];
    }

    return [];
  }, [currentRole]);

  // ============================================================
  // AJOUTER DESTINATAIRE
  // ============================================================

  const ajouterDestinataire = (
    liste,
    data,
    roleOverride = ''
  ) => {
    if (!data) {
      return;
    }

    const email = String(
      data.email ||
      data.emailParent ||
      ''
    ).trim();

    const nom =
      data.name ||
      `${data.nom || ''} ${data.prenoms || ''}`.trim() ||
      data.displayName ||
      data.email ||
      '';

    const destinataireId = String(
      data.id ||
      data.uid ||
      data.userId ||
      data.matricule ||
      ''
    ).trim();

    if (!destinataireId) {
      return;
    }

    liste.push({
      id: destinataireId,
      email,
      name: nom,
      role: roleOverride || data.role || '',
      classeId:
        data.classeId ||
        data.classePrincipaleId ||
        data.classe ||
        '',
      promotion:
        data.promotion ||
        data.promotionId ||
        ''
    });
  };

  // ============================================================
  // VERIFIER SI UN PROFESSEUR CORRESPOND
  // ============================================================

  const correspondAuProfesseur = (valeurs) => {
    if (!Array.isArray(valeurs)) {
      return false;
    }

    return valeurs
      .filter(Boolean)
      .map(normaliserId)
      .some((valeur) =>
        identifiantsUtilisateur.includes(valeur)
      );
  };

  // ============================================================
  // EXTRAIRE LES IDENTIFIANTS D'UN OBJET PROFESSEUR
  // ============================================================

  const extraireIdentifiantsProfesseur = (objet) => {
    if (!objet) {
      return [];
    }

    if (typeof objet === 'string') {
      return [objet];
    }

    return [
      objet.uid,
      objet.id,
      objet.userId,
      objet.professeurId,
      objet.profId,
      objet.matricule
    ].filter(Boolean);
  };

  // ============================================================
  // TROUVER LES CLASSES D'UN PROFESSEUR
  // ============================================================

  const recupererClassesProfesseur = async () => {
    const classesTrouvees = new Map();

    if (
      !currentSchool ||
      identifiantsUtilisateur.length === 0
    ) {
      return classesTrouvees;
    }

    // ==========================================================
    // 1. COLLECTION classes
    // ==========================================================

    try {
      const qClasses = query(
        collection(db, 'classes'),
        where(
          'schoolId',
          '==',
          currentSchool
        )
      );

      const snapshotClasses =
        await getDocs(qClasses);

      snapshotClasses.forEach((docSnap) => {
        const data = docSnap.data() || {};

        const identifiantsDirects = [
          data.professeurId,
          data.profId,
          data.enseignantId,
          data.professeurPrincipalId,
          data.profPrincipalId,
          data.profPrincipalUid,
          data.ppId,
          data.titulaireId,
          data.enseignantPrincipalId
        ];

        let appartient = correspondAuProfesseur(
          identifiantsDirects
        );

        // ------------------------------------------------------
        // Objets professeur / PP
        // ------------------------------------------------------

        if (!appartient) {
          const objets = [
            data.professeur,
            data.professeurPrincipal,
            data.profPrincipal,
            data.professeurPrincipalData,
            data.pp,
            data.titulaire,
            data.enseignant
          ];

          for (const objet of objets) {
            const ids =
              extraireIdentifiantsProfesseur(
                objet
              );

            if (
              correspondAuProfesseur(ids)
            ) {
              appartient = true;
              break;
            }
          }
        }

        // ------------------------------------------------------
        // Tableau de professeurs
        // ------------------------------------------------------

        if (!appartient) {
          const tableaux = [
            data.professeurs,
            data.enseignants,
            data.teachers
          ];

          for (const tableau of tableaux) {
            if (!Array.isArray(tableau)) {
              continue;
            }

            for (const professeur of tableau) {
              const ids =
                extraireIdentifiantsProfesseur(
                  professeur
                );

              if (
                correspondAuProfesseur(ids)
              ) {
                appartient = true;
                break;
              }
            }

            if (appartient) {
              break;
            }
          }
        }

        if (appartient) {
          classesTrouvees.set(
            docSnap.id,
            {
              id: docSnap.id,
              ...data
            }
          );
        }
      });

    } catch (error) {
      console.error(
        'Erreur récupération classes :',
        error
      );
    }

    // ==========================================================
    // 2. COLLECTION emplois_du_temps
    // ==========================================================

    try {
      const qEdt = query(
        collection(db, 'emplois_du_temps'),
        where(
          'schoolId',
          '==',
          currentSchool
        )
      );

      const snapshotEdt =
        await getDocs(qEdt);

      snapshotEdt.forEach((docSnap) => {
        const edtData =
          docSnap.data() || {};

        // ------------------------------------------------------
        // Cas document avec professeurId / classeId
        // ------------------------------------------------------

        const professeursDirects = [
          edtData.professeurId,
          edtData.profId,
          edtData.enseignantId
        ];

        if (
          correspondAuProfesseur(
            professeursDirects
          )
        ) {
          const classeId =
            edtData.classeId ||
            edtData.classId ||
            edtData.idClasse;

          if (classeId) {
            classesTrouvees.set(
              String(classeId),
              {
                id: String(classeId),
                classeId: String(classeId),
                nom:
                  edtData.nomClasse ||
                  edtData.classeNom ||
                  edtData.nom ||
                  edtData.classe ||
                  String(classeId)
              }
            );
          }
        }

        // ------------------------------------------------------
        // Cas creneaux[]
        // ------------------------------------------------------

        const creneaux =
          Array.isArray(edtData.creneaux)
            ? edtData.creneaux
            : [];

        creneaux.forEach((creneau) => {

          const idsProfesseur = [
            creneau?.professeurId,
            creneau?.profId,
            creneau?.enseignantId
          ];

          if (
            !correspondAuProfesseur(
              idsProfesseur
            )
          ) {
            return;
          }

          const classeId =
            creneau?.classeId ||
            creneau?.classId ||
            creneau?.idClasse ||
            edtData.classeId ||
            edtData.classId;

          if (!classeId) {
            return;
          }

          classesTrouvees.set(
            String(classeId),
            {
              id: String(classeId),
              classeId: String(classeId),
              nom:
                creneau?.nomClasse ||
                creneau?.classeNom ||
                creneau?.classe ||
                edtData.nomClasse ||
                edtData.classeNom ||
                String(classeId)
            }
          );
        });

        // ------------------------------------------------------
        // Cas professeurs[]
        // ------------------------------------------------------

        const professeurs =
          Array.isArray(edtData.professeurs)
            ? edtData.professeurs
            : [];

        professeurs.forEach((professeur) => {

          const idsProfesseur =
            extraireIdentifiantsProfesseur(
              professeur
            );

          if (
            !correspondAuProfesseur(
              idsProfesseur
            )
          ) {
            return;
          }

          const classeId =
            professeur?.classeId ||
            edtData.classeId ||
            edtData.classId;

          if (!classeId) {
            return;
          }

          classesTrouvees.set(
            String(classeId),
            {
              id: String(classeId),
              classeId: String(classeId),
              nom:
                edtData.nomClasse ||
                edtData.classeNom ||
                professeur?.nomClasse ||
                String(classeId)
            }
          );
        });
      });

    } catch (error) {
      console.error(
        'Erreur récupération emplois du temps :',
        error
      );
    }

    // ==========================================================
    // 3. CLASSE DIRECTEMENT DANS LE PROFIL
    // ==========================================================

    const classesProfil = [
      user?.classeId,
      user?.classePrincipaleId,
      user?.classePPId,
      user?.professeurPrincipalClasseId
    ]
      .filter(Boolean)
      .map((valeur) =>
        String(valeur).trim()
      )
      .filter(Boolean);

    classesProfil.forEach((classeId) => {
      if (!classesTrouvees.has(classeId)) {
        classesTrouvees.set(
          classeId,
          {
            id: classeId,
            classeId,
            nom: classeId
          }
        );
      }
    });

    return classesTrouvees;
  };

  // ============================================================
  // TROUVER LES CLASSES DU PROFESSEUR PRINCIPAL
  // ============================================================

  const recupererClassesPP = async () => {
    const classesPP = new Map();

    if (
      !currentSchool ||
      identifiantsUtilisateur.length === 0
    ) {
      return classesPP;
    }

    try {
      const qClasses = query(
        collection(db, 'classes'),
        where(
          'schoolId',
          '==',
          currentSchool
        )
      );

      const snapshot =
        await getDocs(qClasses);

      snapshot.forEach((docSnap) => {
        const data =
          docSnap.data() || {};

        const identifiantsPP = [
          data.professeurPrincipalId,
          data.profPrincipalId,
          data.professeurPrincipalUid,
          data.ppId,
          data.titulaireId,
          data.profPrincipalUid,
          data.enseignantPrincipalId
        ];

        let estPP =
          correspondAuProfesseur(
            identifiantsPP
          );

        if (!estPP) {
          const objetsPP = [
            data.professeurPrincipal,
            data.profPrincipal,
            data.professeurPrincipalData,
            data.pp,
            data.titulaire
          ];

          for (const objet of objetsPP) {
            const ids =
              extraireIdentifiantsProfesseur(
                objet
              );

            if (
              correspondAuProfesseur(ids)
            ) {
              estPP = true;
              break;
            }
          }
        }

        if (estPP) {
          classesPP.set(
            docSnap.id,
            {
              id: docSnap.id,
              ...data
            }
          );
        }
      });

    } catch (error) {
      console.error(
        'Erreur récupération classes PP :',
        error
      );
    }

    // ----------------------------------------------------------
    // Classe PP directement dans le profil
    // ----------------------------------------------------------

    const classePPProfil =
      user?.classePPId ||
      user?.classePrincipaleId ||
      user?.professeurPrincipalClasseId;

    if (
      classePPProfil &&
      !classesPP.has(
        String(classePPProfil).trim()
      )
    ) {
      try {
        const q = query(
          collection(db, 'classes'),
          where(
            'schoolId',
            '==',
            currentSchool
          )
        );

        const snapshot =
          await getDocs(q);

        snapshot.forEach((docSnap) => {
          if (
            docSnap.id ===
            String(classePPProfil).trim()
          ) {
            classesPP.set(
              docSnap.id,
              {
                id: docSnap.id,
                ...docSnap.data()
              }
            );
          }
        });

      } catch (error) {
        console.error(
          'Erreur classe PP profil :',
          error
        );
      }
    }

    return classesPP;
  };

  // ============================================================
  // ENVOI DU MESSAGE
  // ============================================================

  const handleEnvoiMessage = async (e) => {
    e.preventDefault();

    if (!typeCible) {
      setStatutMsg(
        '❌ Veuillez choisir un destinataire.'
      );
      return;
    }

    if (!message.trim()) {
      setStatutMsg(
        '❌ Veuillez saisir un message.'
      );
      return;
    }

    if (!currentSchool) {
      setStatutMsg(
        '❌ Établissement introuvable dans votre session.'
      );
      return;
    }

    if (!myId) {
      setStatutMsg(
        '❌ Identifiant de votre compte introuvable.'
      );
      return;
    }

    setLoading(true);

    setStatutMsg(
      '⏳ Recherche des destinataires...'
    );

    try {
      const usersRef =
        collection(db, 'users');

      let destinatairesTrouves = [];

      let codeCibleInterne =
        typeCible;

      // ========================================================
      // ELEVE CONNECTÉ
      // ========================================================

      if (currentRole === 'eleve') {

        // ------------------------------------------------------
        // ELEVE → ADMIN
        // ------------------------------------------------------

        if (typeCible === 'admin') {

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            )
          );

          const snap =
            await getDocs(q);

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            const role =
              normaliser(data.role);

            if (
              role !== 'admin' &&
              role !== 'super_admin' &&
              role !== 'secretaire'
            ) {
              return;
            }

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              data.role
            );
          });
        }

        // ------------------------------------------------------
        // ELEVE → CLASSE
        // ------------------------------------------------------

        else if (
          typeCible === 'classe'
        ) {

          if (!classeEleve) {
            throw new Error(
              'La classe de l’élève est introuvable dans Firebase.'
            );
          }

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            ),
            where(
              'role',
              '==',
              'eleve'
            )
          );

          const snap =
            await getDocs(q);

          const classeRecherchee =
            normaliserClasse(
              classeEleve
            );

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            const classeUtilisateur =
              normaliserClasse(
                data.classeId ||
                data.classePrincipaleId ||
                data.idClasse ||
                data.classe ||
                ''
              );

            if (
              classeUtilisateur !==
              classeRecherchee
            ) {
              return;
            }

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              'eleve'
            );
          });

          codeCibleInterne =
            `classe_${normaliserClasse(
              classeEleve
            )}`;
        }

        // ------------------------------------------------------
        // ELEVE → PROMOTION
        // ------------------------------------------------------

        else if (
          typeCible === 'promotion'
        ) {

          if (!promoEleve) {
            throw new Error(
              'La promotion de l’élève est introuvable dans Firebase.'
            );
          }

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            ),
            where(
              'role',
              '==',
              'eleve'
            )
          );

          const snap =
            await getDocs(q);

          const promotionRecherchee =
            normaliser(
              promoEleve
            );

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            const promotionUtilisateur =
              normaliser(
                data.promotion ||
                data.promotionId ||
                ''
              );

            if (
              promotionUtilisateur !==
              promotionRecherchee
            ) {
              return;
            }

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              'eleve'
            );
          });

          codeCibleInterne =
            `promotion_${normaliser(
              promoEleve
            )}`;
        }
      }

      // ========================================================
      // PROFESSEUR / PROF PRINCIPAL
      // ========================================================

      else if (
        currentRole === 'professeur' ||
        currentRole === 'prof' ||
        currentRole === 'prof_principal' ||
        currentRole === 'professeur_principal' ||
        currentRole === 'profprincipal'
      ) {

        // ------------------------------------------------------
        // PROFESSEUR → DIRECTION
        // ------------------------------------------------------

        if (typeCible === 'admin') {

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            )
          );

          const snap =
            await getDocs(q);

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            const role =
              normaliser(data.role);

            if (
              role !== 'admin' &&
              role !== 'super_admin' &&
              role !== 'secretaire'
            ) {
              return;
            }

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              data.role
            );
          });

          codeCibleInterne =
            'administration';
        }

        // ------------------------------------------------------
        // PROFESSEUR → SES ELEVES
        // ------------------------------------------------------

        else if (
          typeCible === 'eleve'
        ) {

          setStatutMsg(
            '⏳ Recherche de vos classes...'
          );

          let classesAutorisees =
            new Map();

          // ----------------------------------------------------
          // PROF PRINCIPAL
          // ----------------------------------------------------

          if (
            currentRole === 'prof_principal' ||
            currentRole === 'professeur_principal' ||
            currentRole === 'profprincipal'
          ) {
            classesAutorisees =
              await recupererClassesPP();
          }

          // ----------------------------------------------------
          // PROFESSEUR NORMAL
          // ----------------------------------------------------

          else {
            classesAutorisees =
              await recupererClassesProfesseur();
          }

          const idsClassesAutorisees = [
            ...classesAutorisees.keys()
          ]
            .map((id) =>
              normaliserClasse(id)
            )
            .filter(Boolean);

          if (
            idsClassesAutorisees.length === 0
          ) {

            setStatutMsg(
              '⚠️ Aucune classe correspondant à votre compte n’a été trouvée dans Firebase.'
            );

            setLoading(false);
            return;
          }

          setStatutMsg(
            `⏳ Recherche des élèves de ${idsClassesAutorisees.length} classe(s)...`
          );

          const qEleves = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            ),
            where(
              'role',
              '==',
              'eleve'
            )
          );

          const snapEleves =
            await getDocs(qEleves);

          snapEleves.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            const classeEleveFirebase =
              normaliserClasse(
                data.classeId ||
                data.classePrincipaleId ||
                data.idClasse ||
                data.classe ||
                ''
              );

            if (!classeEleveFirebase) {
              return;
            }

            if (
              !idsClassesAutorisees.includes(
                classeEleveFirebase
              )
            ) {
              return;
            }

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              'eleve'
            );
          });

          codeCibleInterne =
            `classes_prof_${normaliser(
              myId
            )}`;
        }
      }

      // ========================================================
      // ADMINISTRATION
      // ========================================================

      else if (
        currentRole === 'admin' ||
        currentRole === 'super_admin' ||
        currentRole === 'secretaire'
      ) {

        // ------------------------------------------------------
        // TOUT L'ETABLISSEMENT
        // ------------------------------------------------------

        if (
          typeCible === 'all'
        ) {

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            )
          );

          const snap =
            await getDocs(q);

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              data.role
            );
          });

          codeCibleInterne =
            'tout_etablissement';
        }

        // ------------------------------------------------------
        // ADMIN → ADMIN
        // ------------------------------------------------------

        else if (
          typeCible === 'admin'
        ) {

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            )
          );

          const snap =
            await getDocs(q);

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            const role =
              normaliser(data.role);

            if (
              role !== 'admin' &&
              role !== 'super_admin' &&
              role !== 'secretaire'
            ) {
              return;
            }

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              data.role
            );
          });

          codeCibleInterne =
            'administration';
        }

        // ------------------------------------------------------
        // ADMIN → ROLE
        // ------------------------------------------------------

        else {

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            ),
            where(
              'role',
              '==',
              typeCible
            )
          );

          const snap =
            await getDocs(q);

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              data.role
            );
          });
        }
      }

      // ========================================================
      // EDUCATEUR
      // ========================================================

      else if (
        currentRole === 'educateur'
      ) {

        // ------------------------------------------------------
        // EDUCATEUR → ADMIN
        // ------------------------------------------------------

        if (
          typeCible === 'admin'
        ) {

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            )
          );

          const snap =
            await getDocs(q);

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            const role =
              normaliser(data.role);

            if (
              role !== 'admin' &&
              role !== 'super_admin' &&
              role !== 'secretaire'
            ) {
              return;
            }

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              data.role
            );
          });

          codeCibleInterne =
            'administration';
        }

        // ------------------------------------------------------
        // EDUCATEUR → ELEVE
        // ------------------------------------------------------

        else if (
          typeCible === 'eleve'
        ) {

          const q = query(
            usersRef,
            where(
              'schoolId',
              '==',
              currentSchool
            ),
            where(
              'role',
              '==',
              'eleve'
            )
          );

          const snap =
            await getDocs(q);

          snap.forEach((docSnap) => {
            const data =
              docSnap.data() || {};

            ajouterDestinataire(
              destinatairesTrouves,
              {
                ...data,
                id: docSnap.id
              },
              'eleve'
            );
          });
        }
      }

      // ========================================================
      // DEDOUBLONNAGE + EXCLUSION EXPEDITEUR
      // ========================================================

      const mapDestinataires =
        new Map();

      destinatairesTrouves.forEach(
        (destinataire) => {

          const id =
            String(
              destinataire.id || ''
            ).trim();

          if (!id) {
            return;
          }

          const idNormalise =
            normaliserId(id);

          // ----------------------------------------------------
          // Ne jamais envoyer à soi-même
          // ----------------------------------------------------

          if (
            identifiantsUtilisateur.includes(
              idNormalise
            )
          ) {
            return;
          }

          if (
            !mapDestinataires.has(
              idNormalise
            )
          ) {
            mapDestinataires.set(
              idNormalise,
              destinataire
            );
          }
        }
      );

      const destinatairesUniques =
        Array.from(
          mapDestinataires.values()
        );

      // ========================================================
      // AUCUN DESTINATAIRE
      // ========================================================

      if (
        destinatairesUniques.length === 0
      ) {

        setStatutMsg(
          '⚠️ Aucun destinataire correspondant à votre sélection.'
        );

        setLoading(false);
        return;
      }

      // ========================================================
      // ENVOI
      // ========================================================

      setStatutMsg(
        `⏳ Envoi à ${destinatairesUniques.length} destinataire(s)...`
      );

      const titreFinal =
        titre.trim() ||
        'Notification';

      const messageFinal =
        message.trim();

      const dateCreation =
        new Date().toISOString();

      // ========================================================
      // INFORMATIONS EXPEDITEUR
      // ========================================================

      /*
       * IMPORTANT :
       * Ces informations sont enregistrées directement
       * dans chaque notification.
       *
       * Cela permet au destinataire de savoir exactement
       * QUI lui a envoyé le message.
       */

      const informationsExpediteur = {
        expediteurId:
          myId,

        expediteurNom:
          nomExpediteur,

        expediteurRole:
          currentRole,

        expediteurMatricule:
          matriculeEleve,

        expediteurClasseId:
          currentRole === 'eleve'
            ? classeEleve
            : String(
                user?.classeId ||
                user?.classePrincipaleId ||
                ''
              ).trim(),

        expediteurClasse:
          currentRole === 'eleve'
            ? nomClasseEleve
            : String(
                user?.classeNom ||
                user?.nomClasse ||
                user?.classe ||
                ''
              ).trim(),

        expediteurPromotion:
          currentRole === 'eleve'
            ? nomPromotionEleve
            : String(
                user?.promotion ||
                user?.promotionId ||
                ''
              ).trim()
      };

      // ========================================================
      // FIRESTORE
      // ========================================================

      for (
        const destinataire of
        destinatairesUniques
      ) {

        await addDoc(
          collection(
            db,
            'notifications'
          ),
          {
            // ==================================================
            // ETABLISSEMENT
            // ==================================================

            schoolId:
              currentSchool,

            // ==================================================
            // EXPEDITEUR
            // ==================================================

            expediteurId:
              informationsExpediteur.expediteurId,

            expediteurNom:
              informationsExpediteur.expediteurNom,

            expediteurRole:
              informationsExpediteur.expediteurRole,

            expediteurMatricule:
              informationsExpediteur.expediteurMatricule,

            expediteurClasseId:
              informationsExpediteur.expediteurClasseId,

            expediteurClasse:
              informationsExpediteur.expediteurClasse,

            expediteurPromotion:
              informationsExpediteur.expediteurPromotion,

            // ==================================================
            // DESTINATAIRE
            // ==================================================

            destinataireId:
              destinataire.id,

            destinataireNom:
              destinataire.name || '',

            destinataireRole:
              normaliser(
                destinataire.role
              ),

            destinataireEmail:
              destinataire.email || '',

            classeId:
              destinataire.classeId || '',

            promotion:
              destinataire.promotion || '',

            // ==================================================
            // MESSAGE
            // ==================================================

            titre:
              titreFinal,

            message:
              messageFinal,

            cible:
              codeCibleInterne,

            type:
              typeCible === 'admin'
                ? 'reclamation'
                : 'global',

            lienConnexion:
              '/login',

            // ==================================================
            // ETAT
            // ==================================================

            lu:
              false,

            masquePour:
              [],

            createdAt:
              dateCreation
          }
        );
      }

      // ========================================================
      // EMAIL
      // ========================================================

      const listeMails =
        destinatairesUniques
          .map(
            (destinataire) =>
              String(
                destinataire.email || ''
              ).trim()
          )
          .filter(Boolean);

      if (
        listeMails.length > 0
      ) {

        try {

          const response =
            await fetch(
              'http://localhost:10000/api/send-notification-email',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    recipients:
                      listeMails,

                    schoolName:
                      currentSchool,

                    title:
                      titreFinal,

                    message:
                      `${messageFinal}\n\nAccéder à votre espace Ecole : ${window.location.origin}/login`,

                    senderName:
                      nomExpediteur,

                    type:
                      currentRole
                  })
              }
            );

          if (
            !response.ok
          ) {
            console.warn(
              'Le message a été enregistré dans Firebase mais l’email n’a pas pu être envoyé.'
            );
          }

        } catch (emailError) {

          console.warn(
            'Erreur lors de l’envoi email :',
            emailError
          );
        }
      }

      // ========================================================
      // SUCCES
      // ========================================================

      setStatutMsg(
        `🎉 Message envoyé à ${destinatairesUniques.length} destinataire(s).`
      );

      setTitre('');
      setMessage('');
      setTypeCible('');

      setTimeout(() => {
        setStatutMsg('');
      }, 5000);

    } catch (err) {

      console.error(
        'Erreur lors de l’envoi du message :',
        err
      );

      setStatutMsg(
        `❌ Échec de l’envoi : ${
          err?.message ||
          'Erreur inconnue.'
        }`
      );

    } finally {

      setLoading(false);
    }
  };

  // ============================================================
  // AFFICHAGE
  // ============================================================

  return (
    <div className="bg-white max-w-5xl mx-auto sm:p-0 lg:p-0 font-sans bg-gray-50 min-h-screen text-gray-700 text-left">
      <Header />
      <div className="border-b border-slate-800 pb-2 mb-4">

        <h3 className="emettre text-sm font-black uppercase tracking-wide">
          Émettre un Message / Réclamation / Une convocation
        </h3>
      </div>

      {/* ======================================================
          STATUT
      ====================================================== */}

      {statut && (
        <div className="mb-4 p-2.5 bg-slate-950 text-orange-400 font-bold rounded-xl border-l-4 border-orange-500">
          {statut}
        </div>
      )}

      {/* ======================================================
          FORMULAIRE
      ====================================================== */}

      <form
        onSubmit={handleEnvoiMessage}
        className="form-msg space-y-4"
      >

        {/* DESTINATION */}

       <div className='nivaeupr form-floating mb-3'>

          <label className="block text-slate-400 font-bold uppercase mb-1">
            Choisir le canal de destination *
          </label>

          <select
          name="niveauPromotion"
            value={typeCible}
            onChange={(e) =>
              setTypeCible(
                e.target.value
              )
            }
           className="form-select w-full px-3 py-2.5 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none"
            required
          >

            <option selected value="">
              -- Sélectionner le destinataire --
            </option>

            {optionsCibles.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}

          </select>

        </div>

        {/* TITRE */}

       <div className='formecobjet form-floating mb-3'>

          <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
            Titre de l'objet
          </label>

          <input
            type="text"
            id="floatingInput"
            name="numSecuriteSociale"
            placeholder="Ex : Rappel de devoir, Rectification absence..."
            value={titre}
            onChange={(e) =>
              setTitre(
                e.target.value
              )
            }
             className="form-control  w-full  border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono"
          />

        </div>

        {/* MESSAGE */}

       <div className='divisionpedagogi form-floating mb-3'>

          <label htmlFor='exampleFormControlTextarea1' className="textar form-label block text-gray-700 text-xs font-bold uppercase mb-1">
            Texte explicatif *
          </label>

          <textarea
            rows="3"
            type="text"
            placeholder="Tapez votre message complet ici..."
            id="exampleFormControlTextarea1"
            value={message}
            onChange={(e) =>
              setMessage(
                e.target.value
              )
            }
            className="form-control textare w-full bg-slate-950 border border-slate-800 rounded-xl  focus:outline-none focus:border-orange-500 font-medium resize-none"
            required
          />

        </div>

        {/* BOUTON */}

        <button
          type="submit"
          disabled={loading}
          className="btnmsg  w-full bg-orange-500 hover:bg-orange-600 font-black py-3 rounded-xl uppercase tracking-wider transition cursor-pointer border-0 disabled:bg-slate-800 disabled:cursor-not-allowed"
        >

          {loading
            ? '⏳ Transmission...'
            : ' Envoyer le Message'}

        </button>

      </form>
    </div>
  );
};

export default EnvoyerMessageUnique;