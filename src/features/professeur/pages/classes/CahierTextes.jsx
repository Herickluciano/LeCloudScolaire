// src/features/professeur/pages/cahier-textes/CahierTextes.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/api';

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../../../../pages/Header';

const CahierTextes = () => {
  const { user, schoolId, schoolName } = useAuth();

  // ============================================================
  // IDENTITÉ DU PROFESSEUR / ÉTABLISSEMENT
  // ============================================================

  const currentSchool = (
    user?.schoolId ||
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    ''
  )
    .trim()
    .toLowerCase();

  const monIdProf = String(
    user?.id ||
    user?.matricule ||
    user?.uid ||
    ''
  ).trim();

  const nomProf =
    user?.name ||
    `${user?.nom || ''} ${user?.prenoms || ''}`.trim() ||
    `${user?.prenoms || ''} ${user?.nom || ''}`.trim() ||
    'Professeur';

  // ============================================================
  // ÉTATS
  // ============================================================

  const [listeClassesAutorisees, setListeClassesAutorisees] = useState([]);

  const [classeSelectionnee, setClasseSelectionnee] = useState('');

  const [classeNomAffiche, setClasseNomAffiche] =
    useState('Sélectionnez une division');

  const [matiereActive, setMatiereActive] = useState('');

  const [lecons, setLecons] = useState([]);

  const [historiquePointages, setHistoriquePointages] = useState([]);

  const [loading, setLoading] = useState(true);

  const [loadingPointages, setLoadingPointages] = useState(false);

  const [titreSeance, setTitreSeance] = useState('');

  const [resumeCours, setResumeCours] = useState('');

  const [devoirMaison, setDevoirMaison] = useState('');

  const [sending, setSending] = useState(false);

  const [emargementEnCours, setEmargementEnCours] =
    useState(false);

  const [toast, setToast] = useState({
    type: '',
    text: '',
  });

  // ============================================================
  // CLASSE ACTIVE
  // ============================================================

  const classeActive = useMemo(() => {
    return listeClassesAutorisees.find(
      (classe) => classe.id === classeSelectionnee
    );
  }, [listeClassesAutorisees, classeSelectionnee]);

  // ============================================================
  // MESSAGE TEMPORAIRE
  // ============================================================

  const afficherMessage = (type, text) => {
    setToast({
      type,
      text,
    });

    setTimeout(() => {
      setToast({
        type: '',
        text: '',
      });
    }, 5000);
  };

  // ============================================================
  // 1. RÉCUPÉRATION DES CLASSES DU PROFESSEUR
  //    DEPUIS L'EMPLOI DU TEMPS FIRESTORE
  // ============================================================

  useEffect(() => {
    if (!currentSchool || !monIdProf) {
      setListeClassesAutorisees([]);
      setClasseSelectionnee('');
      setClasseNomAffiche('Aucune division disponible');
      setMatiereActive('');
      setLoading(false);
      return;
    }

    setLoading(true);

    const qEDT = query(
      collection(db, 'emplois_du_temps'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      qEDT,
      (snapshot) => {
        const mapClasses = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          // ----------------------------------------------------
          // CAS 1 : les créneaux sont stockés dans "creneaux"
          // ----------------------------------------------------

          if (Array.isArray(data.creneaux)) {
            data.creneaux.forEach((creneau) => {
              const professeurCreneau = String(
                creneau.professeurId ||
                creneau.profId ||
                creneau.enseignantId ||
                ''
              )
                .trim()
                .toLowerCase();

              const professeurConnecte = String(monIdProf)
                .trim()
                .toLowerCase();

              if (
                !professeurCreneau ||
                professeurCreneau !== professeurConnecte
              ) {
                return;
              }

              const classeId =
                creneau.classeId ||
                creneau.divisionId ||
                data.classeId ||
                data.divisionId;

              const classeNom =
                creneau.nomClasse ||
                creneau.classeNom ||
                creneau.nomDivision ||
                data.classeNom ||
                data.nomClasse ||
                data.divisionNom ||
                'Division';

              const matiere =
                creneau.matiere ||
                creneau.discipline ||
                creneau.nomMatiere ||
                data.matiere ||
                data.discipline ||
                '';

              if (!classeId) return;

              const cle = `${String(classeId)}__${String(
                matiere
              ).toLowerCase()}`;

              mapClasses[cle] = {
                id: String(classeId),
                nom: String(classeNom),
                matiere: String(matiere),
                emploiDuTempsId: docSnap.id,

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

                creneauId:
                  creneau.id ||
                  creneau.creneauId ||
                  '',
              };
            });
          }

          // ----------------------------------------------------
          // CAS 2 : un document EDT peut lui-même représenter
          //         un créneau
          // ----------------------------------------------------

          const professeurDocument = String(
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
              String(monIdProf).trim().toLowerCase()
          ) {
            const classeId =
              data.classeId ||
              data.divisionId;

            const classeNom =
              data.classeNom ||
              data.nomClasse ||
              data.divisionNom ||
              'Division';

            const matiere =
              data.matiere ||
              data.discipline ||
              '';

            if (classeId) {
              const cle = `${String(
                classeId
              )}__${String(matiere).toLowerCase()}`;

              mapClasses[cle] = {
                id: String(classeId),
                nom: String(classeNom),
                matiere: String(matiere),
                emploiDuTempsId: docSnap.id,

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

                creneauId:
                  data.creneauId ||
                  docSnap.id,
              };
            }
          }
        });

        const resultats = Object.values(mapClasses).sort(
          (a, b) => {
            const classeCompare = a.nom.localeCompare(
              b.nom,
              'fr',
              {
                numeric: true,
              }
            );

            if (classeCompare !== 0) {
              return classeCompare;
            }

            return a.matiere.localeCompare(
              b.matiere,
              'fr'
            );
          }
        );

        setListeClassesAutorisees(resultats);

        // ------------------------------------------------------
        // Conserver la sélection si elle existe encore
        // ------------------------------------------------------

        const selectionExiste = resultats.some(
          (classe) => classe.id === classeSelectionnee
        );

        if (!selectionExiste) {
          if (resultats.length > 0) {
            const premiereClasse = resultats[0];

            setClasseSelectionnee(premiereClasse.id);
            setClasseNomAffiche(premiereClasse.nom);
            setMatiereActive(premiereClasse.matiere);
          } else {
            setClasseSelectionnee('');
            setClasseNomAffiche(
              'Aucune division disponible'
            );
            setMatiereActive('');
          }
        }

        setLoading(false);
      },
      (error) => {
        console.error(
          'Erreur récupération emploi du temps :',
          error
        );

        setListeClassesAutorisees([]);
        setLoading(false);

        afficherMessage(
          'error',
          'Impossible de récupérer vos divisions depuis Firestore.'
        );
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    monIdProf,
    classeSelectionnee,
  ]);

  // ============================================================
  // 2. CHANGEMENT DE DIVISION
  // ============================================================

  const handleChangerClasse = (event) => {
    const selectedId = event.target.value;

    setClasseSelectionnee(selectedId);

    const classe = listeClassesAutorisees.find(
      (item) => item.id === selectedId
    );

    if (!classe) {
      setClasseNomAffiche(
        'Sélectionnez une division'
      );
      setMatiereActive('');
      return;
    }

    setClasseNomAffiche(classe.nom);
    setMatiereActive(classe.matiere || '');
  };

  // ============================================================
  // 3. RÉCUPÉRATION DES LEÇONS DE LA CLASSE/MATIÈRE
  // ============================================================

  useEffect(() => {
    if (
      !currentSchool ||
      !classeSelectionnee ||
      !matiereActive
    ) {
      setLecons([]);
      return;
    }

    const qLecons = query(
      collection(db, 'cahier_textes'),
      where('schoolId', '==', currentSchool),
      where('classeId', '==', classeSelectionnee),
      where('matiere', '==', matiereActive)
    );

    const unsubscribe = onSnapshot(
      qLecons,
      (snapshot) => {
        const list = [];

        snapshot.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });

        list.sort((a, b) => {
          const dateA = new Date(
            a.createdAt || 0
          ).getTime();

          const dateB = new Date(
            b.createdAt || 0
          ).getTime();

          return dateB - dateA;
        });

        setLecons(list);
      },
      (error) => {
        console.error(
          'Erreur lecture cahier de textes :',
          error
        );
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    classeSelectionnee,
    matiereActive,
  ]);

  // ============================================================
  // 4. RÉCUPÉRATION DE L'HISTORIQUE DES ÉMARGEMENTS
  // ============================================================

  useEffect(() => {
    if (
      !currentSchool ||
      !monIdProf ||
      !classeSelectionnee
    ) {
      setHistoriquePointages([]);
      return;
    }

    setLoadingPointages(true);

    const qPointages = query(
      collection(db, 'pointages_professeurs'),
      where('schoolId', '==', currentSchool),
      where('professeurId', '==', monIdProf),
      where('classeId', '==', classeSelectionnee)
    );

    const unsubscribe = onSnapshot(
      qPointages,
      (snapshot) => {
        const list = [];

        snapshot.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });

        list.sort((a, b) => {
          const dateA = new Date(
            a.createdAtISO ||
              a.createdAt ||
              0
          ).getTime();

          const dateB = new Date(
            b.createdAtISO ||
              b.createdAt ||
              0
          ).getTime();

          return dateB - dateA;
        });

        setHistoriquePointages(list);
        setLoadingPointages(false);
      },
      (error) => {
        console.error(
          'Erreur historique émargement :',
          error
        );

        setHistoriquePointages([]);
        setLoadingPointages(false);
      }
    );

    return () => unsubscribe();
  }, [
    currentSchool,
    monIdProf,
    classeSelectionnee,
  ]);

  // ============================================================
  // 5. VALIDATION DU COURS
  // ============================================================

  const handleValidateSeance = async (event) => {
    event.preventDefault();

    if (!currentSchool) {
      afficherMessage(
        'error',
        "L'établissement n'est pas identifié."
      );
      return;
    }

    if (!monIdProf) {
      afficherMessage(
        'error',
        'Votre identifiant professeur est introuvable.'
      );
      return;
    }

    if (!classeSelectionnee) {
      afficherMessage(
        'error',
        'Sélectionnez une division avant de valider le cours.'
      );
      return;
    }

    if (!matiereActive) {
      afficherMessage(
        'error',
        'La matière du créneau sélectionné est introuvable.'
      );
      return;
    }

    if (!titreSeance.trim()) {
      afficherMessage(
        'error',
        'Le titre de la séance est obligatoire.'
      );
      return;
    }

    if (!resumeCours.trim()) {
      afficherMessage(
        'error',
        'Le résumé du cours est obligatoire.'
      );
      return;
    }

    setSending(true);

    try {
      const maintenant = new Date();

      const documentCours = {
        schoolId: currentSchool,

        classeId: classeSelectionnee,
        classeNom: classeNomAffiche,

        matiere: matiereActive,

        profId: monIdProf,
        professeurId: monIdProf,

        profName: nomProf,
        professeurName: nomProf,

        titre: titreSeance.trim(),

        contenu: resumeCours.trim(),

        devoir:
          devoirMaison.trim() ||
          'Aucun devoir rattaché pour cette séance.',

        date: maintenant.toLocaleDateString(
          'fr-FR'
        ),

        heure: maintenant.toLocaleTimeString(
          'fr-FR',
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        ),

        createdAt: maintenant.toISOString(),

        createdAtTimestamp: serverTimestamp(),

        // Permet de savoir que le cours a été enregistré
        statutSeance: 'terminee',

        // Informations du créneau ayant servi
        // à déterminer automatiquement la classe
        creneauId:
          classeActive?.creneauId || '',

        emploiDuTempsId:
          classeActive?.emploiDuTempsId || '',

        jourCours:
          classeActive?.jour || '',

        heureDebutCours:
          classeActive?.heureDebut || '',

        heureFinCours:
          classeActive?.heureFin || '',
      };

      const coursRef = await addDoc(
        collection(db, 'cahier_textes'),
        documentCours
      );

      setTitreSeance('');
      setResumeCours('');
      setDevoirMaison('');

      afficherMessage(
        'success',
        `Cours enregistré pour ${classeNomAffiche}. Vous pouvez maintenant émarger votre séance.`
      );

      console.log(
        'Cours enregistré :',
        coursRef.id
      );
    } catch (error) {
      console.error(
        'Erreur insertion cahier de textes :',
        error
      );

      afficherMessage(
        'error',
        'Impossible d’enregistrer la séance.'
      );
    } finally {
      setSending(false);
    }
  };

  // ============================================================
  // 6. ÉMARGEMENT APRÈS LE COURS
  // ============================================================

  const handleEmargerSeance = async () => {
    if (!currentSchool) {
      afficherMessage(
        'error',
        "L'établissement n'est pas identifié."
      );
      return;
    }

    if (!monIdProf) {
      afficherMessage(
        'error',
        'Votre identifiant professeur est introuvable.'
      );
      return;
    }

    if (!classeSelectionnee) {
      afficherMessage(
        'error',
        'Aucune division sélectionnée.'
      );
      return;
    }

    if (!matiereActive) {
      afficherMessage(
        'error',
        'La matière du cours est introuvable.'
      );
      return;
    }

    // ----------------------------------------------------------
    // On exige qu'au moins une séance ait été enregistrée
    // pour cette classe/matière.
    // ----------------------------------------------------------

    const derniereLecon = lecons[0];

    if (!derniereLecon) {
      afficherMessage(
        'error',
        'Enregistrez d’abord le contenu de votre cours avant de pouvoir émarger.'
      );
      return;
    }

    // ----------------------------------------------------------
    // Éviter un double émargement pour la même séance.
    // On regarde le dernier cours et les pointages existants.
    // ----------------------------------------------------------

    const dejaEmargee = historiquePointages.some(
      (pointage) =>
        pointage.cahierTexteId === derniereLecon.id
    );

    if (dejaEmargee) {
      afficherMessage(
        'error',
        'Cette séance a déjà été émargée.'
      );
      return;
    }

    setEmargementEnCours(true);

    try {
      const maintenant = new Date();

      await addDoc(
        collection(db, 'pointages_professeurs'),
        {
          schoolId: currentSchool,

          professeurId: monIdProf,
          professeurName: nomProf,

          classeId: classeSelectionnee,
          classeNom: classeNomAffiche,

          matiere: matiereActive,

          // Relation directe avec le cours terminé
          cahierTexteId: derniereLecon.id,

          titreSeance:
            derniereLecon.titre || '',

          dateCours:
            derniereLecon.date || '',

          heureCours:
            derniereLecon.heure || '',

          // Date et heure réelles de l'émargement
          datePointage:
            maintenant.toLocaleDateString(
              'fr-FR'
            ),

          heurePointage:
            maintenant.toLocaleTimeString(
              'fr-FR',
              {
                hour: '2-digit',
                minute: '2-digit',
              }
            ),

          // Statut
          statutVacation: 'certifiee',

          statutEmargement: 'validee',

          verificationMethode:
            'Cahier de textes',

          // Relations EDT
          creneauId:
            classeActive?.creneauId || '',

          emploiDuTempsId:
            classeActive?.emploiDuTempsId || '',

          jour:
            classeActive?.jour || '',

          heureDebut:
            classeActive?.heureDebut || '',

          heureFin:
            classeActive?.heureFin || '',

          createdAt: maintenant.toISOString(),

          createdAtTimestamp:
            serverTimestamp(),

          createdAtISO:
            maintenant.toISOString(),
        }
      );

      afficherMessage(
        'success',
        `Émargement validé.\n${classeNomAffiche} — ${matiereActive}\nSéance : ${derniereLecon.titre}`
      );
    } catch (error) {
      console.error(
        'Erreur émargement professeur :',
        error
      );

      afficherMessage(
        'error',
        'Impossible de valider votre émargement.'
      );
    } finally {
      setEmargementEnCours(false);
    }
  };

  // ============================================================
  // ÉTAT DE LA DERNIÈRE SÉANCE
  // ============================================================

  const derniereLecon = lecons[0];

  const derniereLeconDejaEmargee =
    derniereLecon &&
    historiquePointages.some(
      (pointage) =>
        pointage.cahierTexteId === derniereLecon.id
    );

  // ============================================================
  // AFFICHAGE CHARGEMENT
  // ============================================================

  if (
    loading &&
    listeClassesAutorisees.length === 0
  ) {
    return (
      <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">
        Ouverture du cahier de textes...
      </div>
    );
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="max-w-6xl mx-auto  sm:p-6 font-sans text-gray-700 text-left bg-white min-h-screen animate-fadeIn">

      <Header />

      {/* ======================================================
          TOAST
      ====================================================== */}

      {toast.text && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border-l-4 flex items-start justify-between gap-4 max-w-sm w-full text-xs font-bold whitespace-pre-line ${
            toast.type === 'success'
              ? 'bg-slate-900 border-emerald-500 text-emerald-400'
              : 'bg-slate-900 border-red-500 text-red-400'
          }`}
        >
          <p className="text-left">
            {toast.text}
          </p>

          <button
            type="button"
            onClick={() =>
              setToast({
                type: '',
                text: '',
              })
            }
            className="text-slate-500 hover: text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================
          RETOUR
      ====================================================== */}

      <div className="mb-4">
        <Link
          to="/professeur/dashboard"
          className="signret-1 inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg transition shadow-sm no-underline"
        >
          ⬅ Bureau Enseignant
        </Link>
      </div>

      {/* ======================================================
          EN-TÊTE
      ====================================================== */}

      <div className="bg-purple-900  rounded-2xl p-6 shadow-md mb-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

          <div>
            <h1 className="cahier text-xl md:text-2xl font-black">
              📖 Cahier de Textes
            </h1>
            <div className='discgroup'>
            <p className="disc-1 text-xs text-purple-200 mt-1">
              Établissement :{' '}
              <span className="font-bold text-orange-400 uppercase">
                {schoolName || currentSchool || 'Établissement'}
              </span>
            </p>

            <p className=" text-xs text-purple-200 mt-1">
              Professeur :{' '}
              <span className="font-bold ">
                {nomProf}
              </span>
            </p>
          </div>
          </div>

          <div className="inter-0  px-4 py-3 text-xs">
            <p className="text-purple-200 uppercase font-black">
              Division active  -   {classeNomAffiche}  -   {matiereActive || 'Matière non définie'}
            </p>
          </div>

        </div>
      </div>

      {/* ======================================================
          SÉLECTION DIVISION
      ====================================================== */}

      <div className="  p-5  mb-6">

        <div className=" flex flex-col md:flex-row md:items-end gap-5">

           <div className="selec-clas-1 w-full sm:w-auto text-left">
             <label className="change-div block text-[9px] font-black text-gray-400 uppercase mb-1">
              Divisions & Emploi du temps
            </label>

            <select
              value={classeSelectionnee}
              onChange={handleChangerClasse}
              className="w-full  border border-gray-200 text-gray-800 font-black text-xs rounded-xl px-3 py-3 outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
            >
              {listeClassesAutorisees.length === 0 ? (
                <option value="">
                  Aucune division ne vous est assignée
                </option>
              ) : (
                listeClassesAutorisees.map(
                  (classe, index) => (
                    <option
                      key={`${classe.id}-${classe.matiere}-${index}`}
                      value={classe.id}
                    >
                      🏛️ {String(
                        classe.nom
                      ).toUpperCase()}{' '}
                      —{' '}
                      {classe.matiere ||
                        'Matière'}
                    </option>
                  )
                )
              )}
            </select>
          </div>

          <div className="inter-1 md:w-64 bg-purple-50  px-4 py-3">
            <p className="text-[9px] uppercase font-black text-purple-400">
              Relation automatique
            </p>

            <p className="text-danger font-black text-purple-900 mt-1">
              Classe ↔ Matière ↔ Professeur
            </p>
          </div>

        </div>

        {classeActive && (
          <div className="inter mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-5 gap-3">

            <div>
              <p className="text-[9px] uppercase text-gray-400 font-black">
                Classe
              </p>
              <p className="text-danger font-bold text-gray-800">
                {classeActive.nom}
              </p>
            </div>

            <div>
              <p className="text-[9px] uppercase text-gray-400 font-black">
                Matière
              </p>
              <p className="text-danger font-bold text-purple-700">
                {classeActive.matiere}
              </p>
            </div>

            <div>
              <p className="text-[9px] uppercase text-gray-400 font-black">
                Jour
              </p>
              <p className="text-danger font-bold text-gray-800">
                {classeActive.jour || '—'}
              </p>
            </div>

            <div>
              <p className="text-[9px] uppercase text-gray-400 font-black">
                Début
              </p>
              <p className="text-danger font-bold text-gray-800">
                {classeActive.heureDebut ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="text-[9px] uppercase text-gray-400 font-black">
                Fin
              </p>
              <p className="text-danger font-bold text-gray-800">
                {classeActive.heureFin ||
                  '—'}
              </p>
            </div>

          </div>
        )}
      </div>

      {/* ======================================================
          ESPACE PRINCIPAL
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ====================================================
            FORMULAIRE COURS
        ==================================================== */}

        <div className="bg-slate-900 p-5  h-fit">

          <h3 className="nou text-xs font-black text-orange-400 uppercase tracking-wider border-b border-slate-700 pb-3 mb-5">
           1.  Remplir le cahier de texte
          </h3>

                 <form
            onSubmit={handleValidateSeance}
            className="space-y-4 text-xs font-bold text-left"
          >

            <div className='titreseance form-floating mb-3'>
              <label htmlFor="titreSeanceInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Titre de la leçon *
              </label>

              <input
                type="text"
                id="titreSeanceInput"
                name="ytitreSeance"
                placeholder="Ex : Équations du second degré"
                value={titreSeance}
                onChange={(e) =>
                  setTitreSeance(
                    e.target.value
                  )
                }
                className="form-control w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5  outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

             <div className='mgseance form-floating mb-3'>
              <label htmlFor="resumeCoursInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Résumé de la séance (Appuyez sur Entrée pour aller à la ligne)*
              </label>

              <textarea
                id="resumeCoursInput"
                name="resumeCours"
                rows="6"
                placeholder="Décrivez le cours réalisé... (Appuyez sur Entrée pour aller à la ligne)"
                value={resumeCours}
                onChange={(e) =>
                  setResumeCours(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  // Empêche la soumission accidentelle du formulaire lors d'un appui sur Entrée
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                  }
                }}
                style={{ minHeight: '130px', resize: 'vertical' }}
                className="form-control w-full bg-slate-800 border border-slate-700 rounded-lg  text-slate-200 outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div className='devoirseance form-floating mb-3'>
              <label htmlFor="devoirMaisonInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Exercices / devoir
              </label>

              <input
                type="text"
                id="devoirMaisonInput"
                name="devoirMaison"
                placeholder="Ex : Exercices 4 et 5 page 112"
                value={devoirMaison}
                onChange={(e) =>
                  setDevoirMaison(
                    e.target.value
                  )
                }
                className="form-control w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5  outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={
                sending ||
                listeClassesAutorisees.length === 0
              }
              className="siemg w-full bg-orange-500 hover:bg-orange-600  font-extrabold p-1 py-1 rounded-xl uppercase tracking-wider transition border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending
                ? 'Enregistrement...'
                : '💾 Terminer et enregistrer le cours'}
            </button>

          </form>


          {/* ==================================================
              ÉMARGEMENT
          ================================================== */}

          <div className="mt-6 pt-5 ">

            <p className="text-[10px] text-slate-400 uppercase font-black mb-3">
              
            </p>

            {!derniereLecon ? (
              <div className="rounded-xl bg-slate-800 border border-slate-700 p-3">
                <p className="text-[10px] text-slate-400">
                  Enregistrez votre séance pour activer l'émargement.
                </p>
              </div>
            ) : derniereLeconDejaEmargee ? (
              <div className="rounded-xl bg-emerald-900/30 border border-emerald-700 p-3">
                <p className="text-[10px] text-emerald-400 font-black uppercase">
                  ✓ Séance déjà émargée
                </p>

                <p className="text-[10px] text-slate-400 mt-1">
                  {derniereLecon.titre}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-slate-800 border border-slate-700 p-3 mb-3">

                  <p className="text-[9px] text-slate-500 uppercase font-black">
                    Dernière séance
                  </p>

                  <p className="text-xs  font-black mt-1">
                    {derniereLecon.titre}
                  </p>

                  <p className="text-[10px] text-slate-400 mt-1">
                    {classeNomAffiche} —{' '}
                    {matiereActive}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={handleEmargerSeance}
                  disabled={emargementEnCours}
                  className="siemg-1 w-full bg-emerald-600 hover:bg-emerald-700  font-black py-3 rounded-xl uppercase tracking-wider transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {emargementEnCours
                    ? 'Certification...'
                    : '⏱️ Émarger ma présence'}
                </button>
              </>
            )}

          </div>

        </div>
        <div className="separateur"><div className="traite-pro"></div></div>
        {/* ====================================================
            HISTORIQUE
        ==================================================== */}

        <div className="lg:col-span-2 space-y-6">

          {/* ==================================================
              HISTORIQUE COURS
          ================================================== */}

          <div className="progression p-0">

            <div className="flex items-center justify-between  pb-3 mb-4">

              <h3 className="text-pro font-black text-gray-400  uppercase tracking-wider">
               2.  Progression de la classe
              </h3>

              <span className="text-pro-1 text-[10px] font-black bg-purple-50 text-purple-700 px-2 py-1 ">
                {lecons.length} séance
                {lecons.length > 1
                  ? 's'
                  : ''}
              </span>

            </div>

            {lecons.length === 0 ? (
              <p className="text-xs text-center text-gray-400 py-12 font-medium">
                Aucune séance de cours n'a encore été consignée pour cette matière.
              </p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">

                {lecons.map((lecon) => {

                  const estEmargee =
                    historiquePointages.some(
                      (pointage) =>
                        pointage.cahierTexteId ===
                        lecon.id
                    );

                  return (
                    <div
                      key={lecon.id}
                      className="progressio p-4  text-left relative"
                    >

                      <div className=" flex justify-between items-start mb-1 flex-wrap gap-2">

                        <h4 className="lecontitre text-sm font-black text-gray-900 uppercase">
                         {lecon.titre}
                        </h4>

                        <div className="lecondate flex gap-2 items-center">

                          <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50 px-2 py-0.5 ">
                            {lecon.date}
                          </span>

                          {estEmargee && (
                            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-800">
                              ✓ Émargée
                            </span>
                          )}

                        </div>

                      </div>

                      <p className="lecondate text-xs text-gray-600 whitespace-pre-line mt-2">
                        {lecon.contenu}
                      </p>

                      <div className="lecondate-1 mt-3 p-2 bg-amber-50/50 text-[11px] text-amber-800 font-medium">
                        🎯{' '}
                        <span className="font-bold">
                          Travail à faire :
                        </span>{' '}
                        {lecon.devoir}
                      </div>

                      <p className="lecondate-1 text-[9px] text-gray-400 uppercase font-black mt-2 tracking-wide">
                        Signé numériquement par :{' '}
                        {lecon.profName ||
                          'Enseignant'}
                      </p>

                    </div>
                  );
                })}

              </div>
            )}

          </div>

          {/* ==================================================
              HISTORIQUE ÉMARGEMENTS
          ================================================== */}

          <div className="progression-1 p-5 ">

            <div className="flex items-center justify-between border-b pb-3 mb-4">

              <h3 className="text-pro-B font-black text-gray-400 uppercase tracking-wider">
                3. Historique des émargements
              </h3>

              <span className="text-pro-A text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">
                {historiquePointages.length} validé
                {historiquePointages.length > 1
                  ? 's'
                  : ''}
              </span>

            </div>

            {loadingPointages ? (
              <p className="text-xs text-center text-gray-400 py-8">
                Chargement des émargements...
              </p>
            ) : historiquePointages.length === 0 ? (
              <p className="text-xs text-center text-gray-400 py-8">
                Aucun émargement pour cette division.
              </p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">

                {historiquePointages.map(
                  (pointage) => (
                    <div
                      key={pointage.id}
                      className="p-3 "
                    >

                      <div className="flex justify-between items-start gap-3">

                        <div>

                          <p className="text-xs text-gray-900 font-black">
                            {pointage.titreSeance ||
                              'Séance de cours'}
                          </p>

                          <p className="text-[10px] text-gray-500 font-medium mt-1">
                            {pointage.datePointage ||
                              'Date inconnue'}{' '}
                            à{' '}
                            {pointage.heurePointage ||
                              '—'}
                          </p>

                          <p className="text-[10px] text-purple-600 font-bold mt-1">
                            {pointage.classeNom ||
                              classeNomAffiche}{' '}
                            —{' '}
                            {pointage.matiere ||
                              matiereActive}
                          </p>

                        </div>

                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-800 whitespace-nowrap">
                          ✓ Validé
                        </span>

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default CahierTextes;