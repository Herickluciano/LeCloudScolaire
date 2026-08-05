import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const SaisieNotes = () => {
  const { user, schoolId, schoolName } = useAuth();
  
  const currentSchool = schoolId || user?.schoolId || 'lycee_Moderne_Gagnoa';
  const nomEcoleAffiche = schoolName || currentSchool.replace(/_/g, ' ').toUpperCase();

  // --- ÉTATS DES DONNÉES CLOUD ---
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // --- ÉTATS DES FORMULAIRES ---
  const [selectedClasseId, setSelectedClasseId] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState(user?.matiereEnseignee || 'Français');
  const [activeSubTab, setActiveSubTab] = useState('notes'); // 'appel' | 'notes' | 'principal'
  
  // États tampons locaux pour la saisie
  const [inputNotes, setInputNotes] = useState({});
  const [inputMoyennes, setInputMoyennes] = useState({});

  // 🔄 1. CHARGEMENT EN TEMPS RÉEL DES CLASSES DE L'ÉTABLISSEMENT
  useEffect(() => {
    if (!currentSchool) return;

    const qClasses = query(
      collection(db, "classes"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClasses(list);
      
      if (list.length > 0 && !selectedClasseId) {
        setSelectedClasseId(list[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribeClasses();
  }, [currentSchool, selectedClasseId]);

  // 🔄 2. CHARGEMENT EN TEMPS RÉEL DES ÉLÈVES DE LA CLASSE SÉLECTIONNÉE
  useEffect(() => {
    if (!selectedClasseId) {
      setEleves([]);
      return;
    }

    const cleanClassId = selectedClasseId.includes(`${currentSchool}_`) 
      ? selectedClasseId.replace(`${currentSchool}_`, '') 
      : selectedClasseId;

    const qEleves = query(
      collection(db, "users"),
      where("role", "==", "eleve"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", cleanClassId)
    );

    const unsubscribeEleves = onSnapshot(qEleves, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEleves(list);
    }, (err) => {
      console.error(err);
    });

    return () => unsubscribeEleves();
  }, [selectedClasseId, currentSchool]);

  // 🔴 POINTAGE DES ABSENCES SÉCURISÉ
  const handleMarkAbsence = async (eleveId, currentAbsences = 0) => {
    try {
      const eleveRef = doc(db, "users", eleveId);
      await updateDoc(eleveRef, {
        absences: (currentAbsences || 0) + 1
      });
      setMessage("🛑 1 Heure d'absence cumulée en direct sur le Cloud !");
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // 📝 ACTION : ENREGISTRER LA NOTE
  const handleAddGrade = async (eleveId) => {
    const noteValue = inputNotes[eleveId];
    const val = parseFloat(noteValue);
    
    if (isNaN(val) || val < 0 || val > 20) {
      alert("⚠️ Veuillez entrer une note valide comprise entre 0 et 20.");
      return;
    }

    try {
      const eleveRef = doc(db, "users", eleveId);
      const matiereCle = selectedMatiere.trim();

      await updateDoc(eleveRef, {
        [`notes.${matiereCle}`]: arrayUnion(val)
      });
      
      setMessage(`🎯 Note de ${val}/20 publiée avec succès !`);
      setInputNotes(prev => ({ ...prev, [eleveId]: '' })); 
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // 🟢 NOUVELLE ACTION EN TEMPS RÉEL : REPRENDRE / EFFACER LA NOTE ERRONÉE
  const handleResetGrades = async (eleveId) => {
    const confirmer = window.confirm("🔄 Voulez-vous réinitialiser et reprendre la saisie des notes pour cet élève dans cette matière ?");
    if (!confirmer) return;

    try {
      const eleveRef = doc(db, "users", eleveId);
      const matiereCle = selectedMatiere.trim();

      // Supprime ou vide le tableau des notes de la matière ciblée sur le Cloud
      await updateDoc(eleveRef, {
        [`notes.${matiereCle}`]: [] // Vide la liste pour recommencer à zéro
      });

      setMessage("🔄 Saisie réinitialisée ! Vous pouvez reprendre les notes de l'élève.");
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réinitialisation.");
    }
  };

  // 👑 CONSEIL DE CLASSE : ARRÊTER LA MOYENNE DU TRIMESTRE
  const handleSaveMoyenneFinale = async (eleveId) => {
    const moyenneValue = inputMoyennes[eleveId];
    const val = parseFloat(moyenneValue);
    if (isNaN(val) || val < 0 || val > 20) {
      alert("⚠️ Veuillez entrer une moyenne valide.");
      return;
    }

    try {
      const eleveRef = doc(db, "users", eleveId);
      await updateDoc(eleveRef, {
        [`moyennesTrimestrielles.trimestre_1`]: val
      });
      setMessage(`👑 Moyenne trimestrielle (${val}/20) verrouillée !`);
      setInputMoyennes(prev => ({ ...prev, [eleveId]: '' }));
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // 🟢 NOUVELLE ACTION EN TEMPS RÉEL : REPRENDRE LA MOYENNE DU CONSEIL
  const handleResetMoyenne = async (eleveId) => {
    const confirmer = window.confirm("🔄 Déverrouiller le conseil de classe et reprendre la moyenne de cet élève ?");
    if (!confirmer) return;

    try {
      const eleveRef = doc(db, "users", eleveId);
      await updateDoc(eleveRef, {
        [`moyennesTrimestrielles.trimestre_1`]: null // Libère le verrou en le remettant à null
      });
      setMessage("🔄 Conseil déverrouillé ! Vous pouvez recalculer et reprendre la moyenne.");
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center font-sans rounded-xl bg-white p-8 shadow">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-semibold">Chargement du registre d'évaluation...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
      
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
          ⬅️ Bureau Virtuel
        </Link>
      </div>

      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight">Cahier de Classe & Registre d'Évaluations</h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Enseignant : <span className="font-bold text-purple-700">M. {user?.name || user?.nom || 'GOUEDE'}</span> — Établissement : <span className="text-orange-600 font-black uppercase">{nomEcoleAffiche}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Structure :</label>
          <select 
            value={selectedClasseId} 
            onChange={(e) => setSelectedClasseId(e.target.value)} 
            className="border rounded-lg p-2 text-xs bg-white font-bold text-gray-700 shadow-2xs focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            {classes.map(c => {
              const nameClean = c.id.replace(`${currentSchool}_`, '').toUpperCase();
              return <option key={c.id} value={c.id}>Classe : {nameClean}</option>;
            })}
            {classes.length === 0 && <option value="5eme_1">Classe : 5EME_1</option>}
          </select>
        </div>
      </div>

      <div className="flex space-x-2 mb-6 border-b text-xs sm:text-sm">
        <button onClick={() => setActiveSubTab('appel')} className={`py-2 px-4 font-bold transition ${activeSubTab === 'appel' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}>📋 Cahier d'Appel</button>
        <button onClick={() => setActiveSubTab('notes')} className={`py-2 px-4 font-bold transition ${activeSubTab === 'notes' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}>📝 Saisie des Notes</button>
        <button onClick={() => setActiveSubTab('principal')} className={`py-2 px-4 font-bold transition ${activeSubTab === 'principal' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}>👑 Conseil de Classe</button>
      </div>

      {message && <div className="mb-4 p-2.5 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg animate-pulse">{message}</div>}

      {/* ================= RENDER 1 : CAHIER D'APPEL ================= */}
      {activeSubTab === 'appel' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase">Registre de Présences Horaire</span>
            <span className="text-[10px] sm:text-xs font-mono font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Effectif : {eleves.length}</span>
          </div>
                    <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-gray-50 font-black text-gray-400 text-[10px] uppercase border-b">
                <tr>
                  <th className="p-4">Matricule</th>
                  <th className="p-4">Nom & Prénoms de l'Élève</th>
                  <th className="p-4 text-center">Absences</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700 font-bold">
                {eleves.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 font-mono text-gray-400 text-xs">{student.matricule || student.id}</td>
                    <td className="p-4 uppercase text-gray-900 font-black">
                      {student.nom} <span className="font-normal lowercase first-letter:uppercase text-gray-600">{student.prenoms || student.prenom}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${student.absences > 4 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {student.absences || 0} H
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        type="button" 
                        onClick={() => handleMarkAbsence(student.id, student.absences)} 
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-black text-[10px] uppercase px-3 py-1.5 rounded-lg transition"
                      >
                        🛑 Marquer Absent
                      </button>
                    </td>
                  </tr>
                ))}
                {eleves.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-400 font-bold">
                      Aucun élève trouvé dans la classe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= RENDER 2 : SAISIE DES NOTES ================= */}
      {activeSubTab === 'notes' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-4 bg-purple-900 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider">Discipline Active : {selectedMatiere.toUpperCase()}</span>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={selectedMatiere} 
                onChange={(e) => setSelectedMatiere(e.target.value)}
                className="bg-purple-800 text-white text-xs font-bold px-2 py-1 rounded border border-purple-700 focus:outline-none" 
                placeholder="Ex: Français, Mathématiques..."
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-gray-100 font-black text-gray-400 text-[10px] uppercase border-b">
                <tr>
                  <th className="p-4">Nom de l'Élève</th>
                  <th className="p-4 text-center">Notes existantes (Notes Cloud)</th>
                  <th className="p-4 text-center" style={{ width: '280px' }}>Actions Évaluations</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700 font-bold">
                {eleves.map((student) => {
                  const studentGrades = student.notes?.[selectedMatiere] || [];
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 uppercase text-gray-900 font-black">
                        {student.nom} <span className="font-normal text-gray-600 lowercase first-letter:uppercase">{student.prenoms || student.prenom}</span>
                      </td>
                      <td className="p-4 text-center font-mono text-purple-700 tracking-wider">
                        {studentGrades.length > 0 ? studentGrades.join(' | ') : <span className="text-gray-300 font-sans font-normal text-xs">Aucune note</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <input 
                            type="number" 
                            min="0" 
                            max="20" 
                            step="0.25" 
                            placeholder="Note" 
                            value={inputNotes[student.id] || ''} 
                            onChange={(e) => setInputNotes(prev => ({ ...prev, [student.id]: e.target.value }))}
                            className="w-14 p-1.5 border rounded-lg text-center font-mono outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                          />
                          <button 
                            type="button"
                            onClick={() => handleAddGrade(student.id)} 
                            className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] uppercase font-black transition"
                          >
                            💾 Enregistrer
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleResetGrades(student.id)} 
                            className="bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 px-2 py-1.5 rounded-lg text-[10px] uppercase font-black transition"
                          >
                            🔄 Reprendre
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= RENDER 3 : CONSEIL DE CLASSE ================= */}
      {activeSubTab === 'principal' && (
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-4 bg-purple-100 border-b border-purple-200">
            <span className="text-xs font-black text-purple-800 uppercase tracking-wider">🔒 Clôture Trimestrielle / Validation des Bulletins</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-purple-50 text-[10px] font-black uppercase text-purple-500 border-b">
                <tr>
                  <th className="p-4">Identité Civile</th>
                  <th className="p-4 text-center">Moyenne Verrouillée</th>
                  <th className="p-4 text-center" style={{ width: '280px' }}>Arrêter Moyenne</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700 font-bold">
                {eleves.map((student) => {
                  const moyenneT1 = student.moyennesTrimestrielles?.trimestre_1;
                  return (
                    <tr key={student.id} className="hover:bg-purple-50/20 transition">
                      <td className="p-4 uppercase text-gray-900 font-black">
                        {student.nom} <span className="font-normal text-gray-600 lowercase first-letter:uppercase">{student.prenoms || student.prenom}</span>
                      </td>
                      <td className="p-4 text-center font-mono text-base text-purple-900 font-black">
                        {moyenneT1 !== undefined ? `${moyenneT1} / 20` : <span className="text-gray-300 font-sans font-normal text-xs">En attente</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <input 
                            type="number" 
                            min="0" 
                            max="20" 
                            step="0.01" 
                            placeholder="Moy" 
                            value={inputMoyennes[student.id] || ''} 
                            onChange={(e) => setInputMoyennes(prev => ({ ...prev, [student.id]: e.target.value }))}
                            className="w-16 p-1.5 border rounded-lg text-center font-mono outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                          />
                          <button type="button" onClick={() => handleSaveMoyenneFinale(student.id)} className="bg-purple-900 hover:bg-purple-950 text-white px-2.5 py-1.5 rounded-lg text-[10px] uppercase font-black transition">
                            🔒 Verrouiller
                          </button>
                          <button type="button" onClick={() => handleResetMoyenne(student.id)} className="bg-gray-100 hover:bg-purple-50 text-gray-500 hover:text-purple-700 border border-gray-200 px-2 py-1.5 rounded-lg text-[10px] uppercase font-black transition">
                            🔄 Reprendre
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default SaisieNotes;

            