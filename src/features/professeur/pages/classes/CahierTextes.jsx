import { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';

const CahierTextes = () => {
  const { user, schoolId } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  // --- ÉTATS ---
  const [classes, setClasses] = useState([]);
  const [classeSelectionnee, setClasseSelectionnee] = useState('');
  const [lecons, setLecons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulaire de leçon
  const [titreSeance, setTitreSeance] = useState('');
  const [resumeCours, setResumeCours] = useState('');
  const [devoirMaison, setDevoirMaison] = useState('');
  const [sending, setSending] = useState(false);

  // 🔄 1. Charger la liste des classes
  useEffect(() => {
    if (!currentSchool) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setClasses(list);
      if (list.length > 0 && !classeSelectionnee) {
        setClasseSelectionnee(list[0].id.replace(`${currentSchool}_`, ''));
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentSchool]);

  // 🔄 2. ÉCUTEUR TEMPS RÉEL (onSnapshot) : Liste chronologique des leçons validées
  useEffect(() => {
    if (!classeSelectionnee) return;
    const q = query(
      collection(db, "cahier_textes"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", classeSelectionnee),
      where("matiere", "==", user?.matiereEnseignee || "Mathématiques")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLecons(list);
    });
    return () => unsub();
  }, [classeSelectionnee, currentSchool, user]);

  // 🚀 ACTION : Émarger et valider la séance de cours en direct
  const handleValidateSeance = async (e) => {
    e.preventDefault();
    if (!titreSeance.trim() || !resumeCours.trim()) return;

    setSending(true);
    try {
      await addDoc(collection(db, "cahier_textes"), {
        classeId: classeSelectionnee,
        schoolId: currentSchool,
        matiere: user?.matiereEnseignee || "Mathématiques",
        profName: user?.nom || "Professeur",
        titre: titreSeance.trim(),
        contenu: resumeCours.trim(),
        devoir: devoirMaison.trim() || "Aucun devoir rattaché pour cette séance.",
        date: new Date().toLocaleDateString('fr-FR'),
        createdAt: new Date().toISOString()
      });

      setTitreSeance('');
      setResumeCours('');
      setDevoirMaison('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse">Ouverture du cahier de textes...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 font-sans">
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
          ⬅️ Bureau Virtuel
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-black text-gray-800 tracking-tight">📖 Cahier de Textes de Classe Numérique</h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Progression pédagogique réglementaire. Émargez et consignez vos résumés de leçons en temps réel.</p>
        </div>
        <select value={classeSelectionnee} onChange={(e) => setClasseSelectionnee(e.target.value)} className="bg-white border text-xs font-bold rounded-xl p-3 h-fit outline-none shadow-2xs focus:ring-2 focus:ring-purple-500">
          {classes.map(c => {
            const name = c.id.replace(`${currentSchool}_`, '').toUpperCase();
            return <option key={c.id} value={c.id.replace(`${currentSchool}_`, '')}>Classe : {name}</option>;
          })}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORMULAIRE DE SAISIE DE COURS */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-700 shadow-xl h-fit">
          <h3 className="text-xs font-black text-orange-400 uppercase tracking-wider border-b border-slate-700 pb-2 mb-4">Émager une Nouvelle Séance</h3>
          <form onSubmit={handleValidateSeance} className="space-y-4 text-xs font-bold">
            <div>
              <label className="block text-slate-400 uppercase mb-1">Titre de la Leçon / Chapitre *</label>
              <input type="text" placeholder="Ex: Équations du Second Degré" value={titreSeance} onChange={(e) => setTitreSeance(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-orange-500" required />
            </div>
            <div>
              <label className="block text-slate-400 uppercase mb-1">Résumé détaillé de la séance *</label>
              <textarea rows="4" placeholder="Ex: Définition du discriminant Delta. Étude des trois cas de figures..." value={resumeCours} onChange={(e) => setResumeCours(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-200 outline-none focus:ring-2 focus:ring-orange-500" required></textarea>
            </div>
            <div>
              <label className="block text-slate-400 uppercase mb-1">Exercices / Devoir de maison rattaché</label>
              <input type="text" placeholder="Ex: Exercices 4 et 5 page 112 du manuel" value={devoirMaison} onChange={(e) => setDevoirMaison(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <button type="submit" disabled={sending} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-2.5 rounded-xl uppercase tracking-wider transition disabled:bg-slate-700">{sending ? "Émargement..." : "💾 Valider la Séance"}</button>
          </form>
        </div>

        {/* FLUX DES LEÇONS EN TEMPS RÉEL */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">Historique de Progression de la Classe</h3>
          {lecons.length === 0 ? (
            <p className="text-xs text-center text-gray-400 py-12 font-medium">Aucune séance de cours n'a encore été consignée pour cette matière.</p>
          ) : (
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {lecons.map((l) => (
                <div key={l.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 relative">
                  <div className="flex justify-between items-start mb-1 flex-wrap gap-2">
                    <h4 className="text-sm font-black text-gray-900 uppercase">{l.titre}</h4>
                    <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50 px-2 py-0.5 rounded">{l.date}</span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{l.contenu}</p>
                  <div className="mt-3 p-2 bg-amber-50/50 border border-dashed border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium">
                    🎯 <span className="font-bold">Travail à faire :</span> {l.devoir}
                  </div>
                  <p className="text-[9px] text-gray-400 uppercase font-black mt-2 tracking-wide">Signé numériquement par : M. {l.profName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CahierTextes;
