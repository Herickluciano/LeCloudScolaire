import { useState, useEffect } from 'react';
import { db, addStudentNotesOnFirebase } from '../../../services/api'; 
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext'; 
import { useParams, Link } from 'react-router-dom';

const SaisieNotes = () => {
  const { user, schoolId = 'lycee_Moderne_Gagnoa' } = useAuth();
  const { classIdUrl } = useParams();
  
  // 🟢 DÉBLOCAGE RADICAL : On harmonise la classe et l'ID de l'école sans restriction de rôle
  const classeAssignee = (user?.classeId || 'tle_d_1').trim().toLowerCase();
  const currentClasseId = (classIdUrl || classeAssignee).trim().toLowerCase();
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa').trim();
  const matiereActive = user?.matiereEnseignee || 'Histoire-Géographie';

  const [listeEleves, setListeEleves] = useState([]);
  const [trimestre, setTrimestre] = useState('1');
  const [notesState, setNotesState] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: '', text: '' });

  // 🔄 ÉCOUTEUR LIVE : Extraction en temps réel de tous les élèves de la classe
  useEffect(() => {
    if (!currentSchool || !currentClasseId) {
      setLoading(false);
      return;
    }

    // Requête tolérante croisant l'école et la division cible
    const q = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "==", currentClasseId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      const initialNotes = {};
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data });
        initialNotes[docSnap.id] = { interro: '', ds: '', devCommun: '' };
      });
      
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setListeEleves(list);
      setNotesState(initialNotes);
      setLoading(false);
    }, (err) => {
      console.error("Erreur d'écoute de la table des élèves :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool, currentClasseId]);

  const handleNoteChange = (eleveId, champ, value) => {
    if (value !== '') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 20) return; 
    }
    setNotesState(prev => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], [champ]: value }
    }));
  };

  // 🚀 EXPÉDITION DOUBLE FLUX VERS FIRESTORE
  const handleSauvegarderNotesNotes = async (e) => {
    e.preventDefault();
    setToast({ type: '', text: '' });

    try {
      await Promise.all(
        listeEleves.map(async (el) => {
          const Saisie = notesState[el.id];
          if (Saisie.interro || Saisie.ds || Saisie.devCommun) {
            await addStudentNotesOnFirebase(
              el.matricule || el.id,
              matiereActive,
              trimestre,
              Saisie.interro ? [parseFloat(Saisie.interro)] : [],
              Saisie.ds ? parseFloat(Saisie.ds) : null,
              Saisie.devCommun ? parseFloat(Saisie.devCommun) : null
            );
          }
        })
      );

      setToast({ type: 'success', text: `🎯 Relevé enregistré !\nLes notes de ${matiereActive} ont été synchronisées pour le Trimestre ${trimestre}.` });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: "💥 Erreur technique lors du téléversement." });
    } finally {
      setTimeout(() => setToast({ type: '', text: '' }), 4000);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Ouverture du carnet de notes cloud...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen relative animate-fadeIn">
      
      {/* TOAST POP-UP REUSSITE */}
      {toast.text && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border-l-4 bg-slate-900 text-xs font-bold ${
          toast.type === 'success' ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'
        }`}>
          <p className="whitespace-pre-line text-left">{toast.text}</p>
        </div>
      )}

      {/* BOUTON RETOUR */}
      <div className="mb-4 text-left">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Bureau Virtuel
        </Link>
      </div>

      {/* BANDEAU INTERACTIF */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md mb-6 text-left">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Registre d'Évaluations & Coefficients</h2>
            <p className="text-xs text-slate-400 mt-1">Discipline : <span className="text-orange-400 font-bold">{matiereActive}</span> | Classe : <span className="text-white font-bold uppercase">{currentClasseId}</span></p>
          </div>
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-orange-400 outline-none cursor-pointer">
            <option value="1">1er Trimestre</option>
            <option value="2">2ème Trimestre</option>
            <option value="3">3ème Trimestre</option>
          </select>
        </div>
      </div>

      {/* TABLEAU DE SAISIE DES MOYENNES */}
      <form onSubmit={handleSauvegarderNotesNotes} className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                <th className="p-3">Nom & Prénoms de l'Apprenant</th>
                <th className="p-3 text-center">Interrogation (/20)</th>
                <th className="p-3 text-center">Devoir Surveillé (/20)</th>
                <th className="p-3 text-center">Devoir Commun (/20)</th>
              </tr>
            </thead>
            <tbody>
              {listeEleves.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-gray-400 italic">Aucun élève enregistré dans cette classe.</td>
                </tr>
              ) : (
                listeEleves.map((el) => (
                  <tr key={el.id} className="border-b border-gray-100 hover:bg-gray-50/40 transition">
                    <td className="p-3 text-gray-900 uppercase font-black text-left">{el.nom} {el.prenoms || el.prenom || ''}</td>
                    <td className="p-3 text-center">
                      <input type="text" placeholder="—" value={notesState[el.id]?.interro || ''} onChange={(e) => handleNoteChange(el.id, 'interro', e.target.value)} className="w-16 p-1.5 border bg-gray-50 rounded-lg text-center font-mono font-black outline-none focus:ring-2 focus:ring-orange-500" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="text" placeholder="—" value={notesState[el.id]?.ds || ''} onChange={(e) => handleNoteChange(el.id, 'ds', e.target.value)} className="w-16 p-1.5 border bg-gray-50 rounded-lg text-center font-mono font-black outline-none focus:ring-2 focus:ring-orange-500" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="text" placeholder="—" value={notesState[el.id]?.devCommun || ''} onChange={(e) => handleNoteChange(el.id, 'devCommun', e.target.value)} className="w-16 p-1.5 border bg-gray-50 rounded-lg text-center font-mono font-black outline-none focus:ring-2 focus:ring-orange-500" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button 
          type="submit" 
          disabled={listeEleves.length === 0}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3 rounded-xl uppercase tracking-wider transition shadow-sm cursor-pointer mt-6 disabled:bg-gray-200 text-xs"
        >
          💾 Valider et Enregistrer les Notes de la Classe
        </button>
      </form>

    </div>
  );
};

export default SaisieNotes;
