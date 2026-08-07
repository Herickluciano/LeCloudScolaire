import { useState, useEffect } from 'react';
import { db } from '../../../../services/api'; 
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';

const FaireAppel = () => {
  const { user, schoolId, schoolName } = useAuth();
  
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa').trim();
  const enseignantId = user?.matricule || user?.id || 'PROF_UNKNOWN';
  const classeAssignee = (user?.classeId || '5eme_1').toUpperCase();

  const [historiquePointages, setHistoriquePointages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!enseignantId || !currentSchool) {
      setLoading(false);
      return;
    }
    const qPointages = query(
      collection(db, "pointages_professeurs"),
      where("schoolId", "==", currentSchool),
      where("professeurId", "==", enseignantId)
    );
    const unsubscribe = onSnapshot(qPointages, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => { list.push({ id: docSnap.id, ...docSnap.data() }); });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistoriquePointages(list);
      setLoading(false);
    }, (err) => { setLoading(false); });
    return () => unsubscribe();
  }, [enseignantId, currentSchool]);

  const handleValiderEmargementVacation = async () => {
    setToast({ type: '', text: '' });
    setSending(true);

    const heureActuelle = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const dateActuelle = new Date().toLocaleDateString('fr-FR');

    try {
      await addDoc(collection(db, "pointages_professeurs"), {
        professeurId: enseignantId,
        professeurName: user?.name || "Enseignant",
        schoolId: currentSchool,
        classeId: classeAssignee.toLowerCase(),
        heurePointage: heureActuelle,
        datePointage: dateActuelle,
        statutVacation: "certifiee_cloud",
        verificationMethode: "Bypass Démo Universel",
        createdAt: new Date().toISOString()
      });

      setToast({
        type: 'success',
        text: `⏱️ Émargement certifié avec succès !\nVacation validée à ${heureActuelle} pour la classe ${classeAssignee}.`
      });
    } catch (err) {
      setToast({ type: 'error', text: "💥 Échec de connexion cloud." });
    } finally {
      setSending(false);
      setTimeout(() => setToast({ type: '', text: '' }), 5000);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">Ouverture du terminal...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen relative animate-fadeIn">
      {toast.text && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border-l-4 flex items-center justify-between gap-4 max-w-sm w-full bg-slate-900 border-emerald-500 text-emerald-400 text-xs font-bold animate-fadeIn">
          <p className="whitespace-pre-line text-left">⏱️ {toast.text}</p>
          <button type="button" onClick={() => setToast({ type: '', text: '' })} className="text-slate-500 hover:text-white text-sm cursor-pointer">✕</button>
        </div>
      )}
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">⬅️ Bureau Enseignant</Link>
      </div>
      <div className="bg-purple-900 text-white p-6 rounded-2xl shadow-md mb-8">
        <h1 className="text-xl md:text-2xl font-black">⏱️ Émargement Virtuel Libéré</h1>
        <p className="text-xs text-purple-200">Établissement : <span className="font-bold text-orange-400 uppercase">{schoolName || currentSchool}</span></p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white rounded-2xl border p-6 shadow-sm flex flex-col justify-between">
          <div className="text-left text-xs font-bold">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2 mb-4">Axe de Validation du Cours</h3>
            <p className="text-sm font-black text-gray-800">Classe : {classeAssignee}</p>
            <p className="text-xs text-gray-500 font-medium mt-4 bg-purple-50 p-3 rounded-xl border border-purple-100">💡 Mode Démo : Pointage ouvert sans restriction matérielle ou GPS.</p>
          </div>
          <button type="button" onClick={handleValiderEmargementVacation} disabled={sending} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-black py-4 rounded-xl uppercase text-xs tracking-wider shadow-md transition mt-6 cursor-pointer">
            {sending ? "Certification Cloud..." : "🛫 Émarger ma Présence"}
          </button>
        </div>
        <div className="bg-white rounded-2xl border p-5 shadow-sm h-fit text-xs font-bold">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">📊 Historique live ({historiquePointages.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {historiquePointages.length === 0 ? <p className="text-gray-400 text-center py-6 font-medium">Aucun pointage ce mois-ci.</p> : historiquePointages.map((pt) => (
              <div key={pt.id} className="p-2.5 bg-gray-50 border rounded-xl flex justify-between items-center">
                <p className="text-gray-900 font-mono text-[11px]">{pt.datePointage} à {pt.heurePointage}</p>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">✓ Validé</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaireAppel;
