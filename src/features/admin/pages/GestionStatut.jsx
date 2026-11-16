// src/features/admin/pages/GestionStatut.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { db } from '../../../services/api';

import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';

import { useAuth } from '../../../context/AuthContext';

// IMPORTANT : on utilise la vraie fonction qui génère le PDF + QR
import {
  genererFicheAvecQRCodePDF,
} from '../../../utils/bulletinUtils.js';

import {
  imprimerBulletinTrimestriel,
} from '../../../utils/bulletinUtils';

import Header from '../../../pages/Header.jsx';

const GestionStatut = () => {
  const {
    schoolId,
    schoolName,
  } = useAuth();

  /* =========================================================
     ÉTABLISSEMENT COURANT
  ========================================================= */

  const currentSchool = String(
    schoolId ||
      sessionStorage.getItem(
        'sgs_school_id'
      ) ||
      ''
  )
    .trim()
    .toLowerCase();

  const [eleves, setEleves] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    filtrePromotion,
    setFiltrePromotion,
  ] = useState('all');

  const [
    listePromotionsExistantes,
    setListePromotionsUniques,
  ] = useState([]);

  const [
    envoiEnCours,
    setEnvoiEnCours,
  ] = useState(null);

  const [
    badgeEnCours,
    setBadgeEnCours,
  ] = useState(null);

  const [message, setMessage] =
    useState({
      type: '',
      text: '',
    });

  /* =========================================================
     TRIMESTRE
  ========================================================= */

  const trimestreFiltre =
    sessionStorage.getItem(
      'sgs_trimestre'
    ) || '1';

  /* =========================================================
     NETTOYAGE PROMOTION
  ========================================================= */

  const nettoyerPromotionIvoirienne = (
    promoBrute = ''
  ) => {
    const str = String(
      promoBrute
    )
      .toLowerCase()
      .trim();

    if (!str) return '';

    if (
      str.startsWith('t_') ||
      str.startsWith('tle') ||
      str.startsWith('terminal')
    ) {
      return 'Terminal';
    }

    if (
      str.startsWith('1ere') ||
      str.startsWith('1ère') ||
      str.startsWith('premiere')
    ) {
      return '1ere';
    }

    if (
      str.startsWith('2nd') ||
      str.startsWith('2nde') ||
      str.startsWith('2ème') ||
      str.startsWith('2eme')
    ) {
      return '2nd';
    }

    if (
      str.startsWith('3eme') ||
      str.startsWith('3ème')
    ) {
      return '3eme';
    }

    if (
      str.startsWith('4eme') ||
      str.startsWith('4ème')
    ) {
      return '4eme';
    }

    if (
      str.startsWith('5eme') ||
      str.startsWith('5ème')
    ) {
      return '5eme';
    }

    if (
      str.startsWith('6eme') ||
      str.startsWith('6ème')
    ) {
      return '6eme';
    }

    return str
      .split('_')[0]
      .toUpperCase();
  };

  /* =========================================================
     MESSAGE
  ========================================================= */

  const afficherMessage = (
    type,
    text
  ) => {
    setMessage({
      type,
      text,
    });

    window.setTimeout(() => {
      setMessage({
        type: '',
        text: '',
      });
    }, 6000);
  };

  /* =========================================================
     CHANGEMENT DU STATUT
  ========================================================= */

  const handleChangerStatutManuel =
    async (
      studentId,
      nouveauStatut
    ) => {
      if (
        !studentId ||
        !nouveauStatut
      ) {
        return;
      }

      try {
        const studentRef = doc(
          db,
          'users',
          studentId
        );

        const maintenant =
          new Date().toISOString();

        await updateDoc(
          studentRef,
          {
            statut:
              nouveauStatut,

            statutAcces:
              nouveauStatut,

            updatedAtStatut:
              maintenant,

            updatedAt:
              maintenant,
          }
        );

        setEleves(
          (liste) =>
            liste.map(
              (eleve) =>
                eleve.id ===
                studentId
                  ? {
                      ...eleve,

                      statut:
                        nouveauStatut,

                      statutAcces:
                        nouveauStatut,

                      updatedAtStatut:
                        maintenant,
                    }
                  : eleve
            )
        );

        afficherMessage(
          'success',
          `Statut mis à jour : ${String(
            nouveauStatut
          ).toUpperCase()}`
        );
      } catch (error) {
        console.error(
          'Erreur changement statut :',
          error
        );

        afficherMessage(
          'error',
          error?.message ||
            'Impossible de modifier le statut.'
        );
      }
    };

  /* =========================================================
     GÉNÉRATION DU BADGE + QR
     
     IMPORTANT :
     On relit Firestore juste avant de générer le PDF.
  ========================================================= */

  const handleGenererBadge =
    async (student) => {
      if (!student?.id) {
        afficherMessage(
          'error',
          "Identifiant de l'élève introuvable."
        );

        return;
      }

      setBadgeEnCours(
        student.id
      );

      try {
        const studentRef =
          doc(
            db,
            'users',
            student.id
          );

        const studentSnap =
          await getDoc(
            studentRef
          );

        if (
          !studentSnap.exists()
        ) {
          throw new Error(
            "Le document de l'élève n'existe plus."
          );
        }

        const studentFreshData =
          studentSnap.data() || {};

        /*
         * PRIORITÉ AU STATUT ENREGISTRÉ
         * DANS FIRESTORE.
         */
        const statutFirestore =
          String(
            studentFreshData.statutAcces ||
              studentFreshData.statut ||
              student.statutAcces ||
              student.statut ||
              'actif'
          )
            .trim()
            .toLowerCase();

        /*
         * Fusion complète.
         */
        const studentComplet = {
          ...studentFreshData,

          id:
            studentSnap.id,

          statut:
            statutFirestore,

          statutAcces:
            statutFirestore,

          schoolId:
            studentFreshData.schoolId ||
            currentSchool,

          schoolName:
            studentFreshData.schoolName ||
            schoolName ||
            '',
        };

        console.log(
          '🪪 Génération badge avec statut :',
          statutFirestore
        );

        /*
         * GÉNÉRATION RÉELLE DU PDF.
         */
        const resultat =
          await genererFicheAvecQRCodePDF(
            studentComplet
          );

        if (
          resultat === false ||
          resultat?.success === false
        ) {
          throw new Error(
            "La génération du badge a échoué."
          );
        }

        afficherMessage(
          'success',
          `Badge généré — statut : ${String(
            statutFirestore
          ).toUpperCase()}`
        );
      } catch (error) {
        console.error(
          'Erreur génération badge :',
          error
        );

        afficherMessage(
          'error',
          error?.message ||
            'Impossible de générer le badge.'
        );
      } finally {
        setBadgeEnCours(
          null
        );
      }
    };

  /* =========================================================
     ENVOI / IMPRESSION BULLETIN
  ========================================================= */

  const handleAdminEnvoyerBulletinAuxParents =
    async (
      studentTarget
    ) => {
      if (!studentTarget?.id) {
        return;
      }

      const nomComplet =
        `${studentTarget.nom || ''} ${
          studentTarget.prenoms ||
          studentTarget.prenom ||
          ''
        }`
          .trim()
          .toUpperCase();

      setEnvoiEnCours(
        studentTarget.id
      );

      try {
        const studentRef =
          doc(
            db,
            'users',
            studentTarget.id
          );

        await updateDoc(
          studentRef,
          {
            [`bulletin_somme_t${trimestreFiltre}`]:
              Number(
                studentTarget.moyenneGeneraleCalcul ||
                  0
              ),

            [`bulletin_statut_t${trimestreFiltre}`]:
              'transmis_aux_parents',

            updatedAt:
              new Date().toISOString(),
          }
        );

        const success =
          await imprimerBulletinTrimestriel(
            studentTarget,
            schoolName,
            currentSchool
          );

        if (success) {
          afficherMessage(
            'success',
            `✓ ${nomComplet}`
          );
        } else {
          throw new Error(
            "Impossible de générer le bulletin."
          );
        }
      } catch (error) {
        console.error(
          error
        );

        afficherMessage(
          'error',
          error?.message ||
            "Erreur lors de l'impression."
        );
      } finally {
        setEnvoiEnCours(
          null
        );
      }
    };

  /* =========================================================
     FIRESTORE — ÉLÈVES TEMPS RÉEL
  ========================================================= */

  useEffect(() => {
    if (!currentSchool) {
      setEleves([]);
      setListePromotionsUniques(
        []
      );
      setLoading(false);

      return undefined;
    }

    setLoading(true);

    const q = query(
      collection(
        db,
        'users'
      )
    );

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          const list = [];
          const promos =
            new Set();

          const coefficientsCollege =
            {
              francais: 5,
              français: 5,
              mathematiques: 3,
              mathématiques: 3,
              maths: 3,
              anglais: 2,
              lv1: 2,
              'physique-chimie': 2,
              pc: 2,
              svt: 2,
              'histoire-geographie': 2,
              hg: 2,
              allemand: 1,
              espagnol: 1,
              lv2: 1,
              edhc: 1,
              'arts plastiques': 1,
              musique: 1,
              arts: 1,
              eps: 1,
            };

          const coefficientsLycee =
            {
              A: {
                francais: 5,
                français: 5,
                philosophie: 5,
                mathematiques: 2,
                mathématiques: 2,
                maths: 2,
                'physique-chimie': 1,
                pc: 1,
                svt: 1,
                'histoire-geographie': 4,
                hg: 4,
                anglais: 4,
                lv1: 4,
                allemand: 4,
                espagnol: 4,
                lv2: 4,
                edhc: 1,
                arts: 1,
                eps: 1,
              },

              C: {
                francais: 2,
                français: 2,
                philosophie: 2,
                mathematiques: 5,
                mathématiques: 5,
                maths: 5,
                'physique-chimie': 5,
                pc: 5,
                svt: 2,
                'histoire-geographie': 2,
                hg: 2,
                anglais: 2,
                lv1: 2,
                allemand: 1,
                espagnol: 1,
                lv2: 1,
                edhc: 1,
                arts: 1,
                eps: 1,
              },

              D: {
                francais: 3,
                français: 3,
                philosophie: 2,
                mathematiques: 4,
                mathématiques: 4,
                maths: 4,
                'physique-chimie': 4,
                pc: 4,
                svt: 5,
                'histoire-geographie': 2,
                hg: 2,
                anglais: 2,
                lv1: 2,
                allemand: 1,
                espagnol: 1,
                lv2: 1,
                edhc: 1,
                arts: 1,
                eps: 1,
              },
            };

          snapshot.forEach(
            (docSnap) => {
              const d =
                docSnap.data() || {};

              const schoolIdEleve =
                String(
                  d.schoolId || ''
                )
                  .trim()
                  .toLowerCase();

              const roleEleve =
                String(
                  d.role || ''
                )
                  .trim()
                  .toLowerCase();

              if (
                schoolIdEleve !==
                  currentSchool ||
                roleEleve !==
                  'eleve'
              ) {
                return;
              }

              const niveau =
                nettoyerPromotionIvoirienne(
                  d.promotion
                );

              const estLycee =
                [
                  'Terminal',
                  '1ere',
                  '2nd',
                ].includes(
                  niveau
                );

              const classeBrute =
                String(
                  d.serie ||
                    d.classeNom ||
                    d.classe ||
                    'D'
                ).toUpperCase();

              const serieIdentifiee =
                classeBrute.includes(
                  'A'
                )
                  ? 'A'
                  : classeBrute.includes(
                      'C'
                    )
                  ? 'C'
                  : 'D';

              const cleTrimestre =
                `notes_trimestre_${trimestreFiltre}`;

              const trimestreData =
                d.notes?.[
                  cleTrimestre
                ] || {};

              let totalPointsPonderesBulletin =
                0;

              let totalCoefficientsBulletin =
                0;

              Object.entries(
                trimestreData
              ).forEach(
                ([
                  nomMatiere,
                  notesMatiere,
                ]) => {
                  if (
                    !Array.isArray(
                      notesMatiere
                    ) ||
                    notesMatiere.length ===
                      0
                  ) {
                    return;
                  }

                  if (
                    [
                      'eps',
                      'education physique',
                    ].includes(
                      nomMatiere
                        .toLowerCase()
                    )
                  ) {
                    return;
                  }

                  let pointsPonderesMatiere =
                    0;

                  let coefficientsNotesMatiere =
                    0;

                  notesMatiere.forEach(
                    (item) => {
                      let noteValeur = 0;

                      let typeEvaluation =
                        'interrogation';

                      if (
                        typeof item ===
                          'object' &&
                        item !== null
                      ) {
                        noteValeur =
                          parseFloat(
                            item.note ?? 0
                          );

                        typeEvaluation =
                          String(
                            item.type ||
                              item.categorie ||
                              'interrogation'
                          ).toLowerCase();
                      } else {
                        noteValeur =
                          parseFloat(
                            item || 0
                          );
                      }

                      if (
                        Number.isNaN(
                          noteValeur
                        ) ||
                        !Number.isFinite(
                          noteValeur
                        )
                      ) {
                        return;
                      }

                      let coeffInterne = 1;

                      if (
                        typeEvaluation.includes(
                          'commun'
                        ) ||
                        typeEvaluation.includes(
                          'classe'
                        ) ||
                        typeEvaluation.includes(
                          'devoir'
                        ) ||
                        typeEvaluation.includes(
                          'surveille'
                        )
                      ) {
                        coeffInterne = 2;
                      } else if (
                        typeEvaluation.includes(
                          'comp'
                        ) ||
                        typeEvaluation.includes(
                          'composition'
                        )
                      ) {
                        coeffInterne = 3;
                      }

                      pointsPonderesMatiere +=
                        noteValeur *
                        coeffInterne;

                      coefficientsNotesMatiere +=
                        coeffInterne;
                    }
                  );

                  if (
                    coefficientsNotesMatiere >
                    0
                  ) {
                    const moyenneMatiereBase20 =
                      pointsPonderesMatiere /
                      coefficientsNotesMatiere;

                    const nomNettoye =
                      nomMatiere
                        .toLowerCase()
                        .trim();

                    let coeffGlobalMatiere =
                      1;

                    if (
                      estLycee
                    ) {
                      coeffGlobalMatiere =
                        coefficientsLycee[
                          serieIdentifiee
                        ]?.[
                          nomNettoye
                        ] || 1;
                    } else {
                      coeffGlobalMatiere =
                        coefficientsCollege[
                          nomNettoye
                        ] || 1;
                    }

                    totalPointsPonderesBulletin +=
                      moyenneMatiereBase20 *
                      coeffGlobalMatiere;

                    totalCoefficientsBulletin +=
                      coeffGlobalMatiere;
                  }
                }
              );

              const moyenneGeneraleCalcul =
                totalCoefficientsBulletin >
                0
                  ? parseFloat(
                      (
                        totalPointsPonderesBulletin /
                        totalCoefficientsBulletin
                      ).toFixed(2)
                    )
                  : 0;

              if (niveau) {
                promos.add(
                  niveau
                );
              }

              const statutActuel =
                d.statutAcces ||
                d.statut ||
                'actif';

              list.push({
                ...d,

                id:
                  docSnap.id,

                moyenneGeneraleCalcul,

                statut:
                  statutActuel,

                statutAcces:
                  statutActuel,
              });
            }
          );

          list.sort(
            (a, b) =>
              `${a.nom || ''} ${
                a.prenoms || ''
              }`
                .trim()
                .localeCompare(
                  `${b.nom || ''} ${
                    b.prenoms || ''
                  }`.trim(),
                  'fr'
                )
          );

          setListePromotionsUniques(
            Array.from(
              promos
            ).sort()
          );

          setEleves(
            list
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            'Erreur Firestore :',
            error
          );

          setLoading(false);
        }
      );

    return () =>
      unsubscribe();
  }, [
    currentSchool,
    trimestreFiltre,
  ]);

  /* =========================================================
     FILTRE PROMOTION
  ========================================================= */

  const elevesFiltres =
    useMemo(() => {
      return eleves.filter(
        (student) => {
          if (
            filtrePromotion ===
            'all'
          ) {
            return true;
          }

          return (
            nettoyerPromotionIvoirienne(
              student.promotion
            ) ===
            filtrePromotion
          );
        }
      );
    }, [
      eleves,
      filtrePromotion,
    ]);

  /* =========================================================
     CHARGEMENT
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white  p-8 rounded-2xl text-center shadow-sm animate-pulse">
          <div className="text-4xl mb-3">
            📚
          </div>

          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {sessionStorage.getItem(
              'sgs_label_loading_bulletins'
            ) ||
              'Chargement des notes et livrets...'}
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     INTERFACE
  ========================================================= */

  return (
    <div className="min-h-screen bg-white text-slate-700 font-sans p-4 sm:p-6 lg:p-8 text-left">
      <div className="max-w-7xl mx-auto">

        {/* BANDEAU */}

        <div className="bg-white  -slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">

          <div className="bg-slate-950 px-6 py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>

              <div className="flex items-center gap-3 mb-2">

                <div>
                  <h1 className="gestion text-lg sm:text-xl font-black uppercase tracking-wide ">
                    {sessionStorage.getItem(
                      'sgs_label_admin_title'
                    ) ||
                      'Gestion des bulletins & Notes'}
                  </h1>
                  <p className="text-[9px] font-black tracking-[0.2em] uppercase text-orange-400">
                    {sessionStorage.getItem(
                      'sgs_label_admin_sub'
                    ) ||
                      'Administration académique'}
                  </p>
                </div>

              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={
                  filtrePromotion
                }
                onChange={(e) =>
                  setFiltrePromotion(
                    e.target.value
                  )
                }
                className="bg-white text-slate-800 -0 p-3 border text-xs font-black uppercase rounded-xl outline-none cursor-pointer font-sans"
              >

                <option value="all">
                  {sessionStorage.getItem(
                    'sgs_label_all_promos'
                  ) ||
                    'Toutes les promotions'}
                </option>

                {listePromotionsExistantes.map(
                  (promo) => (
                    <option
                      key={promo}
                      value={promo}
                    >
                      {(sessionStorage.getItem(
                        'sgs_label_promo_prefix'
                      ) ||
                        'PROMOTION') +
                        ' ' +
                        String(
                          promo
                        ).toUpperCase()}
                    </option>
                  )
                )}

              </select>

            </div>

          </div>

          <div className="px-6 py-4 bg-slate-50 -t -slate-200">

            <p className="gestion-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
              {(
                sessionStorage.getItem(
                  'sgs_label_extraction_prefix'
                ) ||
                'Extraction dynamique des moyennes du Trimestre'
              ) +
                ' ' +
                trimestreFiltre +
                ' ' +
                (sessionStorage.getItem(
                  'sgs_label_extraction_suffix'
                ) ||
                  "depuis l'arborescence Cloud Firestore.")}
            </p>

          </div>

        </div>

        {/* MESSAGE */}

        {message.text && (
          <div
            className={`mb-6 rounded-xl  p-4 text-xs font-black flex items-center gap-3 ${
              message.type ===
              'error'
                ? 'bg-red-50 -red-200 text-red-700'
                : 'bg-emerald-50 -emerald-200 text-emerald-700'
            }`}
          >

            <span>
              {message.type ===
              'error'
                ? '⚠️'
                : '✓'}
            </span>

            <span>
              {message.text}
            </span>

          </div>
        )}

        {/* TABLEAU */}

        <div className="bg-white rounded-2xl  -slate-200 shadow-sm overflow-hidden">

          <div className="px-5 py-4 -b -slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

            <div className='gestion-2'>

             {/*  <h2 className="text-sm font-black uppercase text-slate-900">
                {sessionStorage.getItem(
                  'sgs_label_table_title'
                ) ||
                  'Registres des Notes Apprenants'}
              </h2> */}

             {/*  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                {sessionStorage.getItem(
                  'sgs_label_table_sub'
                ) ||
                  'Calculateur de moyenne temps réel'}
              </p> */}

            </div>

            {/* <div className="text-info px-3 text-[9px] font-black uppercase text-slate-400">
              {elevesFiltres.length}{' '}
              {sessionStorage.getItem(
                'sgs_label_count_apprenants'
              ) ||
                'apprenant(s)'}
            </div> */}

          </div>

          <div className="overflow-x-auto">

            <table className="table-1 w-full text-left -collapse">

              <thead>

                <tr className="bg-slate-50 -b -slate-200 text-[9px] uppercase tracking-wider text-slate-400 font-black">

                  <th className="p-4">
                    {sessionStorage.getItem(
                      'sgs_th_matricule'
                    ) ||
                      'Matricule'}
                  </th>

                  <th className="p-4">
                    {sessionStorage.getItem(
                      'sgs_th_promotion'
                    ) ||
                      'Promotion'}
                  </th>

                  <th className="p-4">
                    {sessionStorage.getItem(
                      'sgs_th_classe'
                    ) ||
                      'Classe'}
                  </th>

                  <th className="p-4">
                    {sessionStorage.getItem(
                      'sgs_th_eleve'
                    ) ||
                      'Élève'}
                  </th>

                  <th className="p-4 text-center">
                    {sessionStorage.getItem(
                      'sgs_th_moyenne'
                    ) ||
                      'Moyenne Calculée'}
                  </th>

                  <th className="p-4 text-center">
                    {sessionStorage.getItem(
                      'sgs_th_statut'
                    ) ||
                      'Statut'}
                  </th>

                  <th className="p-4 text-right">
                    {sessionStorage.getItem(
                      'sgs_th_actions'
                    ) ||
                      'Actions'}
                  </th>

                </tr>

              </thead>

              <tbody>

                {elevesFiltres.length ===
                0 ? (
                  <tr>

                    <td
                      colSpan="7"
                      className="p-16 text-center"
                    >

                      <div className="text-4xl mb-3">
                        📂
                      </div>

                      <p className="text-xs font-black uppercase text-slate-400">
                        {sessionStorage.getItem(
                          'sgs_label_no_student'
                        ) ||
                          'Aucun élève trouvé pour cette promotion'}
                      </p>

                    </td>

                  </tr>
                ) : (
                  elevesFiltres.map(
                    (student) => {

                      const statutActuel =
                        student.statutAcces ||
                        student.statut ||
                        'actif';

                      const estExclu =
                        statutActuel ===
                        'exclu';

                      const estRedoublant =
                        statutActuel ===
                        'redoublant';

                      const nomComplet =
                        `${student.nom || ''} ${
                          student.prenoms || ''
                        }`
                          .trim()
                          .toUpperCase();

                      const envoi =
                        envoiEnCours ===
                        student.id;

                      const badge =
                        badgeEnCours ===
                        student.id;

                      return (
                        <tr
                          key={
                            student.id
                          }
                          className="-b -slate-100 hover:bg-slate-50/50 transition"
                        >

                          <td className="p-4">

                            <span className="font-mono text-[10px] font-black text-indigo-700">
                              {student.matricule ||
                                student.id}
                            </span>

                          </td>

                          <td className="p-4">

                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100  -slate-200 text-[9px] font-black uppercase text-slate-600">
                              {nettoyerPromotionIvoirienne(
                                student.promotion
                              ) ||
                                'N/A'}
                            </span>

                          </td>

                          <td className="p-4">

                            <span className="text-[10px] font-black uppercase text-slate-600">
                              {student.classeNom ||
                                student.classe ||
                                'N/A'}
                            </span>

                          </td>

                          <td className="p-4">

                            <div>

                              <p className="text-xs font-black uppercase text-slate-900">
                                {nomComplet}
                              </p>

                              <p className="text-[9px] text-slate-400 mt-1 truncate max-w-[240px] font-medium">
                                {student.emailParent ||
                                  sessionStorage.getItem(
                                    'sgs_label_no_email_parent'
                                  ) ||
                                  "Aucun e-mail parent enregistré"}
                              </p>

                            </div>

                          </td>

                          <td className="p-4 text-center">

                            <span className="text-sm font-black font-mono text-indigo-700">
                              {student.moyenneGeneraleCalcul
                                ? student.moyenneGeneraleCalcul.toFixed(
                                    2
                                  )
                                : '0.00'}
                            </span>

                            <span className="text-[8px] text-slate-400 ml-1 uppercase">
                              /20
                            </span>

                          </td>

                          <td className="p-4 text-center">

                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-[8px] uppercase font-black ${
                                estExclu
                                  ? 'bg-red-100 text-red-700'
                                  : estRedoublant
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {statutActuel}
                            </span>

                          </td>

                          <td className="p-4">

                            <div className="flex justify-end items-center gap-2 flex-wrap">

                              {/* STATUT */}

                              <select
                                value={
                                  statutActuel
                                }
                                onChange={(e) =>
                                  handleChangerStatutManuel(
                                    student.id,
                                    e.target.value
                                  )
                                }
                                className="bg-white  -slate-300 text-[8px] font-black uppercase p-2 rounded-lg outline-none text-slate-700 cursor-pointer"
                              >

                                <option value="actif">
                                  {sessionStorage.getItem(
                                    'sgs_opt_actif'
                                  ) ||
                                    '✓ Actif'}
                                </option>

                                <option value="redoublant">
                                  {sessionStorage.getItem(
                                    'sgs_opt_redoublant'
                                  ) ||
                                    '⚠️ Redoublant'}
                                </option>

                                <option value="exclu">
                                  {sessionStorage.getItem(
                                    'sgs_opt_exclu'
                                  ) ||
                                    '❌ Exclu'}
                                </option>

                              </select>

                              {/* BULLETIN */}

                              <button
                                type="button"
                                onClick={() =>
                                  handleAdminEnvoyerBulletinAuxParents(
                                    student
                                  )
                                }
                                disabled={envoi}
                                className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 font-black text-[8px] uppercase px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap -0 cursor-pointer"
                              >

                                {envoi
                                  ? sessionStorage.getItem(
                                      'sgs_btn_processing'
                                    ) ||
                                    '⏳ Traitement...'
                                  : sessionStorage.getItem(
                                      'sgs_btn_print'
                                    ) ||
                                    '📜 Imprimer le bulletin'}

                              </button>

                              {/* BADGE */}

                              <button
                                type="button"
                                disabled={
                                  badge
                                }
                                onClick={() =>
                                  handleGenererBadge(
                                    student
                                  )
                                }
                                className=" -slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-wait text-slate-700 font-black text-[8px] uppercase px-2.5 py-2 rounded-lg transition bg-white cursor-pointer"
                              >

                                {badge
                                  ? '⏳ Génération...'
                                  : sessionStorage.getItem(
                                      'sgs_btn_badge'
                                    ) ||
                                    '🪪 Badge'}

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

        </div>

        {/* NOTICE */}

        <div className="mt-5 bg-indigo-50  -indigo-100 rounded-xl px-5 py-4">

          <p className="text-[9px] font-black uppercase tracking-wider text-indigo-700">
            {sessionStorage.getItem(
              'sgs_notice_title'
            ) ||
              'Calculateur Multi-Tenant Autonome'}
          </p>

          <p className="text-[9px] text-indigo-600 font-medium mt-1">
            {sessionStorage.getItem(
              'sgs_notice_text'
            ) ||
              "Les moyennes sont compilées en direct. Le clic sur imprimer extrait instantanément le relevé au format PDF sans solliciter de ressource serveur externe."}
          </p>

        </div>

      </div>

    </div>
  );
};

export default GestionStatut;