import { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const ConseilClasse = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';
  
  // --- ÉTATS CLOUD ---
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // --- ÉTATS FORMULAIRES ---
  const [trimestre, setTrimestre] = useState('1');
  const [eleveSelectionne, setEleveSelectionnee] = useState(null);
  
  // États de saisie pour les décisions du conseil
  const [appreciation, setAppreciation] = useState('');
  const [mention, setMention] = useState('Tableau d\'Honneur');
  const [statutConduite, setStatutConduite] = useState('Très Bonne');
  const [saving, setSaving] = useState(false);

  // 🔄 ÉCOUTEUR EN TEMPS RÉEL (onSnapshot) : Charger les élèves de la classe du PP
  useEffect(() => {
    const maClasseId = user?.classeId || '5eme_1';

    const q = query(
      collection(db, "users"),
      where("role", "==", "eleve"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", maClasseId.trim().toLowerCase())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEleves(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur Conseil de classe :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentSchool]);

  // 🟢 CHARGEMENT DES DONNÉES DU CONSEIL DÉJÀ EXISTANTES POUR L'ÉLÈVE SÉLECTIONNÉ
  const handleOuvrirDossierEleve = (student) => {
    setEleveSelectionnee(student);
    const cheminConseil = student.decisionsConseil?.[`trimestre_${trimestre}`] || {};
    setAppreciation(cheminConseil.appreciationPP || '');
    setMention(cheminConseil.mentionOfficielle || 'Tableau d\'Honneur');
    setStatutConduite(cheminConseil.conduite || 'Très Bonne');
  };

  // 💾 ENREGISTRER LA DÉCISION DU CONSEIL EN DIRECT SUR LE CLOUD
  const handleEnregistrerDecision = async (e) => {
    e.preventDefault();
    if (!eleveSelectionne) return;

    setSaving(true);
    try {
      const eleveRef = doc(db, "users", eleveSelectionne.id);
      
      // Injection de la map décisionnelle sans détruire le reste du profil de l'élève
      await updateDoc(eleveRef, {
        [`decisionsConseil.trimestre_${trimestre}`]: {
          appreciationPP: appreciation.trim(),
          mentionOfficielle: mention,
          conduite: statutConduite,
          profPrincipalId: user?.matricule || 'PP_MASTER',
          updatedAt: new Date().toISOString()
        }
      });

      setMessage(`🎉 Délibération validée avec succès pour l'élève ${eleveSelectionne.nom} !`);
      setEleveSelectionnee(null); // Ferme la zone de saisie
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert("Erreur de liaison réseau lors du scellage de la décision.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse">Ouverture du Tribunal Académique Virtuel...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen">
      
      {/* RETOUR ARRIÈRE */}
      <div className="mb-4">
        <Link to="/prof/dashboard-pp" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Tour de Contrôle PP
        </Link>
      </div>

      {/* EN-TÊTE DU CONSEIL */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
            ⚖️ Délibérations & Mentions de Conseils
          </span>
          <h2 className="text-xl font-black text-gray-800 mt-2">Saisie des Appréciations du Titulaire</h2>
          <p className="text-xs text-gray-400 font-medium">Établissement : <span className="font-bold text-orange-600 uppercase">{schoolName}</span> — Classe : <span className="font-bold text-gray-700">{(user?.classeId || '5eme_1').toUpperCase()}</span></p>
        </div>

        <div>
          <select value={trimestre} onChange={(e) => { setTrimestre(e.target.value); setEleveSelectionnee(null); }} className="bg-gray-50 border text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
            <option value="1">1er Trimestre</option>
            <option value="2">2ème Trimestre</option>
            <option value="3">3ème Trimestre</option>
          </select>
        </div>
      </div>

      {message && <div className="mb-6 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500 animate-pulse">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNE GAUCHE : LISTE DE SÉLECTION ÉLÈVES */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-xs overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Registre des décisions de la classe ({eleves.length} Éléves)</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                <tr>
                  <th className="p-3">Nom & Prénoms</th>
                  <th className="p-3 text-center">Moyenne T{trimestre}</th>
                  <th className="p-3 text-center">Statut Décision</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700 font-bold">
                {eleves.map((student) => {
                  const moyenneEleve = student.moyennesTrimestrielles?.[`trimestre_${trimestre}`];
                  const aDejaDecision = !!student.decisionsConseil?.[`trimestre_${trimestre}`];
                  
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/30 transition">
                      <td className="p-3 uppercase text-gray-900 font-black">
                        {student.nom} <span className="font-normal text-gray-600 lowercase first-letter:uppercase">{student.prenoms || student.prenom}</span>
                      </td>
                      <td className="p-3 text-center font-mono text-purple-700 font-black">
                        {moyenneEleve !== undefined && moyenneEleve !== null ? parseFloat(moyenneEleve).toFixed(2) : '--'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-black ${
                          aDejaDecision ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {aDejaDecision ? '✅ Remplie' : '⏳ À délibérer'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          type="button"
                          onClick={() => handleOuvrirDossierEleve(student)}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          ⚖️ Délibérer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLONNE DROITE : SENSEUR DE TRAITEMENT ET FORMULAIRE DU CONSEIL */}
        <div className="bg-white rounded-xl border p-5 shadow-sm h-fit">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2 mb-4">Fiche de Délibération Civile</h3>
          
          {eleveSelectionne ? (
            <form onSubmit={handleEnregistrerDecision} className="space-y-4 text-xs font-bold text-gray-700">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <span className="text-[9px] text-purple-400 uppercase font-black block">Apprenant sélectionné :</span>
                <span className="text-xs font-black text-purple-900 uppercase block mt-0.5">{eleveSelectionne.nom} {eleveSelectionne.prenoms}</span>
                <span className="text-[10px] text-purple-600 font-mono block mt-1">Moyenne Générale : {eleveSelectionne.moyennesTrimestrielles?.[`trimestre_${trimestre}`] || '--'} / 20</span>
              </div>

                            <div>
                <label className="block text-gray-400 uppercase mb-1">1. Conduite & Comportement</label>
                <select value={statutConduite} onChange={(e) => setStatutConduite(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer">
                  <option value="Très Bonne">😇 Très Bonne Conduite (Modèle)</option>
                  <option value="Bonne">👍 Bonne et Calme</option>
                  <option value="Assez Bonne">😐 Assez Bonne / À surveiller</option>
                  <option value="Blâmable">⚠️ Indiscipline / Conduite Blâmable</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 uppercase mb-1">2. Mention d'Honneur / Sanction</label>
                <select value={mention} onChange={(e) => setMention(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer">
                  <option value="Félicitations">🎖️ Félicitations du Conseil (Moy &ge; 14)</option>
                  <option value="Encouragements">🌟 Encouragements du Conseil (Moy &ge; 12)</option>
                  <option value="Tableau d'Honneur">📜 Tableau d'Honneur (Moy &ge; 10)</option>
                  <option value="Avertissement">⚠️ Avertissement Travail / Conduite (Moy &lt; 10)</option>
                  <option value="Blâme">❌ Blâme du Conseil de Discipline</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 uppercase mb-1">3. Appréciation Générale du Professeur Principal</label>
                <textarea 
                  rows="4" 
                  maxLength="150"
                  placeholder="Ex: Excellent trimestre. Élève sérieux, rigoureux et assidu. Continuez ainsi !" 
                  value={appreciation} 
                  onChange={(e) => setAppreciation(e.target.value)} 
                  className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none font-medium text-gray-600 focus:ring-2 focus:ring-purple-500"
                  required
                ></textarea>
                <p className="text-[9px] text-gray-400 text-right mt-0.5">Maximum 150 caractères (S'imprime sur le bulletin) [local].</p>
              </div>

              <div className="flex gap-2 pt-2 text-[10px] uppercase font-black">
                <button type="button" onClick={() => setEleveSelectionnee(null)} className="w-1/3 border py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 transition cursor-pointer">Fermer</button>
                <button type="submit" disabled={saving} className="w-2/3 bg-purple-700 hover:bg-purple-800 text-white py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:bg-gray-300">
                  {saving ? "Scellage..." : "💾 Sceller l'Avis"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-16 text-gray-400 font-semibold">
              <span className="text-3xl block mb-2">⚖️</span>
              Sélectionnez un élève à gauche en cliquant sur <strong className="text-purple-600 font-black">« Délibérer »</strong> pour ouvrir son dossier d'appréciations trimestrielles [local].
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ConseilClasse;
