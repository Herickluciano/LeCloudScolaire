import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
// 🟢 ALIGNEMENT FIRESTORE : Opérateurs d'interception du Routeur Central notifications
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';

const ReceptionProf = ({ currentSchool }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const schoolClean = (currentSchool || 'lycee_moderne_gagnoa').trim().toLowerCase();
  const idProfLogge = user?.matricule || user?.id || 'PROF_UNKNOWN';

  useEffect(() => {
    if (!schoolClean || !idProfLogge) return;

    // 🟢 ANTENNE LIVE RECTIFIÉE : Capte les notes de service ou messages privés reçus par cet enseignant
    const q = query(
      collection(db, "notifications"),
      where("schoolId", "==", schoolClean),
      where("destinataireId", "==", idProfLogge)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Tri chronologique : les messages récents apparaissent au sommet
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMessages(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur Antenne Réception Professeur :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolClean, idProfLogge]);

  // Action : Marquer une notification comme lue / archivée par le professeur
  const handleMarquerTraite = async (idMsg) => {
    try {
      await updateDoc(doc(db, "notifications", idMsg), { 
        statut: "traite",
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Erreur d'archivage professeur :", err);
    }
  };

  if (loading) return <div className="p-6 text-center text-xs font-bold text-gray-400 animate-pulse uppercase tracking-wider">Ouverture de votre boîte de réception enseignant...</div>;

  return (
    <div className="space-y-4 text-left font-sans text-gray-700">
      {messages.length === 0 ? (
        <p className="text-xs text-center text-gray-400 py-12 border rounded-2xl border-dashed italic bg-white font-medium">
          📥 Boîte de réception vide. Aucun message ou note de service reçu pour le moment.
        </p>
      ) : (
        messages.map((m) => {
          const estEnAttente = m.statut !== 'traite';
          const estDepuisAdmin = m.expediteurId === 'ADMIN';

          return (
            <div key={m.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-purple-500/20 transition animate-fadeIn">
              <div className="text-left flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    estDepuisAdmin ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {estDepuisAdmin ? '🏛️ Direction' : '💼 Personnel / Collègue'}
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded truncate">
                    {m.expediteurId}
                  </span>
                  <span className="text-xs font-black text-gray-800 uppercase truncate">
                    — {m.expediteurNom}
                  </span>
                </div>
                
                <h4 className="text-xs font-black text-purple-950 mt-3 uppercase tracking-wide">
                  {estDepuisAdmin ? "Objet : Note de service / Décision administrative" : "Objet : Correspondance interne"}
                </h4>
                <div className="text-gray-600 font-medium text-xs mt-1.5 italic bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed break-words whitespace-pre-wrap">
                  "{m.message || m.corps}"
                </div>
                
                <p className="text-[10px] text-gray-400 font-mono font-bold mt-2.5">
                  Reçu le : {m.createdAt ? new Date(m.createdAt).toLocaleString('fr-FR') : "Date inconnue"}
                </p>
              </div>

              {/* STATUT ACTIONNEUR DE LECTURE */}
              <div className="flex items-center gap-3 self-end sm:self-auto whitespace-nowrap pt-2 sm:pt-0">
                <span className={`text-[9px] uppercase px-2.5 py-1 rounded-full font-black tracking-wide ${
                  estEnAttente ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {estEnAttente ? '⚠️ Nouveau' : '✓ Lu'}
                </span>
                
                {estEnAttente && (
                  <button 
                    type="button"
                    onClick={() => handleMarquerTraite(m.id)}
                    className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-[10px] uppercase px-3 py-2 rounded-xl transition cursor-pointer shadow-xs border-0"
                  >
                    ✓ Archiver
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ReceptionProf;
