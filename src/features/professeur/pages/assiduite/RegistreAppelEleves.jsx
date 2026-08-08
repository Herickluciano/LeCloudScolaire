import { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';

const RegistreAppelEleves = () => {
  const { user, schoolId } = useAuth();
  
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa').trim().toLowerCase();
  
  const matiereReelleProf = (user?.matiereEnseignee || "Général").trim();
  const nomEmetteurProf = (user?.nom || user?.name || "Enseignant").trim();

  // 🟢 ACCÈS GLOBAL : La variable dateAujourdhui est désormais accessible partout dans le composant
  const dateAujourdhui = new Date().toLocaleDateString('fr-FR');

  // --- ÉTATS FORMULAIRE ET SUIVI ---
  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [eleves, setEleves] = useState([]);
  const [heureSelectionnee, setHeureSelectionnee] = useState('H1 (07h-08h)');
  const [statutsAppel, setStatutsAppel] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 🔄 ÉCOUTEUR 1 : Charger toutes les classes de l'école
  useEffect(() => {
    if (!currentSchool) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setClasses(list);
      if (list.length > 0 && !selectedClasse) {
        setSelectedClasse(list[0].id);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentSchool, selectedClasse]);

  // 🔄 ÉCOUTEUR 2 : Charger les élèves dès qu'une classe est sélectionnée
  useEffect(() => {
    if (!selectedClasse || !currentSchool) return;
    
    const morceaux = selectedClasse.toLowerCase().split('gagnoa_');
    const racineClasse = morceaux.length > 1 ? morceaux[1] : selectedClasse.toLowerCase();

    const q = query(collection(db, "users"), where("role", "==", "eleve"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      const statutsInitiaux = {};
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const schoolClean = (data.schoolId || '').trim().toLowerCase();
        const classeClean = (data.classeId || '').trim().toLowerCase();

        if (schoolClean === currentSchool && (classeClean === racineClasse || selectedClasse.toLowerCase().includes(classeClean))) {
          list.push({ id: docSnap.id, ...data });
          statutsInitiaux[docSnap.id] = 'present'; 
        }
      });

      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setEleves(list);
      setStatutsAppel(statutsInitiaux);
    });

    return () => unsub();
  }, [selectedClasse, currentSchool]);

  const handleChangerStatut = (eleveId, nouveauStatut) => {
    setStatutsAppel(prev => ({ ...prev, [eleveId]: nouveauStatut }));
  };

  // 🚀 ACTIONNEUR : Enregistrement de l'appel et calcul d'assiduité
  const handleValiderFicheAppel = async (e) => {
    e.preventDefault();
    if (!selectedClasse || eleves.length === 0) return;

    setSaving(true);
    setMessage('');

    try {
      for (const eleve of eleves) {
        const statutEleve = statutsAppel[eleve.id] || 'present';
        
        await addDoc(collection(db, "registre_appels"), {
          schoolId: currentSchool,
          classeId: selectedClasse.replace(`${currentSchool}_`, '').toLowerCase(),
          eleveId: eleve.id,
          eleveName: `${eleve.nom || ''} ${eleve.prenoms || ''}`.trim(),
          date: dateAujourdhui,
          heure: heureSelectionnee,
          profName: nomEmetteurProf,
          matiere: matiereReelleProf, 
          statut: statutEleve,
          createdAt: new Date().toISOString()
        });

       if (statutEleve === 'absent') {
          const eleveRef = doc(db, "users", eleve.id);
          await updateDoc(eleveRef, {
            // 🟢 CLOISONNEMENT : L'absence est stockée dans un objet dédié au trimestre actif (ex: absences_trimestre_1)
            [`absences_trimestre_${trimestre}`]: increment(2),
            updatedAt: new Date().toISOString()
          });
        }
        
        if (eleve.id && statutEleve === 'retard') {
          const eleveRef = doc(db, "users", eleve.id);
          await updateDoc(eleveRef, {
            retards: increment(1),
            updatedAt: new Date().toISOString()
          });
        }
      }

      setMessage(`🎉 Fiche d'appel validée avec succès pour le cours de ${matiereReelleProf} !`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error("Erreur validation appel :", err);
      alert("💥 Erreur lors du scellage de la feuille d'appel.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Ouverture du registre d'assiduité...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 font-sans text-gray-700 text-left animate-fadeIn">
      
      <div className="mb-4 text-left">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Retour au Bureau Virtuel
        </Link>
      </div>

           <div className="bg-white p-5 rounded-2xl border shadow-2xs mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-left">
          <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
            Registre d'Assiduité Numérique
          </span>
          <h2 className="text-base font-black text-gray-900 mt-1 uppercase">Cahier d'Appel Électronique</h2>
          <p className="text-[11px] text-gray-400 font-medium">Discipline active : <span className="font-bold text-purple-700">{matiereReelleProf}</span> — Enseignant : M. {nomEmetteurProf}</p>
        </div>

        <div className="flex gap-3 text-xs font-bold w-full sm:w-auto">
          <div className="w-1/2 sm:w-36">
            <label className="block text-[10px] text-gray-400 uppercase mb-1">Classe</label>
            <select value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className="w-full bg-gray-50 border p-2 rounded-lg outline-none cursor-pointer bg-white">
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.nom || c.id.replace(`${currentSchool}_`, '').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="w-1/2 sm:w-40">
            <label className="block text-[10px] text-gray-400 uppercase mb-1">Plage Horaire (Fin 18h)</label>
            <select value={heureSelectionnee} onChange={(e) => setHeureSelectionnee(e.target.value)} className="w-full bg-gray-50 border p-2 rounded-lg outline-none cursor-pointer bg-white">
              <option value="H1 (07h-08h)">H1 (07H00 - 08H00)</option>
              <option value="H2 (08h-09h)">H2 (08H00 - 09H00)</option>
              <option value="H3 (09h-10h)">H3 (09H00 - 10H00)</option>
              <option value="H4 (10h-11h)">H4 (10H00 - 11H00)</option>
              <option value="H5 (11h-12h)">H5 (11H00 - 12H00)</option>
              <option value="H6 (13h-14h)">H6 (13H00 - 14H00)</option>
              <option value="H7 (14h-15h)">H7 (14H00 - 15H00)</option>
              <option value="H8 (15h-16h)">H8 (15H00 - 16H00)</option>
              <option value="H9 (16h-17h)">H9 (16H00 - 17H00)</option>
              <option value="H10 (17h-18h)">H10 (17H00 - 18H00)</option>
            </select>
          </div>
        </div>
      </div>

      {message && <div className="mb-6 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500 animate-pulse">{message}</div>}

      <form onSubmit={handleValiderFicheAppel} className="bg-white rounded-2xl border shadow-2xs overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Liste de pointage de la division ({eleves.length} Élèves)</h3>
          <p className="text-[11px] font-mono font-bold text-gray-400">Date du jour : {dateAujourdhui}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                <th className="p-3">Matricule</th>
                <th className="p-3">Nom & Prénoms</th>
                <th className="p-3 text-center">Présence</th>
                <th className="p-3 text-center">Absence (2H)</th>
                <th className="p-3 text-right">Retard</th>
              </tr>
            </thead>
            <tbody>
              {eleves.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 italic">
                    Aucun élève trouvé dans cette classe pour le moment.
                  </td>
                </tr>
              ) : (
                eleves.map((el) => {
                  const statutCourant = statutsAppel[el.id] || 'present';
                  return (
                    <tr key={el.id} className="border-b border-gray-100 hover:bg-gray-50/30 transition">
                      <td className="p-3 font-mono text-gray-400">{el.matricule || el.id}</td>
                      <td className="p-3 text-gray-900 uppercase font-black">{el.nom} {el.prenoms || ''}</td>
                      
                      <td className="p-3 text-center">
                        <button 
                          type="button" 
                          onClick={() => handleChangerStatut(el.id, 'present')}
                          className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wide transition ${statutCourant === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          🟢 Présent
                        </button>
                      </td>

                      <td className="p-3 text-center">
                        <button 
                          type="button" 
                          onClick={() => handleChangerStatut(el.id, 'absent')}
                          className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wide transition ${statutCourant === 'absent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          🛑 Absent
                        </button>
                      </td>

                      <td className="p-3 text-right">
                        <button 
                          type="button" 
                          onClick={() => handleChangerStatut(el.id, 'retard')}
                          className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wide transition ${statutCourant === 'retard' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          🟡 Retard
                        </button>
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
              className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition shadow-md cursor-pointer disabled:bg-gray-200"
            >
              {saving ? "Sauvegarde Cloud en cours..." : "⚡ Enregistrer la Feuille d'Appel"}
            </button>
          </div>
        )}
      </form>

    </div>
  );
};

export default RegistreAppelEleves;
