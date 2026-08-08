import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// 🟢 RECTIFICATION DES CHEMINS : On remonte de 4 niveaux depuis le dossier evaluations/
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../services/api';

const SaisieNotes = () => {
  const { user, schoolId } = useAuth();
  
  // Normalisation de la casse de l'établissement pour éviter les conflits d'index
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();
  
  const idProf = (user?.matricule || user?.id || 'PROF_UNKNOWN').trim();
  const nomProf = (user?.nom || user?.name || 'Enseignant').trim();
  const matiereProf = (user?.matiereEnseignee || 'Français').trim();

  // --- ÉTATS ---
  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [eleves, setEleves] = useState([]);
  const [trimestre, setTrimestre] = useState('1');
  const [typeDevoir, setTypeDevoir] = useState('Interrogation');
  const [notesSaisies, setNotesSaisies] = useState({}); // { eleveId: { valeur: '', appreciation: '' } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 🔄 ÉCOUTEUR 1 : Charger les classes rattachées à l'établissement
  useEffect(() => {
    if (!currentSchool) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setClasses(list);
      if (list.length > 0 && !selectedClasse) {
        setSelectedClasse(list[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error("Erreur écoute classes :", err);
      setLoading(false);
    });
    return () => unsub();
  }, [currentSchool]);

  // 🔄 ÉCOUTEUR 2 : Charger les élèves de la classe sélectionnée
  useEffect(() => {
    if (!selectedClasse || !currentSchool) return;
    
    // Extraction de la racine de la classe (ex: tle_d_1)
    const morceaux = selectedClasse.toLowerCase().split('gagnoa_');
    const racineClasse = morceaux.length > 1 ? morceaux[1] : selectedClasse.toLowerCase();

    const q = query(collection(db, "users"), where("role", "==", "eleve"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      const structureInitiale = {};
      
      snap.forEach(d => {
        const data = d.data();
        const schoolClean = (data.schoolId || '').trim().toLowerCase();
        const classeClean = (data.classeId || '').trim().toLowerCase();

        if (schoolClean === currentSchool && (classeClean === racineClasse || selectedClasse.toLowerCase().includes(classeClean))) {
          list.push({ id: d.id, ...data });
          structureInitiale[d.id] = { valeur: '', appreciation: '' };
        }
      });
      
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setEleves(list);
      setNotesSaisies(structureInitiale);
    }, (err) => {
      console.error("Erreur écoute élèves :", err);
    });
    return () => unsub();
  }, [selectedClasse, currentSchool]);

  const handleChangerNote = (eleveId, champ, valeur) => {
    setNotesSaisies(prev => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], [champ]: valeur }
    }));
  };

  // 🚀 ACTION : Enregistrement de la grille de notes dans Firestore
  const handleValiderNotesDevoir = async (e) => {
    e.preventDefault();
    if (eleves.length === 0) return;

    setSaving(true);
    setMessage('');

    try {
     for (const eleve of eleves) {
        const itemNote = notesSaisies[eleve.id];
        if (!itemNote || itemNote.valeur === '') continue;

        const eleveRef = doc(db, "users", eleve.id);
        
        // 🟢 CLOISONNEMENT NoSQL : On pousse la note dans le tableau de la matière de CE trimestre spécifiquement
        // Structure finale en base : notes_trimestre_1.Français = [12, 12.45]
        await updateDoc(eleveRef, {
          [`notes_trimestre_${trimestre}.${matiereProf}`]: arrayUnion(parseFloat(itemNote.valeur)),
          updatedAt: new Date().toISOString()
        });
      }
      setMessage(`🎉 Grille de notes de ${matiereProf} enregistrée avec succès pour le Trimestre ${trimestre} !`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error("Erreur écriture notes :", err);
      alert("💥 Erreur d'écriture sur Cloud Firestore.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Ouverture du carnet de notes...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 font-sans text-gray-700 text-left animate-fadeIn">
      
      {/* RETOUR ACCUEIL PROF */}
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Bureau Enseignant
        </Link>
      </div>

      {/* BARRE DE FILTRAGE DES SESSIONS */}
      <div className="bg-white p-5 rounded-2xl border shadow-2xs mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-bold">
        <div>
          <label className="block text-gray-400 uppercase mb-1">1. Trimestre</label>
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-lg cursor-pointer outline-none bg-white">
            <option value="1">1er Trimestre</option>
            <option value="2">2ème Trimestre</option>
            <option value="3">3ème Trimestre</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-400 uppercase mb-1">2. Classe</label>
          <select value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-lg cursor-pointer outline-none bg-white">
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.nom || c.id.replace(`${currentSchool}_`, '').toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 uppercase mb-1">3. Type d'Évaluation</label>
          <select value={typeDevoir} onChange={(e) => setTypeDevoir(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-lg cursor-pointer outline-none bg-white">
            <option value="Interrogation">Interrogation</option>
            <option value="Devoir Surveillé">Devoir Surveillé</option>
            <option value="Devoir Commun">Devoir Commun</option>
          </select>
        </div>
        <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100 flex flex-col justify-center">
          <p className="text-[10px] uppercase font-black text-purple-700">Discipline Attribuée</p>
          <p className="text-sm font-black text-purple-900 mt-0.5 uppercase">📚 {matiereProf}</p>
        </div>
      </div>

      {message && <div className="mb-6 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500 animate-pulse text-left">{message}</div>}

      {/* FORMULAIRE DE GRILLE DE COMPOSITION */}
      <form onSubmit={handleValiderNotesDevoir} className="bg-white rounded-2xl border shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                <th className="p-3">Matricule</th>
                <th className="p-3">Nom & Prénoms de l'Apprenant</th>
                <th className="p-3 text-center w-28">Note /20 *</th>
                <th className="p-3">Appréciation Pédagogique</th>
              </tr>
            </thead>
            <tbody>
              {eleves.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-gray-400 italic">
                    Aucun élève trouvé dans cette division pour le moment.
                  </td>
                </tr>
              ) : (
                eleves.map((el) => {
                  const dossierNote = notesSaisies[el.id] || { valeur: '', appreciation: '' };
                  return (
                    <tr key={el.id} className="border-b border-gray-100 hover:bg-gray-50/30 transition">
                      <td className="p-3 font-mono text-gray-400">{el.matricule || el.id}</td>
                      <td className="p-3 text-gray-900 uppercase font-black">{el.nom} {el.prenoms || ''}</td>
                      <td className="p-3 text-center">
                        <input 
                          type="number" 
                          min="0" 
                          max="20" 
                          step="0.25" 
                          placeholder="--/20" 
                          value={dossierNote.valeur} 
                          onChange={(e) => handleChangerNote(el.id, 'valeur', e.target.value)} 
                          className="w-20 bg-gray-50 border rounded-lg p-2 text-center text-gray-900 font-mono font-bold outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </td>
                                            <td className="p-3">
                        <input 
                          type="text" 
                          placeholder="Ex: Bon travail, continuez ainsi." 
                          value={dossierNote.appreciation} 
                          onChange={(e) => handleChangerNote(el.id, 'appreciation', e.target.value)} 
                          className="w-full bg-gray-50 border rounded-lg p-2 text-gray-800 font-medium outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {eleves.length > 0 && (
          <div className="p-4 bg-gray-50 border-t text-right">
            <button 
              type="submit" 
              disabled={saving} 
              className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition cursor-pointer disabled:bg-gray-200"
            >
              {saving ? "Sauvegarde Cloud en cours..." : "💾 Enregistrer la Grille de Notes"}
            </button>
          </div>
        )}
      </form>

    </div>
  );
};

export default SaisieNotes;
