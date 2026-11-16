// src/components/DashboardPP.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';

import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../services/api';
import Header from '../../../../pages/Header';
import ConseilClasse from './ConseilClasse';
import EmploiDuTempsProf from '../EmploiDuTempsProf';
import EmploiDuTempsProfesseur from '../EmploiDuTempsProfesseur';

const normaliser = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const normaliserTexte = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getProfesseurId = (user) =>
  String(user?.uid || user?.id || user?.matricule || '').trim();

const getNom = (user) =>
  String(
    user?.name ||
      user?.nomComplet ||
      `${user?.nom || ''} ${user?.prenoms || user?.prenom || ''}`
  )
    .trim()
    .toUpperCase();

const convertirNote = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === 'object' && value.note !== undefined) {
    return convertirNote(value.note);
  }

  const nombre = Number(
    String(value ?? '')
      .replace(',', '.')
      .trim()
  );

  return Number.isFinite(nombre) ? nombre : null;
};

const classerEvaluation = (evaluation) => {
  const type = normaliserTexte(evaluation?.type);

  if (type.includes('interro') || type.includes('interrogation')) {
    return 'interrogations';
  }

  if (
    type.includes('devoir commun') ||
    type.includes('composition') ||
    type.includes('examen')
  ) {
    return 'devoirsCommuns';
  }

  if (
    type.includes('devoir surveille') ||
    type === 'ds' ||
    type.includes('devoir')
  ) {
    return 'devoirsSurveilles';
  }

  return 'autres';
};

const trouverNotesTrimestre = (eleve, trimestre) => {
  const cle = `notes_trimestre_${trimestre}`;

  const candidats = [
    eleve?.notes?.[cle],
    eleve?.notes_trimestre?.[cle],
    eleve?.[cle],
    eleve?.notes?.[String(trimestre)],
  ];

  return (
    candidats.find(
      (value) => value && typeof value === 'object'
    ) || {}
  );
};

const trouverMoyennesTrimestre = (eleve, trimestre) => {
  const cle = `notes_trimestre_${trimestre}`;

  return (
    eleve?.moyennes_matiere?.[cle] ||
    eleve?.moyennesTrimestres?.[cle] ||
    eleve?.moyennes_trimestrielles?.[cle] ||
    {}
  );
};

const trouverMoyenneMatiere = (moyennes, matiere) => {
  if (!moyennes || typeof moyennes !== 'object') {
    return null;
  }

  if (moyennes[matiere] !== undefined) {
    return moyennes[matiere];
  }

  const cible = normaliserTexte(matiere);

  const cle = Object.keys(moyennes).find(
    (key) => normaliserTexte(key) === cible
  );

  return cle ? moyennes[cle] : null;
};

const extraireMoyenneProfesseur = (objetMoyenne) => {
  if (objetMoyenne === null || objetMoyenne === undefined) {
    return null;
  }

  if (typeof objetMoyenne === 'number') {
    return objetMoyenne;
  }

  if (typeof objetMoyenne === 'string') {
    return convertirNote(objetMoyenne);
  }

  if (typeof objetMoyenne === 'object') {
    return (
      convertirNote(objetMoyenne.note) ??
      convertirNote(objetMoyenne.moyenne) ??
      convertirNote(objetMoyenne.moyenneMatiere) ??
      convertirNote(objetMoyenne.valeur)
    );
  }

  return null;
};

const extraireCoefficientMatiere = (objetMoyenne) => {
  if (!objetMoyenne || typeof objetMoyenne !== 'object') return null;

  const candidats = [
    objetMoyenne.coefficientMatiere,
    objetMoyenne.coefficient,
    objetMoyenne.coefMatiere,
    objetMoyenne.coef,
  ];

  for (const candidat of candidats) {
    const valeur = Number(String(candidat ?? '').replace(',', '.').trim());
    if (Number.isFinite(valeur) && valeur > 0) return valeur;
  }

  return null;
};

const extraireMoyennePonderee = (objetMoyenne, moyenne, coefficient) => {
  if (objetMoyenne && typeof objetMoyenne === 'object') {
    const candidats = [
      objetMoyenne.moyennePonderee,
      objetMoyenne.moyenneMatierePonderee,
      objetMoyenne.moyenneTrimestriellePonderee,
      objetMoyenne.moyennePondere,
    ];

    for (const candidat of candidats) {
      const valeur = Number(String(candidat ?? '').replace(',', '.').trim());
      if (Number.isFinite(valeur)) return valeur;
    }
  }

  if (moyenne !== null && coefficient !== null) {
    return Number((moyenne * coefficient).toFixed(2));
  }

  return null;
};

const obtenirAppreciation = (objetMoyenne, notes) => {
  if (objetMoyenne && typeof objetMoyenne === 'object') {
    if (objetMoyenne.appreciation) {
      return String(objetMoyenne.appreciation);
    }

    if (objetMoyenne.appreciationProfesseur) {
      return String(objetMoyenne.appreciationProfesseur);
    }
  }

  if (!Array.isArray(notes)) {
    return '';
  }

  const avis = notes
    .map((note) => note?.appreciation)
    .filter(Boolean);

  return avis.length ? String(avis[avis.length - 1]) : '';
};

const obtenirSignature = (objetMoyenne) => {
  if (!objetMoyenne || typeof objetMoyenne !== 'object') {
    return '';
  }

  return String(
    objetMoyenne.signatureProfesseur ||
      objetMoyenne.signatureProfesseurImage ||
      objetMoyenne.signatureDessinImage ||
      objetMoyenne.signature ||
      ''
  ).trim();
};

/*
 * IMPORTANT :
 * Le DashboardPP ne recalcule PAS la moyenne trimestrielle à partir
 * des moyennes par matière.
 *
 * Il récupère uniquement une moyenne trimestrielle déjà enregistrée/
 * validée dans le document de l'élève.
 *
 * Les noms ci-dessous couvrent les variantes déjà utilisées dans
 * l'application. Si une seule structure est présente dans Firebase,
 * elle sera utilisée.
 */
