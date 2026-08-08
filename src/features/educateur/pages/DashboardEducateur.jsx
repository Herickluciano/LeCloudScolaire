import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, onSnapshot, addDoc, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// =========================================================================
// 🏛️ INTERCEPTEUR DE RECEPTION DE L'ÉDUCATEUR (ORDRES ADMIN & INSTRUCTIONS)
// =========================================================================
const ReceptionInstructionsAdmin = ({ currentSchool, idEducateurLogge, userRole }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool || !idEducateurLogge) return;
    const q = query(collection(db, "notifications"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if ((d.schoolId || '').trim().toLowerCase() === currentSchool.trim().toLowerCase()) {
          if (d.destinataireId === idEducateurLogge || d.audience === 'all' || d.audience === 'educateur') {
            list.push({ id: docSnap.id, ...d });
          }
        }
      });
      list.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      setMessages(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentSchool, idEducateurLogge, userRole]);

  if (loading) return <div className="p-4 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Chargement des directives...</div>;

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-xs text-center text-gray-400 py-8 border border-dashed rounded-xl italic bg-white font-medium">📥 Aucun ordre ou directive de la direction reçu.</p>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="bg-white p-4 rounded-xl border text-xs font-medium space-y-2 animate-fadeIn text-left">
            <div className="flex justify-between items-center border-b pb-1 font-bold text-gray-500">
              <span className="text-red-600">🏛️ DIRECTION CENTRALE</span>
              <span>{m.date || "Récemment"}</span>
            </div>
            <p className="text-gray-800 leading-relaxed font-bold">"{m.message || m.corps}"</p>
          </div>
        ))
      )}
    </div>
  );
};

