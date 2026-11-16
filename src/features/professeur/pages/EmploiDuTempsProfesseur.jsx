import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../pages/Header';

const EmploiDuTempsProfesseur = () => {
  const { user, schoolId, schoolName } = useAuth();

  const [monPlanning, setMonPlanning] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');

  // ============================================================
  // ÉTABLISSEMENT
  // ============================================================

  const currentSchool = String(
    user?.schoolId ||
      schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
  )
    .trim()
    .toLowerCase();

  // ============================================================
  // IDENTIFIANTS POSSIBLES DU PROFESSEUR
  // ============================================================
  //
  // Dans Firestore, le professeurId ressemble par exemple à :
  // PROF_FORGIE_491
  //
  // On vérifie donc plusieurs identifiants disponibles dans
  // AuthContext/sessionStorage.
  //

  const identifiantsProfesseur = useMemo(() => {
    const valeurs = [
      user?.matricule,
      user?.id,
      user?.uid,
      user?.professeurId,
      user?.profId,
      sessionStorage.getItem('sgs_user_id'),
      sessionStorage.getItem('sgs_user_matricule'),
    ];

    return [
      ...new Set(
        valeurs
          .filter(Boolean)
          .map((value) => String(value).trim())
          .filter(Boolean)
      ),
    ];
  }, [user]);

  // ============================================================
  // NOM DU PROFESSEUR
  // ============================================================

  const nomProfesseur =
    user?.name ||
    user?.nomComplet ||
    `${user?.nom || ''} ${user?.prenoms || user?.prenom || ''}`.trim() ||
    'Professeur';

  // ============================================================
  // RÉCUPÉRATION DE L'EMPLOI DU TEMPS
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      console.warn(
        '⚠️ Aucun schoolId trouvé pour récupérer l’emploi du temps.'
      );

      setMonPlanning([]);
      setErreur('Aucun établissement associé à votre compte.');
      setLoading(false);

      return undefined;
    }

    if (identifiantsProfesseur.length === 0) {
      console.warn(
        '⚠️ Aucun identifiant professeur trouvé.',
        user
      );

      setMonPlanning([]);
      setErreur(
        'Impossible de déterminer votre identifiant professeur.'
      );
      setLoading(false);

      return undefined;
    }

    setLoading(true);
    setErreur('');

    console.log('🏫 Établissement :', currentSchool);
    console.log(
      '👨‍🏫 Identifiants professeur recherchés :',
      identifiantsProfesseur
    );

    // ==========================================================
    // IMPORTANT :
    // professeurId est dans creneaux[],
    // PAS au niveau du document emplois_du_temps.
    //
    // On récupère donc tous les EDT de l'établissement.
    // ==========================================================

    const q = query(
      collection(db, 'emplois_du_temps'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(
          `📚 ${snapshot.size} emploi(s) du temps trouvé(s).`
        );

        const coursTrouves = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          console.log(
            '📄 EDT :',
            docSnap.id,
            data
          );

          if (!Array.isArray(data?.creneaux)) {
            return;
          }

          data.creneaux.forEach((creneau, index) => {
            const professeurId = String(
              creneau?.professeurId ||
                creneau?.profId ||
                creneau?.enseignantId ||
                ''
            ).trim();

            const professeurIdLower =
              professeurId.toLowerCase();

            const correspondance = identifiantsProfesseur.some(
              (id) =>
                String(id).trim().toLowerCase() ===
                professeurIdLower
            );

            if (!correspondance) {
              return;
            }

            const cours = {
              ...creneau,

              // Sécurité : récupérer aussi les informations
              // du document parent si nécessaire.
              idEdt: docSnap.id,

              classeId:
                creneau?.classeId ||
                data?.classeId ||
                data?.idClasse ||
                '',

              nomClasse:
                creneau?.nomClasse ||
                creneau?.classeNom ||
                data?.classeNom ||
                data?.nomClasse ||
                data?.classe ||
                'Classe non définie',

              professeurId,

              professeurName:
                creneau?.professeurName ||
                creneau?.professeurNom ||
                nomProfesseur,

              matiere:
                creneau?.matiere ||
                creneau?.discipline ||
                user?.matiere ||
                user?.specialite ||
                'Général',

              heureDebut:
                creneau?.heureDebut || '',

              heureFin:
                creneau?.heureFin || '',

              jour:
                creneau?.jour || '',
            };

            console.log(
              '✅ COURS DU PROFESSEUR TROUVÉ :',
              cours
            );

            coursTrouves.push(cours);
          });
        });

        // ========================================================
        // ÉVITER LES DOUBLONS
        // ========================================================

        const coursUniques = Array.from(
          new Map(
            coursTrouves.map((cours) => {
              const cle = [
                cours.idUniqueTemp || '',
                cours.idEdt || '',
                cours.jour || '',
                cours.heureDebut || '',
                cours.classeId || '',
                cours.professeurId || '',
              ].join('_');

              return [cle, cours];
            })
          ).values()
        );

        // ========================================================
        // TRI PAR JOUR PUIS PAR HEURE
        // ========================================================

        const ordreJours = {
          lundi: 1,
          mardi: 2,
          mercredi: 3,
          jeudi: 4,
          vendredi: 5,
          samedi: 6,
          dimanche: 7,
        };

        coursUniques.sort((a, b) => {
          const jourA =
            ordreJours[
              String(a.jour || '')
                .trim()
                .toLowerCase()
            ] || 99;

          const jourB =
            ordreJours[
              String(b.jour || '')
                .trim()
                .toLowerCase()
            ] || 99;

          if (jourA !== jourB) {
            return jourA - jourB;
          }

          return String(
            a.heureDebut || ''
          ).localeCompare(
            String(b.heureDebut || '')
          );
        });

        console.log(
          '📅 Planning final du professeur :',
          coursUniques
        );

        setMonPlanning(coursUniques);

        if (coursUniques.length === 0) {
          setErreur(
            `Aucun cours trouvé pour ${nomProfesseur}. ` +
              `Identifiants recherchés : ${identifiantsProfesseur.join(
                ', '
              )}`
          );
        } else {
          setErreur('');
        }

        setLoading(false);
      },
      (error) => {
        console.error(
          '❌ Erreur récupération planning professeur :',
          error
        );

        setErreur(
          `Erreur lors de la récupération de votre emploi du temps : ${
            error?.message || 'Erreur inconnue'
          }`
        );

        setMonPlanning([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    identifiantsProfesseur,
    nomProfesseur,
    user,
  ]);

  // ============================================================
  // NOM ÉTABLISSEMENT
  // ============================================================

  const nomEtablissement =
    schoolName ||
    sessionStorage.getItem('sgs_school_name') ||
    currentSchool
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (lettre) =>
        lettre.toUpperCase()
      ) ||
    'Établissement';

  // ============================================================
  // REGROUPEMENT PAR JOUR
  // ============================================================

  const planningParJour = useMemo(() => {
    const groupes = {};

    monPlanning.forEach((cours) => {
      const jour = cours.jour || 'Jour non défini';

      if (!groupes[jour]) {
        groupes[jour] = [];
      }

      groupes[jour].push(cours);
    });

    return groupes;
  }, [monPlanning]);

  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <div className="h-10 w-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />

        <p className="text-xs font-black text-gray-400 uppercase tracking-wider animate-pulse">
          ⏳ Synchronisation de votre emploi du temps...
        </p>
      </div>
    );
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-700 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">

        <Header />

        {/* ======================================================
            EN-TÊTE
        ====================================================== */}

        <div className="mt-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase">
                📅 Mon Emploi du Temps Officiel
              </h1>

              <p className="text-xs text-gray-400 font-bold uppercase mt-1">
                Mission quotidienne — planning pédagogique
              </p>
            </div>

            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black uppercase">
              🔴 Synchronisation temps réel
            </div>

          </div>

          {/* ====================================================
              INFORMATIONS PROFESSEUR
          ==================================================== */}

          <div className="mt-6 bg-slate-50 p-5 rounded-xl border border-gray-200 text-xs font-bold space-y-2">

            <p>
              👨‍🏫{' '}
              <strong>
                Professeur :
              </strong>{' '}
              <span className="uppercase">
                {nomProfesseur}
              </span>
            </p>

            <p>
              🆔{' '}
              <strong>
                Identifiant :
              </strong>{' '}
              <span className="font-mono text-purple-700">
                {identifiantsProfesseur.join(' / ')}
              </span>
            </p>

            <p>
              📚{' '}
              <strong>
                Discipline :
              </strong>{' '}
              {user?.matiere ||
                user?.matiereEnseignee ||
                user?.specialite ||
                'Général'}
            </p>

            <p>
              🏛️{' '}
              <strong>
                Établissement :
              </strong>{' '}
              <span className="uppercase text-purple-700">
                {nomEtablissement}
              </span>
            </p>

          </div>
        </div>

        {/* ======================================================
            ERREUR / INFORMATION
        ====================================================== */}

        {erreur && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <div className="text-2xl mb-2">
              ⚠️
            </div>

            <p className="text-xs font-black text-amber-700 uppercase">
              {erreur}
            </p>

            <p className="text-[10px] text-amber-600 mt-2">
              Vérifiez que votre identifiant professeur correspond
              au champ <strong>professeurId</strong> enregistré
              dans les créneaux de l'emploi du temps.
            </p>
          </div>
        )}

        {/* ======================================================
            AUCUN COURS
        ====================================================== */}

        {monPlanning.length === 0 && !erreur && (
          <div className="mt-6 py-16 text-center text-xs font-bold text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300">
            📭 Aucun créneau horaire ne vous a encore été assigné.
          </div>
        )}

        {/* ======================================================
            PLANNING
        ====================================================== */}

        {monPlanning.length > 0 && (
          <div className="mt-6 space-y-6">

            {Object.entries(planningParJour).map(
              ([jour, coursDuJour]) => (
                <div
                  key={jour}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                >

                  {/* JOUR */}

                  <div className="bg-slate-900 px-5 py-4">
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">
                      📆 {jour}
                    </h2>

                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">
                      {coursDuJour.length}{' '}
                      {coursDuJour.length > 1
                        ? 'créneaux'
                        : 'créneau'}
                    </p>
                  </div>

                  {/* TABLE */}

                  <div className="overflow-x-auto">

                    <table className="w-full text-left text-xs border-collapse">

                      <thead>
                        <tr className="bg-slate-50 uppercase font-black text-[10px] tracking-wider text-gray-500">
                          <th className="p-4">
                            Horaires
                          </th>

                          <th className="p-4">
                            Classe
                          </th>

                          <th className="p-4">
                            Matière
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">

                        {coursDuJour.map(
                          (cours, index) => (
                            <tr
                              key={
                                cours.idUniqueTemp ||
                                `${cours.idEdt}_${index}`
                              }
                              className="hover:bg-slate-50 transition"
                            >

                              <td className="p-4">
                                <div className="font-mono font-black text-orange-600">
                                  ⏰{' '}
                                  {cours.heureDebut ||
                                    '--:--'}{' '}
                                  —{' '}
                                  {cours.heureFin ||
                                    '--:--'}
                                </div>
                              </td>

                              <td className="p-4">
                                <div className="font-black text-blue-900 uppercase">
                                  🏛️{' '}
                                  {cours.nomClasse ||
                                    'Classe non définie'}
                                </div>

                                {cours.classeId && (
                                  <div className="text-[9px] text-gray-400 font-mono mt-1">
                                    {cours.classeId}
                                  </div>
                                )}
                              </td>

                              <td className="p-4">
                                <span className="inline-flex px-3 py-1 rounded-lg bg-purple-50 text-purple-700 font-black uppercase">
                                  📚{' '}
                                  {cours.matiere ||
                                    'Matière non définie'}
                                </span>
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>
                </div>
              )
            )}

          </div>
        )}

        {/* ======================================================
            RÉSUMÉ
        ====================================================== */}

        {monPlanning.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase">
                Créneaux
              </p>

              <p className="text-2xl font-black text-slate-900 mt-1">
                {monPlanning.length}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase">
                Classes
              </p>

              <p className="text-2xl font-black text-purple-700 mt-1">
                {
                  new Set(
                    monPlanning
                      .map((c) => c.classeId)
                      .filter(Boolean)
                  ).size
                }
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase">
                Matières
              </p>

              <p className="text-2xl font-black text-orange-600 mt-1">
                {
                  new Set(
                    monPlanning
                      .map((c) => c.matiere)
                      .filter(Boolean)
                  ).size
                }
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default EmploiDuTempsProfesseur;