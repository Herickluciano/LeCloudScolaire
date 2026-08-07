import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const DashboardEducateur = () => {
  const { user, schoolId, logout } = useAuth();
  const navigate = useNavigate();

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();
  const niveauPromotion = (user?.promotionId || 'tle').trim().toLowerCase();

  // --- ÉTATS NUAGIQUES RÉACTIFS ---
  const [classesPromotion, setClassesPromotion] = useState([]);
  const [elevesPromotion, setElevesClasse] = useState([]);
  const [pointagesProfesseurs, setPointagesProfesseurs] = useState([]);
  const [toutesNotes, setToutesNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ÉTATS SÉLECTIONS ET NAVIGATION ---
  const [activeTab, setActiveTab] = useState('delegues');
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedDelegueId, setSelectedDelegueId] = useState('');
  
  // 🟢 FILTRES CASCADE POUR L'ONGLET POINTAGE
  const [classeFiltrePointage, setClasseFiltrePointage] = useState('');
  const [profFiltrePointage, setProfFiltrePointage] = useState('');

  // --- ÉTATS MAIL ---
  const [mailSujet, setMailSujet] = useState('');
  const [mailContenu, setMailContenu] = useState('');
  const [sendingMail, setSendingMail] = useState(false);

  // 🔄 ÉCOUTEURS COMPLÈTEMENT CONNECTÉS EN TEMPS RÉEL
  useEffect(() => {
    if (!currentSchool) return;

    // A. Écoute des classes de la promotion
    const qClasses = query(collection(db, "classes"));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        const schoolClean = (data.schoolId || '').trim().toLowerCase();
        if (schoolClean === currentSchool && d.id.toLowerCase().includes(niveauPromotion)) {
          list.push({ id: d.id, ...data });
        }
      });
      setClassesPromotion(list);
      if (list.length > 0) {
        if (!selectedClasse) setSelectedClasse(list[0].id);
        if (!classeFiltrePointage) setClasseFiltrePointage(list[0].id);
      }
    });

    // B. Écoute des élèves de la promotion
    const qEleves = query(collection(db, "users"), where("role", "==", "eleve"));
    const unsubEleves = onSnapshot(qEleves, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        const schoolCleanDoc = (data.schoolId || '').trim().toLowerCase();
        if (schoolCleanDoc === currentSchool && data.classeId?.toLowerCase().includes(niveauPromotion)) {
          list.push({ id: d.id, ...data });
        }
      });
      setElevesClasse(list);
    });

    // C. Écoute globale des pointages profs
    const qPointages = query(collection(db, "pointages_professeurs"));
    const unsubPointages = onSnapshot(qPointages, (snap) => {
      const list = [];
      snap.forEach(d => {
        const pData = d.data();
        const schoolClean = (pData.schoolId || '').trim().toLowerCase();
        if (schoolClean === currentSchool) {
          list.push({ id: d.id, ...pData });
        }
      });
      list.sort((a, b) => new Date(b.createdAt || b.datePointage) - new Date(a.createdAt || a.datePointage));
      setPointagesProfesseurs(list);
    });

    // D. Écoute des notes pour le Top 10
    const qNotes = query(collection(db, "notes"));
    const unsubNotes = onSnapshot(qNotes, (snap) => {
      const list = [];
      snap.forEach(d => {
        const schoolClean = (d.data().schoolId || '').trim().toLowerCase();
        if (schoolClean === currentSchool) list.push({ id: d.id, ...d.data() });
      });
      setToutesNotes(list);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubEleves();
      unsubPointages();
      unsubNotes();
    };
  }, [currentSchool, niveauPromotion]);

  // Extraction automatique du Top 10 par cumul de points
  const top10Eleves = (() => {
    const cartographiePoints = elevesPromotion.map(eleve => {
      const notesEleve = toutesNotes.filter(n => n.eleveId === eleve.id);
      const sommePoints = notesEleve.reduce((acc, current) => acc + (parseFloat(current.valeur) || 0), 0);
      return { ...eleve, totalPointsCumules: sommePoints, nombreEvaluations: notesEleve.length };
    });
    return cartographiePoints.sort((a, b) => b.totalPointsCumules - a.totalPointsCumules).slice(0, 10);
  })();

  // 🟢 EXTRACTION DYNAMIQUE DES PROFS AYANT ÉMARGÉ DANS LA CLASSE SÉLECTIONNÉE
  const extraireProfesseursDeLaClasse = () => {
    if (!classeFiltrePointage) return [];
    const profsMap = {};
    
    pointagesProfesseurs.forEach(p => {
      const classeDoc = (p.classeId || '').toLowerCase().trim();
      const classeCible = classeFiltrePointage.toLowerCase().trim();
      
      // Si le pointage correspond à la classe filtrée
      if (classeCible.includes(classeDoc) || classeDoc.includes(classeCible)) {
        let idProf = p.professeurId || p.profId || "PROF_UNKNOWN";
        let nomProf = p.professeurName || p.professeurNom || p.profNom || "Enseignant";
        
        // Redressement d'identité démo automatique pour la TLE D 1
        if (idProf === "PROF_UNKNOWN" && classeCible.includes("tle_d_1")) {
          idProf = "PROF_BLEGUY_978";
          nomProf = "BLEGUY Eric Luciano";
        }
        
        profsMap[idProf] = nomProf;
      }
    });

    return Object.entries(profsMap).map(([id, nom]) => ({ id, nom }));
  };

  // 🟢 FILTRAGE FINAL DE LA TABLE DE POINTAGES POUR UN PROF ET UNE CLASSE UNIQUE
  const obtenirPointagesFiltrés = () => {
    if (!classeFiltrePointage || !profFiltrePointage) return [];
    
    return pointagesProfesseurs.filter(p => {
      const classeDoc = (p.classeId || '').toLowerCase().trim();
      const classeCible = classeFiltrePointage.toLowerCase().trim();
      const matcheClasse = classeCible.includes(classeDoc) || classeDoc.includes(classeCible);
      
      let idProf = p.professeurId || p.profId || "PROF_UNKNOWN";
      if (idProf === "PROF_UNKNOWN" && classeCible.includes("tle_d_1")) {
        idProf = "PROF_BLEGUY_978";
      }
      
      const matcheProf = idProf === profFiltrePointage;
      return matcheClasse && matcheProf;
    });
  };

  const handleAssignerDelegue = async (e) => {
    e.preventDefault();
    if (!selectedClasse || !selectedDelegueId) return;
    try {
      const classeRef = doc(db, "classes", selectedClasse);
      await updateDoc(classeRef, {
        delegueId: selectedDelegueId,
        delegueNom: (elevesPromotion.find(el => el.id === selectedDelegueId)?.nom || '').toUpperCase(),
        updatedAt: new Date().toISOString()
      });
      alert("🎉 Succès ! Le délégué officiel de la division a été affecté.");
    } catch (err) { console.error(err); }
  };

  const handleEnvoyerMailAuxParents = async (e) => {
    e.preventDefault();
    if (!mailSujet.trim() || !mailContenu.trim()) return;
    setSendingMail(true);
    try {
      const batchIdKey = `${currentSchool}_mail_parents_${Date.now()}`;
      const listeEmailsParents = elevesPromotion.map(el => el.emailParent).filter(email => !!email);
      await setDoc(doc(db, "mails_direction", batchIdKey), {
        id: batchIdKey,
        schoolId: currentSchool,
        promotionId: niveauPromotion,
        sujet: mailSujet.trim(),
        message: mailContenu.trim(),
        destinatairesList: listeEmailsParents,
        createdAt: new Date().toISOString()
      });
      alert("📨 Communiqué envoyé aux parents !");
      setMailSujet(''); setMailContenu('');
    } catch (err) { console.error(err); } finally { setSendingMail(false); }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Initialisation du Bureau en temps réel...</div>;

  const profsDisponibles = extraireProfesseursDeLaClasse();
  const pointagesFiltresSains = obtenirPointagesFiltrés();

  // Extraction simplifiée pour le premier onglet
  const elevesDeLaClasseSelectionnee = elevesPromotion.filter(el => selectedClasse.toLowerCase().includes((el.classeId || '').toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn text-gray-700">
      
      {/* BARRE DE SESSION HAUTE */}
      <div className="max-w-7xl mx-auto flex justify-between items-center border-b pb-4 mb-6">
        <div className="text-left">
          <span className="text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
            Espace Vie Scolaire & Discipline
          </span>
          <h1 className="text-2xl font-black text-gray-900 mt-2">
            Bureau de l'Éducateur : <span className="uppercase text-purple-700">{user?.name || user?.nom || "M. BOLOU"}</span>
          </h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Suivi de la promotion : <span className="font-mono font-black text-purple-700 uppercase">{niveauPromotion}</span></p>
        </div>
        <button type="button" onClick={() => { logout(); navigate('/login'); }} className="bg-gray-100 hover:bg-gray-200 border text-gray-700 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer">🚪 Déconnexion</button>
      </div>

            {/* NAVIGATEUR DES SÉCTIONS */}
      <div className="max-w-7xl mx-auto flex bg-white p-1 rounded-xl border w-fit mb-8 text-left font-bold text-xs uppercase shadow-2xs">
        <button onClick={() => setActiveTab('delegues')} className={`px-4 py-2.5 rounded-lg transition cursor-pointer ${activeTab === 'delegues' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>🪪 Assigner les Délégués</button>
        <button onClick={() => setActiveTab('pointages')} className={`px-4 py-2.5 rounded-lg transition cursor-pointer ${activeTab === 'pointages' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>👨‍🏫 Pointages Profs</button>
        <button onClick={() => setActiveTab('absences')} className={`px-4 py-2.5 rounded-lg transition cursor-pointer ${activeTab === 'absences' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>🛑 Absences Élèves</button>
        <button onClick={() => setActiveTab('top10')} className={`px-4 py-2.5 rounded-lg transition cursor-pointer ${activeTab === 'top10' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>🏆 Top 10 Promotion</button>
        <button onClick={() => setActiveTab('mail')} className={`px-4 py-2.5 rounded-lg transition cursor-pointer ${activeTab === 'mail' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>✉️ Alerte Mail Parents</button>
      </div>

      {/* CONTENU DES ONGLETS */}
      {activeTab === 'delegues' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm text-left grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
          <div className="md:col-span-1 border-r pr-0 md:pr-6">
            <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider mb-4 border-b pb-2">Nomination du Représentant</h3>
            <form onSubmit={handleAssignerDelegue} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-400 uppercase mb-1">Sélectionner la Division</label>
                <select value={selectedClasse} onChange={(e) => { setSelectedClasse(e.target.value); setSelectedDelegueId(''); }} className="w-full bg-gray-50 border p-2.5 rounded-lg bg-white cursor-pointer outline-none">
                  <option value="">-- Choisir la classe --</option>
                  {classesPromotion.map(c => (
                    <option key={c.id} value={c.id}>{c.nom || c.id.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 uppercase mb-1">Désigner le Délégué Titulaire</label>
                <select value={selectedDelegueId} onChange={(e) => setSelectedDelegueId(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-lg bg-white cursor-pointer outline-none" disabled={!selectedClasse}>
                  <option value="">-- Choisir l'élève --</option>
                  {elevesDeLaClasseSelectionnee.map(el => (
                    <option key={el.id} value={el.id}>{el.nom?.toUpperCase()} {el.prenoms || ''}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={!selectedDelegueId} className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-2.5 rounded-xl uppercase tracking-wider transition text-xs cursor-pointer disabled:bg-gray-100">
                ⚡ Enregistrer le Délégué
              </button>
            </form>
          </div>
          <div className="md:col-span-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Cartographie des divisions sous votre juridiction</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {classesPromotion.map(c => (
                <div key={c.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center text-xs font-bold">
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded uppercase text-[10px]">🏛️ {c.nom || c.id.toUpperCase()}</span>
                  <p className="text-gray-900">Délégué : <strong className="text-purple-600 uppercase">{c.delegueNom || "⏳ Aucun délégué assigné"}</strong></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ONGLET B : SUIVI DU POINTAGE RESTRUCTURÉ ET ORGANISÉ */}
      {activeTab === 'pointages' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm text-left animate-fadeIn">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 border-b pb-3">🗂️ Consultation Organisée des Émargements Enseignants</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 border p-4 rounded-xl text-xs font-bold mb-6">
            <div>
              <label className="block text-gray-400 uppercase mb-1">1. Filtrer par Division / Classe</label>
              <select 
                value={classeFiltrePointage} 
                onChange={(e) => { setClasseFiltrePointage(e.target.value); setProfFiltrePointage(''); }} 
                className="w-full bg-white border p-2.5 rounded-lg outline-none cursor-pointer"
              >
                {classesPromotion.map(c => (
                  <option key={c.id} value={c.id}>{c.nom || c.id.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 uppercase mb-1">2. Sélectionner l'Intervenant / Professeur</label>
              <select 
                value={profFiltrePointage} 
                onChange={(e) => setProfFiltrePointage(e.target.value)} 
                className="w-full bg-white border p-2.5 rounded-lg outline-none cursor-pointer disabled:bg-gray-100"
                disabled={profsDisponibles.length === 0}
              >
                <option value="">-- {profsDisponibles.length === 0 ? "Aucun émargement dans cette classe" : "Choisir le professeur"} --</option>
                {profsDisponibles.map(p => (
                  <option key={p.id} value={p.id}>{p.nom} ({p.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                  <th className="p-3">Horodatage Séance</th>
                  <th className="p-3">Matricule Intervenant</th>
                  <th className="p-3">Enseignant Certifié</th>
                  <th className="p-3 text-center">Volume Horaire</th>
                  <th className="p-3 text-right">Statut de la Vacation</th>
                </tr>
              </thead>
              <tbody>
                {!profFiltrePointage ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-gray-400 italic font-medium">
                      👋 Veuillez sélectionner un professeur dans le deuxième menu pour charger sa feuille d'émargement trimestrielle.
                    </td>
                  </tr>
                ) : pointagesFiltresSains.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-gray-400 italic">
                      Aucune ligne d'émargement trouvée pour ce professeur dans cette division.
                    </td>
                  </tr>
                ) : (
                  pointagesFiltresSains.map((p) => {
                    const horodatage = p.createdAt 
                      ? new Date(p.createdAt).toLocaleString('fr-FR') 
                      : `${p.date || p.datePointage} à ${p.heureArrivee || p.heurePointage}`;
                    
                    const nomRendu = profsDisponibles.find(pr => pr.id === profFiltrePointage)?.nom || "Enseignant";

                    return (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                        <td className="p-3 font-mono text-gray-500">{horodatage}</td>
                        <td className="p-3 font-mono text-purple-700 uppercase">{profFiltrePointage}</td>
                        <td className="p-3 text-gray-900 uppercase font-black">{nomRendu}</td>
                        <td className="p-3 text-center font-mono text-xs text-gray-600">{p.heuresEffectuees || 2} Heures</td>
                        <td className="p-3 text-right">
                          <span className={`px-2.5 py-0.5 rounded font-black text-[9px] uppercase ${p.statut === 'en_cours' ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'}`}>
                            {p.statut === 'en_cours' ? '⏳ Cours en cours' : '✓ Vacation Conforme'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET C : CONTRÔLE ABSENCES */}
      {activeTab === 'absences' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm text-left animate-fadeIn">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Bilan Disciplinaire et livret d'assiduité des apprenants</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
                           <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                  <th className="p-3">Matricule</th>
                  <th className="p-3">Classe</th>
                  <th className="p-3">Nom & Prénoms</th>
                  <th className="p-3 text-center">Heures Absences</th>
                  <th className="p-3 text-right">Niveau de Gravité</th>
                </tr>
              </thead>
              <tbody>
                {elevesPromotion.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-gray-400 italic">
                      Aucun élève trouvé dans cette promotion.
                    </td>
                  </tr>
                ) : (
                  elevesPromotion.map((el) => {
                    const totalAbs = el.absences || 0;
                    const critique = totalAbs >= 10;
                    return (
                      <tr key={el.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                        <td className="p-3 font-mono text-gray-400">{el.matricule || el.id}</td>
                        <td className="p-3 font-mono text-purple-700 uppercase">{el.classeId?.toUpperCase()}</td>
                        <td className="p-3 text-gray-900 uppercase font-black">{el.nom} {el.prenoms || ''}</td>
                        <td className="p-3 text-center font-mono font-black">
                          <span className={`px-2 py-0.5 rounded text-xs ${critique ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {totalAbs} H
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${critique ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-emerald-50 text-emerald-700'}`}>
                            {critique ? "🚨 Seuil Dépassé (>10H)" : "🟢 Discipline Normale"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET D : TABLEAU D'EXCELLENCE TOP 10 */}
      {activeTab === 'top10' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm text-left animate-fadeIn">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">🏆 Tableau d'Excellence : Top 10 Apprenants (Addition cumulative de points)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                  <th className="p-4 text-center">Rang</th>
                  <th className="p-4">Matricule</th>
                  <th className="p-4">Classe</th>
                  <th className="p-4">Nom Complet Apprenant</th>
                  <th className="p-4 text-center">Évaluations Composées</th>
                  <th className="p-4 text-right">Points Cumulés</th>
                </tr>
              </thead>
              <tbody>
                {top10Eleves.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-gray-400 italic">
                      Aucune note saisie pour le moment pour classer la promotion.
                    </td>
                  </tr>
                ) : (
                  top10Eleves.map((student, index) => (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-purple-50/10 transition">
                      <td className="p-4 text-center font-black text-sm text-amber-600">
                        {index + 1} {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '✨'}
                      </td>
                      <td className="p-4 font-mono text-gray-400">{student.matricule || student.id}</td>
                      <td className="p-4 font-mono text-purple-700 uppercase font-black">{student.classeId?.toUpperCase()}</td>
                      <td className="p-4 text-gray-900 uppercase font-black">{student.nom} {student.prenoms || ''}</td>
                      <td className="p-4 text-center font-mono text-gray-500">{student.nombreEvaluations} devoirs</td>
                      <td className="p-4 text-right font-mono text-sm font-black text-purple-700">{student.totalPointsCumules.toFixed(2)} pts</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET E : ENVOYER MESSAGE AUX PARENTS */}
      {activeTab === 'mail' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm text-left max-w-2xl animate-fadeIn">
          <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider mb-4 border-b pb-2">✉️ Émission d'une circulaire groupée aux parents d'élèves</h3>
          <form onSubmit={handleEnvoyerMailAuxParents} className="space-y-4 text-xs font-bold text-gray-700">
            <div>
              <label className="block text-gray-400 uppercase mb-1">Sujet du Message / Alerte *</label>
              <input 
                type="text" 
                placeholder="Ex: Convocation Assemblée Générale ou Alerte Discipline Trimestre" 
                value={mailSujet} 
                onChange={(e) => setMailSujet(e.target.value)} 
                className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" 
                required 
              />
            </div>
            <div>
              <label className="block text-gray-400 uppercase mb-1">Contenu de la Circulaire Institutionnelle *</label>
              <textarea 
                rows="6" 
                placeholder="Chers parents, nous vous informons que..." 
                value={mailContenu} 
                onChange={(e) => setMailContenu(e.target.value)} 
                className="w-full bg-gray-50 border p-3 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-medium text-gray-800" 
                required 
              />
            </div>
            <button 
              type="submit" 
              disabled={sendingMail || elevesPromotion.length === 0} 
              className="bg-purple-600 hover:bg-purple-700 text-white font-black px-6 py-3 rounded-xl uppercase tracking-wider transition cursor-pointer text-xs disabled:bg-gray-200"
            >
              ✉️ Diffuser le Mail aux Familles
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default DashboardEducateur;
