import { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

const ReceptionAdmin = ({ currentSchool }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool) return;

    // 🟢 ANTENNE LIVE : Capte uniquement les courriers des élèves de cet établissement
    const q = query(
      collection(db, "messages"),
      where("schoolId", "==", currentSchool),
      where("expediteurRole", "==", "eleve")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMessages(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // Action : Marquer une demande comme traitée / validée
  const handleMarquerTraite = async (idMsg) => {
    try {
      await updateDoc(doc(db, "messages", idMsg), { statut: "traite" });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Ouverture de la boîte de réception...</div>;

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="text-xs text-center text-gray-400 py-8 font-medium">📥 Boîte de réception vide. Aucun message reçu.</p>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-orange-500/20 transition">
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase bg-orange-50 text-orange-600 px-2 py-0.5 rounded">Élève</span>
                <span className="text-xs font-mono text-gray-400">{m.matricule}</span>
                <span className="text-xs font-black text-gray-800">— {m.eleveName}</span>
              </div>
              <h4 className="text-sm font-black text-gray-900 mt-2 uppercase">{m.objetMessage}</h4>
              <p className="text-gray-500 font-medium text-xs mt-1 italic">"{m.contenuMessage}"</p>
              <p className="text-[10px] text-gray-400 font-mono mt-2">Reçu le : {new Date(m.createdAt).toLocaleString('fr-FR')}</p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className={`text-[10px] uppercase px-2.5 py-1 rounded-full font-black ${
                m.statut === 'en_attente' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {m.statut === 'en_attente' ? 'En attente' : 'Traité'}
              </span>
              {m.statut === 'en_attente' && (
                <button 
                  onClick={() => handleMarquerTraite(m.id)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  ✓ Archiver
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ReceptionAdmin;
