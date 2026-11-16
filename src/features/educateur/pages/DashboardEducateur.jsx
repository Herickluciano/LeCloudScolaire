// src/features/educateur/pages/DashboardEducateur.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { useSearchParams, Link } from 'react-router-dom';

import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';

import ReceptionInstructionsAdmin from '../../admin/pages/messages/ReceptionAdmin';
import ListePromotion from './ListePromotion';
import Rectification from './Rectification';
import GestionPaieVacations from './arbitrages/GestionPaieVacations';
import SignaturePadModal from '../../../components/SignaturePadModal';
import Header from '../../../pages/Header';
import Messagerie from '../../../components/Messagerie';
import EnvoyerMessageUnique from '../../../components/EnvoyerMessageUnique';
import BoiteReceptionUnique from '../../../components/BoiteReceptionUnique';

const DashboardEducateur = () => {
  const { user, schoolId, logout } = useAuth();
  const navigate = useNavigate();

  // ==========================================================
  // IDENTITÉ / ÉTABLISSEMENT
  // ==========================================================

  const idEducateur = useMemo(() => {
    return String(
      user?.id ||
      user?.matricule ||
      user?.uid ||
      sessionStorage.getItem('sgs_user_id') ||
      ''
    ).trim();
  }, [user]);

  const currentSchool = useMemo(() => {
    return String(
      schoolId ||
      user?.schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      'lycee_saint_bernard'
    )
      .trim()
      .toLowerCase();
  }, [schoolId, user]);

  const schoolName =
    user?.etablissementActuel ||
    user?.schoolName ||
    sessionStorage.getItem('sgs_school_name') ||
    'Établissement Edulink';

  const nomEducateur =
    `${user?.prenoms || ''} ${user?.nom || ''}`.trim() ||
    user?.name ||
    'Éducateur';

  // ==========================================================
  // ÉTATS
  // ==========================================================

  const [activeTab, setActiveTab] = useState('dashboard_global');

  const [listeClasses, setListeClasses] = useState([]);
  const [elevesPromo, setElevesPromo] = useState([]);

  const [fichesAppels, setFichesAppels] = useState([]);
  const [pointagesProfesseurs, setPointagesProfesseurs] = useState([]);
  const [emploisDuTemps, setEmploisDuTemps] = useState([]);

  const [classeSelectionnee, setClasseSelectionnee] = useState('all');

  const [loadingClasse, setLoadingClasse] = useState(true);
  const [loadingEleves, setLoadingEleves] = useState(true);

  const [maintenant, setMaintenant] = useState(new Date());

  const [isModalDelegueOpen, setIsModalDelegueOpen] = useState(false);
  const [isPadOpen, setIsPadOpen] = useState(false);

  const [rechercheEleveDelegue, setRechercheEleveDelegue] = useState('');
  const [rechercheClasseDelegue, setRechercheClasseDelegue] = useState('');

  const [eleveSelectionneConseil, setEleveSelectionneConseil] = useState(null);
  const [avisConduiteConseil, setAvisConduiteConseil] = useState('');

  const [sujetrCiculaire, setSujetCirculaire] = useState('');
  const [corpsCirculaire, setCorpsCirculaire] = useState('');

  const [sending, setSending] = useState(false);

  const [msgStatus, setMsgStatus] = useState({
    type: '',
    text: ''
  });

  // ==========================================================
  // HORLOGE LIVE
  // ==========================================================

  useEffect(() => {
    const timer = setInterval(() => {
      setMaintenant(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const dateAujourdhui = useMemo(
    () => maintenant.toLocaleDateString('fr-FR'),
    [maintenant]
  );

  const heureActuelle = useMemo(
    () =>
      maintenant.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
    [maintenant]
  );

  const jourActuel = useMemo(
    () =>
      maintenant
        .toLocaleDateString('fr-FR', {
          weekday: 'long'
        })
        .replace(/^./, (c) => c.toUpperCase()),
    [maintenant]
  );

  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const normaliser = (valeur) => {
    return String(valeur || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const idsPossiblesEducateur = useMemo(() => {
    return [
      user?.id,
      user?.uid,
      user?.matricule,
      idEducateur
    ]
      .filter(Boolean)
      .map((id) => String(id).trim());
  }, [user, idEducateur]);

  // ==========================================================
  // CLASSES DE L'ÉDUCATEUR
  // ==========================================================

  useEffect(() => {
    if (!currentSchool || !idEducateur) {
      setListeClasses([]);
      setLoadingClasse(false);
      return;
    }

    setLoadingClasse(true);

    const q = query(
      collection(db, 'classes'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const classes = [];

        snapshot.forEach((snap) => {
          const data = snap.data();

          const educateurIds = [
            data.educateurId,
            data.educateurID,
            data.educateurUid,
            data.educateurUID,
            data.idEducateur,
            data.educateur
          ]
            .filter(Boolean)
            .map((id) => String(id).trim());

          const listeEducateurs = Array.isArray(data.educateurs)
            ? data.educateurs.map((id) => String(id).trim())
            : [];

          const estClasseEducateur =
            idsPossiblesEducateur.some((id) =>
              educateurIds.includes(id)
            ) ||
            idsPossiblesEducateur.some((id) =>
              listeEducateurs.includes(id)
            );

          if (estClasseEducateur) {
            classes.push({
              id: snap.id,
              ...data
            });
          }
        });

        setListeClasses(classes);
        setLoadingClasse(false);
      },
      (error) => {
        console.error(
          '❌ Erreur récupération classes éducateur :',
          error
        );

        setListeClasses([]);
        setLoadingClasse(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchool, idEducateur, idsPossiblesEducateur]);

  // ==========================================================
  // PROMOTION
  // ==========================================================

  const promotionDynamique = useMemo(() => {
    const valeur =
      user?.assigned_promotion ||
      user?.assignedPromotion ||
      user?.promotion ||
      listeClasses[0]?.promotion ||
      '';

    return String(valeur).trim();
  }, [user, listeClasses]);

  // ==========================================================
  // CLASSES CIBLES
  // ==========================================================

  const classesCibles = useMemo(() => {
    if (classeSelectionnee === 'all') {
      return listeClasses;
    }

    return listeClasses.filter(
      (classe) => classe.id === classeSelectionnee
    );
  }, [classeSelectionnee, listeClasses]);

  const idsClassesCibles = useMemo(() => {
    return classesCibles.map((classe) => String(classe.id));
  }, [classesCibles]);

  // ==========================================================
  // EXTRACTION COEFFICIENT
  // ==========================================================

  const extraireCoefficient = (matiereConfig) => {
    if (!matiereConfig || typeof matiereConfig !== 'object') {
      return 0;
    }

    const coefficient =
      matiereConfig.coefficientMatiere ??
      matiereConfig.coefficient ??
      matiereConfig.coefMatiere ??
      matiereConfig.coef ??
      0;

    const nombre = Number(coefficient);

    return Number.isFinite(nombre) ? nombre : 0;
  };

  // ==========================================================
  // EXTRACTION MOYENNE MATIÈRE
  // ==========================================================

  const extraireMoyenneMatiere = (matiereConfig) => {
    if (!matiereConfig || typeof matiereConfig !== 'object') {
      return 0;
    }

    const moyenne =
      matiereConfig.note ??
      matiereConfig.moyenne ??
      matiereConfig.moyenneTrimestrielle ??
      matiereConfig.moyenneMatiere ??
      0;

    const nombre = Number(moyenne);

    return Number.isFinite(nombre) ? nombre : 0;
  };

  // ==========================================================
  // EXTRACTION MOYENNE PONDÉRÉE
  // ==========================================================

  const extraireMoyennePonderee = (
    matiereConfig,
    moyenne,
    coefficient
  ) => {
    if (!matiereConfig || typeof matiereConfig !== 'object') {
      return moyenne * coefficient;
    }

    const valeurExistante =
      matiereConfig.moyennePonderee ??
      matiereConfig.moyenneMatierePonderee ??
      matiereConfig.moyenneTrimestriellePonderee ??
      matiereConfig.moyennePondere ??
      null;

    if (
      valeurExistante !== null &&
      valeurExistante !== undefined &&
      valeurExistante !== ''
    ) {
      const nombre = Number(valeurExistante);

      if (Number.isFinite(nombre)) {
        return nombre;
      }
    }

    return moyenne * coefficient;
  };

  // ==========================================================
  // RÉCUPÉRATION DES ÉLÈVES
  // ==========================================================

  useEffect(() => {
    if (!currentSchool) {
      setElevesPromo([]);
      setLoadingEleves(false);
      return;
    }

    setLoadingEleves(true);

    const q = query(
      collection(db, 'users'),
      where('schoolId', '==', currentSchool),
      where('role', '==', 'eleve')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((snap) => {
          const data = snap.data();

          const classeId = String(
            data.classeId ||
            data.classeID ||
            ''
          ).trim();

          const appartientClasse =
            classeSelectionnee === 'all'
              ? idsClassesCibles.includes(classeId)
              : classeId === classeSelectionnee;

          if (!appartientClasse) {
            return;
          }

          // ====================================================
          // CALCUL DES POINTS PAR MATIÈRE
          // ====================================================

          const moyennesMatiere =
            data.moyennes_matiere || {};

          let totalPointsCumules = 0;
          let totalMoyennesMatieres = 0;
          let nombreMatieres = 0;

          const detailsMatieres = [];

          Object.entries(moyennesMatiere).forEach(
            ([periode, periodeMap]) => {
              if (
                !periodeMap ||
                typeof periodeMap !== 'object' ||
                Array.isArray(periodeMap)
              ) {
                return;
              }

              Object.entries(periodeMap).forEach(
                ([nomMatiere, matiereConfig]) => {
                  if (
                    !matiereConfig ||
                    typeof matiereConfig !== 'object'
                  ) {
                    return;
                  }

                  const moyenne =
                    extraireMoyenneMatiere(
                      matiereConfig
                    );

                  const coefficient =
                    extraireCoefficient(
                      matiereConfig
                    );

                  const moyennePonderee =
                    extraireMoyennePonderee(
                      matiereConfig,
                      moyenne,
                      coefficient
                    );

                  if (moyenne > 0) {
                    totalMoyennesMatieres += moyenne;
                    nombreMatieres += 1;
                  }

                  // ==========================================
                  // IMPORTANT :
                  // LES POINTS = MOYENNE PONDÉRÉE
                  // ==========================================

                  if (moyennePonderee > 0) {
                    totalPointsCumules += moyennePonderee;
                  }

                  detailsMatieres.push({
                    periode,
                    matiere: nomMatiere,
                    moyenne,
                    coefficient,
                    moyennePonderee,
                    appreciation:
                      matiereConfig.appreciation || '',
                    professeurName:
                      matiereConfig.professeurName ||
                      matiereConfig.professeur ||
                      '',
                    signature:
                      matiereConfig.signatureProfesseur ||
                      matiereConfig.signature ||
                      matiereConfig.signet ||
                      ''
                  });
                }
              );
            }
          );

          liste.push({
            id: snap.id,
            ...data,

            totalPointsCumules,

            moyenneGeneraleMatieres:
              nombreMatieres > 0
                ? totalMoyennesMatieres /
                  nombreMatieres
                : 0,

            detailsMatieres
          });
        });

        setElevesPromo(liste);
        setLoadingEleves(false);
      },
      (error) => {
        console.error(
          '❌ Erreur écoute élèves :',
          error
        );

        setElevesPromo([]);
        setLoadingEleves(false);
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    classeSelectionnee,
    idsClassesCibles
  ]);

  // ==========================================================
  // REGISTRE APPELS
  // ==========================================================

  useEffect(() => {
    if (!currentSchool) {
      setFichesAppels([]);
      return;
    }

    const q = query(
      collection(db, 'registre_appels'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((snap) => {
          const data = snap.data();

          const classeId = String(
            data.classeId || ''
          ).trim();

          if (idsClassesCibles.includes(classeId)) {
            liste.push({
              id: snap.id,
              ...data
            });
          }
        });

        liste.sort((a, b) => {
          const da = new Date(
            a.updatedAt ||
            a.createdAt ||
            a.datePointage ||
            0
          ).getTime();

          const dbb = new Date(
            b.updatedAt ||
            b.createdAt ||
            b.datePointage ||
            0
          ).getTime();

          return dbb - da;
        });

        setFichesAppels(liste);
      },
      (error) => {
        console.error(
          '❌ Erreur registre appels :',
          error
        );
      }
    );

    return () => unsubscribe();
  }, [currentSchool, idsClassesCibles]);

  // ==========================================================
  // POINTAGES ENSEIGNANTS
  // ==========================================================

  useEffect(() => {
    if (!currentSchool) {
      setPointagesProfesseurs([]);
      return;
    }

    const q = query(
      collection(db, 'registre_pointages'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((snap) => {
          const data = snap.data();

          const classeId = String(
            data.classeId || ''
          ).trim();

          if (
            !classeId ||
            idsClassesCibles.includes(classeId)
          ) {
            liste.push({
              id: snap.id,
              ...data
            });
          }
        });

        liste.sort((a, b) => {
          return (
            new Date(
              b.datePointage ||
              b.updatedAt ||
              b.date ||
              0
            ).getTime() -
            new Date(
              a.datePointage ||
              a.updatedAt ||
              a.date ||
              0
            ).getTime()
          );
        });

        setPointagesProfesseurs(liste);
      },
      (error) => {
        console.error(
          '❌ Erreur registre pointages :',
          error
        );
      }
    );

    return () => unsubscribe();
  }, [currentSchool, idsClassesCibles]);

  // ==========================================================
  // EMPLOI DU TEMPS
  // ==========================================================

  useEffect(() => {
    if (!currentSchool) {
      setEmploisDuTemps([]);
      return;
    }

    const q = query(
      collection(db, 'emplois_du_temps'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((snap) => {
          const data = snap.data();

          const classeId = String(
            data.classeId || ''
          ).trim();

          if (idsClassesCibles.includes(classeId)) {
            liste.push({
              id: snap.id,
              ...data
            });
          }
        });

        setEmploisDuTemps(liste);
      },
      (error) => {
        console.error(
          '❌ Erreur emploi du temps :',
          error
        );
      }
    );

    return () => unsubscribe();
  }, [currentSchool, idsClassesCibles]);

  // ==========================================================
  // NORMALISATION EDT
  // ==========================================================

  const creneauxEDT = useMemo(() => {
    const resultat = [];

    emploisDuTemps.forEach((documentEDT) => {
      const creneaux = Array.isArray(
        documentEDT.creneaux
      )
        ? documentEDT.creneaux
        : [];

      creneaux.forEach((creneau) => {
        resultat.push({
          ...creneau,

          classeId:
            creneau.classeId ||
            documentEDT.classeId,

          nomClasse:
            creneau.nomClasse ||
            documentEDT.classeNom ||
            documentEDT.nomClasse
        });
      });

      if (
        documentEDT.heureDebut &&
        documentEDT.heureFin
      ) {
        resultat.push({
          ...documentEDT
        });
      }
    });

    return resultat;
  }, [emploisDuTemps]);

  // ==========================================================
  // UTILITAIRES HEURES
  // ==========================================================

  const minutesDepuisMinuit = (heure) => {
    if (!heure) return null;

    const match = String(heure).match(
      /^(\d{1,2}):(\d{2})$/
    );

    if (!match) return null;

    return (
      Number(match[1]) * 60 +
      Number(match[2])
    );
  };

  const heureCouranteMinutes =
    maintenant.getHours() * 60 +
    maintenant.getMinutes();

  // ==========================================================
  // COURS EN COURS
  // ==========================================================

  const coursEnCours = useMemo(() => {
    return creneauxEDT.filter((cours) => {
      const jourCours = normaliser(cours.jour);
      const jourNow = normaliser(jourActuel);

      if (jourCours !== jourNow) {
        return false;
      }

      const debut = minutesDepuisMinuit(
        cours.heureDebut
      );

      const fin = minutesDepuisMinuit(
        cours.heureFin
      );

      if (debut === null || fin === null) {
        return false;
      }

      return (
        heureCouranteMinutes >= debut &&
        heureCouranteMinutes < fin
      );
    });
  }, [
    creneauxEDT,
    jourActuel,
    heureCouranteMinutes
  ]);

  // ==========================================================
  // PROCHAINS COURS
  // ==========================================================

  const prochainsCours = useMemo(() => {
    return creneauxEDT
      .filter((cours) => {
        const jourCours = normaliser(cours.jour);
        const jourNow = normaliser(jourActuel);

        if (jourCours !== jourNow) {
          return false;
        }

        const debut = minutesDepuisMinuit(
          cours.heureDebut
        );

        return (
          debut !== null &&
          debut > heureCouranteMinutes
        );
      })
      .sort(
        (a, b) =>
          minutesDepuisMinuit(a.heureDebut) -
          minutesDepuisMinuit(b.heureDebut)
      );
  }, [
    creneauxEDT,
    jourActuel,
    heureCouranteMinutes
  ]);

  // ==========================================================
  // POINTAGES EN COURS
  // ==========================================================

  const pointagesEnCours = useMemo(() => {
    return pointagesProfesseurs.filter(
      (pointage) =>
        pointage.heureArrivee &&
        !pointage.heureDepart
    );
  }, [pointagesProfesseurs]);

  // ==========================================================
  // APPELS DU JOUR
  // ==========================================================

  const appelsDuJour = useMemo(() => {
    return fichesAppels.filter((appel) => {
      return (
        String(appel.date || '').trim() ===
        dateAujourdhui
      );
    });
  }, [fichesAppels, dateAujourdhui]);

  // ==========================================================
  // STATISTIQUES ASSIDUITÉ
  // ==========================================================

  const statistiquesAssiduite = useMemo(() => {
    let absents = 0;
    let retards = 0;
    let presents = 0;

    appelsDuJour.forEach((appel) => {
      const absentsListe = Array.isArray(
        appel.elevesAbsents
      )
        ? appel.elevesAbsents
        : [];

      const retardsListe = Array.isArray(
        appel.elevesRetards
      )
        ? appel.elevesRetards
        : [];

      absents += absentsListe.length;
      retards += retardsListe.length;

      const totalEleves = elevesPromo.length;

      if (totalEleves > 0) {
        presents += Math.max(
          0,
          totalEleves -
            absentsListe.length -
            retardsListe.length
        );
      }
    });

    return {
      absents,
      retards,
      presents
    };
  }, [
    appelsDuJour,
    elevesPromo.length
  ]);

  // ==========================================================
  // STATISTIQUES PAR ÉLÈVE
  // ==========================================================

  const statistiquesEleves = useMemo(() => {
    const stats = {};

    elevesPromo.forEach((eleve) => {
      stats[eleve.id] = {
        presence: 0,
        absence: 0,
        retard: 0
      };
    });

    fichesAppels.forEach((appel) => {
      const absents = Array.isArray(
        appel.elevesAbsents
      )
        ? appel.elevesAbsents
        : [];

      const retards = Array.isArray(
        appel.elevesRetards
      )
        ? appel.elevesRetards
        : [];

      elevesPromo.forEach((eleve) => {
        const nomEleve = `${eleve.nom || ''} ${
          eleve.prenoms ||
          eleve.prenom ||
          ''
        }`
          .trim()
          .toUpperCase();

        if (!stats[eleve.id]) {
          stats[eleve.id] = {
            presence: 0,
            absence: 0,
            retard: 0
          };
        }

        const estAbsent = absents.some(
          (nom) =>
            String(nom)
              .trim()
              .toUpperCase() === nomEleve
        );

        const estRetard = retards.some(
          (nom) =>
            String(nom)
              .trim()
              .toUpperCase() === nomEleve
        );

        if (estAbsent) {
          stats[eleve.id].absence += 1;
        } else if (estRetard) {
          stats[eleve.id].retard += 1;
        } else {
          stats[eleve.id].presence += 1;
        }
      });
    });

    return stats;
  }, [
    elevesPromo,
    fichesAppels
  ]);

  // ==========================================================
  // TOTAL ABSENCES
  // ==========================================================

  const totalHeuresAbsence = useMemo(() => {
    return elevesPromo.reduce(
      (total, eleve) =>
        total +
        Number(eleve.absences || 0),
      0
    );
  }, [elevesPromo]);

  // ==========================================================
  // CLASSEMENT PAR POINTS
  // ==========================================================

  const classement = useMemo(() => {
    return [...elevesPromo].sort(
      (a, b) =>
        Number(
          b.totalPointsCumules || 0
        ) -
        Number(
          a.totalPointsCumules || 0
        )
    );
  }, [elevesPromo]);

  // ==========================================================
  // RECHERCHE DÉLÉGUÉ
  // ==========================================================

  const elevesPourDelegue = useMemo(() => {
    return elevesPromo.filter((eleve) => {
      const civil = `${eleve.nom || ''} ${
        eleve.prenoms ||
        eleve.prenom ||
        ''
      }`.toLowerCase();

      const classe = String(
        eleve.classeNom ||
        eleve.classeId ||
        ''
      ).toLowerCase();

      return (
        civil.includes(
          rechercheEleveDelegue
            .toLowerCase()
            .trim()
        ) &&
        classe.includes(
          rechercheClasseDelegue
            .toLowerCase()
            .trim()
        )
      );
    });
  }, [
    elevesPromo,
    rechercheEleveDelegue,
    rechercheClasseDelegue
  ]);

  // ==========================================================
  // SAUVEGARDE SIGNATURE
  // ==========================================================

  const handleSauvegarderSignatureDirecte =
    async (base64Data) => {
      if (!base64Data || !idEducateur) {
        return;
      }

      try {
        const userRef = doc(
          db,
          'users',
          idEducateur
        );

        await updateDoc(userRef, {
          signatureDessinImage: base64Data,
          updatedAtSignature:
            new Date().toISOString()
        });

        const updatedUser = {
          ...user,
          signatureDessinImage: base64Data
        };

        sessionStorage.setItem(
          'sgs_user',
          JSON.stringify(updatedUser)
        );

        alert(
          '📝 Votre signature numérique a été validée et enregistrée !'
        );

        setIsPadOpen(false);
      } catch (error) {
        console.error(
          '❌ Erreur enregistrement signature :',
          error
        );

        alert(
          '❌ Une erreur technique a bloqué la sauvegarde.'
        );
      }
    };

  const handleSauvegarderSignatureEducateur =
    async (base64Image) => {
      await handleSauvegarderSignatureDirecte(
        base64Image
      );
    };

  // ==========================================================
  // DÉLÉGUÉ
  // ==========================================================

  const handleValiderChoixDelegue = async (
    idEleve,
    nomCompletEleve,
    classeId
  ) => {
    if (!classeId) {
      alert(
        '❌ Classe introuvable pour cet élève.'
      );
      return;
    }

    try {
      await updateDoc(
        doc(db, 'classes', classeId),
        {
          delegueId: idEleve || '',
          delegueName:
            nomCompletEleve ||
            'Non désigné',
          updatedAt:
            new Date().toISOString()
        }
      );

      setIsModalDelegueOpen(false);
      setRechercheEleveDelegue('');
      setRechercheClasseDelegue('');

      alert(
        idEleve
          ? `👑 Délégué désigné : ${nomCompletEleve}`
          : '✅ Délégué destitué.'
      );
    } catch (error) {
      console.error(
        '❌ Erreur délégué :',
        error
      );

      alert(
        '❌ Impossible de modifier le délégué.'
      );
    }
  };

  // ==========================================================
  // AVIS DE CONDUITE
  // ==========================================================

  const handleEnregistrerAppreciationConseil =
    async (event) => {
      event.preventDefault();

      if (
        !eleveSelectionneConseil ||
        !avisConduiteConseil.trim()
      ) {
        return;
      }

      try {
        await updateDoc(
          doc(
            db,
            'users',
            eleveSelectionneConseil.id
          ),
          {
            appreciationConduiteEducateur:
              avisConduiteConseil.trim(),

            appreciationConduiteEducateurId:
              idEducateur,

            appreciationConduiteEducateurUpdatedAt:
              new Date().toISOString()
          }
        );

        setEleveSelectionneConseil(null);
        setAvisConduiteConseil('');

        alert(
          '✅ Appréciation enregistrée en direct.'
        );
      } catch (error) {
        console.error(error);

        alert(
          "❌ Impossible d'enregistrer l'appréciation."
        );
      }
    };

  // ==========================================================
  // CIRCULAIRE
  // ==========================================================

  const handleDiffuserCirculaire =
    async (event) => {
      event.preventDefault();

      if (
        !sujetCirculaire.trim() ||
        !corpsCirculaire.trim()
      ) {
        alert(
          '⚠️ Veuillez renseigner le sujet et le message.'
        );
        return;
      }

      setSending(true);

      try {
        await addDoc(
          collection(db, 'notifications'),
          {
            schoolId: currentSchool,
            expediteurId: idEducateur,
            expediteurNom: nomEducateur,
            expediteurRole: 'educateur',
            promotion: promotionDynamique,

            classeId:
              classeSelectionnee === 'all'
                ? ''
                : classeSelectionnee,

            cible:
              classeSelectionnee === 'all'
                ? `promotion_${promotionDynamique}`
                : `classe_${classeSelectionnee}`,

            titre:
              sujetCirculaire.trim(),

            message:
              corpsCirculaire.trim(),

            type: 'diffusion_interne',

            createdAt:
              new Date().toISOString()
          }
        );

        await addDoc(
          collection(db, 'mails_direction'),
          {
            schoolId: currentSchool,
            educateurId: idEducateur,
            promotion: promotionDynamique,

            classeId:
              classeSelectionnee === 'all'
                ? ''
                : classeSelectionnee,

            sujet:
              sujetCirculaire.trim(),

            message:
              corpsCirculaire.trim(),

            role: 'parents',

            createdAt:
              new Date().toISOString()
          }
        );

        setSujetCirculaire('');
        setCorpsCirculaire('');

        setMsgStatus({
          type: 'success',
          text:
            '🚀 Circulaire enregistrée et synchronisée en direct.'
        });
      } catch (error) {
        console.error(error);

        setMsgStatus({
          type: 'error',
          text:
            '❌ Échec de diffusion.'
        });
      } finally {
        setSending(false);
      }
    };

  // ==========================================================
  // DÉCONNEXION
  // ==========================================================

  const handleSessionLogout = async () => {
    if (
      !window.confirm(
        '🚪 Souhaitez-vous fermer votre session éducateur ?'
      )
    ) {
      return;
    }

    try {
      if (logout) {
        await logout();
      }
    } catch (error) {
      console.error(error);
    } finally {
      sessionStorage.clear();
      navigate('/', {
        replace: true
      });
    }
  };

  // ==========================================================
  // TEMPS RESTANT
  // ==========================================================

  const calculerTempsRestant = (
    heureFin
  ) => {
    const fin =
      minutesDepuisMinuit(heureFin);

    if (fin === null) return '';

    const difference =
      fin - heureCouranteMinutes;

    if (difference <= 0) {
      return 'Terminé';
    }

    const heures = Math.floor(
      difference / 60
    );

    const minutes =
      difference % 60;

    if (heures > 0) {
      return `${heures}h ${minutes}min restantes`;
    }

    return `${minutes} min restantes`;
  };

  // ==========================================================
  // AFFICHAGE DES POINTS
  // ==========================================================

  const formatNombre = (nombre) => {
    const valeur = Number(nombre || 0);

    if (!Number.isFinite(valeur)) {
      return '0';
    }

    return valeur.toFixed(2);
  };

  // ==========================================================
  // CHARGEMENT
  // ==========================================================

  if (
    loadingClasse ||
    loadingEleves
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl    p-8 text-center">
          <div className="text-3xl mb-3">
            👮
          </div>

          <p className="font-black text-slate-800">
            Connexion au bureau éducateur...
          </p>

          <p className="text-xs text-slate-400 mt-2">
            Synchronisation Firestore en temps réel.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <div className="min-h-screen w-full bg-white">
      <Header />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* ====================================================
            EN-TÊTE
        ==================================================== */}

        <div className="bg-white  p-6  mb-6">

          <div className="flex flex-col lg:flex-row justify-between gap-5">

            <div>
              <p className="bureau text-[10px] font-black uppercase tracking-widest text-purple-500">
                Bureau Éducateur de la promotion
              </p>

              <h1 className="educateur text-2xl font-black text-slate-900 mt-1">
                {nomEducateur}
              </h1>

              <p className="jour text-xs font-bold text-slate-400 mt-2">
               Date:  {jourActuel} / {dateAujourdhui}   heure : {heureActuelle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">

              <select
                value={classeSelectionnee}
                onChange={(e) =>
                  setClasseSelectionnee(
                    e.target.value
                  )
                }
                className="toutelesclass bg-white border boder-purple-200 text-purple-700  px-4 py-3 text-xs font-black outline-none cursor-pointer"
              >
                <option value="all">
                  TOUTES MES CLASSES
                </option>

                {listeClasses.map(
                  (classe) => (
                    <option
                      key={classe.id}
                      value={classe.id}
                    >
                      {classe.nom ||
                        classe.name ||
                        classe.classeNom ||
                        classe.id}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                onClick={() =>
                  setIsPadOpen(true)
                }
                className="signatureeducateur  hover:bg-blue-700  px-4 py-2  text-xs font-black transition cursor-pointer"
              >
                Enregistrer votre Signature dans la base de donnée
              </button>

              <button
                type="button"
                onClick={
                  handleSessionLogout
                }
                className="signatureeducat bg-red-600 hover:bg-red-700  px-4 py-3  text-xs font-black transition cursor-pointer"
              >
                Déconnexion
              </button>
     {/* ======================================================
          SIGNATURE
      ====================================================== */}

      {isPadOpen && (
        <SignaturePadModal
          isOpen={isPadOpen}
          onClose={() =>
            setIsPadOpen(false)
          }
          onSave={
            handleSauvegarderSignatureEducateur
          }
          existingSignature={
            user?.signatureDessinImage || ''
          }
        />
      )}
            </div>
          </div>

          {/* INFORMATIONS CLASSES */}

          <div className="infoclasse grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">

            <div className="bg-white  p-4">
              <p className="text-[10px] font-black uppercase text-purple-400">
                Classes totales de la promotion 
              </p>

              <p className="text-2xl text-danger font-black text-purple-700">
                {listeClasses.length}
              </p>
            </div>

            <div className="bg-white  p-4">
              <p className="text-[10px] font-black uppercase text-blue-400">
                 Effectif total de la promotion
              </p>

              <p className="text-2xl text-danger font-black text-blue-700">
                {elevesPromo.length}
              </p>
            </div>

            <div className="bg-white  p-4">
              <p className="text-[10px] font-black uppercase text-orange-400">
                Absences
              </p>

              <p className="text-2xl text-danger font-black text-orange-700">
                {statistiquesAssiduite.absents}
              </p>
            </div>

            <div className="bg-white  p-4">
              <p className="text-[10px]  font-black uppercase text-emerald-400">
                Points cumulés du premier de la promotion
              </p>

              <p className="text-2xl text-danger font-black text-emerald-700">
                {formatNombre(
                  elevesPromo.reduce(
                    (total, eleve) =>
                      total +
                      Number(
                        eleve.totalPointsCumules ||
                        0
                      ),
                    0
                  )
                )}
              </p>
            </div>

          </div>
        </div>

        {/* ====================================================
            NAVIGATION
        ==================================================== */}

        <div className="bg-white   p-3  mb-6">

          <div className=" flex flex-wrap gap-2">
            <div className=" tableaubord flex flex-wrap gap-2">

            {[
              [
                'dashboard_global',
                'Tableau de bord'
              ],
              [
                'assiduite_classes',
                'Journal des appels'
              ],
              [
                'pointages_rh',
                'Pointages des professeur'
              ],
              [
                'excellence_promo',
                'Moyenne et classement de la promotion'
              ],
              
              
             
              [
                'instructions_admin',
                'Boite de reception'
              ]
              
            ].map(
              ([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab)
                  }
                  className={`px-4 py-3  text-xs font-black transition cursor-pointer ${
                    activeTab === tab
                      ? ' text-orange-400 '
                      : ' text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              )
            )}
            </div>
             <div className="com mb-4">
                 <Link
                   to="/components/communication"
                   className=" px-4 py-3 bg-purple-600 hover:bg-purple-700   text-xs font-black cursor-pointer transition"
                 >
                    Commucation et inforamation
                 </Link>
               </div>
          {/* ====================================================
           Rectifications
        ==================================================== */}

          <div className="mt-6 bg-white   rounded-2xl p-6 ">

            <div className="mise nmb-4">
                 <Link
                   to="/educateur/rectification"
                   className=" px-4 py-3 bg-purple-600 hover:bg-purple-700   text-xs font-black cursor-pointer transition"
                 >
                  Mise ajour et Rectifications
                 </Link>
               </div>
               </div>

                {/* ====================================================
           Rectifications
        ==================================================== */}

          <div className="mt-6 bg-white   rounded-2xl p-6 ">

            <div className="vacation mb-4">
                 <Link
                   to="/educateur/arbitrages/paie-vacation"
                   className="cursor-pointer transition"
                 >
                 Suivi Horaires des Vacations
                 </Link>
               </div>
               </div>


          {/* ====================================================
            PROMOTION
        ==================================================== */}

          <div className="mt-6 bg-white   rounded-2xl p-6 ">

            <div className="mb-4">
                 <Link
                   to="/educateur/promotions"
                   className="gest px-4 py-3 bg-purple-600 hover:bg-purple-700   text-xs font-black cursor-pointer transition"
                 >
                   Gestion de la promotion
                 </Link>
               </div>
               </div>

               


            <button
              type="button"
              onClick={() =>
                setIsModalDelegueOpen(true)
              }
              className="delegue  text-xs font-black cursor-pointer transition"
            >
              Ajouter le Délégué élu a la classe
            </button>
          </div>
        </div>

        {/* ====================================================
            VUE GLOBALE
        ==================================================== */}

        {activeTab === 'dashboard_global' && (
          <div className="space-y-6">
            <div className="courencour grid grid-cols-1 md:grid-cols-3 gap-4">

             
              <div className="bg-white   rounded-2xl p-6 ">
                <p className="text-danger bold text-[10px] font-black uppercase text-slate-400">
                  Prochains cours
                </p>

                <div className="mt-3 space-y-2">
                  {prochainsCours
                    .slice(0, 3)
                    .map(
                      (cours, index) => (
                        <div
                          key={index}
                          className="bg-blue-50  p-3"
                        >
                          <p className="font-black text-sm text-blue-800">
                            {cours.matiere ||
                              'Cours'}
                          </p>

                          <p className="text-xs text-blue-600">
                            {cours.heureDebut} —{' '}
                            {cours.heureFin}
                          </p>

                          <p className="text-[10px] font-bold text-blue-500">
                            {cours.nomClasse ||
                              'Classe'}
                          </p>
                        </div>
                      )
                    )}

                  {prochainsCours.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Aucun prochain cours.
                    </p>
                  )}
                </div>
              </div>

               <div className="bg-white   rounded-2xl p-6 ">
                <p className="text-danger bold font-black uppercase text-slate-400">
                  Cours en cours
                </p>

                <p className="text-danger font-black text-emerald-600 mt-2">
                  {coursEnCours.length}
                </p>

                {coursEnCours.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {coursEnCours.map(
                      (cours, index) => (
                        <div
                          key={index}
                          className="bg-emerald-50  p-3"
                        >
                          <p className="font-black text-sm text-emerald-800">
                            {cours.matiere ||
                              'Cours'}
                          </p>

                          <p className="text-xs text-emerald-600">
                            {cours.heureDebut} —{' '}
                            {cours.heureFin}
                          </p>

                          <p className="text-[10px] font-bold text-emerald-500 mt-1">
                            {calculerTempsRestant(
                              cours.heureFin
                            )}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}

                {coursEnCours.length === 0 && (
                  <p className="bold text-xs text-slate-400 mt-2">
                    Aucun cours actuellement.
                  </p>
                )}
              </div>


              <div className="bg-white   rounded-2xl p-6 ">
                <p className="text-danger bold text-[10px] font-black uppercase text-slate-400">
                  Pointages enseignants
                </p>

                <p className="text-3xl text-danger bold font-black text-orange-600 mt-2">
                  {pointagesEnCours.length}
                </p>

                <p className="text-xs text-slate-400 mt-2">
                  Enseignants actuellement pointés.
                </p>
              </div>

            </div>
            {/* RÉSUMÉ ASSIDUITÉ */}

            <div className="assiparti    rounded-2xl p-6 ">

              <div className="assinfo flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Assiduité du jour
                  </p>

                  <h2 className="text-lg font-black text-slate-900 mt-1">
                    Situation des élèves
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      'assiduite_classes'
                    )
                  }
                  className="voirdetail text-xs font-black text-purple-600 hover:underline cursor-pointer"
                >
                  Voir le détail →
                </button>
              </div>

              <div className="stact grid grid-cols-3 gap-3 mt-5">

                <div className="bg-emerald-50  p-4 text-center">
                  <p className="text-2xl text-danger font-black text-emerald-700">
                    {statistiquesAssiduite.presents}
                  </p>
                  <p className="text-[10px] font-black uppercase text-emerald-500">
                    Présents
                  </p>
                </div>

                <div className="bg-red-50  p-4 text-center">
                  <p className="text-2xl text-danger font-black text-red-700">
                    {statistiquesAssiduite.absents}
                  </p>
                  <p className="text-[10px] font-black uppercase text-red-500">
                    Absents
                  </p>
                </div>

                <div className="bg-orange-50  p-4 text-center">
                  <p className="text-2xl text-danger font-black text-orange-700">
                    {statistiquesAssiduite.retards}
                  </p>
                  <p className="text-[10px] font-black uppercase text-orange-500">
                    Retards
                  </p>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ====================================================
            ASSIDUITÉ
        ==================================================== */}

        {activeTab === 'assiduite_classes' && (
          <div className="assi-group space-y-4">

            <div className="bg-white   rounded-2xl p-6 ">
              <h2 className="text-xl font-black text-slate-900">
                📝 Assiduité des classes
              </h2>

              <p className="text-xs text-slate-400 mt-1">
                Données récupérées en temps réel depuis le registre des appels.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden ">

              <div className=" overflow-x-auto">

                <table className="tab-group w-full text-sm">

                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-4 text-[10px] font-black uppercase text-slate-400">
                        Élève
                      </th>

                      <th className="text-center p-4 text-[10px] font-black uppercase text-slate-400">
                        Présences
                      </th>

                      <th className="text-center p-4 text-[10px] font-black uppercase text-slate-400">
                        Absences
                      </th>

                      <th className="text-center p-4 text-[10px] font-black uppercase text-slate-400">
                        Retards
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {elevesPromo.map(
                      (eleve) => {
                        const stats =
                          statistiquesEleves[
                            eleve.id
                          ] || {
                            presence: 0,
                            absence: 0,
                            retard: 0
                          };

                        return (
                          <tr
                            key={eleve.id}
                            className="-t -slate-100"
                          >
                            <td className="p-4">
                              <p className="font-black text-slate-800">
                                {eleve.nom}{' '}
                                {eleve.prenoms ||
                                  eleve.prenom}
                              </p>

                              <p className="text-[10px] text-danger">
                                {eleve.matricule ||
                                  eleve.id}
                              </p>
                            </td>

                            <td className="text-center font-black text-emerald-600">
                              {stats.presence}
                            </td>

                            <td className="text-center font-black text-red-600">
                              {stats.absence}
                            </td>

                            <td className="text-center font-black text-orange-600">
                              {stats.retard}
                            </td>
                          </tr>
                        );
                      }
                    )}

                  </tbody>
                </table>

              </div>
            </div>

          </div>
        )}

        {/* ====================================================
            POINTAGES PROFS
        ==================================================== */}

        {activeTab === 'pointages_rh' && (
          <div className="space-y-4">

            <div className="bg-white p-6 ">

              <h2 className="pointage text-xl font-black text-slate-900">
                🕒 Pointages des professeurs
              </h2>

              <p className="pointag text-xs text-slate-400 mt-1">
                Suivi en temps réel des pointages enseignants.
              </p>

            </div>

            <div className="pointage-group">

              <div className=" rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase text-emerald-500">
                  Pointages ouverts
                </p>

                <p className="text-danger font-black text-emerald-700 mt-2">
                  {pointagesEnCours.length}
                </p>
              </div>

              <div className=" rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase text-blue-500">
                  Cours aujourd'hui
                </p>

                <p className="text-danger font-black text-blue-700 mt-2">
                  {creneauxEDT.filter(
                    (cours) =>
                      normaliser(
                        cours.jour
                      ) ===
                      normaliser(
                        jourActuel
                      )
                  ).length}
                </p>
              </div>

              <div className=" rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase text-purple-500">
                  Enregistrements
                </p>

                <p className="text-danger font-black text-purple-700 mt-2">
                  {pointagesProfesseurs.length}
                </p>
              </div>

            </div>

            <div >

              <div className="latable ">

                <table className=" w-full py-1 text-sm">

                  <thead >
                    <tr>
                      <th className="p-4 text-left text-[10px] font-black uppercase text-slate-400">
                        Professeur
                      </th>

                      <th className="p-4 text-left text-[10px] font-black uppercase text-slate-400">
                        Date
                      </th>

                      <th className="p-4 text-left text-[10px] font-black uppercase text-slate-400">
                        Arrivée
                      </th>

                      <th className="p-4 text-left text-[10px] font-black uppercase text-slate-400">
                        Départ
                      </th>

                      <th className="p-4 text-left text-[10px] font-black uppercase text-slate-400">
                        Statut
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {pointagesProfesseurs
                      .slice(0, 50)
                      .map(
                        (pointage) => (
                          <tr
                            key={pointage.id}
                            className="-t -slate-100"
                          >
                            <td className="p-4 font-black">
                              {pointage.professeurNom ||
                                pointage.professeur ||
                                pointage.nom ||
                                'Professeur'}
                            </td>

                            <td className="p-4 text-xs text-slate-500">
                              {pointage.datePointage ||
                                pointage.date ||
                                '—'}
                            </td>

                            <td className="p-4 text-emerald-600 font-black">
                              {pointage.heureArrivee ||
                                '—'}
                            </td>

                            <td className="p-4 text-orange-600 font-black">
                              {pointage.heureDepart ||
                                '—'}
                            </td>

                            <td className="p-4">
                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                  pointage.heureArrivee &&
                                  !pointage.heureDepart
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {pointage.heureArrivee &&
                                !pointage.heureDepart
                                  ? 'EN COURS'
                                  : 'FERMÉ'}
                              </span>
                            </td>
                          </tr>
                        )
                      )}

                  </tbody>

                </table>

              </div>
            </div>

          </div>
        )}

        {/* ====================================================
            POINTS / CLASSEMENT
        ==================================================== */}

        {activeTab === 'excellence_promo' && (
          <div className="space-y-4">

            <div className="bg-white   rounded-2xl p-6 ">

              <h2 className="pointage-1 text-xl font-black text-slate-900">
                🏆 Points et classement
              </h2>

              <p className="text-xs text-slate-400 mt-1">
                Les points correspondent aux moyennes pondérées des matières enregistrées par les professeurs.
              </p>

            </div>

            <div className="bg-white   rounded-2xl overflow-hidden ">

              <div className="overflow-x-auto">

                <table className="w-full text-sm">

                  <thead className="bg-slate-50">

                    <tr>
                      <th className="p-4 text-center text-[10px] font-black uppercase text-slate-400">
                        #
                      </th>

                      <th className="p-4 text-left text-[10px] font-black uppercase text-slate-400">
                        Élève
                      </th>

                      <th className="p-4 text-left text-[10px] font-black uppercase text-slate-400">
                        Classe
                      </th>

                      <th className="p-4 text-center text-[10px] font-black uppercase text-slate-400">
                        Moyennes matières
                      </th>

                      <th className="p-4 text-center text-[10px] font-black uppercase text-slate-400">
                        Points pondérés
                      </th>
                    </tr>

                  </thead>

                  <tbody>

                    {classement.map(
                      (eleve, index) => (
                        <tr
                          key={eleve.id}
                          className="-t -slate-100 hover:bg-slate-50"
                        >

                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black ${
                                index === 0
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : index === 1
                                  ? 'bg text-slate-700'
                                  : index === 2
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-50 text-slate-500'
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>

                          <td className="p-4">
                            <p className="font-black text-slate-800">
                              {eleve.nom}{' '}
                              {eleve.prenoms ||
                                eleve.prenom}
                            </p>

                            <p className="text-[10px] text-slate-400">
                              {eleve.matricule ||
                                eleve.id}
                            </p>
                          </td>

                          <td className="p-4 text-xs font-bold text-slate-500">
                            {eleve.classeNom ||
                              eleve.classe ||
                              eleve.classeId ||
                              '—'}
                          </td>

                          <td className="p-4 text-center">
                            <span className="font-black text-blue-600">
                              {formatNombre(
                                eleve.moyenneGeneraleMatieres
                              )}
                            </span>
                          </td>

                          <td className="p-4 text-center">
                            <span className="inline-flex px-4 py-2 bg-purple-100 text-purple-700  font-black">
                              {formatNombre(
                                eleve.totalPointsCumules
                              )}
                            </span>
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            </div>

            {/* DÉTAIL DES MATIÈRES */}

            {classement.length > 0 && (
              <div className="bg-white   rounded-2xl p-6 ">

                <h3 className="text-danger font-black text-slate-900">
                  📚 Détail des moyennes matières
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  Moyenne × coefficient = moyenne pondérée = points.
                </p>

                <div className="mt-5 space-y-4">

                  {classement
                    .slice(0, 10)
                    .map((eleve) => (
                      <div
                        key={eleve.id}
                        className=" -slate-100 rounded-2xl p-4"
                      >

                        <div className="flex justify-between items-center mb-3">
                          <p className="font-black text-slate-800">
                            {eleve.nom}{' '}
                            {eleve.prenoms ||
                              eleve.prenom}
                          </p>

                          <span className="text-xs font-black text-purple-600">
                            {formatNombre(
                              eleve.totalPointsCumules
                            )}{' '}
                            points
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">

                          {(eleve.detailsMatieres ||
                            [])
                            .slice(-12)
                            .map(
                              (
                                matiere,
                                index
                              ) => (
                                <div
                                  key={`${matiere.periode}-${matiere.matiere}-${index}`}
                                  className="bg-slate-50  p-3"
                                >

                                  <p className="text-xs font-black text-slate-700">
                                    {matiere.matiere}
                                  </p>

                                  <p className="text-[10px] text-slate-400">
                                    {matiere.periode}
                                  </p>

                                  <div className="flex justify-between mt-2 text-xs">
                                    <span>
                                      Moyenne :{' '}
                                      <strong>
                                        {formatNombre(
                                          matiere.moyenne
                                        )}
                                      </strong>
                                    </span>

                                    <span>
                                      Coef :{' '}
                                      <strong>
                                        {formatNombre(
                                          matiere.coefficient
                                        )}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="mt-2 bg-purple-100 text-purple-700 rounded-lg px-2 py-1 text-center text-xs font-black">
                                    {formatNombre(
                                      matiere.moyennePonderee
                                    )}{' '}
                                    points
                                  </div>

                                </div>
                              )
                            )}

                        </div>
                      </div>
                    ))}

                </div>
              </div>
            )}

          </div>
        )}

        {/* ====================================================
            CIRCULAIRES
        ==================================================== */}
         {/*  {activeTab === 'messages_sos' && (
          <div className="bg-white   rounded-2xl  overflow-hidden">

            <EnvoyerMessageUnique
              schoolId={currentSchool}
               schoolId={currentSchool}
              user={user}
              role="educateur"
            />

          </div>
        )} */}

          
       
        

        {/* ====================================================
            INSTRUCTIONS ADMIN
        ==================================================== */}

        {activeTab === 'instructions_admin' && (
          <div className="bg-white   rounded-2xl  overflow-hidden">

            <BoiteReceptionUnique
              schoolId={currentSchool}
              user={user}
              role="educateur"
            />

          </div>
        )}

        {/* ====================================================
            AVIS DE CONDUITE
        ==================================================== */}

        {eleveSelectionneConseil && (
          <div className="fixed inset-0 z-[99991] bg-white backdrop-blur-sm flex items-center justify-center p-4">

            <form
              onSubmit={
                handleEnregistrerAppreciationConseil
              }
              className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl"
            >

              <div className="flex justify-between items-center mb-4">

                <div>
                  <h3 className="font-black text-slate-900">
                    📝 Avis de conduite
                  </h3>

                  <p className="text-xs text-slate-400">
                    {eleveSelectionneConseil.nom}{' '}
                    {eleveSelectionneConseil.prenoms ||
                      eleveSelectionneConseil.prenom}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEleveSelectionneConseil(
                      null
                    );
                    setAvisConduiteConseil('');
                  }}
                  className="text-slate-400 font-black cursor-pointer"
                >
                  ✕
                </button>

              </div>

              <textarea
                value={avisConduiteConseil}
                onChange={(e) =>
                  setAvisConduiteConseil(
                    e.target.value
                  )
                }
                rows={6}
                placeholder="Saisissez votre appréciation..."
                className="w-full    p-4 text-sm outline-none resize-none focus:ring-2 focus:ring-purple-200"
              />

              <button
                type="submit"
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700   py-3 text-xs font-black cursor-pointer"
              >
                💾 ENREGISTRER L'APPRÉCIATION
              </button>

            </form>
          </div>
        )}
      </main>
           {/* ====================================================
            MODAL DÉLÉGUÉ
        ==================================================== */}

        {isModalDelegueOpen && (
          <div className="rech-group fixed inset-0 z-[99990]  backdrop-blur-sm flex items-center justify-center p-4">
            <select
                value={classeSelectionnee}
                onChange={(e) =>
                  setClasseSelectionnee(
                    e.target.value
                  )
                }
                className="toutelesclass2 bg-white border boder-purple-200 text-purple-700  px-4 py-3 text-xs font-black outline-none cursor-pointer"
              >
                <option value="all">
                  CHOISIR LA CLASSE CONCERNEE
                </option>

                {listeClasses.map(
                  (classe) => (
                    <option
                      key={classe.id}
                      value={classe.id}
                    >
                      {classe.nom ||
                        classe.name ||
                        classe.classeNom ||
                        classe.id}
                    </option>
                  )
                )}
              </select>
            <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">

              <div className="flex justify-between items-center mb-5">

                <div>
                  <h3 className="text-delegue text-lg  font-black text-slate-900">
                     Désignation du délégué
                  </h3>

                  <p className="text-xs text-slate-400">
                    Sélection en direct parmi vos effectifs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsModalDelegueOpen(
                      false
                    );

                    setRechercheEleveDelegue(
                      ''
                    );

                    setRechercheClasseDelegue(
                      ''
                    );
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xl font-black cursor-pointer"
                >
                  ✕
                </button>

              </div>

              <div className=" grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">

                <input
                  value={
                    rechercheEleveDelegue
                  }
                  onChange={(e) =>
                    setRechercheEleveDelegue(
                      e.target.value
                    )
                  }
                  placeholder="🔎 Rechercher un élève..."
                  className=" bg-slate-50  p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-200"
                />

                <input
                  value={
                    rechercheClasseDelegue
                  }
                  onChange={(e) =>
                    setRechercheClasseDelegue(
                      e.target.value
                    )
                  }
                  placeholder="🔎 Rechercher une classe..."
                  className=" bg-slate-50  p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-200"
                />

              </div>

              <div className="space-y-2">

                {listeClasses.map(
                  (classe) => (
                    <button
                      key={`reset-${classe.id}`}
                      type="button"
                      onClick={() =>
                        handleValiderChoixDelegue(
                          null,
                          'Non désigné',
                          classe.id
                        )
                      }
                      className="w-full p-3 bg-red-50 hover:bg-red-100  -red-100 text-red-700  text-left text-xs font-black cursor-pointer"
                    >
                      ❌ Destituer le délégué de{' '}
                      {classe.nom ||
                        classe.id}
                    </button>
                  )
                )}

              </div>

              <div className="mt-4 space-y-2">

                {elevesPourDelegue.map(
                  (eleve) => (
                    <button
                      key={eleve.id}
                      type="button"
                      onClick={() =>
                        handleValiderChoixDelegue(
                          eleve.id,
                          `${eleve.nom || ''} ${
                            eleve.prenoms ||
                            eleve.prenom ||
                            ''
                          }`
                            .trim()
                            .toUpperCase(),
                          eleve.classeId
                        )
                      }
                      className="w-full p-4 bg-slate-50 hover:bg-purple-50    flex justify-between items-center text-left transition cursor-pointer"
                    >

                      <div>
                        <p className="font-black text-slate-800">
                          {eleve.nom}{' '}
                          {eleve.prenoms ||
                            eleve.prenom}
                        </p>

                        <p className="text-[10px] text-slate-400">
                          {eleve.classeNom ||
                            eleve.classeId ||
                            'Classe inconnue'}
                        </p>
                      </div>

                      <strong className="text-danger text-purple-600">
                        CHOISIR
                      </strong>

                    </button>
                  )
                )}

                {elevesPourDelegue.length ===
                  0 && (
                  <p className="text-center text-xs text-slate-400 py-8">
                    Aucun apprenant ne correspond à vos filtres.
                  </p>
                )}

              </div>

            </div>
          </div>
        )}
    </div>
  );
};

export default DashboardEducateur;