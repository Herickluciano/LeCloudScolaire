// src/features/professeur/pages/evaluations/MoyennesTrimestres.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import Header from '../../../../pages/Header';

const MoyennesTrimestres = () => {
  const { user, schoolId } = useAuth();

  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_saint_bernard'
  )
    .trim()
    .toLowerCase();

  // --- ÉTATS INTERNES ---
  const [classesAutorisees, setClassesAutorisees] = useState([]);
  const [classeSelectionnee, setClasseSelectionnee] = useState('');
  const [matiereActive, setMatiereActive] = useState('');
  const [eleves, setEleves] = useState([]);
  const [eleveSelectionne, setEleveSelectionne] = useState(null);
  const [trimestre, setTrimestre] = useState('1');
  const [loading, setLoading] = useState(true);

  // États de saisie : moyenne de matière, coefficient, moyenne pondérée,
  // appréciation et signature certifiée.
  const [noteSaisieDefinitive, setNoteSaisieDefinitive] = useState('');
  const [coefficientMatiereSaisie, setCoefficientMatiereSaisie] = useState('');
  const [moyennePondereeSaisie, setMoyennePondereeSaisie] = useState('');
  const [appreciationSaisie, setAppreciationSaisie] = useState('');
  const [isSigneByProf, setIsSigneByProf] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });

  /* =========================================================
     🔄 ÉTAPE 1 : CLASSEMENT DE L'EMPLOI DU TEMPS DU PROFESSEUR
  ========================================================= */
  useEffect(() => {
    if (!user?.id || !currentSchool) {
      setLoading(false);
      return undefined;
    }

    const qEdt = query(
      collection(db, "emplois_du_temps"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribeEdt = onSnapshot(qEdt, (snapshot) => {
      const classesTrouvees = [];
      let disciplineDetectee = '';

      snapshot.forEach((docSnap) => {
        const edtData = docSnap.data();
        const creneaux = edtData.creneaux || [];

        creneaux.forEach((creneau) => {
          if (String(creneau.professeurId).trim() === String(user.id).trim()) {
            if (!disciplineDetectee) {
              disciplineDetectee = creneau.matiere;
            }

            if (!classesTrouvees.some(c => c.id === creneau.classeId)) {
              classesTrouvees.push({
                id: creneau.classeId,
                nom: creneau.nomClasse || creneau.classeNom || "N/A"
              });
            }
          }
        });
      });

      setClassesAutorisees(classesTrouvees);
      setMatiereActive(disciplineDetectee || user?.matiereEnseignee || 'Anglais');

      if (classesTrouvees.length > 0) {
        setClasseSelectionnee(classesTrouvees[0].id);
      } else {
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribeEdt();
  }, [user, currentSchool]);

  /* =========================================================
     🔄 ÉTAPE 2 : LIVE STREAM DES ÉLÈVES ET DES NOTES
  ========================================================= */
  useEffect(() => {
    if (!currentSchool || !classeSelectionnee || !matiereActive) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const qEleves = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "==", classeSelectionnee)
    );

    const unsubscribeEleves = onSnapshot(qEleves, (snapshot) => {
      const list = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const cleTrimestre = `notes_trimestre_${trimestre}`;

        const notesMatiere =
          d.notes?.[cleTrimestre]?.[matiereActive] || [];

        // Objet contenant les valeurs déjà arrêtées/transmises.
        const boiteMoyenneExistante =
          d.moyennes_matiere?.[cleTrimestre]?.[matiereActive] || null;

        const notesTrieesChronologique = [...notesMatiere].sort((a, b) => {
          if (!a.date || !b.date) return 0;

          const [jA, mA, aA] = a.date.split('/');
          const [jB, mB, aB] = b.date.split('/');

          return new Date(aA, mA - 1, jA) - new Date(aB, mB - 1, jB);
        });

        let listeInterros = [];
        let listeDs = [];
        let listeDcs = [];

        // Cette moyenne reste INDICATIVE : elle ne remplace pas les
        // valeurs que le professeur doit saisir avant transmission.
        let totalPointsCumules = 0;
        let totalCoefficientsCumules = 0;

        notesTrieesChronologique.forEach((item) => {
          const val = parseFloat(item?.note ?? 0);

          if (Number.isNaN(val) || !Number.isFinite(val)) return;

          const typeEval = String(item?.type || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

          const objetNote = {
            note: val,
            date: item.date || "—"
          };

          if (typeEval.includes("interro")) {
            listeInterros.push(objetNote);
            totalPointsCumules += val * 1;
            totalCoefficientsCumules += 1;
          } else if (
            typeEval.includes("surveille") ||
            typeEval.includes("ds") ||
            typeEval.includes("devoir")
          ) {
            if (
              typeEval.includes("commun") ||
              typeEval.includes("comp")
            ) {
              listeDcs.push(objetNote);
            } else {
              listeDs.push(objetNote);
            }

            totalPointsCumules += val * 2;
            totalCoefficientsCumules += 2;
          }
        });

        const moyenneMatiereIndicative =
          totalCoefficientsCumules > 0
            ? totalPointsCumules / totalCoefficientsCumules
            : 0;

        list.push({
          id: docSnap.id,
          ...d,

          interrosRaw: listeInterros,
          dsRaw: listeDs,
          dcRaw: listeDcs,

          noteDefinitiveSaved:
            boiteMoyenneExistante?.note !== undefined
              ? boiteMoyenneExistante.note
              : '',

          // NOUVEAUX CHAMPS :
          coefficientMatiereSaved:
            boiteMoyenneExistante?.coefficientMatiere !== undefined
              ? boiteMoyenneExistante.coefficientMatiere
              : '',

          moyennePondereeSaved:
            boiteMoyenneExistante?.moyennePonderee !== undefined
              ? boiteMoyenneExistante.moyennePonderee
              : '',

          appreciationSaved:
            boiteMoyenneExistante?.appreciation || '',

          signatureSaved:
            boiteMoyenneExistante?.signe || false,

          moyenneMatiereCalculee:
            Number(moyenneMatiereIndicative.toFixed(2))
        });
      });

      list.sort((a, b) =>
        (a.nom || '').localeCompare(b.nom || '')
      );

      setEleves(list);

      // Auto-sélection unifiée de l'étudiant.
      if (eleveSelectionne) {
        const misAJour = list.find(
          e => e.id === eleveSelectionne.id
        );

        if (misAJour) {
          setEleveSelectionne(misAJour);

          setNoteSaisieDefinitive(
            misAJour.noteDefinitiveSaved !== ''
              ? String(misAJour.noteDefinitiveSaved)
              : ''
          );

          setCoefficientMatiereSaisie(
            misAJour.coefficientMatiereSaved !== ''
              ? String(misAJour.coefficientMatiereSaved)
              : ''
          );

          setMoyennePondereeSaisie(
            misAJour.moyennePondereeSaved !== ''
              ? String(misAJour.moyennePondereeSaved)
              : ''
          );

          setAppreciationSaisie(
            misAJour.appreciationSaved || ''
          );

          setIsSigneByProf(
            misAJour.signatureSaved || false
          );
        }
      } else if (list.length > 0) {
        setEleveSelectionne(list[0]);

        setNoteSaisieDefinitive(
          list[0].noteDefinitiveSaved !== ''
            ? String(list[0].noteDefinitiveSaved)
            : ''
        );

        setCoefficientMatiereSaisie(
          list[0].coefficientMatiereSaved !== ''
            ? String(list[0].coefficientMatiereSaved)
            : ''
        );

        setMoyennePondereeSaisie(
          list[0].moyennePondereeSaved !== ''
            ? String(list[0].moyennePondereeSaved)
            : ''
        );

        setAppreciationSaisie(
          list[0].appreciationSaved || ''
        );

        setIsSigneByProf(
          list[0].signatureSaved || false
        );
      } else {
        setEleveSelectionne(null);
        setNoteSaisieDefinitive('');
        setCoefficientMatiereSaisie('');
        setMoyennePondereeSaisie('');
        setAppreciationSaisie('');
        setIsSigneByProf(false);
      }

      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribeEleves();
  }, [
    currentSchool,
    classeSelectionnee,
    trimestre,
    matiereActive
  ]);

  const handleChangementEleveSelect = (e) => {
    const targetId = e.target.value;
    const cible = eleves.find(
      el => el.id === targetId
    );

    setEleveSelectionne(cible || null);

    setNoteSaisieDefinitive(
      cible?.noteDefinitiveSaved !== undefined &&
      cible.noteDefinitiveSaved !== ''
        ? String(cible.noteDefinitiveSaved)
        : ''
    );

    setCoefficientMatiereSaisie(
      cible?.coefficientMatiereSaved !== undefined &&
      cible.coefficientMatiereSaved !== ''
        ? String(cible.coefficientMatiereSaved)
        : ''
    );

    setMoyennePondereeSaisie(
      cible?.moyennePondereeSaved !== undefined &&
      cible.moyennePondereeSaved !== ''
        ? String(cible.moyennePondereeSaved)
        : ''
    );

    setAppreciationSaisie(
      cible?.appreciationSaved || ''
    );

    setIsSigneByProf(
      cible?.signatureSaved || false
    );
  };

  const normaliserNombre = (value) => {
    const texte = String(value ?? '')
      .replace(',', '.')
      .trim();

    if (texte === '') return null;

    const nombre = Number(texte);

    return Number.isFinite(nombre)
      ? nombre
      : null;
  };

  /* =========================================================
     🚀 ENREGISTREMENT STRICT VIA updateDoc
     Le professeur doit obligatoirement renseigner :
       1. la moyenne de matière ;
       2. le coefficient de la matière ;
       3. la moyenne pondérée ;
       4. l'appréciation ;
       5. la signature.
  ========================================================= */
  const handleEnregistrerMoyenneArbitreeOnFirebase = async (e) => {
    e.preventDefault();

    if (!eleveSelectionne) {
      setToast({
        type: 'error',
        text: '⚠️ Aucun élève sélectionné.'
      });
      return;
    }

    const messageConfirmation =
      sessionStorage.getItem("sgs_confirm_lock_note") ||
      "⚠️ Êtes-vous sûr de vouloir arrêter et signer la note définitive de cet élève pour ce trimestre ?";

    if (!window.confirm(messageConfirmation)) {
      return;
    }

    setToast({
      type: '',
      text: ''
    });

    setIsSavingNote(true);

    try {
      // -----------------------------
      // 1. MOYENNE DE MATIÈRE
      // -----------------------------
      const moyenneMatiere =
        normaliserNombre(noteSaisieDefinitive);

      if (
        moyenneMatiere === null ||
        moyenneMatiere < 0 ||
        moyenneMatiere > 20
      ) {
        setToast({
          type: 'error',
          text:
            sessionStorage.getItem("sgs_error_invalid_note_range") ||
            "⚠️ La moyenne de matière doit être comprise entre 0 et 20."
        });

        setIsSavingNote(false);
        return;
      }

      // -----------------------------
      // 2. COEFFICIENT DE LA MATIÈRE
      // -----------------------------
      const coefficientMatiere =
        normaliserNombre(coefficientMatiereSaisie);

      if (
        coefficientMatiere === null ||
        coefficientMatiere <= 0
      ) {
        setToast({
          type: 'error',
          text:
            "⚠️ Le coefficient de la matière est obligatoire et doit être supérieur à 0."
        });

        setIsSavingNote(false);
        return;
      }

      // -----------------------------
      // 3. MOYENNE PONDÉRÉE
      // -----------------------------
      const moyennePonderee =
        normaliserNombre(moyennePondereeSaisie);

      if (
        moyennePonderee === null ||
        moyennePonderee < 0
      ) {
        setToast({
          type: 'error',
          text:
            "⚠️ La moyenne pondérée est obligatoire et doit être un nombre positif ou nul."
        });

        setIsSavingNote(false);
        return;
      }

      // -----------------------------
      // 4. APPRÉCIATION
      // -----------------------------
      if (!appreciationSaisie.trim()) {
        setToast({
          type: 'error',
          text:
            "⚠️ L'appréciation du professeur est obligatoire avant la transmission."
        });

        setIsSavingNote(false);
        return;
      }

      // -----------------------------
      // 5. SIGNATURE
      // -----------------------------
      if (!isSigneByProf) {
        setToast({
          type: 'error',
          text:
            "⚠️ Vous devez certifier et signer le relevé avant de le transmettre."
        });

        setIsSavingNote(false);
        return;
      }

      const cleTrimestre =
        `notes_trimestre_${trimestre}`;

      const studentRef =
        doc(db, "users", eleveSelectionne.id);

      const maintenant =
        new Date().toISOString();

      // IMPORTANT :
      // On enregistre exactement les valeurs saisies par le professeur.
      // Le PP et le bulletin pourront ensuite les récupérer depuis
      // users/{eleveId}.moyennes_matiere.notes_trimestre_X.{matiere}
      await updateDoc(studentRef, {
        [`moyennes_matiere.${cleTrimestre}.${matiereActive}`]: {
          note: moyenneMatiere,

          coefficientMatiere: coefficientMatiere,

          moyennePonderee: moyennePonderee,

          appreciation:
            appreciationSaisie.trim(),

          professeurId:
            user?.id ||
            user?.uid ||
            "",

          professeurName:
            user?.nomComplet ||
            user?.nom ||
            "PROFESSEUR",

          signe:
            isSigneByProf,

          statut:
            "transmise",

          trimestre:
            Number(trimestre),

          dateTransmission:
            maintenant,

          updatedAt:
            maintenant
        }
      });

      setToast({
        type: 'success',
        text:
          sessionStorage.getItem("sgs_toast_save_success") ||
          "🎯 Note, coefficient et moyenne pondérée enregistrés et transmis avec succès !"
      });

    } catch (err) {
      console.error(
        "Erreur d'écriture NoSQL :",
        err
      );

      setToast({
        type: 'error',
        text:
          sessionStorage.getItem("sgs_toast_save_error") ||
          "💥 Échec technique lors de la sauvegarde."
      });
    } finally {
      setIsSavingNote(false);

      setTimeout(() => {
        setToast({
          type: '',
          text: ''
        });
      }, 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <p className="text-xs font-black uppercase text-slate-500 tracking-widest animate-pulse">
          {sessionStorage.getItem("sgs_label_loading_bulletins") || "Chargement des notes et livrets..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-700 font-sans  sm:p-6 lg:p-8 text-left">
      <Header/>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* BANDEAU DE DIRECTION INTERACTIF */}
        <div className="bg-slate-900  p-6 rounded-2xl shadow-md">
          <div className="flex flex-col gap-4">

            <div>
              <h2 className="conf text-xl font-black uppercase tracking-tight">
                {sessionStorage.getItem("sgs_title_confrontation") || "Confrontation & Vérification des Notes"}
              </h2>

              <p className="conf-1 text-xs text-slate-400 mt-1">
                {sessionStorage.getItem("sgs_label_discipline") || "Discipline :"}
                <span className="text-orange-400 font-bold ml-1">
                  {matiereActive}
                </span>
              </p>
            </div>

            <div className="gridgroup  grid-cols-1 sm:grid-cols-3 gap-3 w-full">

              <select
                value={classeSelectionnee}
                onChange={(e) => {
                  setClasseSelectionnee(e.target.value);
                  setEleveSelectionne(null);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-xs font-black outline-none cursor-pointer"
              >
                {classesAutorisees.length === 0 ? (
                  <option value="">
                    Aucune classe assignée
                  </option>
                ) : (
                  classesAutorisees.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {String(c.nom).toUpperCase()}
                    </option>
                  ))
                )}
              </select>

              <select
                value={eleveSelectionne?.id || ''}
                onChange={handleChangementEleveSelect}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-xs font-black  outline-none cursor-pointer"
              >
                {eleves.length === 0 ? (
                  <option value="">
                    {sessionStorage.getItem("sgs_label_no_student_classe") || "Aucun élève enregistré"}
                  </option>
                ) : (
                  eleves.map((el) => (
                    <option
                      key={el.id}
                      value={el.id}
                    >
                      {`${el.nom} ${el.prenoms || ""}`.toUpperCase()}
                    </option>
                  ))
                )}
              </select>

              <select
                value={trimestre}
                onChange={(e) =>
                  setTrimestre(e.target.value)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-xs font-black text-orange-400 outline-none cursor-pointer"
              >
                <option value="1">
                  {sessionStorage.getItem("sgs_opt_t1") || "1er Trimestre"}
                </option>
                <option value="2">
                  {sessionStorage.getItem("sgs_opt_t2") || "2ème Trimestre"}
                </option>
                <option value="3">
                  {sessionStorage.getItem("sgs_opt_t3") || "3ème Trimestre"}
                </option>
              </select>

            </div>
          </div>
        </div>

        {/* TOAST POPUP NOTIFICATION */}
        {toast.text && (
          <div
            className={`p-4 rounded-xl shadow-md border-l-4 font-bold text-xs ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'bg-red-50 border-red-500 text-red-700'
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* CONTENEUR DE LA FICHE DE CONFRONTATION ET ENREGISTREMENT */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

          {eleveSelectionne ? (
            <div className="space-y-6 animate-fadeIn">

              {/* BLOC CIVIL */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">

                <div className="w-16 h-16 rounded-xl border-2 border-slate-200 bg-slate-200 overflow-hidden flex items-center justify-center">
                  {eleveSelectionne.photoBase64 ||
                  eleveSelectionne.photoUrl ||
                  eleveSelectionne.photo ? (
                    <img
                      src={
                        eleveSelectionne.photoBase64 ||
                        eleveSelectionne.photoUrl ||
                        eleveSelectionne.photo
                      }
                      alt=""
                      className="photoeleve w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">
                      👤
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-mono font-black text-indigo-600 tracking-wider">
                    {eleveSelectionne.matricule ||
                      eleveSelectionne.id}
                  </p>

                  <h4 className="text-base font-black uppercase text-slate-900">
                    {eleveSelectionne.nom}{' '}
                    {eleveSelectionne.prenoms || ""}
                  </h4>

                  <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                    {eleveSelectionne.classeNom ||
                      eleveSelectionne.classe}
                  </p>
                </div>

              </div>

              {/* GRILLE PAR BLOCS CHRONOLOGIQUES */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* BLOC INTERROGATIONS */}
                <div className="p-4 bg-slate-50/50 rounded-xl border flex flex-col justify-between">

                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">
                      {sessionStorage.getItem("sgs_label_interro_section") || "Interrogations (Coeff 1)"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {eleveSelectionne.interrosRaw.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic font-medium">
                        —
                      </p>
                    ) : (
                      eleveSelectionne.interrosRaw.map(
                        (item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-white border px-2 py-1 rounded font-mono text-[10px] shadow-3xs"
                          >
                            <span className="text-slate-400 font-medium text-[8px]">
                              {item.date}
                            </span><br/>

                            <span className="text-info font-black ml-2">
                              Note : {item.note}
                            </span>
                          </div>
                        )
                      )
                    )}
                  </div>

                </div>

                {/* BLOC DEVOIRS SURVEILLÉS */}
                <div className="p-4 bg-slate-50/50 rounded-xl border border-orange-100 flex flex-col justify-between">

                  <div>
                    <p className="text-[9px] font-black uppercase text-orange-500 tracking-wider mb-2">
                      {sessionStorage.getItem("sgs_label_ds_section") || "Devoirs Surveillés (Coeff 2)"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {eleveSelectionne.dsRaw.length === 0 ? (
                      <p className="text-[10px] text-orange-400 italic font-medium">
                        —
                      </p>
                    ) : (
                      eleveSelectionne.dsRaw.map(
                        (item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-white border border-orange-100 px-2 py-1 rounded font-mono text-[10px] shadow-3xs"
                          >
                            <span className="text-orange-400 font-medium text-[8px]">
                              {item.date}
                            </span><br/>

                            <span className="text-info font-black ml-2">
                              Note : {item.note}
                            </span>
                          </div>
                        )
                      )
                    )}
                  </div>

                </div>

                {/* BLOC DEVOIRS COMMUNS */}
                <div className="p-4 bg-slate-50/50 rounded-xl border border-indigo-100 flex flex-col justify-between">

                  <div>
                    <p className="text-[9px] font-black uppercase text-indigo-500 tracking-wider mb-2">
                      {sessionStorage.getItem("sgs_label_dc_section") || "Devoirs Communs (Coeff 2)"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {eleveSelectionne.dcRaw.length === 0 ? (
                      <p className="text-[10px] text-indigo-400 italic font-medium">
                        —
                      </p>
                    ) : (
                      eleveSelectionne.dcRaw.map(
                        (item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-white border border-indigo-100 px-2 py-1 rounded font-mono text-[10px] shadow-3xs"
                          >
                            <span className="text-indigo-400 font-medium text-[8px]">
                              {item.date}
                            </span><br/>

                            <span className="text-info font-black ml-2">
                              Note : {item.note}
                            </span>
                          </div>
                        )
                      )
                    )}
                  </div>

                </div>

              </div>

              {/* FORMULAIRE GLOBAL D'ARRET DE NOTE, COEFFICIENT,
                  MOYENNE PONDÉRÉE, APPRÉCIATION ET SIGNATURE */}
              <form
                onSubmit={
                  handleEnregistrerMoyenneArbitreeOnFirebase
                }
                className="p-6 bg-indigo-950  rounded-xl shadow-md space-y-5 font-mono mt-4"
              >

                <div className="flex flex-col gap-4 border-b border-indigo-900 pb-5">

                  <div className="text-left">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                      {sessionStorage.getItem("sgs_label_moy_matiere") || "Moyenne de Matière Trimestrielle"}
                    </h5>

                    <p className="text-[9px] text-indigo-400 mt-0.5 uppercase font-sans font-bold">
                      {`${sessionStorage.getItem("sgs_prefix_calculated") || "Moyenne indicative calculée :"} ${eleveSelectionne.moyenneMatiereCalculee.toFixed(2)} / 20`}
                    </p>
                  </div>

                  {/* 2 CHAMPS DEMANDÉS : COEFFICIENT + MOYENNE PONDÉRÉE */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                    <div className="flex flex-col gap-1.5">
                      <label className="pon text-[9px] font-black uppercase text-indigo-300">
                        Moyenne de matière
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={noteSaisieDefinitive}
                        onChange={(e) =>
                          setNoteSaisieDefinitive(e.target.value)
                        }
                        disabled={isSavingNote}
                        className="w-full p-2.5 rounded-lg border-0 bg-white text-slate-900 text-center text-sm font-black font-mono outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="pon text-[9px] font-black uppercase text-orange-300">
                        Coefficient de la matière
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex. 2"
                        value={coefficientMatiereSaisie}
                        onChange={(e) =>
                          setCoefficientMatiereSaisie(e.target.value)
                        }
                        disabled={isSavingNote}
                        className="w-full p-2.5 rounded-lg border-0 bg-white text-slate-900 text-center text-sm font-black font-mono outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="pon text-[9px] font-black uppercase text-emerald-300">
                        Moyenne pondérée
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex. 18.50"
                        value={moyennePondereeSaisie}
                        onChange={(e) =>
                          setMoyennePondereeSaisie(e.target.value)
                        }
                        disabled={isSavingNote}
                        className="w-full p-2.5 rounded-lg border-0 bg-white text-slate-900 text-center text-sm font-black font-mono outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                  </div>

                  <div className="bg-indigo-900/50 border border-indigo-800 rounded-lg p-3 text-[9px] text-indigo-200 font-sans">
                    <strong className="">
                      Transmission obligatoire :
                    </strong>{' '}
                    la moyenne de matière, le coefficient et la moyenne
                    pondérée doivent être renseignés avant l'arrêt et la
                    transmission de la note.
                  </div>

                </div>

                {/* ZONE DE SAISIE DE L'APPRECIATION */}
                <div className="flex flex-col gap-1.5 text-left">

                  <label className="text-[9px] font-black uppercase text-indigo-300">
                    {sessionStorage.getItem("sgs_label_appreciation_prof") || "Appréciation Pédagogique de l'Enseignant"}
                  </label>

                  <textarea
                    type="text"
                    value={appreciationSaisie}
                    onChange={(e) =>
                      setAppreciationSaisie(
                        e.target.value
                      )
                    }
                    disabled={isSavingNote}
                    placeholder={
                      sessionStorage.getItem("sgs_placeholder_appreciation") ||
                      "Saisir l'appréciation pour le bulletin..."
                    }
                    className="pon-r w-full px-4 py-6 text-danger border border-slate-700 rounded-xl bg-indigo-900/50 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 placeholder-indigo-400"
                  />

                </div>

                {/* ZONE DE SIGNATURE NUMERIQUE ET TRANSMISSION */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">

                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-[10px] font-black uppercase text-orange-400">

                    <input
                      type="checkbox"
                      checked={isSigneByProf}
                      onChange={(e) =>
                        setIsSigneByProf(
                          e.target.checked
                        )
                      }
                      disabled={isSavingNote}
                      className="w-4 h-4 rounded border-0 bg-indigo-900 text-orange-500 focus:ring-0 cursor-pointer"
                    />

                    <span>
                      {sessionStorage.getItem("sgs_label_signature_certif") ||
                        "✍️ Certifier et Signer ce Relevé"}
                    </span>

                  </label>

                  <button
                    type="submit"
                    disabled={
                      isSavingNote ||
                      !isSigneByProf ||
                      !noteSaisieDefinitive ||
                      !coefficientMatiereSaisie ||
                      !moyennePondereeSaisie ||
                      !appreciationSaisie.trim()
                    }
                    className="bglate-3 hover:bg-orange-600 disabled:bg-slate-700  font-black text-[10px] uppercase px-2 py-3 rounded-xl transition border-0 cursor-pointer shadow-sm w-full sm:w-auto"
                  >
                    {isSavingNote
                      ? (
                        sessionStorage.getItem("sgs_btn_saving") ||
                        "⏳ ..."
                      )
                      : (
                        sessionStorage.getItem("sgs_btn_lock_note") ||
                        "💾 Arrêter et Enregistrer les modifications"
                      )}
                  </button>

                </div>

              </form>

            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 italic font-medium">
              <span className="text-4xl block mb-2">
                🔍
              </span>

              {sessionStorage.getItem("sgs_label_no_selection_confront") ||
                "Veuillez sélectionner une classe et un élève pour confronter ses notes."}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MoyennesTrimestres;
