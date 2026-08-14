import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import html2pdf from 'html2pdf.js';

const EmploiDuTempsAdmin = () => {
  const { schoolId, schoolName } = useAuth();
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

  // --- ÉTATS CENTRALISÉS SAAS ---
  const [classes, setClasses] = useState([]);
  const [personnelEnseignant, setPersonnelEnseignant] = useState([]);
  const [planningsDeployes, setPlanningsDeployes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- ÉTATS FORMULAIRE CRÉNEAUX ENSEIGNANTS ---
  const [selectedProfId, setSelectedProfId] = useState('');
  const [selectedClasse, setSelectedClasse] = useState('');
  const [heureDebut, setHeureDebut] = useState('07:00');
  const [heureFin, setHeureFin] = useState('08:00');
  
  // Tableau de stockage temporaire de la journée du professeur
  const [creneauxTemporaires, setCreneauxTemporaires] = useState([]);
  const [sending, setSending] = useState(false);

  // --- ÉTAT DU COMPOSATEUR AUTOMATIQUE PAR CLASSE ---
  const [classeFiltreVisualisation, setClasseFiltreVisualisation] = useState('');

  // 🔄 ÉCOUTEUR RÉACTIF EN TEMPS RÉEL (onSnapshot Cloud NoSQL)
  useEffect(() => {
    if (!currentSchool) return;

    // A. Lecture live des structures de classes de l'école (Insensible à la casse)
    const qClasses = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      const classesTriees = list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setClasses(classesTriees);
      if (classesTriees.length > 0 && !selectedClasse) {
        setSelectedClasse(classesTriees[0].id);
      }
    });

    // B. Extraction et écoute de tous les professeurs actifs de l'établissement Connecté
    const qStaff = query(collection(db, "users"), where("role", "==", "professeur"), where("schoolId", "==", currentSchool));
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      const profsTries = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setPersonnelEnseignant(profsTries);
      if (profsTries.length > 0 && !selectedProfId) {
        setSelectedProfId(profsTries[0].id);
      }
    });

    // C. Lecture live de la collection globale des emplois du temps structurés
    const qPlannings = query(collection(db, "emplois_du_temps"), where("schoolId", "==", currentSchool));
    const unsubPlannings = onSnapshot(qPlannings, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setPlanningsDeployes(list);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubStaff();
      unsubPlannings();
    };
  }, [currentSchool]);

  // Synchronisation dynamique et automatique de la matière du professeur choisi
  const professeurSelectionne = useMemo(() => {
    return personnelEnseignant.find(p => p.id === selectedProfId) || null;
  }, [selectedProfId, personnelEnseignant]);

  const matiereEnseignee = professeurSelectionne?.matiere || professeurSelectionne?.specialite || 'Mathématiques';

  // ➕ ACTION 1 : AJOUTER UN CRÉNEAU CHRONOLOGIQUE À LA LISTE TEMPORAIRE
  const handleAjouterCreneauLocal = (e) => {
    e.preventDefault();
    if (!selectedProfId || !selectedClasse || !heureDebut || !heureFin) {
      alert("⚠️ Configuration incomplète. Veuillez renseigner tous les champs requis.");
      return;
    }

    const classeTarget = classes.find(c => c.id === selectedClasse);

    // Détection NoSQL des conflits et chevauchements d'heures locaux
    const conflitDHeure = creneauxTemporaires.some(c => 
      (heureDebut >= c.heureDebut && heureDebut < c.heureFin) || 
      (heureFin > c.heureDebut && heureFin <= c.heureFin)
    );

    if (conflitDHeure) {
      alert("❌ Conflit Horaire : Cet enseignant possède déjà un cours programmé sur cette plage.");
      return;
    }

    const nouveauCreneau = {
      idUniqueTemp: Math.random().toString(36).substring(2, 7),
      classeId: selectedClasse,
      nomClasse: classeTarget?.nom || selectedClasse.toUpperCase().replace(/_/g, ' '),
      heureDebut,
      heureFin
    };

    // Injection et tri chronologique immédiat
    setCreneauxTemporaires([...creneauxTemporaires, nouveauCreneau].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)));
  };

  // ❌ SUPPRIMER UN CRÉNEAU PARTICULIER DU TABLEAU AVANT SAUVEGARDE
  const handleRetirerCreneauLocal = (idTemp) => {
    setCreneauxTemporaires(creneauxTemporaires.filter(c => c.idUniqueTemp !== idTemp));
  };

  // 💾 ACTION 2 : ENREGISTRER DANS FIRESTORE ET GÉNÉRER LE RENDU PDF OFFICIEL
  const handleEnregistrerEtImprimerPDF = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!selectedProfId || creneauxTemporaires.length === 0) {
      setMessage({ type: 'error', text: 'La liste des cours programmés est vide. Ajoutez au moins un créneau.' });
      return;
    }

    setSending(true);
    const nomCompletProf = professeurSelectionne?.name || professeurSelectionne?.nom || 'Enseignant';

    const payloadEmploiTemps = {
      professeurId: selectedProfId,
      professeurName: nomCompletProf,
      matiere: matiereEnseignee,
      schoolId: currentSchool,
      createdAt: new Date().toISOString(),
      creneaux: creneauxTemporaires.map(({ classeId, nomClasse, heureDebut, heureFin }) => ({
        classeId,
        nomClasse,
        heureDebut,
        heureFin
      }))
    };

    try {
      // 1. Écriture Cloud
      await addDoc(collection(db, 'emplois_du_temps'), payloadEmploiTemps);

      setMessage({ 
        type: 'success', 
        text: `🎉 Réussite ! L'emploi du temps de M. ${nomCompletProf} a été déployé. Édition du binaire PDF en cours...` 
      });

      // 2. Génération automatique du document A4 Clean
      const elementImprimable = document.createElement('div');
      elementImprimable.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a; background: #ffffff;">
          <table style="width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
            <tr>
              <td>
                <h2 style="font-size: 14px; text-transform: uppercase; margin: 0; color: #475569;">${schoolName?.toUpperCase() || 'EDULINK SYSTEM'}</h2>
                <h1 style="font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 4px 0 0 0;">Planning Général du Personnel Enseignant</h1>
              </td>
            </tr>
          </table>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 25px; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>PROV_ID :</strong> <span style="font-family: monospace;">${selectedProfId}</span></p>
            <p style="margin: 4px 0;"><strong>ENSEIGNANT TITULAIRE :</strong> M. ${nomCompletProf.toUpperCase()}</p>
            <p style="margin: 4px 0;"><strong>DISCIPLINE ENSEIGNÉE :</strong> ${matiereEnseignee.toUpperCase()}</p>
            <p style="margin: 4px 0;"><strong>ANNEE SCOLAIRE :</strong> 2025 - 2026</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase;">
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Régime Horaires</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Structure Pédagogique Assignée</th>
              </tr>
            </thead>
            <tbody>
              ${payloadEmploiTemps.creneaux.map(c => `
                <tr>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #c2410c;">⏰ ${c.heureDebut} — ${c.heureFin}</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #1e3a8a;">🏛️ ${c.nomClasse.toUpperCase()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: right; font-size: 10px; font-style: italic; color: #94a3b8;">[ Emploi du Temps Officiel Archivé par la Direction ]</div>
        </div>
      `;

      const options = {
        margin: 10,
        filename: `EMPLOI_DU_TEMPS_PROF_${nomCompletProf.replace(/\s+/g, '_')}.pdf`,
        html2canvas: { scale: 2.5, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(options).from(elementImprimable).save();

      // Réinitialisation après insertion réussie
      setCreneauxTemporaires([]);

    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "💥 Échec lors de la synchronisation au serveur." });
    } finally {
      setSending(false);
    }
  };

  const handleSupprimerPlanningGlobal = async (idDoc) => {
    if (!window.confirm("Voulez-vous révoquer et détruire ce planning ?")) return;
    try {
      await deleteDoc(doc(db, "emplois_du_temps", idDoc));
      setMessage({ type: 'success', text: "🗑️ Fiche d'emploi du temps révoquée du cloud." });
    } catch (err) { console.error(err); }
  };

    // =========================================================================
  // 3. 📊 COMPOSATEUR AUTOMATIQUE PAR CLASSE (CORRECTION DE CASSE ET NORMALISATION)
  // =========================================================================
   const emploiDuTempsClasseReconstitue = useMemo(() => {
    if (!classeFiltreVisualisation) return [];
    
    const cibleIdNettoye = classeFiltreVisualisation.toString().trim().toLowerCase();
    const list = [];

    planningsDeployes.forEach(p => {
      if (Array.isArray(p.creneaux)) {
        p.creneaux.forEach(c => {
          const creneauClasseIdNettoye = (c.classeId || '').toString().trim().toLowerCase();

          // 🟢 Match flexible insensible à la présence de suffixes de séries (A, C, D, A1...)
          if (
            creneauClasseIdNettoye === cibleIdNettoye ||
            creneauClasseIdNettoye.includes(cibleIdNettoye) ||
            cibleIdNettoye.includes(creneauClasseIdNettoye)
          ) {
            list.push({
              professeurName: p.professeurName,
              matiere: p.matiere,
              heureDebut: c.heureDebut,
              heureFin: c.heureFin,
              parentDocumentId: p.id
            });
          }
        });
      }
    });

    return list.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  }, [classeFiltreVisualisation, planningsDeployes]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">
        Ouverture de la centrale de planification...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen text-gray-700 animate-fadeIn">
      
      {/* Alertes d'états */}
      {message.text && (
        <div className={`p-4 mb-6 rounded-xl text-xs font-bold text-left border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* SECTION 1 : LOGIQUE DE CONFECTION INTERACTIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* BLOC DES CRITÈRES ET DES CHOIX */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm h-fit text-left">
          <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider border-b pb-3 mb-4">
            🔐 Confection Horaires par Enseignant
          </h3>
          
          <form onSubmit={handleAjouterCreneauLocal} className="space-y-4 text-xs font-bold">
            <div>
              <label className="block text-gray-400 uppercase mb-1">1. Enseignant Titulaire *</label>
              <select value={selectedProfId} onChange={(e) => { setSelectedProfId(e.target.value); setCreneauxTemporaires([]); }} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white font-bold cursor-pointer" required>
                <option value="">-- Sélectionner l'enseignant --</option>
                {personnelEnseignant.map(p => (
                  <option key={p.id} value={p.id}>
                    👨‍🏫 Enseignant : {p.name || p.nom} ({p.matiere || 'Discipline'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">Matière Enseignée</label>
              <input type="text" value={matiereEnseignee} className="w-full bg-gray-100 text-gray-500 border rounded-lg p-2.5 outline-none font-bold cursor-not-allowed" readOnly />
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">2. Sélectionner la Classe *</label>
              <select value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer" disabled={!selectedProfId} required>
                <option value="">-- Assigner à la classe --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>🏛️ {c.nom}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 uppercase mb-1">⏰ De (Heure) *</label>
                <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2 font-mono" disabled={!selectedProfId} />
              </div>
              <div>
                <label className="block text-gray-400 uppercase mb-1">⏰ À (Heure) *</label>
                <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2 font-mono" disabled={!selectedProfId} />
              </div>
            </div>

            <button type="submit" disabled={!selectedProfId} className="w-full bg-slate-900 text-orange-400 hover:bg-slate-800 p-3 rounded-lg text-xs font-black uppercase tracking-wider transition disabled:opacity-50">
              ➕ Ajouter ce créneau
            </button>
          </form>
        </div>

        {/* BLOC TABLEAU DE CONSTITUTION EN DIRECT DES COURS */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border shadow-sm text-left">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">
            📋 Feuille de Route Journalière du Professeur Sélectionné
          </h3>
          
          {creneauxTemporaires.length === 0 ? (
            <div className="py-20 text-center text-xs font-medium text-gray-400 bg-gray-50 border border-dashed rounded-xl">
              Ajoutez des plages de cours à l'aide du bouton à gauche pour monter l'emploi du temps de l'enseignant.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase font-black text-[10px] tracking-wider">
                    <th className="p-3">Créneaux horaires</th>
                    <th className="p-3">Classe assignée</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {creneauxTemporaires.map((c) => (
                    <tr key={c.idUniqueTemp} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-orange-600">⏰ {c.heureDebut} — {c.heureFin}</td>
                      <td className="p-3 font-bold text-gray-900 uppercase">🏛️ {c.nomClasse}</td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => handleRetirerCreneauLocal(c.idUniqueTemp)} className="text-red-500 font-bold hover:underline">Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button type="button" onClick={handleEnregistrerEtImprimerPDF} disabled={sending} className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-6 py-3 rounded-lg tracking-widest shadow-md transition disabled:opacity-50">
                  {sending ? "🔄 Écriture NoSQL..." : "💾 Enregistrer & Imprimer la Fiche PDF"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          SECTION 2 : COMPOSATEUR AUTOMATIQUE PAR CLASSE (FUSION EN DIRECT)
          ========================================================================= */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm text-left mt-8">
        <h2 className="text-base font-black text-blue-900 uppercase border-b pb-3 mb-6 flex items-center gap-2">
          📊 Compositeur Automatique : Emploi du Temps Reconstitué par Classe
        </h2>

        <div className="space-y-6">
          <div className="max-w-xs text-xs font-bold">
            <label className="block text-gray-400 uppercase mb-1">Choisir une classe pour assembler ses cours</label>
            <select value={classeFiltreVisualisation} onChange={(e) => setClasseFiltreVisualisation(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer font-bold">
              <option value="">-- Sélectionner la classe cible --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>🏛️ {c.nom}</option>
              ))}
            </select>
          </div>

          {!classeFiltreVisualisation ? (
            <p className="text-xs text-gray-400 italic py-8 bg-slate-50 text-center rounded-xl border border-dashed">
              💡 Sélectionnez une structure de classe ci-dessus pour fusionner en temps réel les plages horaires de vos professeurs.
            </p>
          ) : emploiDuTempsClasseReconstitue.length === 0 ? (
            <p className="text-xs text-red-600 font-black py-8 bg-red-50 text-center rounded-xl border border-dashed border-red-200 uppercase">
              ⚠️ Aucun cours n'a encore été planifié ou rattaché à cette classe.
            </p>
       ) : (
  <div className="border rounded-xl overflow-hidden bg-white max-w-4xl shadow-sm">
    <div className="p-4 bg-blue-50 border-b flex justify-between items-center text-xs">
      <span className="font-black text-blue-950 uppercase">
        📅 Emploi du Temps Assemblé : {classes.find(c => c.id === classeFiltreVisualisation)?.nom.toUpperCase()}
      </span>
      <span className="px-2.5 py-1 bg-blue-200 text-blue-800 text-[10px] font-black rounded uppercase">
        Généré en Temps Réel
      </span>
    </div>
    <table className="w-full text-left text-xs border-collapse">
      <thead>
        <tr className="bg-slate-900 text-white uppercase font-black text-[10px] tracking-wider">
          <th className="p-3">Heures Cours</th>
          <th className="p-3">Discipline / Matière</th>
          <th className="p-3">Professeur Titulaire</th>
          <th className="p-3 text-center">Action Admin</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 font-medium">
        {emploiDuTempsClasseReconstitue.map((cours, idx) => (
          <tr key={idx} className="hover:bg-slate-50 transition">
            <td className="p-3 font-mono font-bold text-orange-600">⏰ {cours.heureDebut} — {cours.heureFin}</td>
            <td className="p-3 font-black text-blue-900 uppercase">📚 {cours.matiere}</td>
            <td className="p-3 text-gray-800 font-bold">👨‍🏫 M. {cours.professeurName}</td>
            <td className="p-3 text-center">
              <button type="button" onClick={() => handleSupprimerPlanningGlobal(cours.parentDocumentId)} className="text-red-500 hover:underline font-bold">
                Révoquer
              </button>
            </td>
          </tr>
        ))}
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
