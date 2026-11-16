// src/features/eleve/pages/DashboardEleve.jsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  db
} from '../../../services/api';

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc
} from 'firebase/firestore';

import { useAuth } from '../../../context/AuthContext';

import {
  useNavigate,
  useLocation,
  Link
} from 'react-router-dom';

import { imprimerBulletinTrimestriel } from '../../../utils/bulletinUtils';

import MesCours from './MesCours';
import Header from '../../../pages/Header';
import BoiteReceptionUnique from '../../../components/BoiteReceptionUnique';

const Monbulletin = () => {
  const {
    user,
    schoolId,
    schoolName,
    logout
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // ============================================================
  // ETABLISSEMENT ACTIF
  // ============================================================

  const currentSchool = String(
    schoolId ||
      user?.schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      'lycee_moderne_gagnoa'
  )
    .trim()
    .toLowerCase();

  const activeSchoolName =
    schoolName ||
    user?.schoolName ||
    sessionStorage.getItem('sgs_school_name') ||
    'Lycée Moderne Gagnoa';

  const activeSchoolId =
    schoolId ||
    user?.schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_moderne_gagnoa';

  // ============================================================
  // IDENTIFICATION ELEVE
  // ============================================================

  const idDocumentEleve = String(
    user?.uid ||
      user?.id ||
      ''
  ).trim();

  const matriculeEleve = String(
    user?.matricule ||
      ''
  ).trim();

  const identifiantEleve =
    idDocumentEleve ||
    matriculeEleve ||
    'ELEVE_UNKNOWN';

  // ============================================================
  // CLASSE / PROMOTION
  // ============================================================

  const classeEleve = String(
    user?.classeId ||
      user?.classe ||
      user?.classeNom ||
      '5eme_1'
  )
    .trim()
    .toLowerCase();

  const promoEleve = String(
    user?.promotion ||
      user?.assigned_promotion ||
      user?.assignedPromotion ||
      user?.niveau ||
      '5eme'
  )
    .trim()
    .toLowerCase();

  // ============================================================
  // ETATS NAVIGATION
  // ============================================================

  const [activeSubSection, setActiveSubSection] =
    useState('accueil');

  const [
    trimestreSelectionne,
    setTrimestreSelectionne
  ] = useState('1');

  const [
    filtreScopeChat,
    setFiltreScopeChat
  ] = useState('classe');

  const [
    rechercheContactChat,
    setRechercheContactChat
  ] = useState('');

  // ============================================================
  // ETATS CLOUD
  // ============================================================

  const [schoolMeta, setSchoolMeta] =
    useState(null);

  const [tousElevesPromo, setTousElevesPromotion] =
    useState([]);

  const [discussionsMessages, setDiscussionsMessages] =
    useState([]);

  const [
    filtreMessageCible,
    setFiltreMessageCible
  ] = useState('ADMIN');

  const [
    texteMessageUrgent,
    setTexteMessageUrgent
  ] = useState('');

  const [sendingMsg, setSendingMsg] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  // ============================================================
  // OUTIL DE NORMALISATION
  // ============================================================

  const normaliser = (valeur) => {
    return String(valeur || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '');
  };

  // ============================================================
  // NAVIGATION AUTOMATIQUE
  // ============================================================

  useEffect(() => {
    if (
      location.pathname.includes(
        'bulletins'
      )
    ) {
      setActiveSubSection(
        'bulletins'
      );
    }

    if (
      location.pathname.includes(
        'messagerie'
      )
    ) {
      setActiveSubSection(
        'messages'
      );
    }
  }, [location]);

  // ============================================================
  // FLUX CLOUD TEMPS REEL
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    // ----------------------------------------------------------
    // A. INFORMATIONS ETABLISSEMENT
    // ----------------------------------------------------------

    const unsubscribeSchool = onSnapshot(
      doc(
        db,
        'schools',
        currentSchool
      ),
      (snapshot) => {
        if (snapshot.exists()) {
          setSchoolMeta(
            snapshot.data()
          );
        } else {
          setSchoolMeta(null);
        }
      },
      (error) => {
        console.error(
          'Erreur lecture établissement :',
          error
        );
      }
    );

    // ----------------------------------------------------------
    // B. TOUS LES ELEVES DE L'ETABLISSEMENT
    // ----------------------------------------------------------
    //
    // On filtre ensuite localement pour éviter
    // les problèmes de casse / accents / format.
    // ----------------------------------------------------------

    const qEleves = query(
      collection(
        db,
        'users'
      ),
      where(
        'role',
        '==',
        'eleve'
      )
    );

    const unsubscribeEleves =
      onSnapshot(
        qEleves,
        (snapshot) => {
          const liste = [];

          snapshot.forEach(
            (docSnap) => {
              const data =
                docSnap.data() || {};

              const schoolDoc =
                normaliser(
                  data.schoolId
                );

              if (
                schoolDoc !==
                normaliser(
                  currentSchool
                )
              ) {
                return;
              }

              const promotionDoc =
                normaliser(
                  data.promotion ||
                    data.assigned_promotion ||
                    data.assignedPromotion ||
                    data.niveau ||
                    ''
                );

              const promotionActive =
                normaliser(
                  promoEleve
                );

              if (
                promotionActive &&
                promotionDoc &&
                promotionDoc !==
                  promotionActive &&
                !promotionDoc.includes(
                  promotionActive
                ) &&
                !promotionActive.includes(
                  promotionDoc
                )
              ) {
                return;
              }

              liste.push({
                id: docSnap.id,
                ...data
              });
            }
          );

          setTousElevesPromotion(
            liste
          );
        },
        (error) => {
          console.error(
            'Erreur lecture élèves :',
            error
          );

          setTousElevesPromotion(
            []
          );
        }
      );

    // ----------------------------------------------------------
    // C. MESSAGERIE
    // ----------------------------------------------------------

    const qMsg = query(
      collection(
        db,
        'notifications'
      )
    );

    const unsubscribeMessages =
      onSnapshot(
        qMsg,
        (snapshot) => {
          const liste = [];

          snapshot.forEach(
            (docSnap) => {
              const data =
                docSnap.data() || {};

              const schoolDoc =
                normaliser(
                  data.schoolId
                );

              if (
                schoolDoc !==
                normaliser(
                  currentSchool
                )
              ) {
                return;
              }

              liste.push({
                id: docSnap.id,
                ...data
              });
            }
          );

          liste.sort(
            (a, b) => {
              const dateA =
                new Date(
                  a.createdAt ||
                    0
                ).getTime();

              const dateB =
                new Date(
                  b.createdAt ||
                    0
                ).getTime();

              return dateA - dateB;
            }
          );

          setDiscussionsMessages(
            liste
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            'Erreur messagerie live :',
            error
          );

          setLoading(false);
        }
      );

    return () => {
      unsubscribeSchool();
      unsubscribeEleves();
      unsubscribeMessages();
    };
  }, [
    currentSchool,
    promoEleve
  ]);

  // ============================================================
  // PROFIL ELEVE LIVE
  // ============================================================

  const profilLoggeLive =
    useMemo(() => {
      return tousElevesPromo.find(
        (eleve) => {
          const id =
            String(
              eleve?.id || ''
            ).trim();

          const uid =
            String(
              eleve?.uid || ''
            ).trim();

          const matricule =
            String(
              eleve?.matricule ||
                ''
            ).trim();

          return (
            (id &&
              id ===
                idDocumentEleve) ||
            (uid &&
              uid ===
                idDocumentEleve) ||
            (matricule &&
              matricule ===
                matriculeEleve) ||
            (id &&
              id ===
                matriculeEleve)
          );
        }
      );
    }, [
      tousElevesPromo,
      idDocumentEleve,
      matriculeEleve
    ]);

  // ============================================================
  // IDENTIFIANT FINAL DU PROFIL
  // ============================================================

  const idEleveLogge =
    profilLoggeLive?.id ||
    idDocumentEleve ||
    matriculeEleve ||
    'ELEVE_UNKNOWN';

  // ============================================================
  // ABSENCES
  // ============================================================

  const absencesDuTrimestre =
    useMemo(() => {
      if (!profilLoggeLive) {
        return 0;
      }

      const trimestre =
        trimestreSelectionne;

      if (trimestre === '1') {
        return Number(
          profilLoggeLive.absences ||
            profilLoggeLive.absences_trimestre_1 ||
            0
        );
      }

      return Number(
        profilLoggeLive[
          `absences_trimestre_${trimestre}`
        ] ||
          0
      );
    }, [
      profilLoggeLive,
      trimestreSelectionne
    ]);

  // ============================================================
  // EXTRACTION DES DONNEES PEDAGOGIQUES
  // ============================================================
  //
  // IMPORTANT :
  //
  // Pour le bulletin, on utilise les moyennes transmises
  // par les professeurs dans :
  //
  // moyennes_matiere.notes_trimestre_X
  //
  // et non une moyenne recalculée à partir des devoirs.
  //
  // Les notes intermédiaires restent visibles lorsqu'elles
  // existent dans notes.notes_trimestre_X.
  // ============================================================

  const extraireMatieresDuTrimestre =
    (studentObj) => {
      if (!studentObj) {
        return [];
      }

      const cleTrimestre =
        `notes_trimestre_${trimestreSelectionne}`;

      // --------------------------------------------------------
      // MOYENNES VALIDÉES PAR LES PROFESSEURS
      // --------------------------------------------------------

      const moyennesMatiere =
        studentObj
          ?.moyennes_matiere?.[
          cleTrimestre
        ] || {};

      // --------------------------------------------------------
      // NOTES INTERMEDIAIRES
      // --------------------------------------------------------

      const notesTrimestre =
        studentObj
          ?.notes?.[
          cleTrimestre
        ] || {};

      const liste = [];

      const matieres = new Set([
        ...Object.keys(
          moyennesMatiere
        ),
        ...Object.keys(
          notesTrimestre
        )
      ]);

      matieres.forEach(
        (matiere) => {
          const objetMoyenne =
            moyennesMatiere?.[
              matiere
            ];

          const notesSource =
            notesTrimestre?.[
              matiere
            ];

          // ------------------------------------------------------
          // MOYENNE DE MATIERE
          // ------------------------------------------------------

          let moyenne = null;

          if (
            objetMoyenne &&
            typeof objetMoyenne ===
              'object' &&
            !Array.isArray(
              objetMoyenne
            )
          ) {
            const valeur =
              objetMoyenne.note;

            if (
              valeur !==
                undefined &&
              valeur !== null &&
              valeur !== ''
            ) {
              const nombre =
                Number(valeur);

              if (
                Number.isFinite(
                  nombre
                )
              ) {
                moyenne =
                  nombre;
              }
            }
          }

          // ------------------------------------------------------
          // COEFFICIENT
          // ------------------------------------------------------

          let coefficient = null;

          if (
            objetMoyenne &&
            typeof objetMoyenne ===
              'object'
          ) {
            const valeurCoefficient =
              objetMoyenne.coefficientMatiere ??
              objetMoyenne.coefficient ??
              objetMoyenne.coefMatiere ??
              objetMoyenne.coef;

            if (
              valeurCoefficient !==
                undefined &&
              valeurCoefficient !==
                null &&
              valeurCoefficient !== ''
            ) {
              const nombre =
                Number(
                  valeurCoefficient
                );

              if (
                Number.isFinite(
                  nombre
                )
              ) {
                coefficient =
                  nombre;
              }
            }
          }

          // ------------------------------------------------------
          // MOYENNE PONDEREE
          // ------------------------------------------------------

          let moyennePonderee =
            null;

          if (
            objetMoyenne &&
            typeof objetMoyenne ===
              'object'
          ) {
            const valeurPonderee =
              objetMoyenne.moyennePonderee ??
              objetMoyenne.moyenneMatierePonderee ??
              objetMoyenne.moyenneTrimestriellePonderee ??
              objetMoyenne.moyennePondere;

            if (
              valeurPonderee !==
                undefined &&
              valeurPonderee !==
                null &&
              valeurPonderee !== ''
            ) {
              const nombre =
                Number(
                  valeurPonderee
                );

              if (
                Number.isFinite(
                  nombre
                )
              ) {
                moyennePonderee =
                  nombre;
              }
            }
          }

          // ------------------------------------------------------
          // SI LA MOYENNE PONDEREE N'EST PAS STOCKEE
          // MAIS QUE MOYENNE + COEFFICIENT EXISTENT
          // ------------------------------------------------------

          if (
            moyennePonderee ===
              null &&
            moyenne !== null &&
            coefficient !== null
          ) {
            moyennePonderee =
              moyenne *
              coefficient;
          }

          // ------------------------------------------------------
          // APPRECIATION PROFESSEUR
          // ------------------------------------------------------

          const appreciation =
            objetMoyenne?.appreciation ||
            objetMoyenne?.appreciationProfesseur ||
            objetMoyenne?.appreciationTeacher ||
            '';

          // ------------------------------------------------------
          // NOM PROFESSEUR
          // ------------------------------------------------------

          const professeurName =
            objetMoyenne?.professeurName ||
            objetMoyenne?.professeurNom ||
            objetMoyenne?.nomProfesseur ||
            '';

          // ------------------------------------------------------
          // SIGNATURE PROFESSEUR
          // ------------------------------------------------------

          const signature =
            objetMoyenne?.signet ||
            objetMoyenne?.signatureProfesseur ||
            objetMoyenne?.signatureProfesseurImage ||
            objetMoyenne?.signature ||
            '';

          // ------------------------------------------------------
          // NOTES INTERMEDIAIRES
          // ------------------------------------------------------

          const notesIntermediaires =
            [];

          if (
            Array.isArray(
              notesSource
            )
          ) {
            notesSource.forEach(
              (noteObj) => {
                if (
                  noteObj &&
                  typeof noteObj ===
                    'object'
                ) {
                  const valeur =
                    noteObj.note;

                  if (
                    valeur !==
                      undefined &&
                    valeur !== null &&
                    valeur !== ''
                  ) {
                    const nombre =
                      Number(
                        valeur
                      );

                    if (
                      Number.isFinite(
                        nombre
                      )
                    ) {
                      notesIntermediaires.push(
                        {
                          note: nombre,
                          type:
                            noteObj.type ||
                            noteObj.typeEvaluation ||
                            '',
                          date:
                            noteObj.date ||
                            ''
                        }
                      );
                    }
                  }
                } else {
                  const nombre =
                    Number(
                      noteObj
                    );

                  if (
                    Number.isFinite(
                      nombre
                    )
                  ) {
                    notesIntermediaires.push(
                      {
                        note: nombre,
                        type: '',
                        date: ''
                      }
                    );
                  }
                }
              }
            );
          }

          // ------------------------------------------------------
          // ON GARDE LA MATIERE SI ELLE A AU MOINS
          // UNE DONNEE PEDAGOGIQUE
          // ------------------------------------------------------

          if (
            moyenne === null &&
            coefficient === null &&
            moyennePonderee === null &&
            notesIntermediaires.length ===
              0 &&
            !appreciation &&
            !professeurName
          ) {
            return;
          }

          liste.push({
            matiere,

            moyenne,

            coefficient,

            moyennePonderee,

            appreciation:
              appreciation ||
              '—',

            professeurName:
              professeurName ||
              '—',

            signature,

            notesIntermediaires
          });
        }
      );

      return liste.sort(
        (a, b) =>
          String(
            a.matiere || ''
          ).localeCompare(
            String(
              b.matiere || ''
            ),
            'fr',
            {
              sensitivity:
                'base'
            }
          )
      );
    };

  // ============================================================
  // MATIERES DE MON BULLETIN
  // ============================================================

  const mesMatieresFiltrees =
    useMemo(() => {
      return extraireMatieresDuTrimestre(
        profilLoggeLive
      );
    }, [
      profilLoggeLive,
      trimestreSelectionne
    ]);

  // ============================================================
  // MOYENNE GENERALE DE L'ELEVE
  // ============================================================

  const maMoyenneGenerale =
    useMemo(() => {
      if (
        mesMatieresFiltrees.length ===
        0
      ) {
        return null;
      }

      let totalPoints = 0;
      let totalCoefficients = 0;

      mesMatieresFiltrees.forEach(
        (matiere) => {
          const moyenne =
            Number(
              matiere.moyenne
            );

          const coefficient =
            Number(
              matiere.coefficient
            );

          if (
            Number.isFinite(
              moyenne
            ) &&
            Number.isFinite(
              coefficient
            ) &&
            coefficient > 0
          ) {
            const points =
              Number.isFinite(
                Number(
                  matiere.moyennePonderee
                )
              )
                ? Number(
                    matiere.moyennePonderee
                  )
                : moyenne *
                  coefficient;

            totalPoints +=
              points;

            totalCoefficients +=
              coefficient;
          }
        }
      );

      if (
        totalCoefficients >
        0
      ) {
        return Number(
          (
            totalPoints /
            totalCoefficients
          ).toFixed(2)
        );
      }

      const moyennes =
        mesMatieresFiltrees
          .map(
            (matiere) =>
              Number(
                matiere.moyenne
              )
          )
          .filter(
            Number.isFinite
          );

      if (
        moyennes.length ===
        0
      ) {
        return null;
      }

      const total =
        moyennes.reduce(
          (acc, valeur) =>
            acc + valeur,
          0
        );

      return Number(
        (
          total /
          moyennes.length
        ).toFixed(2)
      );
    }, [
      mesMatieresFiltrees
    ]);

  // ============================================================
  // TOTAL POINTS DE L'ELEVE
  // ============================================================

  const mesPointsTrimestriels =
    useMemo(() => {
      return mesMatieresFiltrees.reduce(
        (total, matiere) => {
          const moyennePonderee =
            Number(
              matiere.moyennePonderee
            );

          if (
            Number.isFinite(
              moyennePonderee
            )
          ) {
            return (
              total +
              moyennePonderee
            );
          }

          const moyenne =
            Number(
              matiere.moyenne
            );

          const coefficient =
            Number(
              matiere.coefficient
            );

          if (
            Number.isFinite(
              moyenne
            ) &&
            Number.isFinite(
              coefficient
            )
          ) {
            return (
              total +
              moyenne *
                coefficient
            );
          }

          return total;
        },
        0
      );
    }, [
      mesMatieresFiltrees
    ]);

  // ============================================================
  // NOTES DETAILLEES POUR L'AFFICHAGE
  // ============================================================

  const mesNotesFiltrees =
    useMemo(() => {
      const liste = [];

      mesMatieresFiltrees.forEach(
        (matiere) => {
          matiere.notesIntermediaires.forEach(
            (noteObj) => {
              liste.push({
                matiere:
                  matiere.matiere,

                valeur:
                  Number(
                    noteObj.note
                  ),

                type:
                  noteObj.type ||
                  'Évaluation',

                date:
                  noteObj.date ||
                  ''
              });
            }
          );
        }
      );

      return liste;
    }, [
      mesMatieresFiltrees
    ]);

  // ============================================================
  // CLASSEMENT DE LA PROMOTION
  // ============================================================
  //
  // IMPORTANT :
  // classement basé sur les points pondérés transmis,
  // pas sur les devoirs intermédiaires.
  // ============================================================

  const listeClassementPromo =
    useMemo(() => {
      return tousElevesPromo
        .map((student) => {
          const matieres =
            extraireMatieresDuTrimestre(
              student
            );

          let totalPoints = 0;

          let totalCoefficients = 0;

          matieres.forEach(
            (matiere) => {
              const moyennePonderee =
                Number(
                  matiere.moyennePonderee
                );

              const moyenne =
                Number(
                  matiere.moyenne
                );

              const coefficient =
                Number(
                  matiere.coefficient
                );

              if (
                Number.isFinite(
                  moyennePonderee
                )
              ) {
                totalPoints +=
                  moyennePonderee;
              } else if (
                Number.isFinite(
                  moyenne
                ) &&
                Number.isFinite(
                  coefficient
                ) &&
                coefficient > 0
              ) {
                totalPoints +=
                  moyenne *
                  coefficient;
              }

              if (
                Number.isFinite(
                  coefficient
                ) &&
                coefficient > 0
              ) {
                totalCoefficients +=
                  coefficient;
              }
            }
          );

          const moyenneGenerale =
            totalCoefficients >
            0
              ? totalPoints /
                totalCoefficients
              : null;

          return {
            ...student,

            totalPoints,

            totalCoefficients,

            moyenneGenerale
          };
        })
        .sort(
          (a, b) =>
            b.totalPoints -
            a.totalPoints
        );
    }, [
      tousElevesPromo,
      trimestreSelectionne
    ]);

  // ============================================================
  // RANG DE L'ELEVE
  // ============================================================

  const indexMonEleve =
    listeClassementPromo.findIndex(
      (eleve) => {
        return (
          eleve.id ===
            idEleveLogge ||
          eleve.matricule ===
            matriculeEleve
        );
      }
    );

  const monRangDansLaPromo =
    indexMonEleve >= 0
      ? indexMonEleve + 1
      : '—';

  // ============================================================
  // MESSAGERIE
  // ============================================================

  const handleExpedierMessage =
    async (e) => {
      e.preventDefault();

      if (
        !texteMessageUrgent.trim()
      ) {
        return;
      }

      setSendingMsg(true);

      try {
        const expediteurNomComplet =
          `${profilLoggeLive?.nom || ''} ${
            profilLoggeLive?.prenoms ||
            profilLoggeLive?.prenom ||
            ''
          }`
            .trim()
            .toUpperCase();

        const eleveCible =
          tousElevesPromo.find(
            (eleve) =>
              eleve.id ===
              filtreMessageCible
          );

        await addDoc(
          collection(
            db,
            'notifications'
          ),
          {
            schoolId:
              currentSchool,

            expediteurId:
              idEleveLogge,

            expediteurNom:
              expediteurNomComplet ||
              'ÉLÈVE',

            destinataireId:
              filtreMessageCible,

            destinataireNom:
              filtreMessageCible ===
              'ADMIN'
                ? 'ADMINISTRATION CENTRALE'
                : `${
                    eleveCible?.nom ||
                    ''
                  } ${
                    eleveCible?.prenoms ||
                    eleveCible?.prenom ||
                    ''
                  }`.trim() ||
                  'ÉLÈVE CIBLE',

            message:
              texteMessageUrgent.trim(),

            roleEmetteur:
              'eleve',

            type:
              filtreMessageCible ===
              'ADMIN'
                ? 'reclamation'
                : 'chat_eleve',

            createdAt:
              new Date().toISOString()
          }
        );

        setTexteMessageUrgent(
          ''
        );
      } catch (err) {
        console.error(
          "Erreur d'envoi du message :",
          err
        );
      } finally {
        setSendingMsg(false);
      }
    };

  // ============================================================
  // PDF BULLETIN
  // ============================================================

  const handleTelechargerBulletinPDF =
    () => {
      imprimerBulletinTrimestriel(
        profilLoggeLive ||
          user,
        activeSchoolName,
        activeSchoolId
      );
    };

  // ============================================================
  // MESSAGES FILTRES
  // ============================================================

  const messagesFiltresChat =
    discussionsMessages.filter(
      (message) => {
        if (
          filtreMessageCible ===
          'ADMIN'
        ) {
          return (
            message.type ===
              'reclamation' &&
            (
              message.expediteurId ===
                idEleveLogge ||
              message.expediteurId ===
                matriculeEleve ||
              message.destinataireId ===
                idEleveLogge ||
              message.destinataireId ===
                matriculeEleve
            )
          );
        }

        return (
          message.type ===
            'chat_eleve' &&
          (
            (
              (
                message.expediteurId ===
                  idEleveLogge ||
                message.expediteurId ===
                  matriculeEleve
              ) &&
              message.destinataireId ===
                filtreMessageCible
            ) ||
            (
              message.expediteurId ===
                filtreMessageCible &&
              (
                message.destinataireId ===
                  idEleveLogge ||
                message.destinataireId ===
                  matriculeEleve
              )
            )
          )
        );
      }
    );

  // ============================================================
  // CONTACTS DE LA CLASSE / PROMOTION
  // ============================================================

  const contactsChat =
    useMemo(() => {
      const recherche =
        normaliser(
          rechercheContactChat
        );

      return tousElevesPromo
        .filter(
          (eleve) =>
            eleve.id !==
              idEleveLogge &&
            eleve.matricule !==
              matriculeEleve
        )
        .filter(
          (eleve) => {
            if (
              filtreScopeChat ===
              'classe'
            ) {
              const classeEleveContact =
                normaliser(
                  eleve.classeId ||
                    eleve.classe ||
                    eleve.classeNom ||
                    ''
                );

              const classeActuelle =
                normaliser(
                  classeEleve
                );

              if (
                classeEleveContact !==
                  classeActuelle &&
                !classeEleveContact.includes(
                  classeActuelle
                ) &&
                !classeActuelle.includes(
                  classeEleveContact
                )
              ) {
                return false;
              }
            }

            const nomComplet =
              normaliser(
                `${eleve.nom || ''} ${
                  eleve.prenoms ||
                  eleve.prenom ||
                  ''
                }`
              );

            return (
              !recherche ||
              nomComplet.includes(
                recherche
              )
            );
          }
        );
    }, [
      tousElevesPromo,
      idEleveLogge,
      matriculeEleve,
      filtreScopeChat,
      rechercheContactChat,
      classeEleve
    ]);

  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">
        Ouverture du canal de communication...
      </div>
    );
  }

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="min-h-screen bg-white font-sans sm:p-6 lg:p-8 animate-fadeIn text-gray-700 text-left">
      <Header/>
      {/* ======================================================
          BARRE SUPERIEURE
      ======================================================= */}

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-4 mb-6 gap-4">

        <div>

          <span className="compagnon text-[10px] font-black uppercase tracking-widest  text-purple-700 px-3 py-1 rounded-full">
           Mon Relevé de Notes Certifié NoSQL
          </span>

          <h1 className="eleve text-xl md:text-2xl font-black text-gray-900 mt-2 uppercase">
            <img
                  src={
                    profilLoggeLive.photoUrl ||
                    profilLoggeLive.photoBase64 ||
                    profilLoggeLive.photo
                  }
                  alt="Profil"
                  className="photoeleve w-full h-full object-cover"
                /><br/>
                {' '}
            {profilLoggeLive?.nom ||
              user?.nom ||
              ''}
            {' '}
            {profilLoggeLive?.prenoms ||
              profilLoggeLive?.prenom ||
              user?.prenoms ||
              ''}
          </h1>

          <p className="elevematricul text-xs text-gray-400 font-medium mt-0.5">
            Matricule :{' '}
            <span className="font-mono font-bold text-purple-700">
              {profilLoggeLive?.matricule ||
                matriculeEleve ||
                idEleveLogge}
            </span>
            {' — '}
            Division Active :{' '}
            <span className="uppercase font-black text-gray-600">
              {profilLoggeLive?.classeNom ||
                profilLoggeLive?.classe ||
                classeEleve}
            </span>
          </p>

        </div>

      </div>

         {/* ======================================================
               BLOC BULLETIN PDF
           ======================================================= */}
     
           <div className="max-w-7xl mx-auto mt-6">
     
             <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-3xs flex flex-col justify-between items-start gap-3">
     
               <div>
     
                 <span className="text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                   Bulletins trimestriels
                 </span>
     
                 <h3 className="text-sm font-black text-gray-900 mt-2 uppercase">
                   Mon Relevé de Notes
                   Certifié NoSQL
                 </h3>
     
                 <p className="text-[11px] text-gray-400 font-medium mt-1">
                   Générez et téléchargez
                   votre bulletin trimestriel
                   officiel muni de son QR
                   Code de certification de
                   l'établissement.
                 </p>
     
               </div>
     
               <button
                 type="button"
                 onClick={
                   handleTelechargerBulletinPDF
                 }
                 className="bg-purple-600 hover:bg-purple-700  font-black text-[10px] uppercase px-4 py-2.5 rounded-xl transition shadow-xs cursor-pointer border-0"
               >
                 📥 Imprimer / Télécharger
                 mon Bulletin PDF
               </button>
     
             </div>
           </div>
      {/* ======================================================
          ACCUEIL
      ======================================================= */}

      {activeSubSection ===
        'accueil' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 animate-fadeIn items-start text-left">

          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">

            {/* ABSENCES */}

            <div className="bg-white p-5 rounded-2xl border shadow-2xs">

              <p className="text-[10px] font-black uppercase text-gray-400">
                Absences Trimestre{' '}
                {trimestreSelectionne}
              </p>

              <p className="text-2xl font-black text-red-600 mt-1">
                {absencesDuTrimestre}{' '}
                H
              </p>

            </div>

            {/* RANG */}

            <div className="bg-white p-5 rounded-2xl border shadow-2xs">

              <p className="text-[10px] font-black uppercase text-gray-400">
                Position Promotionnelle
              </p>

              <p className="text-2xl font-black text-purple-700 mt-1">
                {monRangDansLaPromo}
                {typeof monRangDansLaPromo ===
                  'number' && (
                  <sup>
                    e
                  </sup>
                )}

                <span className="text-xs font-bold text-gray-400 ml-1">
                  /{' '}
                  {
                    tousElevesPromo.length
                  }
                </span>
              </p>

            </div>

            {/* MOYENNE */}

            <div className="bg-white p-5 rounded-2xl border shadow-2xs">

              <p className="text-[10px] font-black uppercase text-purple-600">
                Moyenne Générale T
                {trimestreSelectionne}
              </p>

              <p className="text-2xl font-black text-gray-900 mt-1">
                {maMoyenneGenerale !==
                null
                  ? maMoyenneGenerale.toFixed(
                      2
                    )
                  : '--'}{' '}
                /20
              </p>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          BULLETIN
      ======================================================= */}

      {activeSubSection ===
        'bulletins' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border p-6 shadow-sm animate-fadeIn text-left">

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-4 gap-3">

            <div>

              <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider">
                📄 Relevé de Notes du
                Trimestre{' '}
                {
                  trimestreSelectionne
                }
              </h3>

              <p className="text-[10px] text-gray-400 mt-1">
                Moyennes transmises par
                les professeurs et
                appréciations pédagogiques.
              </p>

            </div>

            <button
              type="button"
              onClick={
                handleTelechargerBulletinPDF
              }
              className="bg-purple-600 hover:bg-purple-700  font-black text-xs uppercase px-4 py-2 rounded-xl transition shadow-sm cursor-pointer"
            >
              🖨️ Télécharger mon
              Bulletin PDF
            </button>

          </div>

          {/* ==================================================
              TABLEAU DES MATIERES
          =================================================== */}

          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">

              <thead>

                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">

                  <th className="p-3">
                    Discipline
                  </th>

                  <th className="p-3">
                    Notes
                  </th>

                  <th className="p-3 text-center">
                    Moyenne
                  </th>

                  <th className="p-3 text-center">
                    Coef.
                  </th>

                  <th className="p-3 text-center">
                    Points
                  </th>

                  <th className="p-3">
                    Appréciation du
                    professeur
                  </th>

                </tr>

              </thead>

              <tbody>

                {mesMatieresFiltrees.length ===
                0 ? (
                  <tr>

                    <td
                      colSpan="6"
                      className="p-12 text-center text-gray-400 italic"
                    >
                      Aucune moyenne
                      transmise pour le
                      Trimestre{' '}
                      {
                        trimestreSelectionne
                      }
                      .
                    </td>

                  </tr>
                ) : (
                  mesMatieresFiltrees.map(
                    (
                      matiere,
                      index
                    ) => (
                      <tr
                        key={`${matiere.matiere}-${index}`}
                        className="border-b border-gray-100 hover:bg-purple-50/10 transition"
                      >

                        {/* MATIERE */}

                        <td className="p-3 text-purple-700 uppercase font-black">
                          📚{' '}
                          {
                            matiere.matiere
                          }

                          {matiere.professeurName &&
                            matiere.professeurName !==
                              '—' && (
                              <span className="block text-[9px] text-gray-400 font-medium normal-case mt-1">
                                Prof. :{' '}
                                {
                                  matiere.professeurName
                                }
                              </span>
                            )}
                        </td>

                        {/* NOTES */}

                        <td className="p-3">

                          {matiere.notesIntermediaires
                            .length >
                          0 ? (
                            <div className="flex flex-wrap gap-1">

                              {matiere.notesIntermediaires.map(
                                (
                                  note,
                                  noteIndex
                                ) => (
                                  <span
                                    key={
                                      noteIndex
                                    }
                                    className="bg-gray-100 px-2 py-0.5 rounded font-mono text-[10px]"
                                  >
                                    {Number(
                                      note.note
                                    ).toFixed(
                                      2
                                    )}
                                  </span>
                                )
                              )}

                            </div>
                          ) : (
                            <span className="text-gray-400">
                              —
                            </span>
                          )}

                        </td>

                        {/* MOYENNE */}

                        <td className="p-3 text-center">

                          {matiere.moyenne !==
                          null ? (
                            <span
                              className={`px-2 py-1 rounded-md font-mono font-black ${
                                Number(
                                  matiere.moyenne
                                ) >= 10
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-rose-50 text-red-600 border border-rose-100'
                              }`}
                            >
                              {Number(
                                matiere.moyenne
                              ).toFixed(
                                2
                              )}
                              {' / 20'}
                            </span>
                          ) : (
                            '—'
                          )}

                        </td>

                        {/* COEFFICIENT */}

                        <td className="p-3 text-center">

                          {matiere.coefficient !==
                          null ? (
                            <span className="px-2 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 font-mono font-black">
                              ×
                              {Number(
                                matiere.coefficient
                              ).toFixed(
                                2
                              )}
                            </span>
                          ) : (
                            '—'
                          )}

                        </td>

                        {/* POINTS */}

                        <td className="p-3 text-center">

                          {matiere.moyennePonderee !==
                          null ? (
                            <span className="px-2 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-100 font-mono font-black">
                              {Number(
                                matiere.moyennePonderee
                              ).toFixed(
                                2
                              )}
                            </span>
                          ) : (
                            '—'
                          )}

                        </td>

                        {/* APPRECIATION */}

                        <td className="p-3">

                          <div className="text-gray-600 italic font-medium">
                            {matiere.appreciation ||
                              '—'}
                          </div>

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

          {/* ==================================================
              RESUME BULLETIN
          =================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">

            <div className="bg-slate-900  rounded-xl p-5 flex justify-between items-center">

              <div>

                <p className="text-[9px] text-slate-400 uppercase font-black">
                  Moyenne générale
                </p>

                <p className="text-[10px] text-slate-500 mt-1">
                  Trimestre{' '}
                  {
                    trimestreSelectionne
                  }
                </p>

              </div>

              <strong className="text-2xl font-mono text-orange-400">
                {maMoyenneGenerale !==
                null
                  ? maMoyenneGenerale.toFixed(
                      2
                    )
                  : '--'}{' '}
                /20
              </strong>

            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 flex justify-between items-center">

              <div>

                <p className="text-[9px] text-purple-500 uppercase font-black">
                  Total des points
                </p>

                <p className="text-[10px] text-purple-400 mt-1">
                  Somme des moyennes
                  pondérées
                </p>

              </div>

              <strong className="text-2xl font-mono text-purple-700">
                {mesPointsTrimestriels.toFixed(
                  2
                )}
              </strong>

            </div>

          </div>

          {/* ==================================================
              BLOC APPRECIATIONS
          =================================================== */}

          <div className="mt-6">

            <h4 className="text-[10px] font-black uppercase text-gray-400 border-b pb-2 mb-3">
              📝 Appréciations pédagogiques
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              {mesMatieresFiltrees.map(
                (
                  matiere,
                  index
                ) => (
                  <div
                    key={`appreciation-${index}`}
                    className="border border-gray-100 rounded-xl p-4 bg-gray-50"
                  >

                    <div className="flex justify-between items-start gap-3">

                      <div>

                        <p className="text-[10px] font-black uppercase text-purple-700">
                          {
                            matiere.matiere
                          }
                        </p>

                        {matiere.professeurName &&
                          matiere.professeurName !==
                            '—' && (
                            <p className="text-[9px] text-gray-400 mt-1">
                              Professeur :{' '}
                              {
                                matiere.professeurName
                              }
                            </p>
                          )}

                      </div>

                      {matiere.moyenne !==
                        null && (
                        <span className="font-mono font-black text-xs text-gray-700">
                          {Number(
                            matiere.moyenne
                          ).toFixed(
                            2
                          )}
                          /20
                        </span>
                      )}

                    </div>

                    <p className="text-[11px] text-gray-600 italic mt-3 leading-relaxed">
                      {matiere.appreciation ||
                        'Aucune appréciation enregistrée.'}
                    </p>

                  </div>
                )
              )}

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          CLASSEMENT
      ======================================================= */}

      {activeSubSection ===
        'classement' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border p-6 shadow-sm animate-fadeIn text-left">

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 mb-4 gap-2">

            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
              🏆 Relevé d'Excellence
              Promotionnel (
              {promoEleve.toUpperCase()}
              )
            </h3>

            <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-700 px-2 py-1 rounded">
              Trimestre{' '}
              {
                trimestreSelectionne
              }
            </span>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">

              <thead>

                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">

                  <th className="p-4 text-center">
                    Rang
                  </th>

                  <th className="p-4">
                    Matricule
                  </th>

                  <th className="p-4">
                    Division
                  </th>

                  <th className="p-4">
                    Nom & Prénoms
                  </th>

                  <th className="p-4 text-center">
                    Moyenne
                  </th>

                  <th className="p-4 text-right">
                    Points
                  </th>

                </tr>

              </thead>

              <tbody>

                {listeClassementPromo.map(
                  (
                    student,
                    index
                  ) => {

                    const estMoi =
                      student.id ===
                        idEleveLogge ||
                      student.matricule ===
                        matriculeEleve;

                    return (
                      <tr
                        key={
                          student.id
                        }
                        className={`border-b border-gray-100 transition ${
                          estMoi
                            ? 'bg-purple-50/50 border-l-4 border-l-purple-600 font-black'
                            : 'hover:bg-gray-50/50'
                        }`}
                      >

                        <td className="p-4 text-center text-sm font-black text-amber-600">
                          {index + 1}{' '}
                          {index ===
                          0
                            ? '🥇'
                            : index ===
                              1
                            ? '🥈'
                            : index ===
                              2
                            ? '🥉'
                            : '✨'}
                        </td>

                        <td className="p-4 font-mono text-gray-400">
                          {student.matricule ||
                            student.id}
                        </td>

                        <td className="p-4 font-mono text-purple-700 uppercase">
                          {student.classeNom ||
                            student.classe ||
                            student.classeId ||
                            '—'}
                        </td>

                        <td className="p-4 text-gray-900 uppercase">

                          {student.nom ||
                            ''}{' '}
                          {student.prenoms ||
                            student.prenom ||
                            ''}

                          {estMoi && (
                            <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded font-mono ml-2">
                              MOI
                            </span>
                          )}

                        </td>

                        <td className="p-4 text-center font-mono font-black text-gray-700">

                          {Number.isFinite(
                            Number(
                              student.moyenneGenerale
                            )
                          )
                            ? Number(
                                student.moyenneGenerale
                              ).toFixed(
                                2
                              )
                            : '—'}

                        </td>

                        <td className="p-4 text-right font-mono text-purple-700 text-sm">

                          {Number(
                            student.totalPoints ||
                              0
                          ).toFixed(
                            2
                          )}{' '}
                          pts

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

      {/* ======================================================
          MESSAGERIE
      ======================================================= */}

      {activeSubSection ===
        'messages' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-3 animate-fadeIn h-[480px] overflow-hidden text-left">

          {/* ==================================================
              CONTACTS
          =================================================== */}

          <div className="md:col-span-1 border-r flex flex-col justify-start bg-gray-50/50 h-[480px]">

            <div className="p-4 bg-gray-50 border-b space-y-3">

              <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">
                Canaux & Contacts
              </h4>

              <div className="flex bg-white p-0.5 rounded-lg border text-[10px] font-black uppercase">

                <button
                  type="button"
                  onClick={() =>
                    setFiltreScopeChat(
                      'classe'
                    )
                  }
                  className={`flex-1 py-1 rounded transition text-center cursor-pointer ${
                    filtreScopeChat ===
                    'classe'
                      ? 'bg-purple-600  shadow-2xs'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Ma Classe
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFiltreScopeChat(
                      'promotion'
                    )
                  }
                  className={`flex-1 py-1 rounded transition text-center cursor-pointer ${
                    filtreScopeChat ===
                    'promotion'
                      ? 'bg-purple-600  shadow-2xs'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Toute la Promo
                </button>

              </div>

              <input
                type="text"
                placeholder="🔍 Rechercher un camarade..."
                value={
                  rechercheContactChat
                }
                onChange={(e) =>
                  setRechercheContactChat(
                    e.target.value
                  )
                }
                className="w-full bg-white border p-2 rounded-lg outline-none text-[11px] font-bold text-gray-700 focus:ring-1 focus:ring-purple-500"
              />

            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1 text-xs font-bold text-gray-700 max-h-[340px]">

              <button
                type="button"
                onClick={() =>
                  setFiltreMessageCible(
                    'ADMIN'
                  )
                }
                className={`w-full text-left p-3 rounded-xl transition font-bold flex items-center justify-between cursor-pointer ${
                  filtreMessageCible ===
                  'ADMIN'
                    ? 'bg-purple-600  shadow-xs'
                    : 'bg-white border hover:bg-gray-100'
                }`}
              >

                <span>
                  🏛️ Secrétariat /
                  Réclamations
                </span>

                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full ${
                    filtreMessageCible ===
                    'ADMIN'
                      ? 'bg-purple-950 text-purple-300'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  ADMIN
                </span>

              </button>

              <div className="pt-3 pb-1 px-2 border-b">

                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  {filtreScopeChat ===
                  'classe'
                    ? `Mes camarades de (${classeEleve.toUpperCase()})`
                    : `Liste Promotionnelle (${promoEleve.toUpperCase()})`}
                </span>

              </div>

              {contactsChat.map(
                (student) => (
                  <button
                    type="button"
                    key={student.id}
                    onClick={() =>
                      setFiltreMessageCible(
                        student.id
                      )
                    }
                    className={`w-full text-left p-2.5 rounded-xl transition flex justify-between items-center cursor-pointer ${
                      filtreMessageCible ===
                      student.id
                        ? 'bg-slate-900 text-orange-400 font-black shadow-xs'
                        : 'bg-white border hover:bg-gray-100'
                    }`}
                  >

                    <span className="truncate uppercase">
                      {student.nom}{' '}
                      {student.prenoms ||
                        student.prenom ||
                        ''}
                    </span>

                    <span className="font-mono text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded uppercase">
                      {student.classeNom ||
                        student.classe ||
                        student.classeId ||
                        '—'}
                    </span>

                  </button>
                )
              )}

            </div>

          </div>

          {/* ==================================================
              FIL CHAT
          =================================================== */}

          <div className="md:col-span-2 flex flex-col justify-between bg-white h-[480px]">

            <div className="p-4 bg-gray-50 border-b flex justify-between items-center text-xs font-black text-gray-800">

              <p>
                Fil actif :{' '}
                <span className="text-purple-700 uppercase">

                  {filtreMessageCible ===
                  'ADMIN'
                    ? 'Secrétariat central de l\'école'
                    : (() => {
                        const cible =
                          tousElevesPromo.find(
                            (
                              eleve
                            ) =>
                              eleve.id ===
                              filtreMessageCible
                          );

                        return (
                          `${
                            cible?.nom ||
                            ''
                          } ${
                            cible?.prenoms ||
                            cible?.prenom ||
                            ''
                          }`.trim() ||
                          'Élève'
                        );
                      })()}

                </span>
              </p>

              <span className="text-[10px] font-mono text-gray-400 uppercase">
                Canal Cloud
              </span>

            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-gray-50/30 font-medium text-xs max-h-[340px]">

              {messagesFiltresChat.length ===
              0 ? (
                <div className="text-center py-16 text-gray-400 italic">
                  Aucun message échangé
                  dans ce fil. Saisissez
                  votre texte ci-dessous
                  pour initier le dialogue.
                </div>
              ) : (
                messagesFiltresChat.map(
                  (message) => {

                    const estMoi =
                      message.expediteurId ===
                        idEleveLogge ||
                      message.expediteurId ===
                        matriculeEleve;

                    return (
                      <div
                        key={
                          message.id
                        }
                        className={`flex flex-col max-w-[80%] p-3 rounded-2xl shadow-2xs ${
                          estMoi
                            ? 'ml-auto bg-slate-900  rounded-br-none'
                            : 'mr-auto bg-white border text-gray-800 rounded-bl-none'
                        }`}
                      >

                        <span className="text-[8px] font-black uppercase text-purple-400 mb-1">
                          {
                            message.expediteurNom
                          }
                        </span>

                        <p className="leading-relaxed whitespace-pre-wrap font-medium">
                          {
                            message.message
                          }
                        </p>

                      </div>
                    );
                  }
                )
              )}

            </div>

            <form
              onSubmit={
                handleExpedierMessage
              }
              className="p-3 border-t bg-gray-50 flex gap-2"
            >

              <input
                type="text"
                placeholder={
                  filtreMessageCible ===
                  'ADMIN'
                    ? "Rédigez votre réclamation officielle à l'administration..."
                    : 'Tapez votre message privé...'
                }
                value={
                  texteMessageUrgent
                }
                onChange={(e) =>
                  setTexteMessageUrgent(
                    e.target.value
                  )
                }
                className="flex-1 bg-white border rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                required
              />

              <button
                type="submit"
                disabled={
                  sendingMsg ||
                  !texteMessageUrgent.trim()
                }
                className="bg-purple-600 hover:bg-purple-700  font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:bg-gray-200"
              >
                {sendingMsg
                  ? 'Envoi...'
                  : '⚡ Envoyer'}
              </button>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

export default Monbulletin;