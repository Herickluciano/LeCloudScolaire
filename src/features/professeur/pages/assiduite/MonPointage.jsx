// src/features/professeur/pages/assiduite/MonPointage.jsx

import React, { useState, useEffect, useMemo } from 'react';

import { db } from '../../../../services/api';

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
} from 'firebase/firestore';

import { useAuth } from '../../../../context/AuthContext';
import Header from '../../../../pages/Header';

const MonPointage = () => {
  const { schoolId, user } = useAuth();

  // =========================================================
  // IDENTIFICATION ÉTABLISSEMENT
  // =========================================================

  const currentSchool = String(
    user?.schoolId ||
      schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
  )
    .trim()
    .toLowerCase();

  // =========================================================
  // IDENTIFICATION PROFESSEUR
  // =========================================================

  const monIdProf = String(
    user?.id ||
      user?.matricule ||
      user?.uid ||
      ''
  ).trim();

  const nomProf =
    user?.name ||
    `${user?.nom || ''} ${user?.prenoms || ''}`.trim() ||
    'Enseignant';

  const matiereProf =
    user?.matiereEnseignee ||
    user?.matiere ||
    '';

  // =========================================================
  // ÉTATS POINTAGE
  // =========================================================

  const [pointageActif, setPointageActif] = useState(null);

  const [historique, setHistorique] = useState([]);

  const [loading, setLoading] = useState(true);

  // =========================================================
  // ÉTATS CLASSES
  // =========================================================

  const [classesList, setClassesList] = useState([]);

  const [classeSelectionnee, setClasseSelectionnee] =
    useState('');

  const [classesLoading, setClassesLoading] =
    useState(true);

  // =========================================================
  // TERMINAL
  // =========================================================

  const [terminalScelle, setTerminalScelle] =
    useState(false);

  const [terminalFirebase, setTerminalFirebase] =
    useState(null);

  const [terminalLoading, setTerminalLoading] =
    useState(true);

  // =========================================================
  // ÉTAT ACTION
  // =========================================================

  const [arriveeEnCours, setArriveeEnCours] =
    useState(false);

  const [departEnCours, setDepartEnCours] =
    useState(false);

  // =========================================================
  // MESSAGE
  // =========================================================

  const [message, setMessage] = useState({
    type: '',
    text: '',
  });

  // =========================================================
  // DATE
  // =========================================================

  const dateAujourdhui =
    new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  // =========================================================
  // IDENTIFIANT TERMINAL
  // =========================================================

  const terminalId =
    localStorage.getItem(
      'sgs_terminal_hardware_id'
    ) || '';

  // =========================================================
  // MESSAGE
  // =========================================================

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

  // =========================================================
  // 1. VÉRIFICATION DU TERMINAL
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const verifierTerminal = async () => {
      setTerminalLoading(true);

      if (!currentSchool || !terminalId) {
        if (!cancelled) {
          setTerminalScelle(false);
          setTerminalFirebase(null);
          setTerminalLoading(false);
        }

        return;
      }

      try {
        const terminalRef = doc(
          db,
          'terminaux',
          terminalId
        );

        const terminalSnap =
          await getDoc(terminalRef);

        if (cancelled) return;

        if (!terminalSnap.exists()) {
          setTerminalScelle(false);
          setTerminalFirebase(null);
          setTerminalLoading(false);
          return;
        }

        const data = terminalSnap.data();

        const schoolTerminal = String(
          data.schoolId || ''
        )
          .trim()
          .toLowerCase();

        const schoolActuelle = String(
          currentSchool
        )
          .trim()
          .toLowerCase();

        const valide =
          data.scelle === true &&
          data.actif !== false &&
          schoolTerminal === schoolActuelle &&
          !!data.classeId;

        if (valide) {
          setTerminalScelle(true);

          setTerminalFirebase({
            id: terminalSnap.id,
            ...data,
          });

          setClasseSelectionnee(
            String(data.classeId)
          );
        } else {
          setTerminalScelle(false);
          setTerminalFirebase(null);
        }
      } catch (error) {
        console.error(
          'Erreur vérification terminal Firebase :',
          error
        );

        if (!cancelled) {
          setTerminalScelle(false);
          setTerminalFirebase(null);
        }
      } finally {
        if (!cancelled) {
          setTerminalLoading(false);
        }
      }
    };

    verifierTerminal();

    return () => {
      cancelled = true;
    };
  }, [currentSchool, terminalId]);

  // =========================================================
  // 2. RÉCUPÉRATION DES CLASSES DU PROFESSEUR
  //
  // Source principale :
  // emplois_du_temps
  //
  // Le professeur ne voit que les divisions dans lesquelles
  // il intervient.
  // =========================================================

  useEffect(() => {
    if (!currentSchool || !monIdProf) {
      setClassesList([]);
      setClassesLoading(false);
      return;
    }

    setClassesLoading(true);

    const qEDT = query(
      collection(db, 'emplois_du_temps'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      qEDT,
      (snapshot) => {
        const classesMap = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          // ===================================================
          // CAS 1 :
          // document contenant un tableau "creneaux"
          // ===================================================

          if (Array.isArray(data.creneaux)) {
            data.creneaux.forEach(
              (creneau, index) => {
                const professeurCreneau =
                  String(
                    creneau.professeurId ||
                      creneau.profId ||
                      creneau.enseignantId ||
                      ''
                  )
                    .trim()
                    .toLowerCase();

                const professeurConnecte =
                  String(monIdProf)
                    .trim()
                    .toLowerCase();

                if (
                  !professeurCreneau ||
                  professeurCreneau !==
                    professeurConnecte
                ) {
                  return;
                }

                const classeId =
                  creneau.classeId ||
                  creneau.divisionId ||
                  data.classeId ||
                  data.divisionId;

                if (!classeId) return;

                const classeNom =
                  creneau.nomClasse ||
                  creneau.classeNom ||
                  creneau.nomDivision ||
                  data.classeNom ||
                  data.nomClasse ||
                  data.divisionNom ||
                  classeId;

                const matiere =
                  creneau.matiere ||
                  creneau.discipline ||
                  creneau.nomMatiere ||
                  data.matiere ||
                  data.discipline ||
                  matiereProf ||
                  '';

                const cle = String(
                  classeId
                ).trim();

                if (!classesMap[cle]) {
                  classesMap[cle] = {
                    id: String(classeId),

                    nom: String(classeNom),

                    matiere: String(matiere),

                    emploiDuTempsId:
                      docSnap.id,

                    creneauId:
                      creneau.id ||
                      creneau.creneauId ||
                      `${docSnap.id}_${index}`,

                    jour:
                      creneau.jour ||
                      creneau.day ||
                      '',

                    heureDebut:
                      creneau.heureDebut ||
                      creneau.start ||
                      '',

                    heureFin:
                      creneau.heureFin ||
                      creneau.end ||
                      '',
                  };
                }
              }
            );
          }

          // ===================================================
          // CAS 2 :
          // document EDT représentant directement
          // un professeur / une classe
          // ===================================================

          const professeurDocument =
            String(
              data.professeurId ||
                data.profId ||
                data.enseignantId ||
                ''
            )
              .trim()
              .toLowerCase();

          if (
            professeurDocument &&
            professeurDocument ===
              String(monIdProf)
                .trim()
                .toLowerCase()
          ) {
            const classeId =
              data.classeId ||
              data.divisionId;

            if (classeId) {
              const classeNom =
                data.classeNom ||
                data.nomClasse ||
                data.divisionNom ||
                classeId;

              const matiere =
                data.matiere ||
                data.discipline ||
                matiereProf ||
                '';

              const cle =
                String(classeId).trim();

              if (!classesMap[cle]) {
                classesMap[cle] = {
                  id: String(classeId),

                  nom: String(classeNom),

                  matiere: String(matiere),

                  emploiDuTempsId:
                    docSnap.id,

                  creneauId:
                    data.creneauId ||
                    docSnap.id,

                  jour:
                    data.jour ||
                    data.day ||
                    '',

                  heureDebut:
                    data.heureDebut ||
                    data.start ||
                    '',

                  heureFin:
                    data.heureFin ||
                    data.end ||
                    '',
                };
              }
            }
          }
        });

        const resultat = Object.values(
          classesMap
        ).sort((a, b) =>
          String(a.nom).localeCompare(
            String(b.nom),
            'fr',
            {
              numeric: true,
            }
          )
        );

        setClassesList(resultat);

        // =====================================================
        // SI TERMINAL SCELLÉ :
        // classe du terminal prioritaire
        // =====================================================

        if (terminalFirebase?.classeId) {
          const classeTerminal =
            String(
              terminalFirebase.classeId
            );

          const classeExiste =
            resultat.some(
              (classe) =>
                String(classe.id) ===
                classeTerminal
            );

          if (classeExiste) {
            setClasseSelectionnee(
              classeTerminal
            );
          }
        }
        // =====================================================
        // Sinon première classe du professeur
        // =====================================================
        else if (
          resultat.length > 0 &&
          !classeSelectionnee
        ) {
          setClasseSelectionnee(
            resultat[0].id
          );
        }

        setClassesLoading(false);
      },
      (error) => {
        console.error(
          'Erreur récupération classes professeur :',
          error
        );

        setClassesList([]);
        setClassesLoading(false);

        afficherMessage(
          'error',
          "Impossible de récupérer vos classes depuis l'emploi du temps."
        );
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    monIdProf,
    terminalFirebase?.classeId,
    matiereProf,
  ]);

  // =========================================================
  // 3. CLASSE ACTIVE
  // =========================================================

  const classeActive = useMemo(() => {
    return classesList.find(
      (classe) =>
        String(classe.id) ===
        String(classeSelectionnee)
    );
  }, [
    classesList,
    classeSelectionnee,
  ]);

  // =========================================================
  // NOM CLASSE TERMINAL
  // =========================================================

  const classeTerminal = useMemo(() => {
    if (!terminalFirebase?.classeId) {
      return null;
    }

    return classesList.find(
      (classe) =>
        String(classe.id) ===
        String(
          terminalFirebase.classeId
        )
    );
  }, [
    classesList,
    terminalFirebase?.classeId,
  ]);

  const classeTerminalNom =
    classeTerminal?.nom ||
    terminalFirebase?.classeNom ||
    terminalFirebase?.classeId ||
    '';

  // =========================================================
  // 4. RÉCUPÉRATION DES POINTAGES
  // =========================================================

  useEffect(() => {
    if (!currentSchool || !monIdProf) {
      setHistorique([]);
      setPointageActif(null);
      setLoading(false);
      return;
    }

    const qPointages = query(
      collection(db, 'registre_pointages'),
      where(
        'schoolId',
        '==',
        currentSchool
      ),
      where(
        'professeurId',
        '==',
        monIdProf
      )
    );

    const unsubscribe = onSnapshot(
      qPointages,
      (snapshot) => {
        const list = [];

        let actif = null;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          const item = {
            id: docSnap.id,
            ...data,
          };

          list.push(item);

          if (
            data.statutValidation ===
            'en_cours'
          ) {
            actif = item;
          }
        });

        // Plus récent en premier
        list.sort((a, b) => {
          const dateA = new Date(
            a.datePointage ||
              a.updatedAt ||
              0
          ).getTime();

          const dateB = new Date(
            b.datePointage ||
              b.updatedAt ||
              0
          ).getTime();

          return dateB - dateA;
        });

        setPointageActif(actif);

        setHistorique(
          list.filter(
            (pointage) =>
              pointage.statutValidation !==
              'en_cours'
          )
        );

        setLoading(false);
      },
      (error) => {
        console.error(
          'Erreur récupération pointages :',
          error
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    monIdProf,
  ]);

  // =========================================================
  // 5. ARRIVÉE
  // =========================================================

  const handleArrivee = async () => {
    if (arriveeEnCours) {
      return;
    }

    if (pointageActif) {
      afficherMessage(
        'error',
        'Vous avez déjà une arrivée en cours. Vous devez émarger votre départ.'
      );

      return;
    }

    if (!terminalId) {
      alert(
        "🚨 CE TERMINAL N'EST PAS IDENTIFIÉ.\n\nL'émargement doit être effectué depuis un ordinateur scellé par l'administration."
      );

      return;
    }

    setArriveeEnCours(true);

    try {
      // =====================================================
      // RELIRE LE TERMINAL DIRECTEMENT DANS FIRESTORE
      // =====================================================

      const terminalRef = doc(
        db,
        'terminaux',
        terminalId
      );

      const terminalSnap =
        await getDoc(terminalRef);

      if (!terminalSnap.exists()) {
        alert(
          "🚨 ORDINATEUR NON SCELLÉ.\n\nCet ordinateur n'est pas enregistré dans Firebase."
        );

        return;
      }

      const terminalData =
        terminalSnap.data();

      const schoolTerminal = String(
        terminalData.schoolId || ''
      )
        .trim()
        .toLowerCase();

      const schoolActuelle =
        String(currentSchool)
          .trim()
          .toLowerCase();

      const terminalValide =
        terminalData.scelle === true &&
        terminalData.actif !== false &&
        schoolTerminal ===
          schoolActuelle &&
        !!terminalData.classeId;

      if (!terminalValide) {
        alert(
          "🚨 TERMINAL NON AUTORISÉ.\n\nCet ordinateur n'est pas correctement scellé dans Firebase."
        );

        return;
      }

      // =====================================================
      // CLASSE IMPOSÉE PAR LE TERMINAL
      // =====================================================

      const classeDuPoste = String(
        terminalData.classeId
      );

      const classeProfesseur =
        classesList.find(
          (classe) =>
            String(classe.id) ===
            classeDuPoste
        );

      // =====================================================
      // IMPORTANT :
      // Le professeur doit être affecté à cette classe
      // =====================================================

      if (!classeProfesseur) {
        alert(
          `🚨 CLASSE NON AUTORISÉE.\n\nLe terminal est associé à : ${String(
            terminalData.classeNom ||
              classeDuPoste
          ).toUpperCase()}.\n\nCette classe ne figure pas dans vos classes d'intervention.`
        );

        return;
      }

      // =====================================================
      // FORCER LA CLASSE DU TERMINAL
      // =====================================================

      setClasseSelectionnee(
        classeDuPoste
      );

      const classeNom =
        classeProfesseur.nom ||
        terminalData.classeNom ||
        classeDuPoste;

      const matiere =
        classeProfesseur.matiere ||
        matiereProf ||
        terminalData.matiere ||
        'Discipline';

      const maintenant =
        new Date();

      const payload = {
        schoolId:
          currentSchool,

        professeurId:
          monIdProf,

        professeurName:
          nomProf,

        matiere:
          matiere,

        // =================================================
        // CLASSE RÉELLE DU TERMINAL / EDT
        // =================================================

        classeId:
          classeDuPoste,

        classeNom:
          classeNom,

        // =================================================
        // ARRIVÉE
        // =================================================

        date:
          maintenant.toLocaleDateString(
            'fr-FR'
          ),

        datePointage:
          maintenant.toISOString(),

        heureArrivee:
          maintenant.toLocaleTimeString(
            'fr-FR',
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          ),

        heureDepart:
          '—',

        heuresEffectuees:
          0,

        statutValidation:
          'en_cours',

        // =================================================
        // TERMINAL
        // =================================================

        terminalSecurise:
          true,

        terminalHardwareId:
          terminalId,

        terminalScelle:
          true,

        terminalClasseId:
          terminalData.classeId,

        terminalClasseNom:
          terminalData.classeNom ||
          classeNom,

        terminalSchoolId:
          terminalData.schoolId,

        terminalScellePar:
          terminalData.scellePar ||
          '',

        terminalScelleParNom:
          terminalData.scelleParNom ||
          '',

        dateScellementTerminal:
          terminalData.dateScellement ||
          null,

        classeDuPoste:
          terminalData.classeId,

        // =================================================
        // EMPLOI DU TEMPS
        // =================================================

        emploiDuTempsId:
          classeProfesseur.emploiDuTempsId ||
          '',

        creneauId:
          classeProfesseur.creneauId ||
          '',

        jour:
          classeProfesseur.jour ||
          '',

        heureDebutCours:
          classeProfesseur.heureDebut ||
          '',

        heureFinCours:
          classeProfesseur.heureFin ||
          '',

        createdAt:
          maintenant.toISOString(),

        updatedAt:
          maintenant.toISOString(),
      };

      const ref = await addDoc(
        collection(
          db,
          'registre_pointages'
        ),
        payload
      );

      // =====================================================
      // RÉCUPÉRATION IMMÉDIATE DU POINTAGE CRÉÉ
      // =====================================================

      setPointageActif({
        id: ref.id,
        ...payload,
      });

      afficherMessage(
        'success',
        `Arrivée enregistrée pour ${classeNom}. N'oubliez pas d'émarger votre départ à la fin du cours.`
      );

    } catch (error) {
      console.error(
        'Erreur pointage arrivée :',
        error
      );

      afficherMessage(
        'error',
        "Erreur réseau lors de l'enregistrement de votre arrivée."
      );
    } finally {
      setArriveeEnCours(false);
    }
  };

  // =========================================================
  // 6. DÉPART
  // =========================================================

  const handleDepart = async () => {
    if (!pointageActif) {
      return;
    }

    if (departEnCours) {
      return;
    }

    setDepartEnCours(true);

    try {
      const maintenant =
        new Date();

      const heureDepartTexte =
        maintenant.toLocaleTimeString(
          'fr-FR',
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        );

      // =====================================================
      // CALCUL DU VOLUME HORAIRE
      // =====================================================

      const heureArrivee =
        String(
          pointageActif.heureArrivee ||
            ''
        );

      const matchArrivee =
        heureArrivee.match(
          /^(\d{1,2}):(\d{2})/
        );

      const matchDepart =
        heureDepartTexte.match(
          /^(\d{1,2}):(\d{2})/
        );

      let volumeHoraire = 0;

      if (
        matchArrivee &&
        matchDepart
      ) {
        const hArr =
          Number(matchArrivee[1]);

        const mArr =
          Number(matchArrivee[2]);

        const hDep =
          Number(matchDepart[1]);

        const mDep =
          Number(matchDepart[2]);

        let minutes =
          hDep * 60 +
          mDep -
          (hArr * 60 + mArr);

        if (minutes < 0) {
          minutes += 24 * 60;
        }

        volumeHoraire =
          Number(
            (
              minutes / 60
            ).toFixed(2)
          );
      }

      // =====================================================
      // MISE À JOUR FIRESTORE
      // =====================================================

      const pointageRef =
        doc(
          db,
          'registre_pointages',
          pointageActif.id
        );

      await updateDoc(
        pointageRef,
        {
          heureDepart:
            heureDepartTexte,

          heuresEffectuees:
            volumeHoraire,

          statutValidation:
            'en_attente',

          departValide:
            true,

          departDatePointage:
            maintenant.toISOString(),

          updatedAt:
            maintenant.toISOString(),
        }
      );

      // =====================================================
      // SUPPRESSION IMMÉDIATE DE L'ÉTAT ACTIF
      // =====================================================

      setPointageActif(null);

      afficherMessage(
        'success',
        `Départ enregistré à ${heureDepartTexte}. Volume effectué : ${volumeHoraire} h.`
      );

    } catch (error) {
      console.error(
        'Erreur pointage départ :',
        error
      );

      afficherMessage(
        'error',
        "Erreur réseau lors de l'enregistrement du départ."
      );
    } finally {
      setDepartEnCours(false);
    }
  };

  // =========================================================
  // 7. CHANGEMENT DE CLASSE
  //
  // Autorisé uniquement lorsqu'aucun pointage n'est actif.
  // =========================================================

  const handleChangerClasse = (event) => {
    if (pointageActif) {
      return;
    }

    const id = event.target.value;

    const classe =
      classesList.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!classe) {
      return;
    }

    setClasseSelectionnee(
      classe.id
    );
  };

  // =========================================================
  // CHARGEMENT
  // =========================================================

  if (
    loading ||
    terminalLoading ||
    classesLoading
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center">

          <div className="text-3xl mb-3">
            🔐
          </div>

          <p className="text-xs font-black text-gray-400 animate-pulse uppercase">
            Vérification du terminal et récupération de vos classes...
          </p>

        </div>
      </div>
    );
  }

  // =========================================================
  // RENDU
  // =========================================================

  return (
    <div className="max-w-5xl mx-auto  sm:p-6 font-sans bg-white min-h-screen text-gray-700 text-left animate-fadeIn space-y-6">
      <Header/>
      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {message.text && (
        <div
          className={`rappel fixed top-5 right-5 z-[100] max-w-sm w-[calc(100%-2rem)] p-4 rounded-2xl shadow-2xl border-l-4 ${
            message.type === 'success'
              ? 'bg-slate-900 border-emerald-500 text-emerald-400'
              : 'bg-slate-900 border-red-500 text-red-400'
          }`}
        >
          <div className="flex items-start justify-between gap-3">

            <p className="text-xs font-bold whitespace-pre-line">
              {message.text}
            </p>

            <button
              type="button"
              onClick={() =>
                setMessage({
                  type: '',
                  text: '',
                })
              }
              className="text-gray-500 hover:"
            >
              ✕
            </button>

          </div>
        </div>
      )}

      {/* =====================================================
          TITRE
      ===================================================== */}

      <div>
        <p className="assi text-[10px] text-purple-600 font-black uppercase tracking-widest">
          Assiduité professeur
        </p>

        <h1 className="assi-1 text-2xl font-black text-gray-900 mt-1">
           Mon pointage
        </h1>

        <p className="assi-2 text-xs text-gray-500 mt-1">
          {dateAujourdhui}
        </p>
      </div>

      {/* =====================================================
          TERMINAL
      ===================================================== */}

      <div
        className={`p-5  ${
          terminalScelle
            ? 'bg-emerald-950'
            : 'bg-rose-950'
        }`}
      >

        <div className="assi-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div>

            <p className="text-[9px] font-black uppercase text-slate-400">
              État du poste
            </p>

            <p
              className={`text-base font-black uppercase mt-1 ${
                terminalScelle
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {terminalScelle
                ? '🟢 ORDINATEUR SCELLÉ'
                : '🚨 ORDINATEUR NON SCELLÉ'}
            </p>

            {terminalScelle && (
              <p className="text-[10px] text-slate-300 mt-2">
                Classe du poste :
                <strong className=" ml-1 uppercase">
                  {classeTerminalNom}
                </strong>
              </p>
            )}

          </div>

          <div className="Terminal text-right">

            <p className="text-[8px] uppercase text-slate-500">
              Terminal
            </p>

            <p className="text-[9px] font-mono text-slate-300">
              {terminalScelle
                ? 'SCELLEMENT VALIDÉ'
                : 'NON ENREGISTRÉ'}
            </p>

          </div>

        </div>

      </div>

      {/* =====================================================
          ALERTE DÉPART
      ===================================================== */}

      {pointageActif && (
        <div className="animate-pulse bg-red-600  rounded-2xl p-5 shadow-xl border-4 border-red-300">

          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">

            <div className="rappel text-center sm:text-left">

              <p className="text-xs font-black uppercase tracking-widest">
                ⚠️ RAPPEL D'ÉMARGEMENT
              </p>

              <p className="text-xl font-black uppercase mt-1">
                N'OUBLIEZ PAS VOTRE DÉPART !
              </p>

              <p className="text-xs font-bold mt-2">
                Vous avez enregistré votre arrivée à{' '}
                <span className="font-mono">
                  {pointageActif.heureArrivee}
                </span>
                .
              </p>

              <p className="text-xs font-bold mt-1">
                Classe :{' '}
                {String(
                  pointageActif.classeNom ||
                    pointageActif.classeId
                ).toUpperCase()}
              </p>

            </div>

            <button
      type="button"
      onClick={handleDepart}
      className="bouton-emargement-depart w-full mt-5 
                 rounded-xl font-black text-xl text-black
                 bg-yellow-400 hover:bg-yellow-300
                 border-4 border-yellow-100
                 cursor-pointer"
    >
      ÉMARGER MON DÉPART
    </button>
          </div>

        </div>
      )}

      {/* =====================================================
          CLASSE
      ==================================================== */}

      <div className=" p-5">

        <div className="flex flex-col md:flex-row md:items-end gap-4">

          <div className="flex-1">
          </div>
        </div>

      </div>

      {/* =====================================================
          POINTAGE
      ===================================================== */}

      <div className=" bg-slate-900 text-slate-100 p-6">

        {!pointageActif ? (

          <div className="poste  flex flex-col sm:flex-row items-center justify-between gap-6">

            <div className="poste text-center sm:text-left">

              <span
                className={`text-[10px] font-black uppercase px-3 py-1 rounded-md ${
                  terminalScelle
                    ? 'text-emerald-400 bg-emerald-950'
                    : 'text-rose-400 bg-rose-950'
                }`}
              >
                {terminalScelle
                  ? 'Poste autorisé'
                  : 'Poste non autorisé'}
              </span>

              <h3 className="text-lg font-black mt-3 ">
                {terminalScelle
                  ? 'Prêt pour émargement'
                  : 'Émargement bloqué'}
              </h3>

              {terminalScelle && (
                <p className="text-xs text-slate-400 mt-1">
                  Classe :{' '}
                  <strong className="">
                    {classeTerminalNom}
                  </strong>
                </p>
              )}

            </div>
             <div className='poste-1-text'>
              <p>Assurez vous que ce poste ai été scellé a votre classe par l'administration</p>
             </div>
            <button
              type="button"
              onClick={handleArrivee}
              disabled={
                !terminalScelle ||
                !classeSelectionnee ||
                arriveeEnCours
              }
              className="poste-1 bg-info hover:bg-emerald-700  font-black text-xs uppercase px-7 py-4 rounded-xl transition shadow-lg cursor-pointer border-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {arriveeEnCours
                ? '⏳ Vérification...'
                : ' ÉMARGER MON ARRIVÉE'}
            </button>

          </div>

        ) : (

          <div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

              <div>

                <span className="courencour text-[10px] font-black uppercase text-orange-400 bg-orange-950 px-3 py-1 rounded-md">
                  🔴 Cours en cours
                </span>
                 <div className='poste-1'>
                <h3 className="courenclass text-xl font-black mt-3 ">
                  Classe :{' '}
                  {String(
                    pointageActif.classeNom ||
                      pointageActif.classeId
                  ).toUpperCase()}
                </h3>

                <p className="courenheur text-xs text-slate-400 mt-2">
                  Arrivée enregistrée à :
                  <strong className=" font-mono ml-1">
                    {pointageActif.heureArrivee}
                  </strong>
                </p>

                <p className="btndepart-3 text-[10px] uppercase font-mono mt-2">

                  Poste :

                  <span className="text-emerald-400 font-bold ml-1">
                    🟢 SCELLÉ / CONFORME
                  </span>

                </p>

              </div>

              <button
                type="button"
                onClick={handleDepart}
                disabled={departEnCours}
                className="btndepart-2 animate-pulse bg-red-600 hover:bg-red-700  font-black text-sm uppercase  rounded-2xl transition shadow-2xl cursor-pointer border-4 border-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {departEnCours
                  ? '⏳ Enregistrement...'
                  : 'ÉMARGER MON DÉPART'}
              </button>

            </div>
           </div>
          </div>

        )}

      </div>

      {/* =====================================================
          HISTORIQUE
      ===================================================== */}

      <div className="tab ">

        <div className="p-4 bg-gray-50 border-b">

          <div className="flex items-center justify-between gap-3">

            <div>

              <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Registre de vos vacations
              </h3>

              <p className="text-[9px] text-gray-400 mt-1">
                Historique récupéré directement depuis la base des donnees :  <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded-lg">
              {historique.length} Eléves en charge
            </span>
              </p>

            </div>

           

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="taber w-full text-left text-xs font-bold text-gray-700 border-collapse">

            <thead>

              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">

                <th className="p-3">
                  Date
                </th>

                <th className="p-3">
                  Classe
                </th>

                <th className="p-3">
                  Matière
                </th>

                <th className="p-3 text-center">
                  Arrivée
                </th>

                <th className="p-3 text-center">
                  Départ
                </th>

                <th className="p-3 text-center">
                  Terminal
                </th>

                <th className="p-3 text-right">
                  Volume
                </th>

              </tr>

            </thead>

            <tbody>

              {historique.length === 0 ? (

                <tr>

                  <td
                    colSpan="7"
                    className="p-8 text-center text-gray-400 italic"
                  >
                    Aucune vacation terminée dans votre historique.
                  </td>

                </tr>

              ) : (

                historique.map(
                  (h) => (
                    <tr
                      key={h.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >

                      <td className="p-3 font-mono text-gray-500">
                        {h.date ||
                          h.datePointage
                            ?.split('T')[0] ||
                          '—'}
                      </td>

                      <td className="p-3 text-purple-700 uppercase font-black">
                        {String(
                          h.classeNom ||
                            h.classeId ||
                            ''
                        ).toUpperCase()}
                      </td>

                      <td className="p-3 text-gray-600">
                        {h.matiere ||
                          '—'}
                      </td>

                      <td className="p-3 text-center font-mono">
                        {h.heureArrivee ||
                          '—'}
                      </td>

                      <td className="p-3 text-center font-mono">
                        {h.heureDepart ||
                          '—'}
                      </td>

                      <td className="p-3 text-center">

                        {h.terminalScelle ||
                        h.terminalSecurise ? (

                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                            🟢 Scellé
                          </span>

                        ) : (

                          <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                            🚨 Non agréé
                          </span>

                        )}

                      </td>

                      <td className="p-3 text-right font-mono text-gray-900">

                        <span className="bg-slate-100 px-2 py-1 rounded">
                          {Number(
                            h.heuresEffectuees ||
                              0
                          ).toFixed(2)}{' '}
                          H
                        </span>

                      </td>

                    </tr>
                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
};

export default MonPointage;