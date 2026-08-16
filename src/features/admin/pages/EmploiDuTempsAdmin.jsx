import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import html2pdf from 'html2pdf.js';

const EmploiDuTempsAdmin = () => {
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

  const [classes, setClasses] = useState([]);
  const [personnelEnseignant, setPersonnelEnseignant] = useState([]);
  const [planningsDeployes, setPlanningsDeployes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({
    type: '',
    text: ''
  });

  // Professeur sélectionné
  const [selectedProfId, setSelectedProfId] = useState('');

  // Classe sélectionnée
  const [selectedClasse, setSelectedClasse] = useState('');

  // Horaires
  const [heureDebut, setHeureDebut] = useState('07:00');
  const [heureFin, setHeureFin] = useState('08:00');

  // Créneaux temporaires
  const [creneauxTemporaires, setCreneauxTemporaires] = useState([]);

  const [sending, setSending] = useState(false);

  // Filtre classe
  const [classeFiltreVisualisation, setClasseFiltreVisualisation] =
    useState('');

  // ============================================================
  // CHARGEMENT TEMPS RÉEL
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    // ------------------------------------------------------------
    // A. CLASSES
    // ------------------------------------------------------------

    const qClasses = query(
      collection(db, 'classes'),
      where('schoolId', '==', currentSchool)
    );

    const unsubClasses = onSnapshot(
      qClasses,
      (snap) => {
        const list = [];

        snap.forEach((d) => {
          list.push({
            id: d.id,
            ...d.data()
          });
        });

        const classesTriees = list.sort((a, b) =>
          (a.nom || '').localeCompare(b.nom || '')
        );

        setClasses(classesTriees);

        // Sélection automatique de la première classe
        setSelectedClasse((ancienneValeur) => {
          if (
            ancienneValeur &&
            classesTriees.some((classe) => classe.id === ancienneValeur)
          ) {
            return ancienneValeur;
          }

          return classesTriees.length > 0
            ? classesTriees[0].id
            : '';
        });
      },
      (error) => {
        console.error(
          'Erreur écoute classes :',
          error
        );
      }
    );

    // ------------------------------------------------------------
    // B. PROFESSEURS
    // ------------------------------------------------------------

    const qStaff = query(
      collection(db, 'users'),
      where('role', '==', 'professeur'),
      where('schoolId', '==', currentSchool)
    );

    const unsubStaff = onSnapshot(
      qStaff,
      (snap) => {
        const list = [];

        snap.forEach((d) => {
          list.push({
            id: d.id,
            ...d.data()
          });
        });

        const profsTries = list.sort((a, b) => {
          const nomA =
            a.name ||
            a.nom ||
            a.displayName ||
            `${a.prenom || ''} ${a.nom || ''}`;

          const nomB =
            b.name ||
            b.nom ||
            b.displayName ||
            `${b.prenom || ''} ${b.nom || ''}`;

          return nomA.localeCompare(nomB);
        });

        setPersonnelEnseignant(profsTries);

        // Sélection automatique du premier professeur
        setSelectedProfId((ancienneValeur) => {
          if (
            ancienneValeur &&
            profsTries.some((prof) => prof.id === ancienneValeur)
          ) {
            return ancienneValeur;
          }

          return profsTries.length > 0
            ? profsTries[0].id
            : '';
        });
      },
      (error) => {
        console.error(
          'Erreur écoute professeurs :',
          error
        );
      }
    );

    // ------------------------------------------------------------
    // C. EMPLOIS DU TEMPS
    // ------------------------------------------------------------

    const qPlannings = query(
      collection(db, 'emplois_du_temps'),
      where('schoolId', '==', currentSchool)
    );

    const unsubPlannings = onSnapshot(
      qPlannings,
      (snap) => {
        const list = [];

        snap.forEach((d) => {
          list.push({
            id: d.id,
            ...d.data()
          });
        });

        setPlanningsDeployes(list);
        setLoading(false);
      },
      (error) => {
        console.error(
          'Erreur écoute emplois du temps :',
          error
        );

        setLoading(false);
      }
    );

    return () => {
      unsubClasses();
      unsubStaff();
      unsubPlannings();
    };
  }, [currentSchool]);

  // ============================================================
  // PROFESSEUR ACTUEL
  // ============================================================

  const professeurSelectionne = useMemo(() => {
    return (
      personnelEnseignant.find(
        (prof) => prof.id === selectedProfId
      ) || null
    );
  }, [
    selectedProfId,
    personnelEnseignant
  ]);

  // ============================================================
  // MATIÈRE DYNAMIQUE
  // ============================================================
  //
  // On recherche plusieurs noms possibles afin de rester
  // compatible avec les documents déjà présents dans Firestore.
  //
  // IMPORTANT :
  // Aucun "Mathématiques" fixe ici.
  // ============================================================

  const matiereEnseignee = useMemo(() => {
    if (!professeurSelectionne) {
      return '';
    }

    const matiere =
      professeurSelectionne.matiere ||
      professeurSelectionne.specialite ||
      professeurSelectionne.discipline ||
      professeurSelectionne.matiereEnseignee ||
      professeurSelectionne.subject ||
      professeurSelectionne.subjectName ||
      '';

    return String(matiere).trim();
  }, [professeurSelectionne]);

  // ============================================================
  // NOM COMPLET DU PROFESSEUR
  // ============================================================

  const nomCompletProf = useMemo(() => {
    if (!professeurSelectionne) {
      return '';
    }

    if (professeurSelectionne.name) {
      return professeurSelectionne.name;
    }

    if (professeurSelectionne.nomComplet) {
      return professeurSelectionne.nomComplet;
    }

    if (professeurSelectionne.displayName) {
      return professeurSelectionne.displayName;
    }

    const prenom = professeurSelectionne.prenom || '';
    const nom = professeurSelectionne.nom || '';

    return `${prenom} ${nom}`.trim() || 'Enseignant';
  }, [professeurSelectionne]);

  // ============================================================
  // CHANGEMENT PROFESSEUR
  // ============================================================

  const handleChangerProfesseur = (e) => {
    const nouveauProfId = e.target.value;

    setSelectedProfId(nouveauProfId);

    // On vide les anciens créneaux lorsque l'on change
    // d'enseignant pour éviter de mélanger les cours.
    setCreneauxTemporaires([]);

    setMessage({
      type: '',
      text: ''
    });
  };

  // ============================================================
  // AJOUT CRÉNEAU TEMPORAIRE
  // ============================================================

  const handleAjouterCreneauLocal = (e) => {
    e.preventDefault();

    if (!selectedProfId) {
      alert(
        '⚠️ Veuillez sélectionner un enseignant.'
      );
      return;
    }

    if (!matiereEnseignee) {
      alert(
        '⚠️ La matière de cet enseignant n’est pas renseignée dans son profil.'
      );
      return;
    }

    if (!selectedClasse) {
      alert(
        '⚠️ Veuillez sélectionner une classe.'
      );
      return;
    }

    if (!heureDebut || !heureFin) {
      alert(
        '⚠️ Veuillez renseigner les horaires.'
      );
      return;
    }

    // Vérification heure début / fin
    if (heureFin <= heureDebut) {
      alert(
        '❌ L’heure de fin doit être supérieure à l’heure de début.'
      );
      return;
    }

    const classeTarget = classes.find(
      (c) => c.id === selectedClasse
    );

    // ----------------------------------------------------------
    // CONFLIT LOCAL
    // ----------------------------------------------------------

    const conflitDHeure =
      creneauxTemporaires.some((c) => {
        return (
          heureDebut < c.heureFin &&
          heureFin > c.heureDebut
        );
      });

    if (conflitDHeure) {
      alert(
        '❌ Conflit horaire : cet enseignant possède déjà un cours programmé sur cette plage.'
      );
      return;
    }

    const nouveauCreneau = {
      idUniqueTemp:
        Math.random()
          .toString(36)
          .substring(2, 9),

      classeId: selectedClasse,

      nomClasse:
        classeTarget?.nom ||
        selectedClasse
          .toUpperCase()
          .replace(/_/g, ' '),

      heureDebut,
      heureFin,

      // On conserve également la matière au niveau
      // du créneau pour garder une information claire.
      matiere: matiereEnseignee
    };

    const nouvelleListe = [
      ...creneauxTemporaires,
      nouveauCreneau
    ].sort((a, b) =>
      a.heureDebut.localeCompare(
        b.heureDebut
      )
    );

    setCreneauxTemporaires(
      nouvelleListe
    );
  };

  // ============================================================
  // RETIRER CRÉNEAU TEMPORAIRE
  // ============================================================

  const handleRetirerCreneauLocal = (
    idTemp
  ) => {
    setCreneauxTemporaires(
      creneauxTemporaires.filter(
        (c) =>
          c.idUniqueTemp !== idTemp
      )
    );
  };

  // ============================================================
  // ENREGISTRER + PDF
  // ============================================================

  const handleEnregistrerEtImprimerPDF = async (
    e
  ) => {
    e.preventDefault();

    setMessage({
      type: '',
      text: ''
    });

    if (!selectedProfId) {
      setMessage({
        type: 'error',
        text: 'Veuillez sélectionner un enseignant.'
      });
      return;
    }

    if (!matiereEnseignee) {
      setMessage({
        type: 'error',
        text:
          'La matière de cet enseignant n’est pas renseignée dans son profil.'
      });
      return;
    }

    if (
      creneauxTemporaires.length === 0
    ) {
      setMessage({
        type: 'error',
        text:
          'La liste des cours programmés est vide. Ajoutez au moins un créneau.'
      });
      return;
    }

    setSending(true);

    const payloadEmploiTemps = {
      professeurId: selectedProfId,

      professeurName:
        nomCompletProf,

      matiere:
        matiereEnseignee,

      schoolId:
        currentSchool,

      createdAt:
        new Date().toISOString(),

      creneaux:
        creneauxTemporaires.map(
          ({
            classeId,
            nomClasse,
            heureDebut,
            heureFin
          }) => ({
            classeId,
            nomClasse,
            heureDebut,
            heureFin,
            matiere:
              matiereEnseignee
          })
        )
    };

    try {
      // --------------------------------------------------------
      // 1. ENREGISTREMENT FIRESTORE
      // --------------------------------------------------------

      await addDoc(
        collection(
          db,
          'emplois_du_temps'
        ),
        payloadEmploiTemps
      );

      setMessage({
        type: 'success',
        text: `🎉 Réussite ! L'emploi du temps de ${nomCompletProf} (${matiereEnseignee}) a été déployé.`
      });

      // --------------------------------------------------------
      // 2. CRÉATION PDF
      // --------------------------------------------------------

      const elementImprimable =
        document.createElement(
          'div'
        );

      elementImprimable.innerHTML = `
        <div
          style="
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #0f172a;
            background: #ffffff;
          "
        >

          <table
            style="
              width: 100%;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 20px;
            "
          >
            <tr>
              <td>

                <h2
                  style="
                    font-size: 14px;
                    text-transform: uppercase;
                    margin: 0;
                    color: #475569;
                  "
                >
                  ${
                    schoolName?.toUpperCase() ||
                    'EDULINK SYSTEM'
                  }
                </h2>

                <h1
                  style="
                    font-size: 20px;
                    font-weight: 900;
                    text-transform: uppercase;
                    margin: 4px 0 0 0;
                  "
                >
                  Planning Général du Personnel Enseignant
                </h1>

              </td>
            </tr>
          </table>

          <div
            style="
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 25px;
              font-size: 13px;
            "
          >

            <p style="margin: 4px 0;">
              <strong>PROF_ID :</strong>
              <span style="font-family: monospace;">
                ${selectedProfId}
              </span>
            </p>

            <p style="margin: 4px 0;">
              <strong>ENSEIGNANT :</strong>
              ${nomCompletProf.toUpperCase()}
            </p>

            <p style="margin: 4px 0;">
              <strong>DISCIPLINE ENSEIGNÉE :</strong>
              ${matiereEnseignee.toUpperCase()}
            </p>

            <p style="margin: 4px 0;">
              <strong>ANNÉE SCOLAIRE :</strong>
              2025 - 2026
            </p>

          </div>

          <table
            style="
              width: 100%;
              border-collapse: collapse;
              text-align: left;
              font-size: 12px;
            "
          >

            <thead>
              <tr
                style="
                  background: #0f172a;
                  color: #ffffff;
                  text-transform: uppercase;
                "
              >

                <th
                  style="
                    padding: 10px;
                    border: 1px solid #cbd5e1;
                  "
                >
                  Régime Horaires
                </th>

                <th
                  style="
                    padding: 10px;
                    border: 1px solid #cbd5e1;
                  "
                >
                  Structure Pédagogique Assignée
                </th>

              </tr>
            </thead>

            <tbody>

              ${payloadEmploiTemps.creneaux
                .map(
                  (c) => `
                    <tr>

                      <td
                        style="
                          padding: 10px;
                          border: 1px solid #cbd5e1;
                          font-family: monospace;
                          font-weight: bold;
                          color: #c2410c;
                        "
                      >
                        ⏰ ${c.heureDebut} — ${c.heureFin}
                      </td>

                      <td
                        style="
                          padding: 10px;
                          border: 1px solid #cbd5e1;
                          font-weight: bold;
                          color: #1e3a8a;
                        "
                      >
                        🏛️ ${c.nomClasse.toUpperCase()}
                      </td>

                    </tr>
                  `
                )
                .join('')}

            </tbody>

          </table>

          <div
            style="
              margin-top: 40px;
              text-align: right;
              font-size: 10px;
              font-style: italic;
              color: #94a3b8;
            "
          >
            [ Emploi du Temps Officiel Archivé par la Direction ]
          </div>

        </div>
      `;

      const options = {
        margin: 10,

        filename: `EMPLOI_DU_TEMPS_PROF_${nomCompletProf
          .replace(/\s+/g, '_')}.pdf`,

        html2canvas: {
          scale: 2.5,
          backgroundColor: '#ffffff'
        },

        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        }
      };

      await html2pdf()
        .set(options)
        .from(elementImprimable)
        .save();

      // Nettoyage
      setCreneauxTemporaires([]);
    } catch (err) {
      console.error(
        'Erreur enregistrement emploi du temps :',
        err
      );

      setMessage({
        type: 'error',
        text:
          '💥 Échec lors de la synchronisation au serveur.'
      });
    } finally {
      setSending(false);
    }
  };

  // ============================================================
  // SUPPRIMER UN PLANNING
  // ============================================================

  const handleSupprimerPlanningGlobal =
    async (idDoc) => {
      if (
        !window.confirm(
          'Voulez-vous révoquer et supprimer cet emploi du temps ?'
        )
      ) {
        return;
      }

      try {
        await deleteDoc(
          doc(
            db,
            'emplois_du_temps',
            idDoc
          )
        );

        setMessage({
          type: 'success',
          text:
            "🗑️ L'emploi du temps a été révoqué du cloud."
        });
      } catch (err) {
        console.error(
          'Erreur suppression planning :',
          err
        );

        setMessage({
          type: 'error',
          text:
            '❌ Impossible de supprimer cet emploi du temps.'
        });
      }
    };

  // ============================================================
  // RECONSTRUCTION DE L'EMPLOI DU TEMPS PAR CLASSE
  // ============================================================

  const emploiDuTempsClasseReconstitue =
    useMemo(() => {
      if (!classeFiltreVisualisation) {
        return [];
      }

      const cibleIdNettoye =
        classeFiltreVisualisation
          .toString()
          .trim()
          .toLowerCase();

      const list = [];

      planningsDeployes.forEach(
        (planning) => {
          if (
            !Array.isArray(
              planning.creneaux
            )
          ) {
            return;
          }

          planning.creneaux.forEach(
            (creneau) => {
              const creneauClasseIdNettoye =
                (
                  creneau.classeId ||
                  ''
                )
                  .toString()
                  .trim()
                  .toLowerCase();

              if (
                creneauClasseIdNettoye ===
                  cibleIdNettoye ||
                creneauClasseIdNettoye.includes(
                  cibleIdNettoye
                ) ||
                cibleIdNettoye.includes(
                  creneauClasseIdNettoye
                )
              ) {
                list.push({
                  professeurName:
                    planning.professeurName,

                  matiere:
                    creneau.matiere ||
                    planning.matiere ||
                    'Matière non renseignée',

                  heureDebut:
                    creneau.heureDebut,

                  heureFin:
                    creneau.heureFin,

                  parentDocumentId:
                    planning.id
                });
              }
            }
          );
        }
      );

      return list.sort((a, b) =>
        a.heureDebut.localeCompare(
          b.heureDebut
        )
      );
    }, [
      classeFiltreVisualisation,
      planningsDeployes
    ]);

  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">
        Ouverture de la centrale de planification...
      </div>
    );
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen text-gray-700 animate-fadeIn">

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message.text && (
        <div
          className={`p-4 mb-6 rounded-xl text-xs font-bold text-left border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ======================================================
          SECTION 1
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ====================================================
            FORMULAIRE
        ==================================================== */}

        <div className="bg-white p-5 rounded-2xl border shadow-sm h-fit text-left">

          <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider border-b pb-3 mb-4">
            🔐 Confection Horaires par Enseignant
          </h3>

          <form
            onSubmit={handleAjouterCreneauLocal}
            className="space-y-4 text-xs font-bold"
          >

            {/* PROFESSEUR */}

            <div>
              <label className="block text-gray-400 uppercase mb-1">
                1. Enseignant Titulaire *
              </label>

              <select
                value={selectedProfId}
                onChange={handleChangerProfesseur}
                className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none font-bold cursor-pointer"
                required
              >

                <option value="">
                  -- Sélectionner l'enseignant --
                </option>

                {personnelEnseignant.map(
                  (prof) => (
                    <option
                      key={prof.id}
                      value={prof.id}
                    >
                      👨‍🏫{' '}
                      {prof.name ||
                        prof.nom ||
                        prof.displayName ||
                        'Enseignant'}{' '}
                      (
                      {prof.matiere ||
                        prof.specialite ||
                        prof.discipline ||
                        prof.matiereEnseignee ||
                        'Matière non renseignée'}
                      )
                      )
                    </option>
                  )
                )}

              </select>
            </div>

            {/* MATIÈRE DYNAMIQUE */}

            <div>
              <label className="block text-gray-400 uppercase mb-1">
                Matière enseignée
              </label>

              <input
                type="text"
                value={
                  matiereEnseignee ||
                  'Matière non renseignée'
                }
                className={`w-full border rounded-lg p-2.5 outline-none font-bold ${
                  matiereEnseignee
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-red-50 text-red-500 border-red-200'
                }`}
                readOnly
              />

              {!matiereEnseignee &&
                selectedProfId && (
                  <p className="text-[10px] text-red-500 mt-1 font-bold">
                    ⚠️ Aucune matière n'est renseignée
                    dans le profil de cet enseignant.
                  </p>
                )}
            </div>

            {/* CLASSE */}

            <div>
              <label className="block text-gray-400 uppercase mb-1">
                2. Sélectionner la classe *
              </label>

              <select
                value={selectedClasse}
                onChange={(e) =>
                  setSelectedClasse(
                    e.target.value
                  )
                }
                className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none cursor-pointer"
                disabled={!selectedProfId}
                required
              >

                <option value="">
                  -- Assigner à la classe --
                </option>

                {classes.map(
                  (classe) => (
                    <option
                      key={classe.id}
                      value={classe.id}
                    >
                      🏛️ {classe.nom}
                    </option>
                  )
                )}

              </select>
            </div>

            {/* HORAIRES */}

            <div className="grid grid-cols-2 gap-3">

              <div>
                <label className="block text-gray-400 uppercase mb-1">
                  ⏰ De *
                </label>

                <input
                  type="time"
                  value={heureDebut}
                  onChange={(e) =>
                    setHeureDebut(
                      e.target.value
                    )
                  }
                  className="w-full bg-gray-50 border rounded-lg p-2 font-mono"
                  disabled={!selectedProfId}
                />
              </div>

              <div>
                <label className="block text-gray-400 uppercase mb-1">
                  ⏰ À *
                </label>

                <input
                  type="time"
                  value={heureFin}
                  onChange={(e) =>
                    setHeureFin(
                      e.target.value
                    )
                  }
                  className="w-full bg-gray-50 border rounded-lg p-2 font-mono"
                  disabled={!selectedProfId}
                />
              </div>

            </div>

            {/* AJOUT */}

            <button
              type="submit"
              disabled={
                !selectedProfId ||
                !matiereEnseignee
              }
              className="w-full bg-slate-900 text-orange-400 hover:bg-slate-800 p-3 rounded-lg text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
            >
              ➕ Ajouter ce créneau
            </button>

          </form>
        </div>

        {/* ====================================================
            TABLEAU TEMPORAIRE
        ==================================================== */}

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border shadow-sm text-left">

          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">
            📋 Feuille de Route du Professeur Sélectionné
          </h3>

          {creneauxTemporaires.length ===
          0 ? (
            <div className="py-20 text-center text-xs font-medium text-gray-400 bg-gray-50 border border-dashed rounded-xl">

              Ajoutez des plages de cours à l'aide
              du bouton à gauche pour construire
              l'emploi du temps de l'enseignant.

            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">

              <table className="w-full text-left text-xs border-collapse">

                <thead>
                  <tr className="bg-slate-900 text-white uppercase font-black text-[10px] tracking-wider">

                    <th className="p-3">
                      Créneaux horaires
                    </th>

                    <th className="p-3">
                      Classe assignée
                    </th>

                    <th className="p-3">
                      Matière
                    </th>

                    <th className="p-3 text-center">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">

                  {creneauxTemporaires.map(
                    (c) => (
                      <tr
                        key={
                          c.idUniqueTemp
                        }
                        className="hover:bg-slate-50 transition"
                      >

                        <td className="p-3 font-mono font-bold text-orange-600">
                          ⏰ {c.heureDebut} —{' '}
                          {c.heureFin}
                        </td>

                        <td className="p-3 font-bold text-gray-900 uppercase">
                          🏛️ {c.nomClasse}
                        </td>

                        <td className="p-3 font-black text-blue-900 uppercase">
                          📚 {c.matiere}
                        </td>

                        <td className="p-3 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              handleRetirerCreneauLocal(
                                c.idUniqueTemp
                              )
                            }
                            className="text-red-500 font-bold hover:underline"
                          >
                            Retirer
                          </button>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

              <div className="p-4 bg-gray-50 border-t flex justify-end">

                <button
                  type="button"
                  onClick={
                    handleEnregistrerEtImprimerPDF
                  }
                  disabled={sending}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-6 py-3 rounded-lg tracking-widest shadow-md transition disabled:opacity-50"
                >
                  {sending
                    ? '🔄 Écriture...'
                    : '💾 Enregistrer & Imprimer la Fiche PDF'}
                </button>

              </div>

            </div>
          )}

        </div>
      </div>

      {/* ======================================================
          SECTION 2 : EMPLOI DU TEMPS PAR CLASSE
      ====================================================== */}

      <div className="bg-white p-6 rounded-2xl border shadow-sm text-left mt-8">

        <h2 className="text-base font-black text-blue-900 uppercase border-b pb-3 mb-6 flex items-center gap-2">
          📊 Emploi du Temps Reconstitué par Classe
        </h2>

        <div className="space-y-6">

          <div className="max-w-xs text-xs font-bold">

            <label className="block text-gray-400 uppercase mb-1">
              Choisir une classe
            </label>

            <select
              value={
                classeFiltreVisualisation
              }
              onChange={(e) =>
                setClasseFiltreVisualisation(
                  e.target.value
                )
              }
              className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none cursor-pointer font-bold"
            >

              <option value="">
                -- Sélectionner la classe --
              </option>

              {classes.map(
                (classe) => (
                  <option
                    key={classe.id}
                    value={classe.id}
                  >
                    🏛️ {classe.nom}
                  </option>
                )
              )}

            </select>

          </div>

          {!classeFiltreVisualisation ? (
            <p className="text-xs text-gray-400 italic py-8 bg-slate-50 text-center rounded-xl border border-dashed">
              💡 Sélectionnez une classe pour
              afficher automatiquement ses cours.
            </p>
          ) : emploiDuTempsClasseReconstitue.length ===
            0 ? (
            <p className="text-xs text-red-600 font-black py-8 bg-red-50 text-center rounded-xl border border-dashed border-red-200 uppercase">
              ⚠️ Aucun cours n'a encore été planifié
              pour cette classe.
            </p>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white max-w-5xl shadow-sm">

              <div className="p-4 bg-blue-50 border-b flex justify-between items-center text-xs">

                <span className="font-black text-blue-950 uppercase">
                  📅 Emploi du Temps Assemblé :{' '}
                  {classes
                    .find(
                      (c) =>
                        c.id ===
                        classeFiltreVisualisation
                    )
                    ?.nom?.toUpperCase()}
                </span>

                <span className="px-2.5 py-1 bg-blue-200 text-blue-800 text-[10px] font-black rounded uppercase">
                  Généré en Temps Réel
                </span>

              </div>

              <table className="w-full text-left text-xs border-collapse">

                <thead>

                  <tr className="bg-slate-900 text-white uppercase font-black text-[10px] tracking-wider">

                    <th className="p-3">
                      Heures
                    </th>

                    <th className="p-3">
                      Discipline
                    </th>

                    <th className="p-3">
                      Professeur
                    </th>

                    <th className="p-3 text-center">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-200 font-medium">

                  {emploiDuTempsClasseReconstitue.map(
                    (cours, idx) => (
                      <tr
                        key={`${cours.parentDocumentId}-${idx}`}
                        className="hover:bg-slate-50 transition"
                      >

                        <td className="p-3 font-mono font-bold text-orange-600">
                          ⏰ {cours.heureDebut} —{' '}
                          {cours.heureFin}
                        </td>

                        <td className="p-3 font-black text-blue-900 uppercase">
                          📚{' '}
                          {cours.matiere ||
                            'Matière non renseignée'}
                        </td>

                        <td className="p-3 text-gray-800 font-bold">
                          👨‍🏫{' '}
                          {cours.professeurName}
                        </td>

                        <td className="p-3 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              handleSupprimerPlanningGlobal(
                                cours.parentDocumentId
                              )
                            }
                            className="text-red-500 hover:underline font-bold"
                          >
                            Révoquer
                          </button>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>
      </div>

    </div>
  );
};

export default EmploiDuTempsAdmin;