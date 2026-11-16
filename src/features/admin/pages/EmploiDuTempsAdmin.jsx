// src/features/admin/pages/EmploiDuTempsAdmin.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import html2pdf from 'html2pdf.js';
import Header from '../../../pages/Header';

const EmploiDuTempsAdmin = () => {
  const { schoolId, schoolName } = useAuth();

  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_moderne_gagnoa'
  )
    .trim()
    .toLowerCase();

  const LES_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  // ============================================================
  // ÉTATS COMPOSANTS
  // ============================================================
  const [classes, setClasses] = useState([]);
  const [personnelEnseignant, setPersonnelEnseignant] = useState([]);
  const [planningsDeployes, setPlanningsDeployes] = useState([]);
  
  // Fiche école 100% dynamique extraite du cloud (Aucune valeur en dur)
  const [metaSchool, setMetaSchool] = useState({
    pays: '',
    devise: '',
    ministere: '',
    anneeScolaire: '',
    nomEtablissement: ''
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Sélections formulaires
  const [selectedProfId, setSelectedProfId] = useState('');
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedJour, setSelectedJour] = useState('Lundi');
  const [heureDebut, setHeureDebut] = useState('07:00');
  const [heureFin, setHeureFin] = useState('08:00');

  // Grille temporaire locale
  const [creneauxTemporaires, setCreneauxTemporaires] = useState([]);
  const [sending, setSending] = useState(false);

  // Filtre de visualisation principale
  const [classeFiltreVisualisation, setClasseFiltreVisualisation] = useState('');

  // ============================================================
  // CHARGEMENT SYNCHRONISÉ EN TEMPS RÉEL (FIRESTORE CLOUD)
  // ============================================================
  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    // A. CHARGEMENT DES CLASSES
    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', currentSchool));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const list = [];
      snap.forEach((d) => { list.push({ id: d.id, ...d.data() }); });
      const sorted = list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setClasses(sorted);
      if (sorted.length > 0 && !selectedClasse) setSelectedClasse(sorted[0].id);
    });

    // B. CHARGEMENT DES ENSEIGNANTS (PROFS & PROFS PRINCIPAUX)
    const qStaff = query(
      collection(db, 'users'),
      where('schoolId', '==', currentSchool),
      where('role', 'in', ['professeur', 'prof_principal'])
    );
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      const list = [];
      snap.forEach((d) => { list.push({ id: d.id, ...d.data() }); });
      const sorted = list.sort((a, b) => {
        const nomA = a.name || a.nom || a.id || '';
        const nomB = b.name || b.nom || b.id || '';
        return nomA.localeCompare(nomB);
      });
      setPersonnelEnseignant(sorted);
      if (sorted.length > 0 && !selectedProfId) setSelectedProfId(sorted[0].id);
    });

    // C. CHARGEMENT DES ATTRIBUTIONS ENREGISTRÉES DIRECTEMENT DE DE "emplois_du_temps"
    const qPlannings = query(collection(db, 'emplois_du_temps'), where('schoolId', '==', currentSchool));
    const unsubPlannings = onSnapshot(qPlannings, (snap) => {
      const list = [];
      snap.forEach((d) => { list.push({ id: d.id, ...d.data() }); });
      setPlanningsDeployes(list);
      setLoading(false);
    }, (error) => {
      console.error('Erreur écoute des emplois du temps :', error);
      setLoading(false);
    });

    // D. CHARGEMENT DES METADONNÉES DE L'ÉCOLE
    const docSchoolRef = doc(db, 'schools', currentSchool);
    const unsubSchool = onSnapshot(docSchoolRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMetaSchool({
          pays: data.pays || '',
          devise: data.devise || '',
          ministere: data.ministere || '',
          anneeScolaire: data.anneeScolaire || data.annee || '',
          nomEtablissement: data.nom || data.name || schoolName || currentSchool.replace(/_/g, ' ')
        });
      }
    }, (err) => {
      console.error("Erreur d'écoute de la fiche école :", err);
    });

    return () => { 
      unsubClasses(); 
      unsubStaff(); 
      unsubPlannings(); 
      unsubSchool();
    };
  }, [currentSchool, schoolName]);

  // ============================================================
  // ANALYSE DES COMPOSANTS ET MEMOS EXTRACTION STRICTE
  // ============================================================
  const professeurSelectionne = useMemo(() => {
    return personnelEnseignant.find((p) => p.id === selectedProfId) || null;
  }, [selectedProfId, personnelEnseignant]);

  const matiereEnseignee = useMemo(() => {
    if (!professeurSelectionne) return '';
    return String(professeurSelectionne.matiereEnseignee || professeurSelectionne.matiere || professeurSelectionne.specialite || '').trim();
  }, [professeurSelectionne]);

  const nomCompletProf = useMemo(() => {
    if (!professeurSelectionne) return '';
    if (professeurSelectionne.name) return professeurSelectionne.name;
    const pnom = professeurSelectionne.nom || '';
    const pprenom = professeurSelectionne.prenoms || professeurSelectionne.prenom || '';
    return `${pnom} ${pprenom}`.trim() || professeurSelectionne.id;
  }, [professeurSelectionne]);

  const handleChangerProfesseur = (e) => setSelectedProfId(e.target.value);

  const handleChangerClasseCible = (e) => {
    const classeId = e.target.value;
    setSelectedClasse(classeId);
    
    // Recherche tolérante multi-champs
    const existant = planningsDeployes.find(
      (p) => String(p.classeId).toLowerCase().trim() === classeId.toLowerCase().trim() ||
             (p.creneaux && p.creneaux.some((c) => String(c.classeId).toLowerCase().trim() === classeId.toLowerCase().trim()))
    );
    setCreneauxTemporaires(existant && Array.isArray(existant.creneaux) ? existant.creneaux : []);
  };

  // ============================================================
  // ACTION : AJOUT CRÉNEAU EN LOCAL
  // ============================================================
  const handleAjouterCreneauLocal = (e) => {
    e.preventDefault();

    if (!selectedProfId || !matiereEnseignee) {
      alert("⚠️ Sélectionnez un enseignant possédant une discipline.");
      return;
    }
    if (heureFin <= heureDebut) {
      alert("❌ L'heure de fin doit être supérieure à l'heure de début.");
      return;
    }

    const conflitSalle = creneauxTemporaires.some((c) => {
      return c.jour === selectedJour && heureDebut < c.heureFin && heureFin > c.heureDebut;
    });
    if (conflitSalle) {
      alert(`❌ Conflit Classe : Un cours est déjà planifié le ${selectedJour} sur cette plage horaire.`);
      return;
    }

    const conflitProfLocal = creneauxTemporaires.some((c) => {
      return c.professeurId === selectedProfId && c.jour === selectedJour && heureDebut < c.heureFin && heureFin > c.heureDebut;
    });
    const conflitProfDistant = planningsDeployes.some((p) => {
      if (!Array.isArray(p.creneaux)) return false;
      return p.creneaux.some((c) => {
        return c.professeurId === selectedProfId && c.jour === selectedJour && heureDebut < c.heureFin && heureFin > c.heureDebut;
      });
    });

    if (conflitProfLocal || conflitProfDistant) {
      alert(`❌ Conflit Enseignant : ${nomCompletProf} est déjà occupé le ${selectedJour} à cette heure !`);
      return;
    }

    const classeTarget = classes.find((c) => c.id === selectedClasse);
    const nomClasseAffiche = classeTarget?.nom || classeTarget?.classeNom || selectedClasse;

    const nouveauCreneau = {
      idUniqueTemp: Math.random().toString(36).substring(2, 9),
      jour: selectedJour,
      heureDebut,
      heureFin,
      matiere: matiereEnseignee,
      professeurId: selectedProfId,
      professeurName: nomCompletProf,
      classeId: selectedClasse,
      nomClasse: nomClasseAffiche
    };

    const triJours = (a, b) => {
      const idxA = LES_JOURS.indexOf(a.jour);
      const idxB = LES_JOURS.indexOf(b.jour);
      if (idxA !== idxB) return idxA - idxB;
      return a.heureDebut.localeCompare(b.heureDebut);
    };

    setCreneauxTemporaires([...creneauxTemporaires, nouveauCreneau].sort(triJours));
    setMessage({ type: 'success', text: '➕ Créneau ajouté à l’organisation locale.' });
    setTimeout(() => setMessage({ type: '', text: '' }), 2000);
  };

  const handleRetirerCreneauLocal = (idTemp) => {
    setCreneauxTemporaires(creneauxTemporaires.filter((c) => c.idUniqueTemp !== idTemp));
  };

  // ============================================================
  // ENREGISTREMENT GLOBAL & EXPORTATION PDF
  // ============================================================
  const handleEnregistrerEtImprimerPDF = async (e) => {
    e.preventDefault();
    if (!selectedClasse || creneauxTemporaires.length === 0) return;

    setSending(true);
    const classeTarget = classes.find((c) => c.id === selectedClasse);
    const nomClasseAffiche = classeTarget?.nom || classeTarget?.classeNom || selectedClasse;

    const cleanDocId = String(selectedClasse).replace(/[^a-zA-Z0-9_]/g, '').toUpperCase();

    const payload = {
      classeId: selectedClasse,
      classeNom: nomClasseAffiche,
      schoolId: currentSchool,
      createdAt: new Date().toISOString(), // Stockage de la date d'enregistrement
      creneaux: creneauxTemporaires
    };

       try {
      await setDoc(doc(db, 'emplois_du_temps', `DOC_EDT_${cleanDocId}`), payload);
      setMessage({ type: 'success', text: `🎉 Enregistrement cloud réussi pour la classe ${nomClasseAffiche}.` });

      const element = document.createElement('div');
      element.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a; background: #ffffff;">
          <div style="width: 100%; text-align: center; -top: 4px solid #7c3aed; padding-top: 16px;">
            <h1 style="font-size: 22px; font-weight: 900; tracking-tight: -0.025em; margin: 12px 0 0 0; text-transform: uppercase;">
              🏛️ ${String(metaSchool.nomEtablissement).toUpperCase()} 🏛️
            </h1>
            <div style="margin-top: 4px;">
              ${metaSchool.pays ? `<p style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #1f2937; letter-spacing: 0.05em; margin: 4px 0 0 0;">${metaSchool.pays}</p>` : ''}
              ${metaSchool.devise ? `<p style="font-size: 10px; color: #9ca3af; font-style: italic; font-weight: 500; margin: 2px 0 0 0;">${metaSchool.devise}</p>` : ''}
              ${metaSchool.ministere ? `<p style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #7c3aed; max-w: 600px; margin: 8px auto 0 auto; line-height: 1.4;">${metaSchool.ministere}</p>` : ''}
            </div>
            <div style="margin-top: 16px; padding-top: 16px; -top: 1px solid #f3f4f6;">
              <h2 style="font-size: 16px; font-weight: 900; color: #111827; text-transform: uppercase; margin: 0;">
                Emploi du Temps Consolidé — ${nomClasseAffiche.toUpperCase()}
              </h2>
              ${metaSchool.anneeScolaire ? `<p style="font-size: 10px; color: #9ca3af; margin: 4px 0 0 0; font-family: monospace; text-transform: uppercase;">Session Académique : ${metaSchool.anneeScolaire}</p>` : ''}
            </div>
          </div>

          <table style="width: 100%; -collapse: collapse; font-size: 11px; text-align: left; margin-top: 25px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase;">
                <th style="padding: 10px; : 1px solid #cbd5e1;">Jour</th>
                <th style="padding: 10px; : 1px solid #cbd5e1;">Horaires</th>
                <th style="padding: 10px; : 1px solid #cbd5e1;">Discipline / Enseignement</th>
                <th style="padding: 10px; : 1px solid #cbd5e1;">Enseignant Mandaté</th>
              </tr>
            </thead>
            <tbody>
              ${creneauxTemporaires.map((c) => `
                <tr>
                  <td style="padding: 10px; : 1px solid #cbd5e1; font-weight: 900; text-transform: uppercase; color: #7c3aed;">${c.jour}</td>
                  <td style="padding: 10px; : 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #c2410c;">${c.heureDebut} - ${c.heureFin}</td>
                  <td style="padding: 10px; : 1px solid #cbd5e1; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">${c.matiere}</td>
                  <td style="padding: 10px; : 1px solid #cbd5e1; color: #475569;">👨‍🏫 ${c.professeurName}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      const options = {
        margin: 10,
        filename: `EDT_${nomClasseAffiche.replace(/\s+/g, '_')}.pdf`,
        html2canvas: { scale: 2.5, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(options).from(element).save();
      setCreneauxTemporaires([]);
    } catch (err) {
      console.error(err);
    } {
      setSending(false);
    }
  };

  const handleSupprimerPlanningGlobal = async (idDoc) => {
    if (!window.confirm('Voulez-vous supprimer définitivement cet emploi du temps ?')) return;
    try {
      await deleteDoc(doc(db, 'emplois_du_temps', idDoc));
      setMessage({ type: 'success', text: "🗑️ L'emploi du temps a été supprimé du cloud." });
    } catch (err) {
      console.error(err);
    }
  };

  const planningsFiltresVisualisation = useMemo(() => {
    if (!classeFiltreVisualisation) return planningsDeployes;
    const cible = String(classeFiltreVisualisation).trim().toLowerCase();
    return planningsDeployes.filter((p) => {
      const matchDirect = String(p.classeId).trim().toLowerCase() === cible;
      const matchTableau = p.creneaux && p.creneaux.some((c) => String(c.classeId).trim().toLowerCase() === cible);
      return matchDirect || matchTableau;
    });
  }, [planningsDeployes, classeFiltreVisualisation]);

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Initialisation du planificateur central...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen text-gray-700 animate-fadeIn text-left">
     <Header/>
      {message.text && (
        <div className={`p-4 mb-6 rounded-xl text-xs font-bold  ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 -emerald-200' : 'bg-red-50 text-red-700 -red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PANEL CONFECTION */}
        <div className="bg-white p-5 rounded-2xl  shadow-sm h-fit">
          <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider -b pb-3 mb-4 confection">Confection d'un Emploi du Temps</h3>
           <h2 className="tiretemp text-lg font-black text-gray-900 uppercase">Recrutement & Gestion des Équipes RH</h2>
          <form onSubmit={handleAjouterCreneauLocal} className="formtemp space-y-4 text-xs font-bold">
          
          <div className='genreclasse form-floating mb-3'>
              <label className="block text-gray-400 uppercase mb-1">1. Sélectionner la classe cible *</label>
              <select value={selectedClasse} onChange={handleChangerClasseCible} className="form-select  w-full border border-gray-300  rounded-lg p-2.5 outline-none font-bold cursor-pointer bg-white" required>
                <option selected value="">-- Choisir une classe --</option>
                {classes.map((c) => (<option key={c.id} value={c.id}> {c.nom || c.classeNom}</option>))}
              </select>
            </div>

            <div className='genrejour form-floating mb-3'>
              <label className="block text-gray-400 uppercase mb-1">2. Jour de la semaine *</label>
              <select value={selectedJour} onChange={(e) => setSelectedJour(e.target.value)} className="form-select w-full border border-gray-300  rounded-lg p-2.5 outline-none text-purple-700 font-black cursor-pointer bg-white">
                {LES_JOURS.map((j) => (<option key={j} value={j}> {j.toUpperCase()}</option>))}
              </select>
            </div>

            <div className='genreenseignant form-floating mb-3'>
              <label className="block text-gray-400 uppercase mb-1">3. Enseignant Mandaté *</label>
              <select value={selectedProfId} onChange={handleChangerProfesseur} className="form-select w-full border border-gray-300  rounded-lg p-2.5 outline-none font-bold cursor-pointer bg-white" required>
                <option value="">-- Sélectionner l'enseignant --</option>
                {personnelEnseignant.map((p) => {
                  const labelProf = p.name || `${p.nom || ''} ${p.prenoms || p.prenom || ''}`.trim() || p.id;
                  return <option key={p.id} value={p.id}> {labelProf} ({p.matiereEnseignee || p.matiere || 'Discipline'})</option>;
                })}
              </select>
            </div>

           <div className='genrematiere form-floating mb-3'>
              <label className="block text-gray-400 uppercase mb-1">Matière Enseignée</label>
              <input type="text" value={matiereEnseignee || 'Aucune matière détectée'} className="form-select w-full border rounded-lg p-2.5 outline-none bg-gray-100 text-gray-600 font-black uppercase" readOnly />
            </div>

            <div className="reveil grid grid-cols-2 gap-3">
               <div className='genrearrive form-floating mb-3'>
                <label className="block text-gray-400 uppercase mb-1">⏰ De *</label>
                <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="form-select w-full border border-gray-300  rounded-lg p-2 font-mono text-center bg-white" />
              </div>
              
              <div className='genredepart form-floating mb-3'>
                <label className="block text-gray-400 uppercase mb-1">⏰ À *</label>
                <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} className="form-select w-full border border-gray-300  rounded-lg p-2 font-mono text-center bg-white" />
              </div>
            </div>

            <button type="submit" disabled={!selectedProfId || !matiereEnseignee} className="btntemp w-full bg-slate-900 text-orange-400 hover:bg-slate-800 p-3 rounded-lg text-white font-black uppercase tracking-wider transition disabled:opacity-50 cursor-pointer -0">
              ➕ Insérer ce créneau à la classe
            </button>
          </form>
        </div>

        {/* GRILLE ASSEMBLAGE TEMPORAIRE */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl  shadow-sm">
          <h3 className="feuille text-xs font-black text-gray-400 uppercase tracking-wider -b pb-3 mb-4">Feuille de Route en Assemblage de la Classe</h3>
          {creneauxTemporaires.length === 0 ? (
            <div className="py-20 text-center text-xs font-medium text-gray-400 bg-gray-50  -dashed rounded-xl">
              Ajoutez les créneaux successifs (Jours + Heures) de tous les professeurs pour cette classe. Enregistrez l'ensemble à la fin.
            </div>
          ) : (
            <div className=" rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="table-responsive overflow-x-auto">
                <table className="table align-middle w-full text-left text-xs -collapse">
                    <thead>
                    <tr className="bg-slate-900 text-white uppercase font-black text-[10px] tracking-wider">
                      <th className="p-3">Jour</th>
                      <th className="p-3">Horaires</th>
                      <th className="p-3">Discipline</th>
                      <th className="p-3">Enseignant Mandaté</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {creneauxTemporaires.map((c) => (
                      <tr key={c.idUniqueTemp} className="hover:bg-slate-50 transition font-bold">
                        <td className="p-3 text-purple-700 uppercase font-black">{c.jour}</td>
                        <td className="p-3 font-mono text-orange-600">⏰ {c.heureDebut} — {c.heureFin}</td>
                        <td className="p-3 text-blue-900 uppercase">📚 {c.matiere}</td>
                        <td className="p-3 text-gray-800 uppercase font-medium">👨‍🏫 {c.professeurName}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRetirerCreneauLocal(c.idUniqueTemp)}
                            className="text-danger font-bold hover:underline bg-transparent -0 cursor-pointer"
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-gray-50 -t flex justify-end">
                <button
                  type="button"
                  onClick={handleEnregistrerEtImprimerPDF}
                  disabled={sending}
                  className="btntemps  hover:bg-purple-700 text-white font-black text-xs uppercase  rounded-lg tracking-widest shadow-md transition -0 cursor-pointer"
                >
                  {sending ? '🔄 Écriture...' : '💾 Enregistrer la classe complète & exporter PDF'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          REGISTRE DES DEPLOYMENTS
      ====================================================== */}
      <div className="bg-white p-6 rounded-2xl  shadow-sm text-left mt-8">
        <h2 className="text-base font-black text-blue-900 uppercase -b pb-3 mb-6">
           Registre des Emplois du Temps Actifs par Classe
        </h2>
        <div className="space-y-6">
         <div className='genretoutes form-floating mb-3'>
            <select
              value={classeFiltreVisualisation}
              onChange={(e) => setClasseFiltreVisualisation(e.target.value)}
              className="form-select border w-full bg-gray-50  rounded-lg p-2.5 outline-none font-black text-purple-700 cursor-pointer"
            >
              <option value="">-- Toutes les classes actives --</option>
              {classes.map((cl) => (
                <option key={cl.id} value={cl.id}>🏛️ {cl.nom || cl.classeNom}</option>
              ))}
            </select>
          </div>

          {planningsFiltresVisualisation.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-8 bg-slate-50 text-center rounded-xl  -dashed">
              Aucun emploi du temps n'est actuellement déployé pour cette sélection.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {planningsFiltresVisualisation.map((planning) => {
                const aDesCreneaux = planning.creneaux && planning.creneaux.length > 0;
                const nomClasseFiche = planning.classeNom || (aDesCreneaux ? planning.creneaux[0].nomClasse : '') || planning.classeId || 'Division Spécifiée';
                const dateFiche = planning.createdAt || planning.updatedAt || '';

                return (
                  <div key={planning.id} className="revoque rounded-xl p-4 bg-white shadow-2xs relative font-bold text-xs">
                    <button
                      type="button"
                      onClick={() => handleSupprimerPlanningGlobal(planning.id)}
                      className="laclass absolute top-4 right-4 text-danger bold hover:underline bg-transparent -0 cursor-pointer font-black text-[11px]"
                    >
                      ✕ Révoquer
                    </button>
                    <div className="mb-2 -b pb-1.5 text-left">
                      <p className="laclasse text-purple-900 font-black text-sm uppercase">🏛️ Classe : {nomClasseFiche}</p>
                      <p className="dernier text-[9px] text-gray-400 uppercase font-mono mt-0.5">
                        Dernière mise à jour : {dateFiche ? new Date(dateFiche).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    <div className="planing space-y-1.5 mt-3 text-left">
                      {planning.creneaux && planning.creneaux.map((cr, i) => (
                        <div key={i} className="p-2.5 bg-gray-50 rounded-lg flex justify-between items-center text-[11px] font-bold  -gray-100/60">
                          <span className="text-gray-900 uppercase">
                            <span className="text-purple-700 font-extrabold font-sans mr-1">[{cr.jour || 'Lundi'}] </span>  📚 {cr.matiere} <span className="text-gray-400 font-sans font-medium">({cr.professeurName || 'Titulaire'})</span>
                          </span>
                          <span className="heure text-info font-mono  bg-white  px-1.5 py-0.5 rounded shadow-3xs shrink-0">
                                {cr.heureDebut}  -  {cr.heureFin}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default EmploiDuTempsAdmin;
