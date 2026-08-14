import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../../services/api';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const GestionStatut = () => {
  const { schoolId, schoolName } = useAuth();

  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_moderne_gagnoa'
  )
    .trim()
    .toLowerCase();

  // ============================================================
  // ÉTATS
  // ============================================================

  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filtrePromotion, setFiltrePromotion] = useState('all');

  const [listePromotionsExistantes, setListePromotionsUniques] =
    useState([]);

  const [envoiEnCours, setEnvoiEnCours] = useState(null);

  const [message, setMessage] = useState({
    type: '',
    text: '',
  });

  // ============================================================
  // NORMALISATION DES PROMOTIONS
  // ============================================================

  const nettoyerPromotionIvoirienne = (promoBrute = '') => {
    const str = promoBrute
      .toString()
      .toLowerCase()
      .trim();

    if (!str) {
      return '';
    }

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

    return str.split('_')[0];
  };

  // ============================================================
  // MESSAGE TEMPORAIRE
  // ============================================================

  const afficherMessage = (type, text) => {
    setMessage({
      type,
      text,
    });

    window.setTimeout(() => {
      setMessage({
        type: '',
        text: '',
      });
    }, 5000);
  };

  // ============================================================
  // ÉCOUTEUR FIRESTORE TEMPS RÉEL
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      setEleves([]);
      setListePromotionsUniques([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const q = query(collection(db, 'users'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        const setPromos = new Set();

        snapshot.forEach((docSnap) => {
          const d = docSnap.data();

          const schoolCleanDoc = (d.schoolId || '')
            .toString()
            .trim()
            .toLowerCase();

          const roleClean = (d.role || '')
            .toString()
            .trim()
            .toLowerCase();

          // Seulement les élèves de l'établissement courant
          if (
            schoolCleanDoc !== currentSchool ||
            roleClean !== 'eleve'
          ) {
            return;
          }

          // ====================================================
          // CALCUL DES POINTS CUMULÉS
          // ====================================================

          const sourceNotes = d.notes || {};

          let totalPointsCumules = 0;

          Object.values(sourceNotes).forEach(
            (notesArray) => {
              if (!Array.isArray(notesArray)) {
                return;
              }

              notesArray.forEach((val) => {
                totalPointsCumules +=
                  parseFloat(val) || 0;
              });
            }
          );

          // ====================================================
          // PROMOTION
          // ====================================================

          if (
            d.promotion &&
            d.promotion.toString().trim() !== ''
          ) {
            const promoUnifiee =
              nettoyerPromotionIvoirienne(
                d.promotion
              );

            if (promoUnifiee) {
              setPromos.add(promoUnifiee);
            }
          }

          // ====================================================
          // ÉLÈVE
          // ====================================================

          list.push({
            id: docSnap.id,
            totalPointsCumules,
            ...d,
          });
        });

        // Tri alphabétique
        list.sort((a, b) => {
          const nomA = `${a.nom || ''} ${
            a.prenoms || a.prenom || ''
          }`.trim();

          const nomB = `${b.nom || ''} ${
            b.prenoms || b.prenom || ''
          }`.trim();

          return nomA.localeCompare(
            nomB,
            'fr',
            {
              sensitivity: 'base',
            }
          );
        });

        const promotionsTriees = Array.from(
          setPromos
        ).sort((a, b) =>
          a.localeCompare(b, 'fr', {
            sensitivity: 'base',
            numeric: true,
          })
        );

        setListePromotionsUniques(
          promotionsTriees
        );

        setEleves(list);
        setLoading(false);
      },
      (err) => {
        console.error(
          "Erreur d'écoute de la table des statuts :",
          err
        );

        setLoading(false);

        afficherMessage(
          'error',
          "Impossible de synchroniser les élèves en temps réel."
        );
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // ============================================================
  // FILTRE PROMOTION
  // ============================================================

  const elevesFiltres = useMemo(() => {
    return eleves.filter((student) => {
      if (filtrePromotion === 'all') {
        return true;
      }

      return (
        nettoyerPromotionIvoirienne(
          student.promotion
        ) === filtrePromotion
      );
    });
  }, [eleves, filtrePromotion]);

  // ============================================================
  // ENVOI DU BULLETIN AUX PARENTS
  // ============================================================

  const handleAdminEnvoyerBulletinAuxParents =
    async (studentTarget) => {
      const emailParent =
        studentTarget.emailParent ||
        studentTarget.email ||
        '';

      if (!emailParent.trim()) {
        afficherMessage(
          'error',
          "Envoi impossible : l'adresse e-mail de la famille est absente."
        );

        return;
      }

      setEnvoiEnCours(studentTarget.id);

      try {
        // ======================================================
        // NOTES
        // ======================================================

        const sourceNotes =
          studentTarget.notes || {};

        const listeMatieresPDF = [];

        let totalPtsGlobal = 0;
        let countMat = 0;

        Object.entries(sourceNotes).forEach(
          ([nomMatiere, notesArray]) => {
            if (
              !Array.isArray(notesArray) ||
              notesArray.length === 0
            ) {
              return;
            }

            if (
              nomMatiere.toLowerCase() === 'eps'
            ) {
              return;
            }

            const sommeMatiere =
              notesArray.reduce(
                (acc, value) =>
                  acc + (parseFloat(value) || 0),
                0
              );

            const moyenneMatiere = parseFloat(
              (
                sommeMatiere /
                notesArray.length
              ).toFixed(2)
            );

            listeMatieresPDF.push({
              nom: nomMatiere.toUpperCase(),
              notes: notesArray.join(' - '),
              moyenne: moyenneMatiere,
            });

            totalPtsGlobal +=
              moyenneMatiere;

            countMat++;
          }
        );

        const moyenneCalculee =
          countMat > 0
            ? parseFloat(
                (
                  totalPtsGlobal / countMat
                ).toFixed(2)
              )
            : 0;

        // ======================================================
        // SIGNATURES
        // ======================================================

        const signatureEducateur =
          studentTarget.signatureManuscriteBase64 ||
          sessionStorage.getItem(
            'sgs_educateur_sig'
          ) ||
          null;

        const signatureAdmin =
          sessionStorage.getItem(
            'sgs_admin_sig'
          ) || null;

        // ======================================================
        // NOM ÉLÈVE
        // ======================================================

        const nomEleve =
          `${studentTarget.nom || ''} ${
            studentTarget.prenoms ||
            studentTarget.prenom ||
            ''
          }`.trim();

        // ======================================================
        // PROMOTION
        // ======================================================

        const promotionNormalisee =
          nettoyerPromotionIvoirienne(
            studentTarget.promotion
          );

        // ======================================================
        // ENVOI BACKEND
        // ======================================================

        const response = await fetch(
          'http://localhost:10000/api/send-email',
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
            },

            body: JSON.stringify({
              to_email: emailParent
                .trim()
                .toLowerCase(),

              student_name:
                nomEleve.toUpperCase(),

              matricule:
                studentTarget.matricule ||
                studentTarget.id ||
                'N/A',

              promotion:
                promotionNormalisee
                  .toUpperCase(),

              classeId:
                (
                  studentTarget.classeId ||
                  'N/A'
                ).toUpperCase(),

              school_name:
                schoolName || 'Edulink',

              schoolId: currentSchool,

              moyenne: moyenneCalculee,

              absences:
                studentTarget.absences || 0,

              matieres: listeMatieresPDF,

              appreciationEducateur:
                studentTarget
                  .appreciationConduiteEducateur ||
                'Élève suivi régulièrement par la vie scolaire.',

              signature_educateur:
                signatureEducateur,

              signature_admin:
                signatureAdmin,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Erreur serveur HTTP ${response.status}`
          );
        }

        afficherMessage(
          'success',
          `Le bulletin PDF de ${nomEleve.toUpperCase()} a été transmis avec succès à la famille.`
        );
      } catch (err) {
        console.error(
          'Erreur routage SMTP bulletin :',
          err
        );

        afficherMessage(
          'error',
          "Une erreur technique a bloqué l'envoi du bulletin PDF."
        );
      } finally {
        setEnvoiEnCours(null);
      }
    };

  // ============================================================
  // CHANGEMENT DE STATUT
  // ============================================================

  const handleChangerStatutManuel = async (
    studentId,
    nouveauStatut
  ) => {
    if (!studentId || !nouveauStatut) {
      return;
    }

    try {
      await updateDoc(
        doc(db, 'users', studentId),
        {
          statut: nouveauStatut,
          updatedAtStatut:
            new Date().toISOString(),
        }
      );

      /*
       * Pas besoin de setEleves ici.
       *
       * Firestore déclenche automatiquement
       * onSnapshot() ci-dessus et l'élève est
       * immédiatement mis à jour dans le tableau.
       */

      afficherMessage(
        'success',
        `Statut mis à jour : ${nouveauStatut.toUpperCase()}`
      );
    } catch (err) {
      console.error(
        'Erreur modification statut :',
        err
      );

      afficherMessage(
        'error',
        "Impossible de modifier le statut de l'élève."
      );
    }
  };

  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3">
            ⏳
          </div>

          <p className="text-xs font-bold text-gray-400 animate-pulse uppercase tracking-wider">
            Analyse des fiches élèves...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans text-gray-700 text-left bg-gray-50 min-h-screen">

      {/* ======================================================
          BANDEAU
      ====================================================== */}

      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div>
          <h2 className="text-base font-black text-gray-800 uppercase tracking-wide">
            ⚖️ Console de Gestion des Statuts
          </h2>

          <p className="text-[11px] text-gray-400 font-medium mt-1">
            Modifiez le statut des apprenants ou
            expédiez leur livret de notes aux parents.
          </p>

          <div className="mt-2 text-[10px] text-emerald-600 font-black uppercase">
            ● Données synchronisées en temps réel
          </div>
        </div>

        {/* FILTRE */}
        <div>
          <select
            value={filtrePromotion}
            onChange={(e) =>
              setFiltrePromotion(
                e.target.value
              )
            }
            className="bg-white border border-gray-300 p-2.5 text-xs font-black uppercase rounded-xl outline-none text-gray-800 cursor-pointer focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">
              ⭐ Toutes les promotions
            </option>

            {listePromotionsExistantes.map(
              (promoName) => (
                <option
                  key={promoName}
                  value={promoName}
                >
                  Promotion{' '}
                  {promoName.toUpperCase()}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message.text && (
        <div
          className={`mb-6 rounded-xl border p-4 text-xs font-bold ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ======================================================
          STATISTIQUES
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-[10px] font-black uppercase text-gray-400">
            Élèves
          </p>

          <p className="text-2xl font-black text-gray-800 mt-1">
            {elevesFiltres.length}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-[10px] font-black uppercase text-gray-400">
            Promotions
          </p>

          <p className="text-2xl font-black text-gray-800 mt-1">
            {listePromotionsExistantes.length}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-[10px] font-black uppercase text-gray-400">
            Établissement
          </p>

          <p className="text-sm font-black text-gray-800 mt-2 truncate">
            {schoolName ||
              currentSchool}
          </p>
        </div>
      </div>

      {/* ======================================================
          TABLEAU
      ====================================================== */}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">

            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b text-[10px] tracking-wider">

                <th className="p-3">
                  Matricule
                </th>

                <th className="p-3">
                  Promotion
                </th>

                <th className="p-3">
                  Classe
                </th>

                <th className="p-3">
                  Nom & Prénoms
                </th>

                <th className="p-3 text-center">
                  Somme Notes
                </th>

                <th className="p-3 text-center">
                  Fiche Statut
                </th>

                <th className="p-3 text-right">
                  Actions
                </th>

              </tr>
            </thead>

            <tbody>

              {elevesFiltres.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="p-12 text-center text-gray-400 italic font-medium"
                  >
                    Aucun élève trouvé dans cette
                    section.
                  </td>
                </tr>
              ) : (
                elevesFiltres.map((student) => {
                  const estExclu =
                    student.statut ===
                    'exclu';

                  const estRedoublant =
                    student.statut ===
                    'redoublant';

                  const promoAffichee =
                    nettoyerPromotionIvoirienne(
                      student.promotion
                    );

                  const nomComplet =
                    `${student.nom || ''} ${
                      student.prenoms ||
                      student.prenom ||
                      ''
                    }`.trim();

                  const statutActuel =
                    student.statut ||
                    'actif';

                  const envoi =
                    envoiEnCours ===
                    student.id;

                  return (
                    <tr
                      key={student.id}
                      className="border-b border-gray-100 hover:bg-purple-50/20 transition"
                    >

                      {/* MATRICULE */}
                      <td className="p-3 font-mono text-purple-700 truncate max-w-[120px]">
                        {student.matricule ||
                          student.id}
                      </td>

                      {/* PROMOTION */}
                      <td className="p-3 uppercase text-gray-500">
                        <span className="px-2 py-1 rounded-md text-[10px] bg-slate-100 border border-slate-200 text-slate-700 font-black">
                          {promoAffichee ||
                            'N/A'}
                        </span>
                      </td>

                      {/* CLASSE */}
                      <td className="p-3 font-mono text-slate-600 uppercase">
                        {student.classeNom ||
                          student.classeId ||
                          'N/A'}
                      </td>

                      {/* NOM */}
                      <td className="p-3 text-gray-900 uppercase font-black truncate max-w-[200px]">
                        {nomComplet ||
                          'Élève sans nom'}
                      </td>

                      {/* NOTES */}
                      <td className="p-3 text-center font-mono text-purple-800 text-sm">
                        {Number(
                          student.totalPointsCumules ||
                            0
                        ).toFixed(1)}{' '}
                        pts
                      </td>

                      {/* STATUT */}
                      <td className="p-3 text-center">
                        <span
                          className={`text-[9px] uppercase px-2 py-1 rounded-full font-black ${
                            estExclu
                              ? 'bg-red-100 text-red-800'
                              : estRedoublant
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {statutActuel}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="p-3 text-right">

                        <div className="flex items-center justify-end gap-2 flex-wrap">

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
                            className="bg-white border border-gray-300 text-[9px] font-black uppercase p-1.5 rounded-md outline-none text-gray-700 cursor-pointer focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="actif">
                              ✓ Actif
                            </option>

                            <option value="redoublant">
                              ⚠️ Redoublant
                            </option>

                            <option value="exclu">
                              ❌ Exclu
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
                            className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-black text-[9px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer border-0 shadow-sm whitespace-nowrap"
                          >
                            {envoi
                              ? '⏳ Envoi...'
                              : '✉️ Envoyer Bulletin'}
                          </button>

                        </div>

                      </td>
                    </tr>
                  );
                })
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GestionStatut;