const extraireMoyenneTrimestrielleValidee = (eleve, trimestre) => {
  if (!eleve) return null;

  const numero = Number(trimestre);
  const cle = `notes_trimestre_${numero}`;

  const candidats = [
    eleve?.[`moyenne_archive_t${numero}`],
    eleve?.[`moyenneArchiveT${numero}`],
    eleve?.[`moyenne_trimestre_${numero}`],
    eleve?.[`moyenneTrimestre${numero}`],
    eleve?.[`moyenne_trimestrielle_t${numero}`],
    eleve?.[`moyenneTrimestrielleT${numero}`],
    eleve?.moyennes_trimestrielles?.[cle],
    eleve?.moyennesTrimestrielles?.[cle],
    eleve?.moyennes_trimestrielles?.[`t${numero}`],
    eleve?.moyennesTrimestrielles?.[`t${numero}`],
    eleve?.conseilClasse?.[`trimestre${numero}`]?.moyenne,
    eleve?.conseilClasse?.[`trimestre${numero}`]?.moyenneTrimestrielle,
    eleve?.conseilClasseAnnuel?.[`trimestre${numero}`]?.moyenne,
    eleve?.conseilClasseAnnuel?.[`trimestre${numero}`]?.moyenneTrimestrielle,
  ];

  for (const candidat of candidats) {
    const valeur = convertirNote(candidat);
    if (valeur !== null && valeur >= 0 && valeur <= 20) {
      return valeur;
    }
  }

  return null;
};

const trouverValeurClasse = (classe) =>
  String(
    classe?.nom ||
      classe?.name ||
      classe?.classeNom ||
      classe?.libelle ||
      classe?.nomClasse ||
      classe?.id ||
      ''
  ).trim();

const classeAppartientAuPP = (classe, professeurId) => {
  const ppId = normaliser(professeurId);

  const identifiantsDirects = [
    classe?.professeurPrincipalId,
    classe?.profPrincipalId,
    classe?.professeurPrincipalUid,
    classe?.ppId,
    classe?.titulaireId,
    classe?.profPrincipalUid,
    classe?.enseignantPrincipalId,
  ]
    .filter(Boolean)
    .map(normaliser);

  if (identifiantsDirects.includes(ppId)) {
    return true;
  }

  const objetsPP = [
    classe?.professeurPrincipal,
    classe?.profPrincipal,
    classe?.professeurPrincipalData,
    classe?.pp,
  ];

  return objetsPP.some((objet) => {
    if (!objet) return false;

    if (typeof objet === 'string') {
      return normaliser(objet) === ppId;
    }

    return [
      objet?.uid,
      objet?.id,
      objet?.userId,
      objet?.professeurId,
      objet?.matricule,
    ]
      .filter(Boolean)
      .map(normaliser)
      .includes(ppId);
  });
};

const eleveAppartientClasse = (eleve, classe) => {
  if (!eleve || !classe) return false;

  const classeId = normaliser(classe?.id || classe?.classeId);
  const classeNom = normaliserTexte(trouverValeurClasse(classe));

  const valeursEleve = [
    eleve?.classeId,
    eleve?.classePrincipaleId,
    eleve?.classePPId,
    eleve?.idClasse,
  ]
    .filter(Boolean)
    .map(normaliser);

  if (classeId && valeursEleve.includes(classeId)) {
    return true;
  }

  const nomsEleve = [
    eleve?.classeNom,
    eleve?.classe,
    eleve?.nomClasse,
    eleve?.classeName,
    eleve?.libelleClasse,
  ]
    .filter(Boolean)
    .map(normaliserTexte);

  return Boolean(
    classeNom &&
      nomsEleve.some(
        (nom) => nom === classeNom || nom.includes(classeNom) || classeNom.includes(nom)
      )
  );
};

