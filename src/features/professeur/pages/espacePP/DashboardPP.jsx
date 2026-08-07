import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// --- CHEMINS RELATIFS SÉCURISÉS (4 niveaux depuis espacePP/) ---
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../services/api';
import ConseilClasse from './ConseilClasse';

const DashboardPP = () => {
  const { user, schoolId } = useAuth();
  
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa').trim().toLowerCase();
  const classePP = (user?.classeId || 'tle_d_1').trim().toLowerCase(); 

  // --- ÉTATS CLOUD ---
  const [elevesClasse, setElevesClasse] = useState([]);
  const [toutesNotes, setToutesNotes] = useState([]);
  const [appreciationsPP, setAppreciationsPP] = useState({});
  const [loading, setLoading] = useState(true);

  // Éléments de filtrage de l'espace de synthèse
  const [trimestreSelectionne, setTrimestreSelectionne] = useState('1');
  const [eleveSelectionneId, setEleveSelectionneId] = useState('');
  const [sendingAppreciation, setSendingAppreciation] = useState(false);
  const [texteAppreciation, setTexteAppreciation] = useState('');

  // 🔄 ÉCOUTEUR MULTI-FLUX COMPLÈTEMENT RÉACTIF TEMPS RÉEL
  useEffect(() => {
    if (!currentSchool || !classePP) {
      setLoading(false);
      return;
    }

    // A. Écoute des élèves de la classe (Récupère le compteur live d'absences de l'éducateur)
    const qEleves = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "==", classePP)
    );

    const unsubEleves = onSnapshot(qEleves, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setElevesClasse(list);
      if (list.length > 0 && !eleveSelectionneId) {
        setEleveSelectionneId(list[0].id);
      }
    });

    // B. Écoute de TOUTES les notes de l'établissement pour croiser les moyennes
    const qNotes = query(collection(db, "notes"), where("schoolId", "==", currentSchool));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
      setToutesNotes(list);
    });

    // C. Écoute des appréciations globales déjà validées par le PP
    const qAppreciations = query(collection(db, "appreciations_conseil"), where("schoolId", "==", currentSchool));
    const unsubAppreciations = onSnapshot(qAppreciations, (snapshot) => {
      const map = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        map[`${data.eleveId}_trim_${data.trimestre}`] = data.contenu;
      });
      setAppreciationsPP(map);
      setLoading(false);
    });

    return () => {
      unsubEleves();
      unsubNotes();
      unsubAppreciations();
    };
  }, [currentSchool, classePP, eleveSelectionneId]);

  // Déclencher la mise à jour du champ d'appréciation lors du changement d'élève ou de trimestre
  useEffect(() => {
    const cleMap = `${eleveSelectionneId}_trim_${trimestreSelectionne}`;
    setTexteAppreciation(appreciationsPP[cleMap] || '');
  }, [eleveSelectionneId, trimestreSelectionne, appreciationsPP]);

  // Extraction de l'élève actif pour le livrable
  const eleveActif = elevesClasse.find(e => e.id === eleveSelectionneId);

  // 🟢 FILTRAGE COMPATIBLE DES NOTES POUR CONSTRUIRE LE PRÉ-BULLETIN
  const extraireNotesEleveCourant = () => {
    return toutesNotes.filter(n => n.eleveId === eleveSelectionneId && n.trimestre === trimestreSelectionne);
  };

  // 🚀 ACTION : Enregistrer le verdict du Conseil de classe
  const handleSaveVerdictPP = async (e) => {
    e.preventDefault();
    if (!eleveSelectionneId || !texteAppreciation.trim()) return;

    setSendingAppreciation(true);
    const documentKey = `${currentSchool}_verdict_${eleveSelectionneId}_t${trimestreSelectionne}`;

    try {
      await setDoc(doc(db, "appreciations_conseil", documentKey), {
        id: documentKey,
        schoolId: currentSchool,
        eleveId: eleveSelectionneId,
        classeId: classePP,
        trimestre: trimestreSelectionne,
        contenu: texteAppreciation.trim(),
        signePar: `M. ${user?.nom || 'Professeur Principal'}`,
        updatedAt: new Date().toISOString()
      });
      alert("🎯 Verdict et avis du Conseil de classe enregistrés avec succès !");
    } catch (err) {
      console.error(err);
    } finally {
      setSendingAppreciation(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">Centralisation des livrets de notes live...</div>;

  const notesFiltrees = extraireNotesEleveCourant();

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen text-gray-700 animate-fadeIn text-left">
      
      {/* BOUTON RETOUR */}
      <div className="mb-4 text-left">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
          ⬅️ Retour au Bureau Virtuel
        </Link>
      </div>

      {/* BANNIÈRE PP */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-md mb-8 text-left">
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-950/60 px-2.5 py-1 rounded-full">
          👑 Supervision Pédagogique Connectée
        </span>
        <h1 className="text-xl md:text-2xl font-black mt-2">Espace Enseignant Principal</h1>
        <p className="text-xs text-slate-400 mt-1">Titulaire de la division : <span className="text-orange-400 font-bold uppercase">{classePP}</span> — Enseignant : <span className="font-bold text-white uppercase">{user?.nom || "BLEGUY"}</span></p>
      </div>

      {/* ZONE DE SÉLECTION DE L'ÉLÈVE ET DU TRIMESTRE */}
      <div className="bg-white border p-4 rounded-xl shadow-xs mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
        <div>
          <label className="block text-gray-400 uppercase mb-1">1. Choisir l'Apprenant</label>
          <select value={eleveSelectionneId} onChange={(e) => setEleveSelectionneId(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none cursor-pointer">
            {elevesClasse.map(e => (
              <option key={e.id} value={e.id}>{e.nom?.toUpperCase()} {e.prenoms || ''} ({e.matricule || e.id})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 uppercase mb-1">2. Période Évaluative</label>
          <select value={trimestreSelectionne} onChange={(e) => setTrimestreSelectionne(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none cursor-pointer">
            <option value="1">Premier Trimestre</option>
            <option value="2">Deuxième Trimestre</option>
            <option value="3">Troisième Trimestre</option>
          </select>
        </div>
        <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100 text-purple-900 flex flex-col justify-center">
          <p className="text-[10px] uppercase font-black tracking-wide">Assiduité Live Éducateur</p>
          <p className="text-sm font-mono font-black mt-1">⚠️ {eleveActif?.absences || 0} Heures d'Absence</p>
        </div>
      </div>

      {/* ================= PANNEAU DU PRÉ-BULLETIN INTERCONNECTÉ ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* GRILLE RECAPITULATIVE DES MATIÈRES & NOTES */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-5 shadow-sm">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">📄 Relevé de Notes Trimestriel Provisoire</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                  <th className="p-3">Discipline</th>
                  <th className="p-3">Intervenant</th>
                  <th className="p-3 text-center">Note /20</th>
                  <th className="p-3">Appréciation Enseignant</th>
                </tr>
              </thead>
              <tbody>
                {notesFiltrees.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center text-gray-400 italic">Aucune note n'a encore été saisie pour cet élève sur ce trimestre.</td>
                  </tr>
                ) : (
                  notesFiltrees.map((note) => (
                    <tr key={note.id} className="border-b border-gray-100 hover:bg-gray-50/40 transition">
                      <td className="p-3 text-purple-700 uppercase font-black">{note.matiere}</td>
                      <td className="p-3 text-gray-600 font-medium">{note.profName || 'Enseignant'}</td>
                      <td className="p-3 text-center font-mono text-sm font-black text-gray-900">
                        {parseFloat(note.valeur).toFixed(2)}
                      </td>
                      <td className="p-3 text-gray-500 font-medium italic truncate max-w-[200px]">
                        {note.appreciation || 'Aucun commentaire renseigné.'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

                {/* PANNEAU DE VERDICT DU CONSEIL POUR LE PROFESSEUR PRINCIPAL */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl h-fit">
          <h3 className="text-xs font-black text-orange-400 uppercase tracking-wider border-b border-slate-800 pb-3 mb-4">👑 Avis du Professeur Principal</h3>
          
          <div className="text-xs font-bold space-y-3 mb-4 text-slate-300">
            <p>● <span className="text-slate-500">Élève :</span> {eleveActif?.nom?.toUpperCase()} {eleveActif?.prenoms}</p>
            <p>● <span className="text-slate-500">Total Absences :</span> <strong className="text-red-400">{eleveActif?.absences || 0} H</strong> (Donnée Éducateur)</p>
          </div>

          <form onSubmit={handleSaveVerdictPP} className="space-y-4 text-xs font-bold">
            <div>
              <label className="block text-slate-400 uppercase mb-1">Appréciation Générale du Conseil *</label>
              <textarea 
                rows="5" 
                placeholder="Ex: Trimestre satisfaisant. Élève sérieux et discipliné. Poursuivez ainsi..." 
                value={texteAppreciation} 
                onChange={(e) => setTexteAppreciation(e.target.value)} 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 font-medium outline-none focus:ring-2 focus:ring-orange-500" 
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={sendingAppreciation || !eleveSelectionneId} 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-3 rounded-xl uppercase tracking-wider transition disabled:bg-slate-700 cursor-pointer"
            >
              {sendingAppreciation ? "Validation Conseil..." : "💾 Valider le Livret de Classe"}
            </button>
          </form>
        </div>
        <ConseilClasse/>
      </div>
    </div>
  );
};

export default DashboardPP;
