import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';

const SaisieNotes = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = schoolId || 'lycee_classique_abidjan';

  // --- ÉTATS DES DONNÉES CLOUD ---
  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ÉTATS DES FORMULAIRES ---
  const [selectedClasseId, setSelectedClasseId] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState('Mathématiques');
  const [attendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeSubTab, setActiveSubTab] = useState('appel'); // 'appel' | 'notes' | 'principal'

  // 🔄 1. CHARGEMENT EN TEMPS RÉEL DES CLASSES ASSIGNÉES AU PROFESSEUR
  useEffect(() => {
    if (!user) return;

    // Filtre pour ne récupérer que les classes de cette école
    const qClasses = query(
      collection(db, "classes"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Optionnel : Si l'admin a renseigné le profPrincipalId ou s'il est dans les classes attribuées
        if (data.profPrincipalId === user.id || user.assigned_classes?.includes(docSnap.id) || user.role === 'admin') {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setClasses(list);
      
      // Sélectionner la première classe disponible par défaut
      if (list.length > 0 && !selectedClasseId) {
        setSelectedClasseId(list[0].id);
      }
      setLoading(false);
    });

    return () => unsubscribeClasses();
  }, [user, currentSchool]);

  // 🔄 2. CHARGEMENT EN TEMPS RÉEL DES ÉLÈVES DE LA CLASSE SÉLECTIONNÉE
  useEffect(() => {
    if (!selectedClasseId) {
      setEleves([]);
      return;
    }

    const qEleves = query(
      collection(db, "users"),
      where("role", "==", "eleve"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", selectedClasseId)
    );

    const unsubscribeEleves = onSnapshot(qEleves, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEleves(list);
    });

    return () => unsubscribeEleves();
  }, [selectedClasseId, currentSchool]);

  // 🔴 POINTAGE DES ABSENCES SUR LE CLOUD
  const handleMarkAbsence = async (eleveId, currentAbsences = 0) => {
    try {
      const eleveRef = doc(db, "users", eleveId);
      await updateDoc(eleveRef, {
        absences: (currentAbsences || 0) + 1
      });
      alert("🔴 1 Heure d'absence cumulée au dossier de l'élève !");
    } catch (err) {
      console.error(err);
      alert("Erreur technique de transmission.");
    }
  };

  // 📝 ENREGISTREMENT EN DIRECT DES EVALUATIONS (INTERROGATIONS)
  const handleAddGrade = async (eleveId, noteValue) => {
    const val = parseFloat(noteValue);
    if (isNaN(val) || val < 0 || val > 20) {
      alert("Veuillez entrer une note valide entre 0 et 20.");
      return;
    }

    try {
      const eleveRef = doc(db, "users", eleveId);
      // Utilisation du chemin dynamique Firebase pour cibler le tableau de la matière
      await updateDoc(eleveRef, {
        [`notes.${selectedMatiere}`]: arrayUnion(val)
      });
      alert(`🎯 Note de ${val}/20 enregistrée avec succès !`);
    } catch (err) {
      console.error(err);
      alert("Erreur de liaison avec la base de données cloud.");
    }
  };

  // 👑 VALIDATION CONSEIL DE CLASSE : ARRÊTER LA MOYENNE DU TRIMESTRE
  const handleSaveMoyenneFinale = async (eleveId, moyenneValue) => {
    const val = parseFloat(moyenneValue);
    if (isNaN(val) || val < 0 || val > 20) return;

    try {
      const eleveRef = doc(db, "users", eleveId);
      await updateDoc(eleveRef, {
        [`moyennesTrimestrielles.trimestre_1`]: val
      });
      alert(`👑 Moyenne trimestrielle (${val}/20) verrouillée !`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center font-sans rounded-xl bg-white p-8 shadow">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-semibold">Chargement des structures Cloud...</p>
      </div>
    );
  }

  const classeActiveInfo = classes.find(c => c.id === selectedClasseId);

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      
      {/* En-tête de classe */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Cahier de Classe & Registre d'Évaluations</h1>
          <p className="text-sm text-gray-500 font-medium">
            Enseignant : <span className="font-bold text-gray-700">{user?.name}</span> — Établissement : <span className="text-orange-600 font-bold uppercase">{schoolName}</span>
          </p>
        </div>

        {/* Sélecteur de structure cloud filtré */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Structure :</label>
          <select 
            value={selectedClasseId} 
            onChange={(e) => setSelectedClasseId(e.target.value)} 
            className="border rounded-lg p-2 text-sm bg-white font-bold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            {classes.length === 0 && <option value="">Aucune classe assignée</option>}
          </select>
        </div>
      </div>

      {/* Onglets d'action */}
      <div className="flex space-x-2 mb-6 border-b">
        <button onClick={() => setActiveSubTab('appel')} className={`py-2 px-4 font-bold text-sm transition ${activeSubTab === 'appel' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>📋 Cahier d'Appel</button>
        <button onClick={() => setActiveSubTab('notes')} className={`py-2 px-4 font-bold text-sm transition ${activeSubTab === 'notes' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>📝 Saisie des Notes</button>
        
        {/* Vérification du grade de prof principal pour débloquer l'onglet conseil de classe */}
        {(user?.role === 'prof_principal' || classeActiveInfo?.profPrincipalId === user?.id) && (
          <button onClick={() => setActiveSubTab('principal')} className="py-2 px-4 font-bold text-sm bg-purple-100 text-purple-700 rounded-t-lg shadow-xs">👑 Conseil de Classe</button>
        )}
      </div>

      {/* RENDER 1 : CAHIER D'APPEL */}
      {activeSubTab === 'appel' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500 uppercase">Séance de Cours du : {attendanceDate}</span>
            <span className="text-xs font-mono font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Effectif réel : {eleves.length}</span>
          </div>
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-100 font-bold text-gray-700 text-xs uppercase border-b">
              <tr>
                <th className="p-4">Matricule</th>
                <th className="p-4">Nom & Prénoms de l'Élève</th>
                <th className="p-4 text-center">Absences cumulées</th>
                <th className="p-4 text-center">Action de cours</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-600">
              {eleves.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-mono font-bold text-gray-900">{e.matricule || e.id}</td>
                  <td className="p-4 font-bold text-gray-800 uppercase">{e.nom} {e.prenoms}</td>
                  <td className="p-4 text-center font-mono font-bold text-orange-600">{e.absences || 0} H</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleMarkAbsence(e.id, e.absences)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-extrabold hover:bg-red-100 transition shadow-xs">
                      🔴 Signaler 1h d'Absence
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

            {/* RENDER 2 : CARNET DE NOTES */}
      {activeSubTab === 'notes' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-4">
          <div className="mb-4 flex items-center space-x-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Matière évaluée :</label>
            <select value={selectedMatiere} onChange={(e) => setSelectedMatiere(e.target.value)} className="border rounded-lg p-2 text-sm bg-white font-semibold outline-none focus:ring-2 focus:ring-orange-500">
              <option value="Mathématiques">Mathématiques</option>
              <option value="Français">Français</option>
              <option value="Anglais">Anglais</option>
              <option value="Physique-Chimie">Physique-Chimie</option>
              <option value="SVT">SVT</option>
            </select>
          </div>
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-100 text-gray-700 font-bold text-xs uppercase border-b">
              <tr>
                <th className="p-4">Nom & Prénoms</th>
                <th className="p-4">Notes d'Interrogations</th>
                <th className="p-4">Saisir une Note (Entrée)</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-600">
              {eleves.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-bold text-gray-800 uppercase">{e.nom} {e.prenoms}</td>
                  <td className="p-4 font-mono font-bold text-gray-900 tracking-wide">
                    {e.notes && e.notes[selectedMatiere] && e.notes[selectedMatiere].length > 0 
                      ? e.notes[selectedMatiere].join('  |  ') 
                      : <span className="text-gray-300 italic text-xs">Aucune évaluation</span>}
                  </td>
                  <td className="p-4">
                    <input 
                      type="number" 
                      min="0" 
                      max="20" 
                      step="0.5"
                      placeholder="Note /20" 
                      onKeyDown={(evt) => { 
                        if (evt.key === 'Enter') { 
                          handleAddGrade(e.id, evt.target.value); 
                          evt.target.value = ''; 
                        } 
                      }} 
                      className="border rounded-lg px-3 py-1.5 text-sm w-28 focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold shadow-xs" 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* RENDER 3 : CONSEIL DE CLASSE PROFS PRINCIPAUX */}
      {activeSubTab === 'principal' && (
        <div className="bg-white rounded-xl border border-purple-200 shadow-md p-5">
          <h2 className="text-purple-900 font-black text-lg mb-1">👑 Arrêté des Moyennes Trimestrielles Finales</h2>
          <p className="text-xs text-purple-500 font-medium mb-4">Sous l'autorité du Professeur Principal — Validation des dossiers du 1er Trimestre</p>
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-purple-50 text-purple-900 font-bold text-xs uppercase border-b">
              <tr>
                <th className="p-4">Nom & Prénoms de l'Élève</th>
                <th className="p-4 text-center">Moyenne Générale Validée du Trimestre</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-600">
              {eleves.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-bold text-gray-800 uppercase">{e.nom} {e.prenoms}</td>
                  <td className="p-4 text-center">
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="20" 
                      defaultValue={e.moyennesTrimestrielles?.trimestre_1 || ''}
                      placeholder="Moyenne /20" 
                      onKeyDown={(evt) => {
                        if (evt.key === 'Enter') {
                          handleSaveMoyenneFinale(e.id, evt.target.value);
                        }
                      }}
                      className="border border-purple-300 rounded-lg text-center py-1.5 w-32 text-sm font-black text-purple-700 outline-none focus:ring-2 focus:ring-purple-500 shadow-xs" 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {eleves.length === 0 && selectedClasseId && (
        <div className="p-8 text-center text-gray-400 font-medium bg-white rounded-xl border border-dashed mt-4">
          Aucun élève n'est encore inscrit par l'éducateur dans cette structure.
        </div>
      )}
     <div className="mb-4">
        {/* 🟢 CORRECTION : Redirige vers le bon chemin configuré */}
        <Link 
          to="/prof/dashboardProf" 
          className="inline-flex items-center text-xs font-bold bg-purple-900 hover:bg-purple-800 text-purple-100 px-4 py-2 rounded-lg transition shadow-sm"
        >
          ⬅️ Retour au Tableau de bord Enseignant
        </Link>
      </div>


    </div>
  );
};

export default SaisieNotes;