const DashboardPP = () => {
  const { user, schoolId } = useAuth();

  const professeurId = getProfesseurId(user);
  const currentSchool = normaliser(
    user?.schoolId ||
      schoolId ||
      sessionStorage.getItem('sgs_school_id')
  );

  const [classesPP, setClassesPP] = useState([]);
  const [classePP, setClassePP] = useState(null);

  const [eleves, setEleves] = useState([]);
  const [loadingClasse, setLoadingClasse] = useState(true);
  const [loadingEleves, setLoadingEleves] = useState(true);

  const [eleveSelectionneId, setEleveSelectionneId] = useState('');
  const [rechercheEleve, setRechercheEleve] = useState('');

  const [trimestre, setTrimestre] = useState('1');
  const [matiereSelectionnee, setMatiereSelectionnee] = useState('');
  const [moyenneModifiee, setMoyenneModifiee] = useState('');
  const [avisPP, setAvisPP] = useState('');

  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  /* ============================================================
     CLASSES DU PROFESSEUR PRINCIPAL
     ============================================================ */
  useEffect(() => {
    if (!professeurId || !currentSchool) {
      setClassesPP([]);
      setClassePP(null);
      setLoadingClasse(false);
      return undefined;
    }

    setLoadingClasse(true);

    const qClasses = query(
      collection(db, 'classes'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      qClasses,
      (snapshot) => {
        const toutesLesClasses = [];

        snapshot.forEach((snap) => {
          toutesLesClasses.push({
            id: snap.id,
            ...snap.data(),
          });
        });

        let classesTrouvees = toutesLesClasses.filter((classe) =>
          classeAppartientAuPP(classe, professeurId)
        );

        /*
         * Fallback :
         * si les données "professeur principal" ne sont pas présentes
         * dans la collection classes, on utilise la classe du profil.
         */
        if (classesTrouvees.length === 0) {
          const profilClasseId =
            user?.classePrincipaleId ||
            user?.classeId ||
            user?.classePPId;

          const profilClasseNom = normaliserTexte(
            user?.classeNom ||
              user?.classe ||
              user?.nomClasse ||
              ''
          );

          const fallback = toutesLesClasses.filter((classe) => {
            const idMatch =
              profilClasseId &&
              normaliser(classe.id) === normaliser(profilClasseId);

            const nomMatch =
              profilClasseNom &&
              normaliserTexte(trouverValeurClasse(classe)) === profilClasseNom;

            return Boolean(idMatch || nomMatch);
          });

          classesTrouvees = fallback;
        }

        classesTrouvees.sort((a, b) =>
          trouverValeurClasse(a).localeCompare(
            trouverValeurClasse(b),
            'fr',
            { sensitivity: 'base' }
          )
        );

        setClassesPP(classesTrouvees);

        setClassePP((ancienneClasse) => {
          if (
            ancienneClasse &&
            classesTrouvees.some((classe) => classe.id === ancienneClasse.id)
          ) {
            return classesTrouvees.find(
              (classe) => classe.id === ancienneClasse.id
            );
          }

          /*
           * S'il y a plusieurs classes PP, la première est sélectionnée
           * automatiquement mais reste modifiable par le sélecteur.
           */
          return classesTrouvees[0] || null;
        });

        setLoadingClasse(false);
      },
      (error) => {
        console.error('Erreur récupération classes PP :', error);
        setClassesPP([]);
        setClassePP(null);
        setLoadingClasse(false);
      }
    );

    return () => unsubscribe();
  }, [professeurId, currentSchool, user]);

  /* ============================================================
     ÉLÈVES DE LA CLASSE DU PP
     ============================================================ */
  useEffect(() => {
    if (!currentSchool || !classePP) {
      setEleves([]);
      setEleveSelectionneId('');
      setLoadingEleves(false);
      return undefined;
    }

    setLoadingEleves(true);

    /*
     * On ne dépend pas uniquement de where('classeId', ...)
     * car certaines anciennes fiches utilisent classe, classeNom,
     * nomClasse ou une autre représentation.
     */
    const qEleves = query(
      collection(db, 'users'),
      where('schoolId', '==', currentSchool),
      where('role', '==', 'eleve')
    );

    const unsubscribe = onSnapshot(
      qEleves,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((snap) => {
          const eleveData = {
            id: snap.id,
            ...snap.data(),
          };

          if (eleveAppartientClasse(eleveData, classePP)) {
            liste.push(eleveData);
          }
        });

        liste.sort((a, b) => {
          const nomA = `${a.nom || ''} ${a.prenoms || a.prenom || ''}`;
          const nomB = `${b.nom || ''} ${b.prenoms || b.prenom || ''}`;

          return nomA.localeCompare(nomB, 'fr', {
            sensitivity: 'base',
          });
        });

        setEleves(liste);

        setEleveSelectionneId((ancien) => {
          if (ancien && liste.some((e) => e.id === ancien)) {
            return ancien;
          }

          return liste[0]?.id || '';
        });

        setLoadingEleves(false);
      },
      (error) => {
        console.error('Erreur élèves classe PP :', error);
        setEleves([]);
        setEleveSelectionneId('');
        setLoadingEleves(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchool, classePP]);

  const elevesFiltres = useMemo(() => {
    const recherche = normaliserTexte(rechercheEleve);

    if (!recherche) {
      return eleves;
    }

    return eleves.filter((item) => {
      const texte = normaliserTexte(
        [
          item?.nom,
          item?.prenoms,
          item?.prenom,
          item?.matricule,
          item?.email,
        ]
          .filter(Boolean)
          .join(' ')
      );

      return texte.includes(recherche);
    });
  }, [eleves, rechercheEleve]);

  const eleve = useMemo(
    () =>
      eleves.find((item) => item.id === eleveSelectionneId) || null,
    [eleves, eleveSelectionneId]
  );

  const notesTrimestre = useMemo(
    () => trouverNotesTrimestre(eleve, trimestre),
    [eleve, trimestre]
  );

  const moyennesTrimestre = useMemo(
    () => trouverMoyennesTrimestre(eleve, trimestre),
    [eleve, trimestre]
  );

  /* ============================================================
     MATIÈRES DISPONIBLES
     ============================================================ */
  const matieres = useMemo(() => {
    const ensemble = new Map();

    Object.keys(notesTrimestre || {}).forEach((matiere) => {
      ensemble.set(normaliserTexte(matiere), matiere);
    });

    Object.keys(moyennesTrimestre || {}).forEach((matiere) => {
      ensemble.set(normaliserTexte(matiere), matiere);
    });

    return Array.from(ensemble.values()).sort((a, b) =>
      String(a).localeCompare(String(b), 'fr', {
        sensitivity: 'base',
      })
    );
  }, [notesTrimestre, moyennesTrimestre]);

  useEffect(() => {
    if (!matieres.length) {
      setMatiereSelectionnee('');
      return;
    }

    setMatiereSelectionnee((ancienne) =>
      matieres.includes(ancienne) ? ancienne : matieres[0]
    );
  }, [matieres]);

  /* ============================================================
     DONNÉES DE LA MATIÈRE ACTIVE
     ============================================================ */
  const donneesMatiere = useMemo(() => {
    if (!eleve || !matiereSelectionnee) {
      return null;
    }

    const notes = Array.isArray(notesTrimestre?.[matiereSelectionnee])
      ? notesTrimestre[matiereSelectionnee]
      : [];

    const objetMoyenne = trouverMoyenneMatiere(
      moyennesTrimestre,
      matiereSelectionnee
    );

    const moyenneFirebase =
      extraireMoyenneProfesseur(objetMoyenne);

    const coefficientMatiere =
      extraireCoefficientMatiere(objetMoyenne);

    const moyennePonderee =
      extraireMoyennePonderee(
        objetMoyenne,
        moyenneFirebase,
        coefficientMatiere
      );

    const evaluations = {
      interrogations: [],
      devoirsSurveilles: [],
      devoirsCommuns: [],
      autres: [],
    };

    notes.forEach((ev) => {
      const groupe = classerEvaluation(ev);

      evaluations[groupe].push({
        ...ev,
        note: convertirNote(ev),
      });
    });

    const appreciation = obtenirAppreciation(
      objetMoyenne,
      notes
    );

    const signature = obtenirSignature(objetMoyenne);

    const professeur =
      objetMoyenne && typeof objetMoyenne === 'object'
        ? String(
            objetMoyenne.professeurName ||
              objetMoyenne.profName ||
              objetMoyenne.nomProfesseur ||
              ''
          )
        : '';

    return {
      notes,
      evaluations,
      moyenneFirebase,
      coefficientMatiere,
      moyennePonderee,
      appreciation,
      signature,
      professeur,
      objetMoyenne,
    };
  }, [
    eleve,
    matiereSelectionnee,
    notesTrimestre,
    moyennesTrimestre,
  ]);

  /* ============================================================
     MOYENNE TRIMESTRIELLE VALIDÉE
     ============================================================ */
  const moyenneTrimestrielleValidee = useMemo(
    () => extraireMoyenneTrimestrielleValidee(eleve, trimestre),
    [eleve, trimestre]
  );

  /*
   * Le bilan affiché ici n'est PAS recalculé à partir des matières.
   * Il reprend la moyenne trimestrielle déjà validée.
   */
  const bilanTrimestrielGlobal = useMemo(
    () => ({
      moyenneGenerale: moyenneTrimestrielleValidee,
    }),
    [moyenneTrimestrielleValidee]
  );

  /* ============================================================
     BILAN ANNUEL
     T1 = coefficient 1
     T2 = coefficient 2
     T3 = coefficient 2
     Formule = (T1*1 + T2*2 + T3*2) / 5
     ============================================================ */
  const bilanAnnuel = useMemo(() => {
    if (!eleve) {
      return {
        trimestre1: null,
        trimestre2: null,
        trimestre3: null,
        moyenneAnnuelle: null,
        totalPondere: 0,
        complet: false,
      };
    }

    const trimestre1 = extraireMoyenneTrimestrielleValidee(
      eleve,
      1
    );

    const trimestre2 = extraireMoyenneTrimestrielleValidee(
      eleve,
      2
    );

    const trimestre3 = extraireMoyenneTrimestrielleValidee(
      eleve,
      3
    );

    const complet =
      trimestre1 !== null &&
      trimestre2 !== null &&
      trimestre3 !== null;

    if (!complet) {
      return {
        trimestre1,
        trimestre2,
        trimestre3,
        moyenneAnnuelle: null,
        totalPondere: 0,
        complet: false,
      };
    }

    const totalPondere =
      trimestre1 * 1 +
      trimestre2 * 2 +
      trimestre3 * 2;

    const moyenneAnnuelle = Number(
      (totalPondere / 5).toFixed(2)
    );

    return {
      trimestre1,
      trimestre2,
      trimestre3,
      moyenneAnnuelle,
      totalPondere: Number(totalPondere.toFixed(2)),
      complet: true,
    };
  }, [eleve]);

  /* ============================================================
     CHARGEMENT DES CHAMPS DE SAISIE
     ============================================================ */
  useEffect(() => {
    if (!donneesMatiere) {
      setMoyenneModifiee('');
      return;
    }

    setMoyenneModifiee(
      donneesMatiere.moyenneFirebase !== null
        ? String(donneesMatiere.moyenneFirebase)
        : ''
    );
  }, [donneesMatiere]);

  useEffect(() => {
    setAvisPP(
      eleve?.appreciations_conseil?.[
        `notes_trimestre_${trimestre}`
      ] || ''
    );
  }, [eleve, trimestre]);

  useEffect(() => {
    setMessage({ type: '', text: '' });
  }, [eleveSelectionneId, trimestre, matiereSelectionnee]);

  /* ============================================================
     MODIFICATION D'UNE MOYENNE DE MATIÈRE PAR LE PP
     ============================================================ */
  const modifierMoyenne = async () => {
    if (!eleve || !matiereSelectionnee) return;

    const valeur = Number(
      String(moyenneModifiee)
        .replace(',', '.')
        .trim()
    );

    if (
      !Number.isFinite(valeur) ||
      valeur < 0 ||
      valeur > 20
    ) {
      setMessage({
        type: 'error',
        text:
          sessionStorage.getItem(
            'sgs_error_invalid_note_range'
          ) ||
          'La moyenne doit être comprise entre 0 et 20.',
      });
      return;
    }

    if (
      donneesMatiere?.moyenneFirebase !== null &&
      Number(donneesMatiere.moyenneFirebase) === valeur
    ) {
      setMessage({
        type: 'info',
        text:
          sessionStorage.getItem('sgs_info_no_change') ||
          'Aucune modification de moyenne nécessaire.',
      });
      return;
    }

    if (
      !window.confirm(
        `Confirmer la modification de la moyenne de ${matiereSelectionnee} pour ${getNom(
          eleve
        )} ?`
      )
    ) {
      return;
    }

    setSauvegardeEnCours(true);

    try {
      const cle = `notes_trimestre_${trimestre}`;
      const eleveRef = doc(db, 'users', eleve.id);

      const coefficient = donneesMatiere?.coefficientMatiere;

      if (coefficient === null || coefficient === undefined) {
        setMessage({
          type: 'error',
          text: 'Le coefficient de cette matière n’a pas été transmis par le professeur.',
        });
        return;
      }

      const moyennePonderee = Number((valeur * coefficient).toFixed(2));

      await updateDoc(eleveRef, {
        [`moyennes_matiere.${cle}.${matiereSelectionnee}.note`]:
          valeur,
        [`moyennes_matiere.${cle}.${matiereSelectionnee}.coefficientMatiere`]:
          coefficient,
        [`moyennes_matiere.${cle}.${matiereSelectionnee}.moyennePonderee`]:
          moyennePonderee,
        [`moyennes_matiere.${cle}.${matiereSelectionnee}.corrigeParPP`]:
          professeurId,
        [`moyennes_matiere.${cle}.${matiereSelectionnee}.corrigeParPPNom`]:
          getNom(user),
        [`moyennes_matiere.${cle}.${matiereSelectionnee}.dateCorrectionPP`]:
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setMessage({
        type: 'success',
        text:
          sessionStorage.getItem(
            'sgs_save_success_firebase'
          ) ||
          'Moyenne enregistrée avec succès dans le dossier de l’élève.',
      });
    } catch (error) {
      console.error(
        'Erreur correction moyenne PP :',
        error
      );

      setMessage({
        type: 'error',
        text:
          error.message ||
          'Impossible de modifier la moyenne.',
      });
    } finally {
      setSauvegardeEnCours(false);
    }
  };

  /* ============================================================
     ENREGISTREMENT DE L'AVIS DU PP DANS LE DOCUMENT ÉLÈVE
     ============================================================ */
  const enregistrerAvisPP = async (event) => {
    event.preventDefault();

    if (!eleve || !avisPP.trim()) return;

    if (
      !window.confirm(
        'Confirmer l’enregistrement de votre avis de Professeur Principal ?'
      )
    ) {
      return;
    }

    setSauvegardeEnCours(true);

    try {
      const cle = `notes_trimestre_${trimestre}`;
      const eleveRef = doc(db, 'users', eleve.id);

      const donnees = {
        [`appreciations_conseil.${cle}`]:
          avisPP.trim(),
        [`verdict_signe_par.${cle}`]:
          getNom(user),
        [`verdict_professeur_principal_id.${cle}`]:
          professeurId,
        [`verdict_date.${cle}`]:
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      /*
       * Au T3, on enregistre aussi le bilan annuel calculé
       * avec les coefficients officiels demandés :
       * T1=1, T2=2, T3=2.
       *
       * La décision finale n'est volontairement PAS écrite ici :
       * elle appartient au ConseilClasse.jsx.
       */
      if (Number(trimestre) === 3) {
        if (bilanAnnuel.complet) {
          donnees['conseilClasseAnnuel.trimestre1.moyenne'] =
            bilanAnnuel.trimestre1;

          donnees['conseilClasseAnnuel.trimestre1.coefficient'] = 1;

          donnees['conseilClasseAnnuel.trimestre2.moyenne'] =
            bilanAnnuel.trimestre2;

          donnees['conseilClasseAnnuel.trimestre2.coefficient'] = 2;

          donnees['conseilClasseAnnuel.trimestre3.moyenne'] =
            bilanAnnuel.trimestre3;

          donnees['conseilClasseAnnuel.trimestre3.coefficient'] = 2;

          donnees['conseilClasseAnnuel.totalPondere'] =
            bilanAnnuel.totalPondere;

          donnees['conseilClasseAnnuel.totalCoefficients'] = 5;

          donnees['conseilClasseAnnuel.moyenneAnnuelle'] =
            bilanAnnuel.moyenneAnnuelle;

          donnees['conseilClasseAnnuel.appreciationPP'] =
            avisPP.trim();

          donnees['conseilClasseAnnuel.professeurPrincipalId'] =
            professeurId;

          donnees['conseilClasseAnnuel.professeurPrincipalNom'] =
            getNom(user);

          donnees['conseilClasseAnnuel.dateCalcul'] =
            new Date().toISOString();

          donnees['conseilClasseAnnuel.statut'] =
            'moyenne_annuelle_calculee';
        } else {
          donnees['conseilClasseAnnuel.statut'] =
            'trimestres_incomplets';
        }
      }

      await updateDoc(eleveRef, donnees);

      setMessage({
        type: 'success',
        text:
          Number(trimestre) === 3 && bilanAnnuel.complet
            ? 'Avis du Professeur Principal et moyenne annuelle enregistrés dans le dossier de l’élève.'
            : 'Avis du Professeur Principal enregistré dans le dossier de l’élève.',
      });
    } catch (error) {
      console.error('Erreur avis PP :', error);

      setMessage({
        type: 'error',
        text:
          error.message ||
          'Impossible d’enregistrer votre avis.',
      });
    } finally {
      setSauvegardeEnCours(false);
    }
  };

  /* ============================================================
     ÉTATS DE CHARGEMENT / ERREUR
     ============================================================ */
  if (loadingClasse || loadingEleves) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            {sessionStorage.getItem('sgs_label_sync_live') ||
              'Synchronisation des données pédagogiques...'}
          </p>
        </div>
      </div>
    );
  }

  if (!classePP) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">👑</div>

          <h2 className="text-lg font-black uppercase text-slate-800">
            {sessionStorage.getItem('sgs_title_no_class') ||
              'Aucune classe principale trouvée'}
          </h2>

          <p className="text-sm text-slate-500 mt-3">
            {sessionStorage.getItem('sgs_desc_no_class') ||
              "Votre profil n'est actuellement associé à aucune classe comme Professeur Principal."}
          </p>

          <Link
            to="/professeur/dashboard"
            className="inline-flex mt-6 px-5 py-3 rounded-xl bg-slate-900  text-xs font-black no-underline"
          >
            {sessionStorage.getItem('sgs_btn_back_bureau') ||
              'Retour au bureau'}
          </Link>
        </div>
      </div>
    );
  }

  const nomClasse = trouverValeurClasse(classePP);

  const nomEleve = eleve
    ? `${eleve.nom || ''} ${
        eleve.prenoms || eleve.prenom || ''
      }`.trim()
    : '';

  return (
    <div className="bg-white min-h-screen  text-slate-700 font-sans  sm:p-6 lg:p-8 text-left">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ======================================================
            EN-TÊTE
        ====================================================== */}
        <div className="bg-slate-900 rounded-2xl p-6 shadow-md">
          <Header />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mt-5">
            <div>
              
              <h1 className="bureau-1 inline-flex  rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-black uppercase tracking-widest">
                {' '}
                {sessionStorage.getItem(
                  'sgs_tag_pp_supervision'
                ) || 'Bureau du Professeur Principal'}
              </h1>
                <Link
                to="/professeur/dashboard"
                className="signretou inline-flex mb-5  py-1 rounded-xl bg-white/10 hover:bg-white/20  text-xs font-black no-underline transition"
              >
                ← Retour au bureau
              </Link>
              <div className=''>
              <Link
                        to="/professeur/conseil-classe"
                        className="signretou-1 w-full text-center bg-gray-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-1 rounded-xl transition mt-5 block no-underline shadow-sm"
                      >
                        Aller au Conseil de classe
                      </Link>
               </div>
              <h3 className="bureau-2 text-xl sm:text-2xl font-black uppercase mt-3">
                {sessionStorage.getItem(
                  'sgs_title_confrontation'
                ) || 'Confrontation des résultats scolaires'}
              </h3>

              <p className="bureau-4 text-xs text-slate-400 mt-2 font-bold">
                {sessionStorage.getItem('sgs_label_div') ||
                  'Classe principale :'}{' '}
                <span className="border text-orange-400 py-2 p-2 font-black ml-1 uppercase">
                  {String(nomClasse)}
                </span>
              </p>

              <p className="bureau-3 text-xs text-slate-400 mt-1 font-bold">
                {sessionStorage.getItem(
                  'sgs_label_prof_prefix'
                ) || 'Professeur :'}{' '}
                <span className=" font-black ml-1">
                  {getNom(user)}
                </span>
              </p>
            </div>

            <div className="bureau-5 bg-white/5 rounded-xl p-4 min-w-[180px]">
              <p className="text-[9px] uppercase font-black text-slate-400">
                {sessionStorage.getItem(
                  'sgs_label_student_count'
                ) || 'Élèves de la classe : '} {eleves.length}
              </p>

              {/* <p className="text-3xl font-black text-orange-400 mt-1">
                {eleves.length}
              </p> */}
            </div>
          </div>
        </div>

        {/* ======================================================
            SÉLECTIONS : CLASSE / ÉLÈVE / TRIMESTRE / MATIÈRE
        ====================================================== */}
        <div className="bg-white ">
          <div className="etatcivil-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-3">
            {/* CLASSE */}
            <h1 className='tireeleve-1'>Les donnees sur l'éleve</h1>
             <div className='principal form-floating mb-3'>
              <label  htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Classe du Professeur Principal
              </label>

              <select
                value={classePP?.id || ''}
                  id="floatingInput"
                   name="nom"
                onChange={(event) => {
                  const nouvelleClasse = classesPP.find(
                    (classe) => classe.id === event.target.value
                  );

                  setClassePP(nouvelleClasse || null);
                  setEleveSelectionneId('');
                  setRechercheEleve('');
                }}
                className="form-control w-full p-6 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-orange-500 text-xs font-black text-slate-700"
              >
                {classesPP.length === 0 ? (
                  <option value="">
                    Aucune classe disponible
                  </option>
                ) : (
                  classesPP.map((classe) => (
                    <option
                      key={classe.id}
                      value={classe.id}
                    >
                      {trouverValeurClasse(classe)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* RECHERCHE + ÉLÈVE */}
            <div className='principal-1 form-floating mb-3'>
              <label  htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Rechercher éleve par nom, prénom, matricule...
              </label>

              <input
                type="search"
                id="floatingInput"
                name="nom"
                value={rechercheEleve}
                onChange={(event) =>
                  setRechercheEleve(event.target.value)
                }
                placeholder="Rechercher nom, prénom, matricule..."
                className="form-control w-full p-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-orange-500 text-xs font-bold text-slate-700 mb-2"
              />

              <select
                value={eleveSelectionneId}
                onChange={(event) =>
                  setEleveSelectionneId(event.target.value)
                }
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-orange-500 text-xs font-black text-slate-700"
              >
                {elevesFiltres.length === 0 ? (
                  <option value="">
                    Aucun élève trouvé
                  </option>
                ) : (
                  elevesFiltres.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {`${item.nom || ''} ${
                        item.prenoms || item.prenom || ''
                      }`.trim()}
                      {item.matricule
                        ? ` — ${item.matricule}`
                        : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* TRIMESTRE */}
            <div className="principal-2 block text-[9px] font-black uppercase text-slate-400 mb-1">
              <label className="bass block text-[9px] py-0 font-black uppercase text-slate-400 mb-1">
                Trimestre en cours
              </label>

              <select
                value={trimestre}
                onChange={(event) =>
                  setTrimestre(event.target.value)
                }
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-orange-500 text-xs font-black text-slate-700"
              >
                <option value="1">Trimestre 1</option>
                <option value="2">Trimestre 2</option>
                <option value="3">Trimestre 3</option>
              </select>

              <p className="textdanger text-slate-400 mt-2 font-bold">
                Trimestre 1 = Coef 1 <br /> Trimestre 2 = Coef 2 <br /> Trimestre 3 = Coef 2
              </p>
            </div>

            {/* MATIÈRE */}
            <div  className="principal-3 block text-[9px] font-black uppercase text-slate-400 mb-1">
              <label className="bass block text-[9px]  font-black uppercase text-slate-400 mb-1">
                Matière à confronter
              </label>

              <select
                value={matiereSelectionnee}
                onChange={(event) =>
                  setMatiereSelectionnee(event.target.value)
                }
                disabled={!matieres.length}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-orange-500 text-xs font-black text-slate-700 disabled:opacity-50"
              >
                {!matieres.length ? (
                  <option value="">
                    Aucune matière disponible
                  </option>
                ) : (
                  matieres.map((matiere) => (
                    <option
                      key={matiere}
                      value={matiere}
                    >
                      {matiere}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
        <div className="separateur"><div className="traitepricipal"></div></div>
        <div className="separateur"><div className="traitepricipal-1"></div></div>
        {/* ======================================================
            MESSAGE
        ====================================================== */}
        {message.text && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-black border ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : message.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ======================================================
            DOSSIER ÉLÈVE
        ====================================================== */}
        {!eleve ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <span className="text-4xl block mb-3">👨‍🎓</span>
            <p className="text-xs font-black uppercase text-slate-500">
              Aucun élève sélectionné.
            </p>
          </div>
        ) : (
          <>
            {/* IDENTITÉ */}
            <div className="identite ">
               <h1 className='tireeleve-2'>Identité de l'élève concerné</h1>
              <div className="flex flex-col md:flex-row md:items-center gap-5">
                <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                  {eleve.photoURL ||
                  eleve.photoUrl ||
                  eleve.photo ||
                  eleve.avatar ? (
                    <img
                      src={
                        eleve.photoURL ||
                        eleve.photoUrl ||
                        eleve.photo ||
                        eleve.avatar
                      }
                      alt=""
                      className="photoeleve w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">👨‍🎓</span>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-orange-500">
                    Dossier pédagogique de l'élève
                  </p>

                  <h2 className="text-xl sm:text-2xl font-black uppercase text-slate-900 mt-1">
                    {nomEleve || 'Élève sans nom'}
                  </h2>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {eleve.matricule && (
                      <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-[9px] font-black text-slate-600 uppercase">
                        Matricule : {eleve.matricule}
                      </span>
                    )}

                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-[9px] font-black text-slate-600 uppercase">
                      Classe : {nomClasse}
                    </span>

                    {eleve.promotion && (
                      <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-[9px] font-black text-slate-600 uppercase">
                        Promotion : {eleve.promotion}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="separateur"><div className="diviseur"></div></div>
            {/* ==================================================
                CONFRONTATION DE LA MATIÈRE
            ================================================== */}
            {donneesMatiere ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-5">
                  <div className="bg-white rounded-2xl  overflow-hidden">
                    <div className="p-5  flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="confron   p-5  flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="font-black uppercase text-danger tracking-widest">
                          Etape I : Confrontation des résultats
                        </p>

                        <h3 className="text-lg font-black uppercase text-slate-900 mt-1">
                          {matiereSelectionnee}
                        </h3>

                        {donneesMatiere.professeur && (
                          <p className="text-[10px] text-slate-400 font-bold mt-1">
                            Enseignant :{' '}
                            <span className="text-slate-700">
                              {donneesMatiere.professeur}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="flexflex items-center justify-end gap-2">
                        <div className="bg-indigo-50  rounded-xl px-4 py-3 text-center min-w-[110px]">
                          <p className="text-[8px] uppercase font-black text-indigo-400">
                            Coefficient matière
                          </p>
                          <p className="text-danger font-black text-indigo-700 mt-1">
                            {donneesMatiere.coefficientMatiere !== null
                              ? donneesMatiere.coefficientMatiere
                              : '—'}
                          </p>
                          <p className="text-[8px] text-indigo-400 font-bold mt-1">
                            récupéré du professeur
                          </p>
                        </div>

                        <div className="bg-emerald-50 px-4 py-3 text-center min-w-[135px]">
                          <p className="text-[8px] uppercase font-black text-emerald-500">
                            Moyenne pondérée
                          </p>
                          <p className="text-danger font-black text-emerald-700 mt-1">
                            {donneesMatiere.moyennePonderee !== null
                              ? donneesMatiere.moyennePonderee.toFixed(2)
                              : '—'}
                          </p>
                          <p className="text-[8px] text-emerald-500 font-bold mt-1">
                            moyenne × coefficient
                          </p>
                        </div>
                         <div className="bg-slate-900  rounded-xl px-5 py-4 text-center min-w-[140px]">
                        <p className="text-[8px] uppercase font-black text-slate-400">
                          Moyenne matière
                        </p>

                        <p className="text-danger font-black text-orange-400 mt-1">
                          {donneesMatiere.moyenneFirebase !==
                          null
                            ? Number(
                                donneesMatiere.moyenneFirebase
                              ).toFixed(2)
                            : '—'}
                          <span className="text-xs text-slate-400 ml-1">
                            /20
                          </span>
                        </p>
                      </div>
                      </div>

                     
                    </div>
                    <div></div>
                    {/* NOTES PAR TYPE */}
                    <div className="flexflex-1 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        [
                          'Interrogations',
                          donneesMatiere.evaluations
                            .interrogations,
                         
                        ],
                        [
                          'Devoirs surveillés',
                          donneesMatiere.evaluations
                            .devoirsSurveilles,
                          
                        ],
                        [
                          'Devoirs / Composition',
                          donneesMatiere.evaluations
                            .devoirsCommuns,
                          
                        ],
                        [
                          'Autres évaluations',
                          donneesMatiere.evaluations.autres,
                          
                        ],
                      ].map(
                        ([
                          titreBloc,
                          liste,
                          bg,
                          border,
                          text,
                        ]) => (
                          <div
                            key={titreBloc}
                            className={`${bg} ${border}  p-4`}
                          >
                            <h4
                              className={`text-[10px] font-black uppercase ${text} tracking-wider mb-3`}
                            >
                              {titreBloc}
                            </h4>

                            <div className="space-y-2">
                              {liste.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic font-medium">
                                  {sessionStorage.getItem(
                                    'sgs_label_no_note'
                                  ) || 'Aucune note'}
                                </p>
                              ) : (
                                liste.map((ev, i) => (
                                  <div
                                    key={`${titreBloc}-${i}`}
                                    className="bg-white  p-2.5 flex items-center justify-between "
                                  >
                                    <div className="text-left">
                                      <p className="text-[9px] font-black text-slate-700 uppercase max-w-[180px] truncate">
                                        {ev.type || 'Note'}
                                      </p>

                                      <p className="text-[8px] text-slate-400 font-medium mt-0.5">
                                        {ev.date || ''}
                                      </p>
                                    </div>

                                    <span className="text-sm font-black font-mono text-slate-900">
                                      {ev.note !== null
                                        ? ev.note
                                        : '—'}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* APPRECIATION + SIGNATURE */}
                    <div className="flexflex-2 p-5 pt-0">
                      <div className=" rounded-xl bg-slate-50  p-4 space-y-3">
                        <p className="text-danger uppercase font-black text-slate-400 tracking-wider">
                          {sessionStorage.getItem(
                            'sgs_label_appreciation_title'
                          ) ||
                            "Appréciation pédagogique de l'enseignant"}
                        </p>

                        <p className="bg-success p-3 rounded-xl border border-slate-100 italic font-bold text-xs  shadow-sm">
                          {donneesMatiere.appreciation
                            ? `« ${donneesMatiere.appreciation} »`
                            : sessionStorage.getItem(
                                'sgs_label_no_appreciation'
                              ) ||
                              'Aucune appréciation enregistrée.'}
                        </p>

                        {donneesMatiere.signature && (
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-14  flex items-center justify-center overflow-hidden p-1 shadow-sm">
                              <img
                                src={donneesMatiere.signature}
                                alt=""
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>

                            <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-wider">
                              {sessionStorage.getItem(
                                'sgs_tag_signed'
                              ) || '✍️ RELEVÉ SIGNÉ'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ==================================================
                      MOYENNE TRIMESTRIELLE VALIDÉE
                  ================================================== */}
                  <div className="valide bg-slate-900 rounded-2xl p-3 text-danger border border-slate-800 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Moyenne trimestrielle validée
                        </p>

                        <p className="text-xs text-slate-400 mt-1 max-w-xl">
                          Cette moyenne est récupérée depuis les
                          données trimestrielles déjà enregistrées
                          dans le dossier de l’élève. Elle n’est pas
                          recalculée ici à partir des matières.
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-3xl font-black text-orange-400">
                          {bilanTrimestrielGlobal.moyenneGenerale !==
                          null
                            ? bilanTrimestrielGlobal.moyenneGenerale.toFixed(
                                2
                              )
                            : '—'}
                        </span>

                        <span className="text-xs text-slate-400 ml-1">
                          /20
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ==================================================
                    COLONNE PP
                ================================================== */}
                <div className="space-y-5">
                  {/* CORRECTION MATIÈRE */}
                  <div className=" confron-1  p-5">
                    <div className="mb-4">
                      <h3 className="text-pp uppercase font-black text-indigo-500 tracking-widest">
                        Partie III : Ajustement PP
                      </h3>

                      <p className="text-base font-black uppercase text-slate-900 mt-1">
                        Corriger la moyenne de matière
                      </p>

                      <p className="text-[10px] text-slate-400 mt-1 font-medium">
                        Le PP peut corriger la moyenne consolidée
                        lorsqu'une erreur est constatée.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={moyenneModifiee}
                        onChange={(event) =>
                          setMoyenneModifiee(
                            event.target.value
                          )
                        }
                        className="flex-1 p-3 border border-slate-200 rounded-xl text-center text-sm font-black text-slate-900 outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                      />

                      <span className="font-black text-slate-400">
                        /20
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-center">
                        <p className="text-[8px] uppercase font-black text-indigo-400">
                          Coefficient récupéré
                        </p>
                        <p className="text-lg font-black text-indigo-700 mt-1">
                          {donneesMatiere.coefficientMatiere !== null
                            ? donneesMatiere.coefficientMatiere
                            : '—'}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                        <p className="text-[8px] uppercase font-black text-emerald-500">
                          Moyenne pondérée
                        </p>
                        <p className="text-lg font-black text-emerald-700 mt-1">
                          {(() => {
                            const valeur = Number(String(moyenneModifiee).replace(',', '.'));
                            const coefficient = donneesMatiere.coefficientMatiere;
                            return Number.isFinite(valeur) && coefficient !== null
                              ? (valeur * coefficient).toFixed(2)
                              : donneesMatiere.moyennePonderee !== null
                              ? donneesMatiere.moyennePonderee.toFixed(2)
                              : '—';
                          })()}
                        </p>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-400 mt-3 font-medium">
                      Le coefficient est récupéré depuis la transmission du professeur.
                      Le PP ajuste uniquement la moyenne de matière ; la moyenne pondérée est recalculée automatiquement.
                    </p>

                    <button
                      type="button"
                      onClick={modifierMoyenne}
                      disabled={sauvegardeEnCours}
                      className="lebtn w-full mt-3 bg-indigo-600  hover:bg-indigo-700 disabled:bg-indigo-300  font-black px-2 py-1 rounded-xl border-0 cursor-pointer text-[10px] uppercase shadow-sm transition"
                    >
                      {sauvegardeEnCours
                        ? '⏳ Enregistrement...'
                        : sessionStorage.getItem(
                            'sgs_btn_modify_note'
                          ) || 'Modifier la moyenne'}
                    </button>
                  </div>

                  {/* AVIS PP */}
                  <div className="formpp bg-slate-900  p-5 ">
                    <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="textpp font-black uppercase text-orange-400 tracking-widest">
                          {sessionStorage.getItem(
                            'sgs_label_council_title'
                          ) || 'Partie II : Conseil Pédagogique'}
                        </h3>

                        <p className="text-base font-black uppercase mt-1">
                          {sessionStorage.getItem(
                            'sgs_title_verdict_section'
                          ) ||
                            'Avis du Professeur Principal'}
                        </p>
                      </div>
                    </div>

                    <form
                      onSubmit={enregistrerAvisPP}
                      className="space-y-4"
                    >
                      <textarea
                        value={avisPP}
                        onChange={(event) =>
                          setAvisPP(event.target.value)
                        }
                        rows="7"
                        placeholder={
                          sessionStorage.getItem(
                            'sgs_placeholder_conseil'
                          ) ||
                          'Saisir l’avis du Professeur Principal...'
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm  outline-none resize-none font-sans font-medium focus:ring-2 focus:ring-orange-500"
                        required
                      />

                      <div className="text-[9px] text-slate-400 uppercase font-black tracking-wide">
                        PP : {getNom(user)}
                      </div>

                      <button
                        type="submit"
                        disabled={
                          sauvegardeEnCours ||
                          !avisPP.trim()
                        }
                        className="lebt bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 px-3 py-1 rounded-xl text-[10px] font-black uppercase border-0 cursor-pointer shadow-md transition w-full"
                      >
                        {sauvegardeEnCours
                          ? '⏳ Enregistrement...'
                          : sessionStorage.getItem(
                              'sgs_btn_save_verdict'
                            ) || 'Enregistrer mon avis'}
                      </button>
                    </form>
                  </div>

                  {/* BILAN ANNUEL : VISIBLE AU T3 */}
                  {Number(trimestre) === 3 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <p className="text-[9px] uppercase font-black text-orange-500 tracking-widest">
                        Bilan annuel
                      </p>

                      <h3 className="text-base font-black uppercase text-slate-900 mt-1">
                        Calcul de fin d'année
                      </h3>

                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {[
                          ['T1', bilanAnnuel.trimestre1, 1],
                          ['T2', bilanAnnuel.trimestre2, 2],
                          ['T3', bilanAnnuel.trimestre3, 2],
                        ].map(([label, valeur, coefficient]) => (
                          <div
                            key={label}
                            className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center"
                          >
                            <p className="text-[9px] font-black text-slate-400 uppercase">
                              {label}
                            </p>

                            <p className="text-lg font-black text-slate-900 mt-1">
                              {valeur !== null
                                ? valeur.toFixed(2)
                                : '—'}
                            </p>

                            <p className="text-[8px] font-black text-orange-500 mt-1">
                              Coef. {coefficient}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 rounded-xl bg-slate-900  p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[9px] uppercase font-black text-slate-400">
                            Moyenne générale annuelle
                          </span>

                          <span className="text-2xl font-black text-orange-400">
                            {bilanAnnuel.moyenneAnnuelle !==
                            null
                              ? bilanAnnuel.moyenneAnnuelle.toFixed(
                                  2
                                )
                              : '—'}
                            <span className="text-xs text-slate-400 ml-1">
                              /20
                            </span>
                          </span>
                        </div>

                        {!bilanAnnuel.complet && (
                          <p className="text-[9px] text-slate-400 mt-3">
                            La moyenne annuelle sera calculée
                            lorsque T1, T2 et T3 seront tous
                            validés.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 shadow-sm">
                <span className="text-4xl block mb-2">📚</span>

                <p className="text-xs font-black uppercase tracking-wide">
                  {sessionStorage.getItem(
                    'sgs_label_no_data_transmited'
                  ) ||
                    'Aucune donnée de moyenne disponible pour cette discipline ce trimestre.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPP;
