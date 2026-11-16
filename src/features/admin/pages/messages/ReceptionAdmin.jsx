import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Header from '../../../../pages/Header';

const ReceptionAdmin = ({ currentSchool }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const schoolClean = (currentSchool || 'lycee_moderne_gagnoa').trim().toLowerCase();

  useEffect(() => {
    if (!schoolClean) return;

    // Écoute en direct des rapports et réclamations envoyés à la Direction
    const q = query(
      collection(db, "notifications"),
      where("schoolId", "==", schoolClean),
      where("destinataireId", "==", "ADMIN")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      setMessages(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur Réception Admin :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolClean]);

  const handleMarquerTraite = async (idMsg) => {
    try {
      await updateDoc(doc(db, "notifications", idMsg), { 
        statut: "traite",
        updatedAt: new Date().toISOString()
      });
      alert("📦 Note archivée dans les registres de la direction.");
    } catch (err) {
      console.error(err);
    }
  };

  // =========================================================================
  // 🖨️ FONCTION RECTIFIÉE : GÉNÉRATION DU RAPPORT DE PAIE EN PDF COMPTABLE
  // =========================================================================
    const handleTelechargerRapportPDF = (msg) => {
    const fenetreImpression = window.open('', '_blank');
    
    fenetreImpression.document.write(`
      <html>
        <head>
          <title>RAPPORT FINANCIER DES HEURES CUMULÉES — LECLOUDCOLAIRE</title>
          <style>
            body { font-family: monospace; padding: 40px; color: #0f172a; line-height: 1.5; background: #fff; }
            .header { border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 25px; text-align: center; }
            .title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
            .meta { font-size: 11px; margin-top: 5px; color: #475569; font-weight: bold; }
            .content { font-size: 12px; font-weight: bold; white-space: pre; background: #fafafa; border: 1px solid #e2e8f0; padding: 20px; font-family: monospace; }
            .footer { margin-top: 40px; border-top: 1px dashed #000; padding-top: 15px; font-size: 10px; text-align: right; font-weight: bold; }
            @media print { body { padding: 0; } .content { border: none; background: none; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Rapport de Synthèse RH & Émargement Vacataires</div>
            <div class="meta">Établissement : ${schoolClean.toUpperCase()} — Date de traitement : ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
          
          <div class="content">${msg.message || msg.corps}</div>
          
          <div class="footer">
            Signature et Cachet du Premier Responsable Financier
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    fenetreImpression.document.close();
  };

  if (loading) return <div className="p-6 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Vérification de la boîte aux lettres...</div>;

  return (
    <div className="bg-white space-y-4 text-left font-sans text-gray-700">
     
      {messages.length === 0 ? (
        <p className="text-xs text-center text-gray-400 py-12 border rounded-2xl border-dashed italic bg-white font-medium">
          📥 Aucun rapport de cumul ou réclamation d'élève dans la boîte direction.
        </p>
      ) : (
        messages.map((m) => {
          const estEnAttente = m.statut !== 'traite';
          const estRapportComptable = (m.message || '').includes('BILAN COMPTABLE') || m.expediteurNom?.includes('VIE SCOLAIRE');

          return (
            <div key={m.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-purple-500/20 transition animate-fadeIn">
              <div className="text-left flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    estRapportComptable ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {estRapportComptable ? '📊 Rapport RH Cumulé' : '🎓 Apprenant'}
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded truncate">
                    {m.expediteurId || "EDUC"}
                  </span>
                  <span className="text-xs font-black text-gray-800 uppercase truncate">
                    — {m.expediteurNom}
                  </span>
                </div>
                
                <h4 className="text-xs font-black text-purple-950 mt-3 uppercase tracking-wide">
                  {estRapportComptable ? "Objet : Pointages & Heures Vacations" : "Objet : Réclamation Éléve / SOS"}
                </h4>
                <div className="text-gray-600 font-medium text-xs mt-1.5 italic bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed break-words whitespace-pre-wrap font-bold">
                  "{m.message || m.corps}"
                </div>
                
                <p className="text-[10px] text-gray-400 font-mono font-bold mt-2.5">
                  Reçu le : {m.createdAt ? new Date(m.createdAt).toLocaleString('fr-FR') : m.date || "Date inconnue"}
                </p>
              </div>

              {/* BARRE D'ACTIONS COMPTABLES */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 whitespace-nowrap pt-2 sm:pt-0">
                {/* 🟢 LE BOUTON COMMERCIALE MAGIQUE : Imprime ou télécharge la fiche au format PDF */}
                <button
                  type="button"
                  onClick={() => handleTelechargerRapportPDF(m)}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-700 font-black text-[10px] uppercase px-3 py-2 rounded-xl transition cursor-pointer border-0"
                >
                  🖨️ Télécharger PDF
                </button>

                <span className={`text-[9px] uppercase px-2.5 py-1.5 rounded-full font-black tracking-wide ${
                  estEnAttente ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {estEnAttente ? '⚠️ En attente' : '✓ Traité'}
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

export default ReceptionAdmin;
