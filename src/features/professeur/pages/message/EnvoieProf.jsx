import { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const EnvoieProf = ({ currentSchool }) => {
  const [envois, setEnvois] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool) return;

    // 🟢 ANTENNE LIVE : Capte les notifications circulaires créées par l'administration
    const q = query(
      collection(db, "notifications"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setEnvois(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  if (loading) return <div className="p-6 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Chargement des archives d'envois...</div>;

  return (
    <div className="space-y-4">
      {envois.length === 0 ? (
        <p className="text-xs text-center text-gray-400 py-8 font-medium">📤 Aucun message envoyé dans vos archives administratives.</p>
      ) : (
        envois.map((e) => (
          <div key={e.id} className="bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-xs text-left hover:border-purple-500/30 transition">
            <div className="flex justify-between items-start gap-2">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                e.cible === 'admin' ? 'bg-amber-950 text-amber-400' : e.cible === 'professeur' ? 'bg-purple-950 text-purple-400' : 'bg-blue-950 text-blue-400'
              }`}>
                🎯 Cible : {e.cible?.toUpperCase() || 'TOUS'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{e.date || new Date(e.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
            <h4 className="text-sm font-black text-slate-100 mt-3 uppercase tracking-tight">{e.titre}</h4>
            <p className="text-slate-400 font-medium text-xs mt-1.5 whitespace-pre-line leading-relaxed">{e.contenu}</p>
            <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
              <span>Priorité : <strong className={e.priorite === 'haute' ? 'text-red-400' : 'text-slate-400'}>{e.priorite || 'normale'}</strong></span>
              <span className="text-emerald-400 font-mono">● Transmis</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default EnvoieProf;
