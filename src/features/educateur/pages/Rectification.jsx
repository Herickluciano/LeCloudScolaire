// src/features/educateur/pages/arbitrages/Rectification.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/api';
// 🟢 RECTIFICATION DES ACTIONS NOSQL : Ajout de query, collection, fields atomiques
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../../../pages/Header';

const Rectification = () => {
  const { user, schoolId } = useAuth();

  // 🎯 ZERO VALEUR EN DUR : Extraction dynamique de la session de l'établissement
  const currentSchool = (user?.schoolId || schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();
  const nomEducateur = `${user?.nom || ''} ${user?.prenoms || ''}`.trim() || 'Éducateur Vie Scolaire';

  // --- ÉTATS DYNAMIQUES DE FLUX ET CONTRÔLE ---
  const [ongletActif, setOngletActif] = useState('ELEVES');
  const [fichesAppels, setFichesAppels] = useState([]);
  const [pointagesProfesseurs, setPointagesProfesseurs] = useState([]);
  const [listeProfesseurs, setListeProfesseurs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');

  // --- ÉTATS DES FORMULAIRES D'ARBITRAGE ---
  const [ficheSelectionnee, setFicheSelectionnee] = useState(null);
  const [nomEleveCible, setNomEleveCible] = useState('');
  const [nouveauStatut, setNouveauStatut] = useState('present');
  const [motifAction, setMotifAction] = useState('');

  // États du formulaire Professeur
  const [modeActionProf, setModeActionProf] = useState(''); // 'AJOUT_COMPLET' ou 'CORRECTION_LIGNE'
  const [profSelectionne, setProfSelectionne] = useState(null);
  const [profIdForm, setProfIdForm] = useState('');
  const [classeSelectionneeProf, setClasseSelectionneeProf] = useState('');
  const [dateSaisieProf, setDateSaisieProf] = useState(new Date().toLocaleDateString('fr-FR'));
  const [heureArriveeProf, setHeureArriveeProf] = useState('07:00');
  const [heureDepartProf, setHeureDepartProf] = useState('08:00');

  // Helper pour calculer le volume d'heures de vacation rectifiées
  const calculerHeuresVacations = (arr, dep) => {
    try {
      const [hA, mA] = arr.split(':').map(Number);
      const [hD, mD] = dep.split(':').map(Number);
      const diff = (hD * 60 + mD) - (hA * 60 + mA);
      return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0;
    } catch (e) {
      return 0;
    }
  };

  // 🔄 ÉCOUTEUR RÉACTIF DOUBLE FLUX EN TEMPS RÉEL (SANS ACTUALISATION PAGE)
  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    // A. FLUX TEMPS RÉEL DIRECT : Journal d'assiduité des élèves (registre_appels)
    const qAppels = query(collection(db, "registre_appels"), where("schoolId", "==", currentSchool));
    const unsubAppels = onSnapshot(qAppels, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      // Tri chronologique inverse (le plus récent en premier)
      setFichesAppels(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    });

    // B. 🔥 CLÉ DU FIX FLUX LIVE : Aligné sur la collection immatriculée "registre_pointages"
    const qPointages = query(collection(db, "registre_pointages"), where("schoolId", "==", currentSchool));
    const unsubPointages = onSnapshot(qPointages, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setPointagesProfesseurs(list.sort((a, b) => (b.datePointage || b.updatedAt || '').localeCompare(a.datePointage || a.updatedAt || '')));
      setLoading(false);
    }, (err) => {
      console.error("Erreur d'interconnexion NoSQL :", err);
      setLoading(false);
    });

    // C. CHARGEMENT COMPLÉMENTAIRE DE SÉCURITÉ POUR LES PROFESSEURS ET CLASSES (SÉLECTEURS)
    const qProfs = query(collection(db, "users"), where("schoolId", "==", currentSchool));
    const unsubProfs = onSnapshot(qProfs, (snapshot) => {
      const listProfs = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (String(data.id || data.matricule).startsWith('PROF_')) {
          listProfs.push({ id: d.id, ...data });
        }
      });
      setListeProfesseurs(listProfs.sort((a, b) => (a.nom || '').localeCompare(b.nom || '')));
      if (listProfs.length > 0 && !profIdForm) setProfIdForm(listProfs[0].id);
    });

    const qClasses = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const listCl = [];
      snapshot.forEach((d) => listCl.push({ id: d.id, ...d.data() }));
      setClasses(listCl.sort((a, b) => (a.nom || '').localeCompare(b.nom || '')));
      if (listCl.length > 0 && !classeSelectionneeProf) setClasseSelectionneeProf(listCl[0].id);
    });

    return () => {
      unsubAppels();
      unsubPointages();
      unsubProfs();
      unsubClasses();
    };
  }, [currentSchool, profIdForm, classeSelectionneeProf]);

  // Préparation des fiches élèves
  const preparerRectificationEleve = (fiche, nomEleve, typeInit) => {
    setFicheSelectionnee(fiche);
    setNomEleveCible(nomEleve);
    setNouveauStatut(typeInit === 'absent' ? 'present' : 'absent');
    setModeActionProf('');
  };

  // Préparation du panneau professeur
  const preparerOuvrirPanneauProf = (mode, ligne = null) => {
    setFicheSelectionnee(null);
    setModeActionProf(mode);
    if (mode === 'CORRECTION_LIGNE' && ligne) {
      setProfSelectionne(ligne);
      setDateSaisieProf(ligne.date || '');
      setHeureArriveeProf(ligne.heureArrivee || '07:00');
      setHeureDepartProf(ligne.heureDepart || '08:00');
    } else {
      setProfSelectionne(null);
    }
  };

  // 🚀 TRANSACTION TECHNIQUE : TRAITEMENT ET VALIDATION DES ARBITRAGES CLOUD
  const handleSoumettreArbitrageGeneral = async (e) => {
    e.preventDefault();
    if (!motifAction.trim()) return alert("❌ Cause administrative absente.");
    setProcessing(true);

    try {
      // --- CAS 1 : RECTIFICATION ASSIDUITÉ ÉLÈVE ---
      if (ficheSelectionnee) {
        let absentsNet = Array.isArray(ficheSelectionnee.elevesAbsents) ? [...ficheSelectionnee.elevesAbsents] : [];
        let retardsNet = Array.isArray(ficheSelectionnee.elevesRetards) ? [...ficheSelectionnee.elevesRetards] : [];

        if (nouveauStatut === 'present') {
          absentsNet = absentsNet.filter(n => n !== nomEleveCible);
          retardsNet = retardsNet.filter(n => n !== nomEleveCible);
        } else if (nouveauStatut === 'retard') {
          absentsNet = absentsNet.filter(n => n !== nomEleveCible);
          if (!retardsNet.includes(nomEleveCible)) retardsNet.push(nomEleveCible);
        } else if (nouveauStatut === 'absent') {
          retardsNet = retardsNet.filter(n => n !== nomEleveCible);
          if (!absentsNet.includes(nomEleveCible)) absentsNet.push(nomEleveCible);
        }

        await updateDoc(doc(db, "registre_appels", ficheSelectionnee.id), {
          elevesAbsents: absentsNet,
          elevesRetards: retardsNet,
          rectifiePar: nomEducateur,
          motifModification: motifAction.trim(),
          rectifiedAt: new Date().toISOString()
        });
        setFeedback("🎉 Rectification d'assiduité élève traitée avec succès !");
        setFicheSelectionnee(null);
      }

      // --- CAS 2 : SÉANCE COMPLÈTE MANQUANTE OU OUBLIÉE ---
      else if (modeActionProf === 'AJOUT_COMPLET') {
        const enseignantObj = listeProfesseurs.find(p => p.id === profIdForm);
        const heuresCalculees = calculerHeuresVacations(heureArriveeProf, heureDepartProf);

        await addDoc(collection(db, "registre_pointages"), {
          schoolId: currentSchool,
          classeId: classeSelectionneeProf,
          date: dateSaisieProf,
          datePointage: new Date().toISOString(),
          heureArrivee: heureArriveeProf,
          heureDepart: heureDepartProf,
          heuresEffectuees: heuresCalculees,
          matiere: enseignantObj?.matiereEnseignee || "Discipline",
          professeurId: profIdForm,
          professeurName: enseignantObj ? `${enseignantObj.nom || ''} ${enseignantObj.prenoms || ''}`.trim() : "Enseignant",
          statutValidation: 'valide',
          statut: 'cloture',
          terminalHardwareId: "VIE_SCOLAIRE_RECTIFICATION_MANUELLE",
          terminalSecurise: true,
          rectifiePar: nomEducateur,
          motifModification: motifAction.trim(),
          updatedAt: new Date().toISOString()
        });
        setFeedback("🎉 Vacation manquante insérée et créditée avec succès !");
        setModeActionProf('');
      }

      // --- CAS 3 : CORRECTION DE LIGNES D'OUBLIS D'ARRIVÉE OU DE DÉPART PROF ---
      else if (modeActionProf === 'CORRECTION_LIGNE' && profSelectionne) {
        const heuresCalculees = calculerHeuresVacations(heureArriveeProf, heureDepartProf);
        
        await updateDoc(doc(db, "registre_pointages", profSelectionne.id), {
          heureArrivee: heureArriveeProf,
          heureDepart: heureDepartProf,
          heuresEffectuees: heuresCalculees,
          statut: 'cloture',
          statutValidation: 'valide',
          rectifiePar: nomEducateur,
          motifModification: motifAction.trim(),
          updatedAt: new Date().toISOString()
        });
        setFeedback("🎉 Fiche d'émargement professeur redressée au vert !");
        setModeActionProf('');
        setProfSelectionne(null);
      }
     // ... (Suite et fin du composant à partir de handleSoumettreArbitrageGeneral)
      setMotifAction('');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      console.error(err);
      setFeedback(`❌ Erreur technique : ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs font-bold text-orange-500 animate-pulse uppercase tracking-widest">
        Initialisation de la console centrale d'arbitrages...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto sm:p-6 lg:p-8 font-sans text-gray-700 text-left bg-white min-h-screen w-full select-none animate-fadeIn">
      <Header/>
      {/* ACTION COMMANDE RETOUR */}
      <div className="mb-4">
        <Link to="/educateur/promotions" className="signretour-1 w-full sm:w-auto inline-flex justify-center items-center text-xs font-bold bg-white hover:bg-gray-100 text-gray-700  py-1 rounded-xl  transition shadow-2xs no-underline">
          ⬅️ Retour Console Éducateur
        </Link>
      </div>

      {/* EN-TÊTE DU COMMANDEMENT DE LA VIE SCOLAIRE */}
      <div className="bgwhite  -gray-200 rounded-2xl p-4 sm:p-5 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ">
        <div className="text-left">
          <span className="gouv  text-orange-700 font-extrabold text-[9px] uppercase px-2.5 py-1 rounded-md  -orange-200">Gouvernance Discipline & Vacations</span>
          <h2 className="textlg sm:text-xl font-black text-slate-900 tracking-tight mt-1 uppercase">Justifications & Rectifications Globales</h2>
          <p className="textxs text-slate-400 font-medium mt-0.5">Régulez les dossiers d'assiduité des élèves et redressez les oublis de pointages de cours des enseignants en temps réel.</p>
        </div>
      </div>

      {/* BLOC DES FILTRES ET ONGLET D'INDEXATION */}
      <div className="grouprec flex gap-2 mb-6">
        <button type="button" onClick={() => { setOngletActif('ELEVES'); setFicheSelectionnee(null); setModeActionProf(''); }} className={`px-4 py-2.5 rounded-xl border  font-black uppercase bg-success transition -0 cursor-pointer ${ongletActif === 'ELEVES' ? 'bg-slate-900  shadow-md' : 'bg-white  -gray-200 text-slate-600'}`}>🧑‍🎓 Absences Élèves</button>
        <button type="button" onClick={() => { setOngletActif('PROFESSEURS'); setFicheSelectionnee(null); setModeActionProf(''); }} className={`px-4 py-2.5 border rounded-xl font-black uppercase bg-success transition -0 cursor-pointer ${ongletActif === 'PROFESSEURS' ? 'bg-slate-900  shadow-md' : 'bg-white  -gray-200 text-slate-600'}`}>👨‍🏫 Vacations Enseignants</button>
      </div>

      {feedback && <div className="mb-4 p-3 bg-slate-900 text-orange-400 font-bold rounded-xl -l-4 -orange-500 text-xs animate-pulse text-left ">{feedback}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* FORMULAIRE DE TRAITEMENT (GAUCHE) */}
        <div className="bg-slate-900  p-4 sm:p-5 rounded-2xl  -slate-800 shadow-xl h-fit">
          <h3 className="pano text-xs font-black text-orange-400 uppercase tracking-wider -b -slate-800 pb-2 mb-4">⚙️ Panneau des rectifications et des  mises à jour</h3>
          
          {!ficheSelectionnee && !modeActionProf && (
            <div className="textcenter py-8 text-slate-400 font-bold text-xs">
              <p className="mb-4">Aucune ligne n'est en cours de traitement.</p>
              {ongletActif === 'PROFESSEURS' && (
                <button type="button" onClick={() => preparerOuvrirPanneauProf('AJOUT_COMPLET')} className="bg-orange-500 hover:bg-orange-600  font-black text-[10px] uppercase px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md -0">➕ Injecter un cours oublié</button>
              )}
            </div>
          )}

          {/* FORMULAIRE ÉLÈVE CHARGÉ */}
          {ficheSelectionnee && (
            <form onSubmit={handleSoumettreArbitrageGeneral} className="space-y-4 text-xs font-bold text-left">
              <input type="text" value={`ÉLÈVE : ${nomEleveCible}`} className="w-full bg-slate-950  -slate-800 rounded-xl p-3 text-orange-400 font-black outline-none" disabled readOnly />
              <div>
                <label className="block text-slate-400 uppercase mb-1">Nouveau Statut</label>
                <select value={nouveauStatut} onChange={(e) => setNouveauStatut(e.target.value)} className="w-full bg-slate-950  -slate-800 rounded-xl p-3 font-bold  outline-none focus:-orange-500 cursor-pointer">
                  {ficheSelectionnee.elevesAbsents?.includes(nomEleveCible) && <option value="present">✓ Marquer Présent (Rétablir le compteur d'heures)</option>}
                  {ficheSelectionnee.elevesAbsents?.includes(nomEleveCible) && <option value="retard">⏳ Commuter en Retard Simple</option>}
                  {ficheSelectionnee.elevesRetards?.includes(nomEleveCible) && <option value="absent">● Commuter en Absent (Pénaliser d'une heure)</option>}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 uppercase mb-1">Motif administratif du changement (Obligatoire) *</label>
                <textarea rows="4" placeholder="Ex: Certificat médical d'absence visé par le proviseur..." value={motifAction} onChange={(e) => setMotifAction(e.target.value)} className="w-full bg-slate-950  -slate-800 rounded-xl p-3 text-slate-200 font-medium resize-none focus:-orange-500 outline-none" required />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={processing} className="w-full bg-orange-500 hover:bg-orange-600  font-black py-3 rounded-xl uppercase tracking-wider transition cursor-pointer -0">{processing ? "Sauvegarde..." : "💾 Rectifier"}</button>
                <button type="button" onClick={() => setFicheSelectionnee(null)} className="bg-slate-800 px-4 rounded-xl -0 font-black  cursor-pointer">X</button>
              </div>
            </form>
          )}

          {/* FORMULAIRE DOUBLE PRIVILÈGES ENSEIGNANTS CHARGÉ */}
          {modeActionProf && (
            <form onSubmit={handleSoumettreArbitrageGeneral} className="formgauche  space-y-4 text-xs font-bold text-left">
              <span className="text-[9px] bg-purple-950  -purple-800 text-purple-400 font-black px-2 py-0.5 rounded uppercase">Ajustement Vacation Enseignant</span><br/>
              
              {modeActionProf === 'AJOUT_COMPLET' ? (
                <div>
                  <label className="block text-slate-400 uppercase mb-1">Sélectionner l'Enseignant concerné *</label><br/>
                  <select value={profIdForm} onChange={(e) => setProfIdForm(e.target.value)} className="border w-full bg-slate-950  -slate-800 rounded-xl p-3  cursor-pointer outline-none">
                    {listeProfesseurs.map(p => (
                      <option key={p.id} value={p.id}>{p.name || p.nom} ({p.matiereEnseignee || "Cours"})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <input type="text" value={`PROF : ${profSelectionne?.professeurName || profSelectionne?.profName}`} className="border boder-purple-200 w-full bg-slate-950  -slate-800 rounded-xl p-3 text-purple-400 font-black outline-none" disabled readOnly />
              )}

              {modeActionProf === 'AJOUT_COMPLET' && (
                <div>
                  <label className="block text-slate-400 uppercase mb-1">Classe d'Affectation *</label><br/>
                  <select value={classeSelectionneeProf} onChange={(e) => setClasseSelectionneeProf(e.target.value)} className="border boder-purple-200 w-full bg-slate-950  -slate-800 rounded-xl p-3  cursor-pointer outline-none">
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{String(c.nom || c.name || '').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="seance block text-slate-400 uppercase mb-1">Date Séance</label><br/>
                  <input type="text" value={dateSaisieProf} onChange={(e) => setDateSaisieProf(e.target.value)} className="border boder-purple-200 w-full bg-slate-950  -slate-800 rounded-xl p-3  font-mono outline-none" />
                </div>
                <div>
                  <label className="seance block text-slate-400 uppercase mb-1">Arrivée (HH:MM)</label><br/>
                  <input type="text" value={heureArriveeProf} onChange={(e) => setHeureArriveeProf(e.target.value)} className="border boder-purple-200 w-full bg-slate-950  -slate-800 rounded-xl p-3  font-mono outline-none" />
                </div>
              </div>

              <div>
                <label className="seance block text-slate-400 uppercase mb-1">Départ (HH:MM) - Clôture d'Oubli</label><br/>
                <input type="text" value={heureDepartProf} onChange={(e) => setHeureDepartProf(e.target.value)} className="border boder-purple-200 w-full bg-slate-950  -slate-800 rounded-xl p-3  font-mono outline-none" />
              </div>
                <div>
                <label className="seance block text-slate-400 uppercase mb-1">Motif de la modification (Obligatoire) *</label><br/>
                <textarea rows="4" placeholder="Ex: Oubli de pointage départ certifié par le surveillant..." value={motifAction} onChange={(e) => setMotifAction(e.target.value)} className="border boder-purple-200 w-full bg-slate-950  -slate-800 rounded-xl p-3 text-slate-200 font-medium resize-none focus:-orange-500 outline-none" required />
              </div>

              <div className="flexgap">
                <button type="submit" className="signretour-2 w-full bg-orange-500 hover:bg-orange-600  font-black py-1 rounded-xl uppercase tracking-wider transition cursor-pointer -0">
                  💾 Sauvegarder Vacation
                </button>
                <button type="button" onClick={() => setModeActionProf('')} className="signretour-3 bg-slate-800 px-4 rounded-xl -0 font-black text-slate-400 cursor-pointer">
                  X Annuler
                </button>
              </div>
            </form>
          )}
        </div>

        {/* INDEXATIONS EN DIRECT DE LA VIE SCOLAIRE (DROITE) */}
        <div className="lg:col-span-2 space-y-4 text-left">
          
          {/* COMPARTIMENT A : ASSIDUITÉ DES APPRENANTS */}
          {ongletActif === 'ELEVES' && (
            <>
              <h3 className="textsm font-black text-slate-900 uppercase -b pb-2 tracking-tight">📜 Journal d'Assiduité des Élèves</h3>
              {fichesAppels.length === 0 ? (
                <div className="textocun py-10 text-gray-400 font-bold bg-white  -dashed rounded-2xl">
                  ⚠️ Aucune fiche d'appel reçue.
                </div>
              ) : (
                <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1 scrollbar-none">
                  {fichesAppels.map((fiche) => {
                    const abs = fiche.elevesAbsents && fiche.elevesAbsents.length > 0;
                    const ret = fiche.elevesRetards && fiche.elevesRetards.length > 0;
                    if (!abs && !ret) return null;
                    return (
                      <div key={fiche.id} className="bg-white  -gray-200 rounded-2xl p-4 shadow-3xs hover:-gray-300 transition animate-fadeIn">
                        <div className="flex justify-between items-start flex-wrap gap-2 -b -gray-100 pb-2 mb-3">
                          <div>
                            <span className="bg-slate-900  font-mono font-black text-[9px] uppercase px-2 py-0.5 rounded  -slate-800 mr-2">
                              Classe : {String(fiche.classeNom || fiche.classeId).toUpperCase()}
                            </span>
                            <span className="text-slate-500 font-bold text-xs uppercase">{fiche.matiere} ➔ M/Mme {fiche.professeurNom}</span>
                          </div>
                          <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50  -purple-100 px-2.5 py-1 rounded-xl">📅 {fiche.date}</span>
                        </div>
                        <div className="space-y-2 text-left">
                          {abs && (
                            <div>
                              <p className="text-[9px] text-red-500 font-black uppercase mb-1">● Liste des Élèves Absents :</p>
                              <div className="flex flex-wrap gap-1.5">
                                {fiche.elevesAbsents.map((nom, i) => (
                                  <div key={i} className="inline-flex items-center gap-2 bg-red-50  -red-100 text-red-900 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase">
                                    <span>{nom}</span>
                                    <button type="button" onClick={() => preparerRectificationEleve(fiche, nom, 'absent')} className="text-[9px] bg-white text-red-700  -gray-200 font-black px-1.5 py-0.5 rounded cursor-pointer transition hover:bg-red-600 hover:">Justifier</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {ret && (
                            <div className="mt-2">
                              <p className="text-[9px] text-amber-600 font-black uppercase mb-1">⏳ Liste des Élèves en Retard :</p>
                              <div className="flex flex-wrap gap-1.5">
                                {fiche.elevesRetards.map((nom, i) => (
                                  <div key={i} className="inline-flex items-center gap-2 bg-amber-50  -amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase">
                                    <span>{nom}</span>
                                    <button type="button" onClick={() => preparerRectificationEleve(fiche, nom, 'retard')} className="text-[9px] bg-white text-amber-700  -gray-200 font-black px-1.5 py-0.5 rounded cursor-pointer transition hover:bg-amber-500 hover:">Modifier</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* COMPARTIMENT B : RELEVÉS DES PROFESSEURS */}
          {ongletActif === 'PROFESSEURS' && (
            <>
              <h3 className="textsm font-black text-slate-900 uppercase -b pb-2 tracking-tight">📜 Relevé des Émargements NoSQL Enseignants</h3>
              {pointagesProfesseurs.length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-bold bg-white  -dashed rounded-2xl">⚠️ Aucun pointage enseignant répertorié.</div>
              ) : (
                <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1 scrollbar-none">
                  {pointagesProfesseurs.map((pt) => {
                    const estEnCours = pt.statut === 'en_cours' || !pt.heureDepart;
                    return (
                      <div key={pt.id} className={` formdroite rounded-2xl p-4 shadow-3xs transition  ${estEnCours ? '-l-4 -l-orange-500' : ''}`}>
                        <div className="flex justify-between items-start flex-wrap gap-2 -b -gray-100 pb-2 mb-3">
                          <div className="text-left">
                            <h4 className="text-xs font-black text-slate-900 uppercase">M/Mme {pt.professeurName || pt.profName}</h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Matière : {pt.matiere} ➔ Classe : <span className="uppercase font-bold text-slate-600 font-mono">{pt.classeId?.replace(`${currentSchool}_`, '').toUpperCase()}</span></p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${estEnCours ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {estEnCours ? "⏳ Oubli Départ ?" : "● Clôturé"}
                            </span>
                            <button type="button" onClick={() => preparerOuvrirPanneauProf('CORRECTION_LIGNE', pt)} className="bg-slate-900 hover:bg-slate-800  text-danger font-black uppercase px-2.5 py-1 rounded-md transition cursor-pointer -0 ">Redresser / Rectifier</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-slate-600 bg-slate-50 p-2 rounded-xl  -gray-100/60">
                          <div><span className="text-[9px] text-slate-400 uppercase font-black block">Date</span> {pt.date}</div>
                          <div><span className="text-[9px] text-slate-400 uppercase font-black block">Arrivée</span> {pt.heureArrivee}</div>
                          <div><span className="text-[9px] text-slate-400 uppercase font-black block">Départ</span> {pt.heureDepart || 'En cours'}</div>
                        </div>

                        <div className="mt-3 flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                          <span>Volume Comptabilisé : <strong className="text-red-600 font-mono text-xs">{pt.heuresEffectuees || 0} H</strong></span>
                          {pt.rectifiePar && <span className="text-slate-400 font-medium normal-case italic">⚙️ Ajusté par la Vie Scolaire</span>}
                        </div>
                        {pt.rectifiePar && (
                          <div className="mt-2 bg-purple-50 p-2 rounded-lg text-[9px] text-purple-900 font-semibold  -purple-100/40 leading-relaxed text-left">
                            <strong>Motif d'action enregistré :</strong> {pt.motifModification}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Rectification;