// =========================================================================
// 👮 COMPOSANT SOUVERAIN : DASHBOARD ÉDUCATEUR GENERAL DE PROMOTION
// =========================================================================
const DashboardEducateur = () => {
  // 🟢 EXTRACTION : Récupération de la méthode logout globale du système SaaS
  const { user, schoolId, schoolName, logout } = useAuth();
  const navigate = useNavigate();

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();
  const idEducateur = user?.matricule || user?.id || 'EDUC_UNKNOWN';
  const promoResponsable = (user?.assigned_promotion || user?.promotion || '5eme').trim().toLowerCase();

  // --- STRUCTURE DE NAVIGATION PAR PANNEAUX ---
  const [activeTab, setActiveSubTab] = useState('dashboard_global'); 

  // --- MATRICES CLOUD ---
  const [elevesPromo, setElevesPromo] = useState([]);
  const [pointagesRaw, setPointagesRaw] = useState([]); 
  const [fichesAppels, setFichesAppels] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- REDACTION INTERNE ---
  const [sujetCirculaire, setSujetCirculaire] = useState('');
  const [corpsCirculaire, setContenuCirculaire] = useState('');
  const [sending, setSending] = useState(false);
  const [msgStatus, setStatusMessage] = useState({ type: '', text: '' });
  
  const [eleveSelectionneConseil, setEleveSelectionneConseil] = useState(null);
  const [avisConduiteConseil, setAvisConduiteConseil] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // 🟢 DECONNEXION METIER : Purge des caches de session et routage vers la mire de connexion
  const handleSessionLogout = async () => {
    if (window.confirm("🚪 Souhaitez-vous fermer votre session de supervision Vie Scolaire ?")) {
      try {
        if (logout) await logout();
        sessionStorage.clear();
        localStorage.removeItem('sgs_owner_root_key');
        navigate('/');
      } catch (err) {
        console.error(err);
        navigate('/');
      }
    }
  };

  const handleForcerRetourBureau = () => {
    setSujetCirculaire('');
    setContenuCirculaire('');
    setStatusMessage({ type: '', text: '' });
    setActiveSubTab('dashboard_global');
    setRefreshKey(prev => prev + 1); 
  };

  // 🔄 ÉCOUTEUR MULTI-FLUX UNIFIÉ EN TEMPS RÉEL
  useEffect(() => {
    if (!currentSchool || !promoResponsable) return;

    const qUsers = query(collection(db, "users"), where("role", "==", "eleve"));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if ((d.schoolId || '').trim().toLowerCase() === currentSchool && (d.promotion || '').trim().toLowerCase() === promoResponsable) {
          const sourceNotes = d.notes || {};
          let totalPointsCumules = 0;
          Object.values(sourceNotes).forEach(notesArray => {
            if (Array.isArray(notesArray)) {
              notesArray.forEach(val => totalPointsCumules += (parseFloat(val) || 0));
            }
          });
          list.push({ id: docSnap.id, totalPointsCumules, ...d });
        }
      });
      list.sort((a, b) => b.totalPointsCumules - a.totalPointsCumules);
      setElevesPromo(list);
    });

    const qPointages = query(collection(db, "pointages_professeurs"));
    const unsubPointages = onSnapshot(qPointages, (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const schoolCleanDoc = (d.schoolId || '').trim().toLowerCase();
        const classCleanDoc = (d.classeId || '').trim().toLowerCase();

        if (schoolCleanDoc === currentSchool && classCleanDoc.startsWith(promoResponsable)) {
          list.push({ id: docSnap.id, ...d });
        }
      });
      setPointagesRaw(list);
    });

    const qAppels = query(collection(db, "registre_appels"));
    const unsubAppels = onSnapshot(qAppels, (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if ((d.schoolId || '').trim().toLowerCase() === currentSchool && (d.promotion || '').trim().toLowerCase() === promoResponsable) {
          list.push({ id: docSnap.id, ...d });
        }
      });
      setFichesAppels(list);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubPointages();
      unsubAppels();
    };
  }, [currentSchool, promoResponsable]);

  // =========================================================================
  // 🥇 ALGORITHME COMPTABLE : FUSION ET CUMUL DES HEURES DE COURS PROFESSEURS
  // =========================================================================
  const genererBilanPointagesCumules = () => {
    const dictionnaireComptable = {};

    pointagesRaw.forEach((p) => {
      const profKey = `${p.profId || 'INCONNU'}_${p.classeId || '5eme_1'}_${p.matiere || 'Général'}`;
      let dureeSession = parseFloat(p.heuresEffectuees) || 0;
      
      if (dureeSession === 0 && p.heureArrivee && p.heureDepart && p.statut === 'cloture') {
        const [hArrivee, mArrivee] = p.heureArrivee.split(':').map(Number);
        const [hDepart, mDepart] = p.heureDepart.split(':').map(Number);
        const deltaMinutes = (hDepart * 60 + mDepart) - (hArrivee * 60 + mArrivee);
        if (deltaMinutes > 0) dureeSession = parseFloat((deltaMinutes / 60).toFixed(2));
      } else if (p.statut === 'en_cours' && dureeSession === 0) {
        dureeSession = 1.0; 
      }

      if (!dictionnaireComptable[profKey]) {
        dictionnaireComptable[profKey] = {
          profId: p.profId || "PROF",
          profName: p.profName || "Enseignant",
          matiere: p.matiere || "Mathématiques",
          classeId: p.classeId || "5eme_1",
          totalHeuresCumulees: 0,
          nombreSessions: 0,
          derniereMiseAJour: p.date || "Aujourd'hui"
        };
      }

      dictionnaireComptable[profKey].totalHeuresCumulees += dureeSession;
      dictionnaireComptable[profKey].nombreSessions += 1;
    });

    return Object.values(dictionnaireComptable);
  };

  const listePointagesConsolides = genererBilanPointagesCumules();

  const handleTransmettreRapportRHToAdmin = async () => {
    if (listePointagesConsolides.length === 0) return alert("❌ Aucun cumul d'heures disponible.");
    try {
      let rapportTexte = `BILAN COMPTABLE DE SUIVI RH - PROMO ${promoResponsable.toUpperCase()}\n`;
      listePointagesConsolides.forEach(p => {
        rapportTexte += `- ${p.profName} (${p.matiere}) en ${p.classeId?.toUpperCase()} : ${p.totalHeuresCumulees.toFixed(2)} Heures totales (${p.nombreSessions} cours effectués).\n`;
      });

      await addDoc(collection(db, "notifications"), {
        schoolId: currentSchool,
        expediteurId: idEducateur,
        expediteurNom: `VIE SCOLAIRE : ÉDUCATEUR PROMO ${promoResponsable.toUpperCase()}`,
        destinataireId: "ADMIN",
        destinataireNom: "DIRECTION GENERALE",
        message: rapportTexte,
        type: "reclamation",
        createdAt: new Date().toISOString()
      });
      alert("⚡ Rapport financier des heures cumulées transmis sur le bureau de l'Admin !");
    } catch (err) { console.error(err); }
  };

   const handleEnregistrerAppreciationConseil = async (e) => {
    e.preventDefault();
    if (!eleveSelectionneConseil || !avisConduiteConseil.trim()) return;
    try {
      await updateDoc(doc(db, "users", eleveSelectionneConseil.id), {
        appreciationConduiteEducateur: avisConduiteConseil.trim(),
        updatedAtConseil: new Date().toISOString()
      });
      alert("✨ Appréciation enregistrée pour le Conseil de Classe !");
      setAvisConduiteConseil('');
      setEleveSelectionneConseil(null);
    } catch (err) { 
      console.error(err); 
    }
  };

  const handleDiffuserCirculaireMails = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });
    if (!sujetCirculaire.trim() || !corpsCirculaire.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "notifications"), {
        schoolId: currentSchool,
        expediteurId: idEducateur,
        expediteurNom: `VIE SCOLAIRE : PROMO ${promoResponsable.toUpperCase()}`,
        destinataireId: "ALL_PROMO",
        cibleGroup: promoResponsable,
        titre: sujetCirculaire.trim().toUpperCase(),
        message: corpsCirculaire.trim(),
        type: "global",
        createdAt: new Date().toISOString()
      });
      setStatusMessage({ type: 'success', text: '📢 Circulaire de niveau diffusée aux familles.' });
      setSujetCirculaire(''); 
      setContenuCirculaire('');
    } catch (err) { 
      console.error(err); 
    } finally { 
      setSending(false); 
    }
  };

  const extraireHeuresAbsencesParClasse = (classeName) => {
    return elevesPromo
      .filter(st => (st.classeId || '').toLowerCase().trim() === classeName.toLowerCase().trim())
      .reduce((acc, curr) => acc + (curr.absences || 0), 0);
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">Initialisation du Bureau de Promotion...</div>;

  return (
    <div key={refreshKey} className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans text-gray-700 text-left bg-gray-50 min-h-screen animate-fadeIn">
      
      {/* HEADER MANAGER PROMO AVEC BOUTON DE DECONNEXION INTEGRE */}
      <div className="mb-6 border-b pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-left">
        <div className="flex-1">
          <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-orange-400 px-3 py-1 rounded-full">
            Console Directeur de Niveau / Manager Général de Promotion
          </span>
          <h1 className="text-xl md:text-2xl font-black mt-2 text-gray-900 uppercase">
            👮 Bureau Éducateur : Promotion {promoResponsable.toUpperCase()}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <p className="text-xs text-gray-400 font-medium">Manager en charge : <span className="font-bold text-gray-600 uppercase">{user?.name || user?.nom || "BOLOU"}</span> — École : <span className="uppercase font-mono font-bold text-purple-700">{schoolName}</span></p>
            <button 
              type="button" 
              onClick={handleSessionLogout} 
              className="text-[10px] font-black text-red-600 hover:text-red-700 uppercase bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded transition cursor-pointer"
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>

        {/* CONTROLE DES ONGLETS DÉPLOYÉS */}
        <div className="flex flex-wrap bg-white p-1 rounded-xl border border-gray-200 text-xs font-black uppercase shadow-2xs">
          <button type="button" onClick={handleForcerRetourBureau} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeTab === 'dashboard_global' ? 'bg-slate-900 text-orange-400 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>📊 Vue Globale</button>
          <button type="button" onClick={() => setActiveSubTab('pointages_rh')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeTab === 'pointages_rh' ? 'bg-slate-900 text-orange-400 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>🕒 Suivi Heures Profs ({listePointagesConsolides.length})</button>
          <button type="button" onClick={() => setActiveSubTab('assiduite_classes')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeTab === 'assiduite_classes' ? 'bg-slate-900 text-orange-400 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>📝 Appels & Classes</button>
          <button type="button" onClick={() => setActiveSubTab('excellence_promo')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeTab === 'excellence_promo' ? 'bg-slate-900 text-orange-400 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>🏆 Registre Excellence ({elevesPromo.length})</button>
          <button type="button" onClick={() => setActiveSubTab('messages_sos')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeTab === 'messages_sos' ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}>📬 Circulaires & SOS</button>
        </div>
      </div>

      {/* ================= 🚨 ONGLET 1 : VUE GLOBALE ================= */}
      {activeTab === 'dashboard_global' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border">
              <p className="text-[10px] font-black uppercase text-gray-400">Effectif Supervisé Niveau {promoResponsable.toUpperCase()}</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{elevesPromo.length} <span className="text-xs font-bold text-gray-400">Apprenants</span></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border">
              <p className="text-[10px] font-black uppercase text-red-500">Heures d'Absences Globales Promotion</p>
              <p className="text-3xl font-black text-red-600 mt-1">{elevesPromo.reduce((acc, curr) => acc + (curr.absences || 0), 0)} H</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-purple-100 bg-purple-50/10 flex flex-col justify-between">
              <p className="text-[10px] font-black uppercase text-purple-700">Volume Horaire Enseignants</p>
              <p className="text-lg font-black text-purple-950 mt-1">✓ {pointagesRaw.length} Pointages bruts cumulés</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= 🚨 ONGLET 2 : COMPTEUR DES HEURES CUMULÉES TOTAL (SALAIRES RH) ================= */}
      {activeTab === 'pointages_rh' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm animate-fadeIn space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider">🕒 Grand Livre de Consolidation des Heures Effectuées</h3>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">Les lignes identiques sont fusionnées. Le créneau horaire calcule la somme totale des heures réelles transmises à la direction.</p>
            </div>
            <button type="button" onClick={handleTransmettreRapportRHToAdmin} className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl transition cursor-pointer border-0">
              ⚡ Transmettre Cumuls à l'Admin
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b">
                  <th className="p-3">ID Code Prof</th>
                  <th className="p-3">Nom de l'Enseignant</th>
                  <th className="p-3">Matière Spécifiée</th>
                  <th className="p-3 text-center">Classe Cible</th>
                  <th className="p-3 text-center bg-purple-50 text-purple-950">⏱️ Somme des Heures Effectuées (Cumul)</th>
                  <th className="p-3 text-right">Nb Sessions</th>
                </tr>
              </thead>
              <tbody>
                {listePointagesConsolides.length === 0 ? (
                  <tr><td colSpan="6" className="p-12 text-center text-gray-400 italic">Aucun pointage disponible pour consolidation.</td></tr>
                ) : (
                  listePointagesConsolides.map((p, index) => (
                    <tr key={index} className="border-b border-gray-50 hover:bg-purple-50/20 transition">
                      <td className="p-3 font-mono text-purple-700 uppercase">{p.profId}</td>
                      <td className="p-3 text-gray-900 uppercase font-black">{p.profName}</td>
                      <td className="p-3 text-gray-500 uppercase">📚 {p.matiere}</td>
                      <td className="p-3 text-center font-mono font-black text-gray-700 uppercase">{p.classeId}</td>
                      <td className="p-3 text-center font-mono font-black bg-purple-50 text-purple-700 text-sm">
                        {p.totalHeuresCumulees.toFixed(1)} Heures
                      </td>
                      <td className="p-3 text-right text-gray-400 font-mono font-bold">
                        {p.nombreSessions} cours
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

            {/* ================= 🚨 ONGLET 3 : SUIVI DES CAHIERS D'APPELS ================= */}
      {activeTab === 'assiduite_classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn text-left">
          <div className="lg:col-span-2 bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 border-b pb-2">📋 Décompte Global des Absences par Division de Classe</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['5eme_1', '5eme_2', '5eme_3'].map((nomClasse, idx) => {
                const absTotal = extraireHeuresAbsencesParClasse(nomClasse);
                return (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl border flex justify-between items-center text-xs font-bold font-mono">
                    <div>
                      <span className="text-purple-700 block uppercase font-black font-sans text-[11px]">Classe : {nomClasse.toUpperCase()}</span>
                      <span className="text-[10px] text-gray-400 font-sans">Volume Global Absences</span>
                    </div>
                    <span className="text-lg font-black text-red-600">{absTotal} H</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= 🚨 ONGLET 4 : CONSEIL DE CLASSE ================= */}
      {activeTab === 'excellence_promo' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border p-6 shadow-sm animate-fadeIn grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3">🏆 Classement Général de la Promotion (Somme Totale des Notes)</h3>
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 uppercase border-b">
                    <th className="p-3 text-center">Rang</th>
                    <th className="p-3">Division</th>
                    <th className="p-3">Nom & Prénoms</th>
                    <th className="p-3 text-center">Absences</th>
                    <th className="p-3 text-right">Somme des Notes</th>
                    <th className="p-3 text-right">Avis</th>
                  </tr>
                </thead>
                <tbody>
                  {elevesPromo.map((student, index) => (
                    <tr key={student.id} className="border-b border-gray-50 hover:bg-purple-50/20 transition">
                      <td className="p-3 text-center text-sm font-black text-amber-600">{index + 1}</td>
                      <td className="p-3 font-mono text-purple-700 uppercase">{student.classeId?.toUpperCase()}</td>
                      <td className="p-3 text-gray-900 uppercase font-black">{student.nom} {student.prenoms || ''}</td>
                      <td className="p-3 text-center font-mono text-red-600">{student.absences || 0} H</td>
                      <td className="p-3 text-right font-mono text-purple-700 text-sm">{student.totalPointsCumules.toFixed(2)} pts</td>
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => { setEleveSelectionneConseil(student); setAvisConduiteConseil(student.appreciationConduiteEducateur || ''); }} className="bg-gray-100 border text-[9px] uppercase px-2 py-0.5 rounded font-black tracking-tighter hover:bg-slate-900 hover:text-orange-400 cursor-pointer">✏️ Donner Avis</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-4 shadow-sm h-fit">
            <h4 className="text-xs font-black text-purple-700 uppercase tracking-wider border-b pb-3 mb-4">💬 Appréciation de Conduite de l'Éducateur</h4>
            {eleveSelectionneConseil ? (
              <form onSubmit={handleEnregistrerAppreciationConseil} className="space-y-4 text-xs font-bold text-gray-700">
                <div className="bg-purple-50 border p-3 rounded-xl">
                  <span className="text-purple-950 font-black uppercase">{eleveSelectionneConseil.nom} {eleveSelectionneConseil.prenoms || ''}</span>
                  <span className="block font-mono text-[10px] text-purple-600 mt-1">Points cumulés : {eleveSelectionneConseil.totalPointsCumules.toFixed(2)} pts</span>
                </div>
                <textarea rows="4" value={avisConduiteConseil} onChange={(e) => setAvisConduiteConseil(e.target.value)} placeholder="Ex: Élève discipliné..." className="w-full bg-gray-50 border p-2.5 rounded-xl outline-none font-medium text-gray-900 bg-white" required />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEleveSelectionneConseil(null)} className="flex-1 bg-gray-100 border py-2 rounded-xl uppercase text-[10px] cursor-pointer">Annuler</button>
                  <button type="submit" className="flex-1 bg-purple-600 text-white py-2 rounded-xl uppercase text-[10px] border-0 cursor-pointer">Enregistrer</button>
                </div>
              </form>
            ) : (
              <p className="text-center py-12 text-gray-400 italic text-[11px]">Sélectionnez un élève dans le registre d'excellence pour enregistrer son appréciation officielle de fin de trimestre.</p>
            )}
          </div>
        </div>
      )}

      {/* ================= 🚨 ONGLET 5 : MESSAGERIE DUO, SOS ET CIRCULAIRES ================= */}
      {activeTab === 'messages_sos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">✉️ Émission d'une circulaire de promotion</h3>
            {msgStatus.text && <div className={`p-3 rounded-xl text-xs font-bold border ${msgStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>{msgStatus.text}</div>}
            <form onSubmit={handleDiffuserCirculaireMails} className="space-y-4 text-xs font-bold text-gray-700">
              <input type="text" placeholder="Sujet de l'Alerte" value={sujetCirculaire} onChange={(e) => setSujetCirculaire(e.target.value)} className="w-full bg-gray-50 border p-3 rounded-xl outline-none text-gray-900 bg-white" required />
              <textarea rows="6" placeholder="Chers parents..." value={corpsCirculaire} onChange={(e) => setContenuCirculaire(e.target.value)} className="w-full bg-gray-50 border p-3 rounded-xl outline-none font-medium leading-relaxed text-gray-900 bg-white" required />
              <button type="submit" disabled={sending} className="w-full bg-purple-600 text-white font-black py-3.5 rounded-xl uppercase border-0 cursor-pointer">{sending ? "Envoi..." : "✉️ Diffuser aux Familles"}</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">📥 Instructions et Décisions de la Direction Admin</h3>
            <ReceptionInstructionsAdmin currentSchool={currentSchool} idEducateurLogge={idEducateur} userRole={user?.role} />
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardEducateur;
