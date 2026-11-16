import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../../../../pages/Header';

const DUREE_CYCLE = 30;

const normaliser = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const ajouterJours = (date, jours) => {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() + jours);
  return resultat;
};

const toISO = (date) => {
  return new Date(date).toISOString();
};

const GestionPaieVacations = () => {
  const { user, schoolId } = useAuth();

  // ============================================================
  // IDENTITÉ DYNAMIQUE
  // ============================================================

  const currentSchool = String(
    user?.schoolId ||
      schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
  )
    .trim()
    .toLowerCase();

  const maPromotionResponsable = String(
    user?.promotion ||
      user?.assigned_promotion ||
      sessionStorage.getItem('sgs_user_promotion') ||
      ''
  )
    .trim()
    .toLowerCase();

  // ============================================================
  // ÉTATS
  // ============================================================

  const [pointagesRaw, setPointagesRaw] = useState([]);
  const [professeurs, setProfesseurs] = useState([]);
  const [cycle, setCycle] = useState(null);

  const [professeurFiltre, setProfesseurFiltre] =
    useState('');

  const [loading, setLoading] = useState(true);

  const [feedback, setFeedback] = useState({
    type: '',
    text: '',
  });

  // ============================================================
  // ID DU CYCLE
  // ============================================================

  const cycleDocId = useMemo(() => {
    if (!currentSchool || !maPromotionResponsable) {
      return '';
    }

    return `${currentSchool}_${maPromotionResponsable}`
      .replace(/[^a-zA-Z0-9_-]/g, '_');
  }, [
    currentSchool,
    maPromotionResponsable,
  ]);

  // ============================================================
  // CYCLE FIRESTORE EN TEMPS RÉEL
  // ============================================================

  useEffect(() => {
    if (!cycleDocId) {
      setCycle(null);
      return undefined;
    }

    const cycleRef = doc(
      db,
      'cycles_paie_vacations',
      cycleDocId
    );

    const unsubscribe = onSnapshot(
      cycleRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setCycle({
            id: snapshot.id,
            ...snapshot.data(),
          });

          return;
        }

        // Aucun cycle : création du premier cycle.
        const maintenant = new Date();
        const fin = ajouterJours(
          maintenant,
          DUREE_CYCLE
        );

        const nouveauCycle = {
          id: cycleDocId,
          schoolId: currentSchool,
          promotion: maPromotionResponsable,
          cycleStart: toISO(maintenant),
          cycleEnd: toISO(fin),
          numeroCycle: 1,
          statut: 'ouvert',
        };

        setCycle(nouveauCycle);

        setDoc(
          cycleRef,
          {
            schoolId: currentSchool,
            promotion: maPromotionResponsable,
            cycleStart: toISO(maintenant),
            cycleEnd: toISO(fin),
            numeroCycle: 1,
            statut: 'ouvert',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((error) => {
          console.error(
            'Erreur création cycle :',
            error
          );
        });
      },
      (error) => {
        console.error(
          'Erreur cycle paie :',
          error
        );

        setFeedback({
          type: 'error',
          text:
            'Impossible de synchroniser le cycle de 30 jours.',
        });
      }
    );

    return () => unsubscribe();
  }, [
    cycleDocId,
    currentSchool,
    maPromotionResponsable,
  ]);

  // ============================================================
  // POINTAGES DE L'ÉTABLISSEMENT
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      setPointagesRaw([]);
      setLoading(false);
      return undefined;
    }

    const q = query(
      collection(db, 'registre_pointages'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((docSnap) => {
          liste.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });

        setPointagesRaw(liste);
        setLoading(false);
      },
      (error) => {
        console.error(
          'Erreur registre_pointages :',
          error
        );

        setPointagesRaw([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // ============================================================
  // PROFESSEURS EN CHARGE DE LA PROMOTION
  // ============================================================
  //
  // IMPORTANT :
  // On ne dépend plus du registre des pointages pour connaître
  // les professeurs.
  //
  // Ainsi un professeur apparaît même avec 0 pointage.
  // ============================================================

  useEffect(() => {
    if (
      !currentSchool ||
      !maPromotionResponsable
    ) {
      setProfesseurs([]);
      return undefined;
    }

    const q = query(
      collection(db, 'users'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const map = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          const role = normaliser(
            data?.role ||
              data?.profil ||
              data?.type ||
              ''
          );

          const estProfesseur =
            role === 'professeur' ||
            role === 'prof' ||
            role === 'prof_principal' ||
            role === 'professeur_principal';

          if (!estProfesseur) {
            return;
          }

          const promotions = [
            data?.promotion,
            data?.assigned_promotion,
            data?.promotionAffectee,
            data?.promotionAssignee,
            data?.niveau,
          ]
            .filter(Boolean)
            .map(normaliser);

          const appartientPromotion =
            promotions.some(
              (promotion) =>
                promotion ===
                  maPromotionResponsable ||
                promotion.includes(
                  maPromotionResponsable
                ) ||
                maPromotionResponsable.includes(
                  promotion
                )
            );

          // Certaines fiches professeurs possèdent directement
          // une ou plusieurs classes.
          const classes = [
            data?.classeId,
            data?.classeNom,
            data?.classe,
            ...(Array.isArray(data?.classes)
              ? data.classes
              : []),
            ...(Array.isArray(
              data?.classesAffectees
            )
              ? data.classesAffectees
              : []),
          ]
            .filter(Boolean)
            .map(normaliser);

          const classeCorrespondante =
            classes.some(
              (classe) =>
                classe.includes(
                  maPromotionResponsable
                ) ||
                classe.includes(
                  `_${maPromotionResponsable}_`
                )
            );

          if (
            !appartientPromotion &&
            !classeCorrespondante
          ) {
            return;
          }

          const professeurId =
            data?.matricule ||
            data?.professeurId ||
            data?.profId ||
            data?.id ||
            docSnap.id;

          const professeurNom =
            data?.name ||
            data?.nomComplet ||
            `${data?.nom || ''} ${
              data?.prenoms ||
              data?.prenom ||
              ''
            }`.trim() ||
            data?.professeurName ||
            'Enseignant';

          map[String(professeurId)] = {
            id: String(professeurId),
            nom: professeurNom,
            promotion:
              data?.promotion ||
              data?.assigned_promotion ||
              maPromotionResponsable,
            matiere:
              data?.matiere ||
              data?.matiereEnseignee ||
              data?.discipline ||
              data?.specialite ||
              'Discipline',
          };
        });

        setProfesseurs(
          Object.values(map).sort(
            (a, b) =>
              String(a.nom).localeCompare(
                String(b.nom),
                'fr',
                {
                  sensitivity: 'base',
                }
              )
          )
        );
      },
      (error) => {
        console.error(
          'Erreur professeurs :',
          error
        );

        setProfesseurs([]);
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    maPromotionResponsable,
  ]);

  // ============================================================
  // DATES DU CYCLE
  // ============================================================

  const cycleStartDate = useMemo(() => {
    if (!cycle?.cycleStart) {
      return null;
    }

    const date = new Date(
      cycle.cycleStart
    );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }, [cycle]);

  const cycleEndDate = useMemo(() => {
    if (!cycle?.cycleEnd) {
      return null;
    }

    const date = new Date(
      cycle.cycleEnd
    );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }, [cycle]);

  // ============================================================
  // VÉRIFICATION PROMOTION
  // ============================================================

  const appartientPromotion = (pointage) => {
    const promotion = normaliser(
      pointage?.promotion ||
        pointage?.classeDuPoste ||
        pointage?.assigned_promotion ||
        ''
    );

    const classeId = normaliser(
      pointage?.classeId || ''
    );

    const classeNom = normaliser(
      pointage?.classeNom ||
        pointage?.terminalClasseNom ||
        ''
    );

    if (
      promotion ===
        maPromotionResponsable ||
      promotion.includes(
        maPromotionResponsable
      ) ||
      maPromotionResponsable.includes(
        promotion
      )
    ) {
      return true;
    }

    return (
      classeId.includes(
        maPromotionResponsable
      ) ||
      classeNom.includes(
        maPromotionResponsable
      )
    );
  };

  // ============================================================
  // VÉRIFICATION CYCLE 30 JOURS
  // ============================================================

  const appartientCycle = (pointage) => {
    if (!cycleStartDate) {
      return false;
    }

    const valeurDate =
      pointage?.datePointage ||
      pointage?.date ||
      pointage?.createdAt ||
      pointage?.updatedAt;

    if (!valeurDate) {
      return false;
    }

    const datePointage =
      new Date(valeurDate);

    if (
      Number.isNaN(
        datePointage.getTime()
      )
    ) {
      return false;
    }

    if (
      datePointage < cycleStartDate
    ) {
      return false;
    }

    if (
      cycleEndDate &&
      datePointage >= cycleEndDate
    ) {
      return false;
    }

    return true;
  };

  // ============================================================
  // POINTAGES DU CYCLE COURANT
  // ============================================================

  const pointagesCycle = useMemo(() => {
    return pointagesRaw.filter(
      (pointage) =>
        appartientCycle(pointage) &&
        appartientPromotion(pointage)
    );
  }, [
    pointagesRaw,
    cycleStartDate,
    cycleEndDate,
    maPromotionResponsable,
  ]);

  // ============================================================
  // LISTE DES PROFESSEURS
  // ============================================================

  const listeProfsFiltre = useMemo(() => {
    const map = {};

    professeurs.forEach((prof) => {
      map[prof.id] = prof;
    });

    // Sécurité : si un professeur existe dans un pointage
    // mais que sa fiche users n'est pas correctement affectée,
    // on le fait quand même apparaître.
    pointagesCycle.forEach((pointage) => {
      const id =
        pointage?.professeurId ||
        'PROF_INCONNU';

      if (!map[id]) {
        map[id] = {
          id,
          nom:
            pointage?.professeurName ||
            pointage?.profName ||
            'Enseignant',
          matiere:
            pointage?.matiere ||
            'Discipline',
          promotion:
            pointage?.promotion ||
            maPromotionResponsable,
        };
      }
    });

    return Object.values(map).sort(
      (a, b) =>
        String(a.nom).localeCompare(
          String(b.nom),
          'fr',
          {
            sensitivity: 'base',
          }
        )
    );
  }, [
    professeurs,
    pointagesCycle,
    maPromotionResponsable,
  ]);

  // ============================================================
  // BILAN
  // ============================================================

  const bilanVacationsProfs = useMemo(() => {
    const map = {};

    // Tous les professeurs commencent à 0.
    professeurs.forEach((prof) => {
      map[prof.id] = {
        id: prof.id,
        nom: prof.nom,
        matiere: prof.matiere,
        heuresTotales: 0,
        nombrePointages: 0,
        detailsInterventions: [],
      };
    });

    // Ajouter les pointages du cycle.
    pointagesCycle.forEach((pointage) => {
      const profId =
        pointage?.professeurId ||
        'PROF_INCONNU';

      const profNom =
        pointage?.professeurName ||
        pointage?.profName ||
        'Enseignant';

      if (
        professeurFiltre &&
        profId !== professeurFiltre
      ) {
        return;
      }

      if (!map[profId]) {
        map[profId] = {
          id: profId,
          nom: profNom,
          matiere:
            pointage?.matiere ||
            'Discipline',
          heuresTotales: 0,
          nombrePointages: 0,
          detailsInterventions: [],
        };
      }

      const heures = Number(
        pointage?.heuresEffectuees || 0
      );

      map[profId].heuresTotales +=
        Number.isFinite(heures)
          ? heures
          : 0;

      map[profId].nombrePointages += 1;

      map[profId].detailsInterventions.push({
        id: pointage.id,

        date:
          pointage?.datePointage ||
          pointage?.date ||
          '—',

        classe:
          pointage?.classeNom ||
          pointage?.terminalClasseNom ||
          pointage?.classeId ||
          'STRUCTURE',

        matiere:
          pointage?.matiere ||
          'Discipline',

        arrivee:
          pointage?.heureArrivee ||
          '—',

        depart:
          pointage?.heureDepart ||
          '—',

        volume:
          Number.isFinite(heures)
            ? heures
            : 0,

        securise:
          pointage?.terminalSecurise !==
          false,
      });
    });

    return Object.values(map)
      .filter((prof) =>
        professeurFiltre
          ? prof.id ===
            professeurFiltre
          : true
      )
      .sort((a, b) =>
        String(a.nom).localeCompare(
          String(b.nom),
          'fr',
          {
            sensitivity: 'base',
          }
        )
      );
  }, [
    professeurs,
    pointagesCycle,
    professeurFiltre,
  ]);

  // ============================================================
  // CLÔTURE DU CYCLE
  // ============================================================

  const handleGenererFicheEtMiseAZero =
    async () => {
      if (!cycle) {
        setFeedback({
          type: 'error',
          text:
            '❌ Aucun cycle actif.',
        });
        return;
      }

      if (!maPromotionResponsable) {
        setFeedback({
          type: 'error',
          text:
            '❌ Aucune promotion affectée à cet éducateur.',
        });
        return;
      }

      const confirmer =
        window.confirm(
          `🔒 CLÔTURE DU CYCLE\n\n` +
            `Promotion : ${maPromotionResponsable.toUpperCase()}\n` +
            `Cycle N° : ${
              cycle.numeroCycle || 1
            }\n` +
            `Début : ${
              cycleStartDate
                ? cycleStartDate.toLocaleDateString(
                    'fr-FR'
                  )
                : '—'
            }\n` +
            `Fin prévue : ${
              cycleEndDate
                ? cycleEndDate.toLocaleDateString(
                    'fr-FR'
                  )
                : '—'
            }\n\n` +
            `Le relevé sera généré puis un nouveau cycle de 30 jours sera ouvert.\n\n` +
            `Les anciens pointages resteront conservés.\n` +
            `Les compteurs du nouveau cycle repartiront à 0.\n\n` +
            `Continuer ?`
        );

      if (!confirmer) {
        return;
      }

      try {
        setFeedback({
          type: 'info',
          text:
            '⏳ Clôture du cycle en cours...',
        });

        const maintenant =
          new Date();

        const numeroAncienCycle =
          Number(
            cycle.numeroCycle || 1
          );

        // ======================================================
        // RAPPORT
        // ======================================================

        let contenu =
          '==================================================\n';

        contenu +=
          '       EDULINK - COMPTABILITÉ DES VACATIONS\n';

        contenu +=
          `       PROMOTION : ${maPromotionResponsable.toUpperCase()}\n`;

        contenu +=
          `       CYCLE N° : ${numeroAncienCycle}\n`;

        contenu +=
          `       DÉBUT : ${
            cycleStartDate
              ? cycleStartDate.toLocaleDateString(
                  'fr-FR'
                )
              : '—'
          }\n`;

        contenu +=
          `       CLÔTURE : ${maintenant.toLocaleString(
            'fr-FR'
          )}\n`;

        contenu +=
          '==================================================\n\n';

        bilanVacationsProfs.forEach(
          (prof) => {
            contenu +=
              `👨‍🏫 Enseignant : ${String(
                prof.nom
              ).toUpperCase()}\n`;

            contenu +=
              `🆔 ID : ${prof.id}\n`;

            contenu +=
              `📚 Discipline : ${
                prof.matiere ||
                '—'
              }\n`;

            contenu +=
              `📊 Nombre de pointages : ${
                prof.nombrePointages
              }\n`;

            contenu +=
              `⏱️ Total : ${prof.heuresTotales.toFixed(
                2
              )} H\n`;

            contenu +=
              '--------------------------------------------------\n';

            prof.detailsInterventions.forEach(
              (detail) => {
                contenu +=
                  `• ${detail.date} | ${detail.classe} | ${detail.matiere} | Arrivée : ${detail.arrivee} | Départ : ${detail.depart} | Durée : ${detail.volume.toFixed(
                    2
                  )} H\n`;
              }
            );

            contenu += '\n';
          }
        );

        // ======================================================
        // TÉLÉCHARGEMENT
        // ======================================================

        const blob = new Blob(
          [contenu],
          {
            type:
              'text/plain;charset=utf-8',
          }
        );

        const lien =
          document.createElement('a');

        lien.href =
          URL.createObjectURL(blob);

        lien.download =
          `Edulink_Vacations_${maPromotionResponsable}_Cycle_${numeroAncienCycle}_${maintenant
            .toISOString()
            .slice(0, 10)}.txt`;

        document.body.appendChild(
          lien
        );

        lien.click();

        document.body.removeChild(
          lien
        );

        URL.revokeObjectURL(
          lien.href
        );

        // ======================================================
        // NOUVEAU CYCLE
        // ======================================================

        const nouveauDebut =
          maintenant;

        const nouvelleFin =
          ajouterJours(
            nouveauDebut,
            DUREE_CYCLE
          );

        const nouveauNumero =
          numeroAncienCycle + 1;

        const cycleRef = doc(
          db,
          'cycles_paie_vacations',
          cycleDocId
        );

        await setDoc(
          cycleRef,
          {
            schoolId:
              currentSchool,

            promotion:
              maPromotionResponsable,

            cycleStart:
              toISO(
                nouveauDebut
              ),

            cycleEnd:
              toISO(
                nouvelleFin
              ),

            numeroCycle:
              nouveauNumero,

            statut:
              'ouvert',

            dernierCycleCloture: {
              numeroCycle:
                numeroAncienCycle,

              cycleStart:
                cycle?.cycleStart ||
                null,

              cycleEnd:
                cycle?.cycleEnd ||
                null,

              closedAt:
                toISO(
                  maintenant
                ),

              totalPointages:
                pointagesCycle.length,

              totalHeures:
                Number(
                  bilanVacationsProfs
                    .reduce(
                      (
                        total,
                        prof
                      ) =>
                        total +
                        prof.heuresTotales,
                      0
                    )
                    .toFixed(2)
                ),

              professeurs:
                bilanVacationsProfs.map(
                  (prof) => ({
                    professeurId:
                      prof.id,

                    professeurNom:
                      prof.nom,

                    heures:
                      Number(
                        prof.heuresTotales.toFixed(
                          2
                        )
                      ),

                    nombrePointages:
                      prof.nombrePointages,
                  })
                ),
            },

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        // ======================================================
        // RESET DU FILTRE
        // ======================================================

        setProfesseurFiltre('');

        setFeedback({
          type: 'success',
          text:
            `✅ Cycle N°${numeroAncienCycle} clôturé.\n\n` +
            `🖨️ Relevé généré.\n` +
            `🔄 Les compteurs sont maintenant à 0.\n` +
            `📅 Nouveau cycle N°${nouveauNumero} : ` +
            `${nouveauDebut.toLocaleDateString(
              'fr-FR'
            )} → ` +
            `${nouvelleFin.toLocaleDateString(
              'fr-FR'
            )}.\n\n` +
            `👨‍🏫 Les professeurs en charge continuent d'être suivis en temps réel.`,
        });

        setTimeout(() => {
          setFeedback({
            type: '',
            text: '',
          });
        }, 8000);
      } catch (error) {
        console.error(
          'Erreur clôture :',
          error
        );

        setFeedback({
          type: 'error',
          text:
            `❌ Erreur lors de la clôture : ${
              error?.message ||
              'Erreur inconnue'
            }`,
        });
      }
    };

  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs font-black text-purple-700 uppercase animate-pulse">
          Synchronisation des pointages...
        </p>
      </div>
    );
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="max-w-7xl mx-auto sm:p-6 lg:p-8 font-sans bg-white min-h-screen">
     <Header/>
      {/* RETOUR */}

      <div className="mb-4">
        <Link
          to="/educateur/promotions"
          className="signretour inline-flex items-center text-xs font-bold  hover:bg-gray-100 text-gray-700 py-1 rounded-xl no-underline"
        >
          ⬅ Retour Console Éducateur
        </Link>
      </div>

      {/* EN-TÊTE */}

      <div className="bg-white border-gray-200 rounded-2xl p-5 mb-6 shadow-sm flex flex-col md:flex-row justify-between gap-4">

        <div className="horaires text-orange-700 font-black text-[9px] uppercase px-3 py-1 rounded">
          <span className="bg-orange-100 text-orange-700 font-black text-[9px] uppercase px-3 py-1 rounded">
            Promotion :
            {' '}
            {maPromotionResponsable.toUpperCase()}
          </span>

          <h2 className="text-xl font-black text-slate-900 uppercase mt-2">
            Suivi Horaires des Vacations
          </h2>

          <p className="text-danger text-gray-400 mt-1">
            Les professeurs en charge sont détectés
            automatiquement en temps réel.
          </p>
        </div>

        <div className="cycle text-right">

          <div className="inline-block bg-slate-900 text-orange-400 px-2 py-0 rounded-xl text-xs font-black">
            🔄 CYCLE DE PAIEMENT N°
            {cycle?.numeroCycle || 1}
          </div>

          <p className="text-[10px] text-gray-500 font-bold mt-2">
            Début du cycle :{' '}
            {cycleStartDate
              ? cycleStartDate.toLocaleDateString(
                  'fr-FR'
                )
              : '—'}
              <br/>
            Fin du cycle :{' '}
            {cycleEndDate
              ? cycleEndDate.toLocaleDateString(
                  'fr-FR'
                )
              : '—'}
          </p>

        </div>

      </div>

      {/* FEEDBACK */}

      {feedback.text && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs font-bold whitespace-pre-line border-l-4 ${
            feedback.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-500'
              : 'bg-slate-900 text-emerald-400 border-emerald-500'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* COMPTEURS */}

      <div className="chargegroup grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-gray-400 font-black uppercase">
            Professeurs en charge
          </p>

          <p className="text-3xl font-black text-purple-700">
            {professeurs.length}
          </p>

          <p className="text-[9px] text-gray-400 font-bold uppercase">
            Temps réel
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-gray-400 font-black uppercase">
            Pointages du cycle
          </p>

          <p className="text-3xl font-black text-orange-600">
            {pointagesCycle.length}
          </p>

          <p className="text-[9px] text-gray-400 font-bold uppercase">
            Cycle courant
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-gray-400 font-black uppercase">
            Heures du cycle
          </p>

          <p className="text-3xl font-black text-slate-900">
            {bilanVacationsProfs
              .reduce(
                (total, prof) =>
                  total +
                  prof.heuresTotales,
                0
              )
              .toFixed(2)}
            H
          </p>

          <p className="text-[9px] text-gray-400 font-bold uppercase">
            Compteur courant
          </p>
        </div>

      </div>

      {/* FILTRE */}

      <div className="tousvos  p-4 rounded-2xl mb-6">
        <select
          value={professeurFiltre}
          onChange={(e) =>
            setProfesseurFiltre(
              e.target.value
            )
          }
          className=" w-full border sm:w-96 bg-gray-50 p-3 rounded-xl font-black"
        >
          <option value="">
            👁️ TOUS VOS PROFESSEURS (
            {listeProfsFiltre.length}
            )
          </option>

          {listeProfsFiltre.map(
            (prof) => (
              <option
                key={prof.id}
                value={prof.id}
              >
                👨‍🏫{' '}
                {String(
                  prof.nom
                ).toUpperCase()}
              </option>
            )
          )}
        </select>

      </div>

      {/* GRAND LIVRE */}

      <div className="space-y-6">

        {bilanVacationsProfs.length ===
        0 ? (
          <div className="bg-white border-dashed rounded-2xl p-12 text-center">
            <p className="text-xs font-black text-gray-400 uppercase">
              Aucun professeur trouvé pour cette promotion.
            </p>
          </div>
        ) : (
          bilanVacationsProfs.map(
            (prof) => (
              <div
                key={prof.id}
                className="bg-white rounded-2xl p-5 shadow-sm"
              >

          <div className="cloture flex justify-between items-center gap-4 border-b pb-4">
                 
        <h3 className="text-sm font-black text-red-800 uppercase">
          🔒 Clôture du cycle de 30 jours
        </h3>

        <p className="text-xs text-red-600 mt-1">
          Les anciens pointages sont conservés.
          Seul le compteur du nouveau cycle repart
          à zéro.
        </p>

                  <div>
                    <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-1 rounded font-black">
                      ID PROF : {prof.id}
                    </span>

                    <h3 className="text-base font-black uppercase mt-2">
                      👨‍🏫 {prof.nom}
                    </h3>

                    <p className="text-[10px] text-gray-400 font-bold uppercase">
                      {prof.matiere}
                    </p>
                  </div>

                  <div className="bg-slate-900 text-orange-400 rounded-xl px-4 py-3 text-right">

                    <span className="block text-[9px] text-gray-400 uppercase">
                      Heures
                    </span>

                    <strong className="font-mono">
                      {prof.heuresTotales.toFixed(
                        2
                      )}{' '}
                      H
                    </strong>

                  </div>

                </div>

                {prof.detailsInterventions
                  .length === 0 ? (
                  <div className="py-8 text-center">

                    <div className="text-3xl">
                      🕘
                    </div>

                    <p className="text-[10px] font-black text-gray-400 uppercase mt-2">
                      Aucun pointage dans ce cycle
                    </p>

                    <p className="text-[9px] text-gray-400 mt-1">
                      Compteur : 0 H
                    </p>

                  </div>
                ) : (
                  <div className="overflow-x-auto mt-4">

                    <table className="tablef w-full text-xs border-collapse">

                      <thead>
                        <tr className="bg-gray-50 text-gray-400 uppercase text-[9px]">

                          <th className="p-3 text-left">
                            Date
                          </th>

                          <th className="p-3 text-left">
                            Classe
                          </th>

                          <th className="p-3 text-left">
                            Matière
                          </th>

                          <th className="p-3 text-center">
                            Arrivée
                          </th>

                          <th className="p-3 text-center">
                            Départ
                          </th>

                          <th className="p-3 text-center">
                            Durée
                          </th>

                        </tr>
                      </thead>

                      <tbody className="divide-y">

                        {prof.detailsInterventions.map(
                          (detail) => (
                            <tr
                              key={detail.id}
                              className="hover:bg-gray-50"
                            >

                              <td className="p-3 font-mono">
                                {detail.date}
                              </td>

                              <td className="p-3 font-black uppercase">
                                🏛️{' '}
                                {detail.classe}
                              </td>

                              <td className="p-3 font-bold">
                                {detail.matiere}
                              </td>

                              <td className="p-3 text-center font-mono">
                                {detail.arrivee}
                              </td>

                              <td className="p-3 text-center font-mono">
                                {detail.depart}
                              </td>

                              <td className="p-3 text-right font-black text-purple-700">
                                {detail.volume.toFixed(
                                  2
                                )}{' '}
                                H
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>
                   
                   {/* CLÔTURE */}

      <div className="bg-red-50 border-red-200 rounded-2xl p-5 mb-6">

        <button
          type="button"
          onClick={
            handleGenererFicheEtMiseAZero
          }
          disabled={!cycle}
          className="imprime mt-4 bg-red-600 hover:bg-red-700 disabled:opacity-40 font-black text-xs uppercase py-3.5 rounded-xl cursor-pointer"
        >
          🖨️ Clôturer & Imprimer la Promotion
        </button>

      </div>
                  </div>
                )}

              </div>
            )
          )
        )}

      </div>

    </div>
  );
};

export default GestionPaieVacations;