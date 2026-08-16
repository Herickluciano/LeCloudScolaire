import React, { useState, useEffect } from 'react';
import { db } from '../services/api';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const GestionPubSaas = () => {
  const [nomAnnonceur, setNomAnnonceur] = useState('');
  const [textePub, setTextePub] = useState('');
  const [lienPub, setLienPub] = useState('');
  const [activerPub, setActiverPub] = useState(true);
  const [statutMsg, setStatutMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // 🔄 Charger la publicité actuelle au démarrage
  useEffect(() => {
    const chargerPub = async () => {
      try {
        const docRef = doc(db, "publicites", "banniere_mail");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNomAnnonceur(data.nomAnnonceur || '');
          setTextePub(data.textePub || '');
          setLienPub(data.lienPub || '');
          setActiverPub(data.activerPub !== false);
        }
      } catch (err) {
        console.error("Erreur de chargement de la pub:", err);
      } finally {
        setLoading(false);
      }
    };
    chargerPub();
  }, []);

  // 💾 Sauvegarder et créer automatiquement dans Firebase
  const handleSauvegarder = async (e) => {
    e.preventDefault();
    setStatutMsg('⏳ Enregistrement dans le Cloud...');
    
    try {
      const docRef = doc(db, "publicites", "banniere_mail");
      await setDoc(docRef, {
        nomAnnonceur: nomAnnonceur.trim(),
        textePub: textePub.trim(),
        lienPub: lienPub.trim(),
        activerPub: activerPub,
        updatedAt: new Date()
      });
      
      setStatutMsg('🎉 Campagne publicitaire synchronisée avec succès !');
      setTimeout(() => setStatutMsg(''), 4000);
    } catch (err) {
      setStatutMsg('❌ Échec de la synchronisation.');
      console.error(err);
    }
  };

  if (loading) return <div className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center py-10">Initialisation de la régie...</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl max-w-2xl mx-auto my-6 font-sans">
      <div className="border-b border-slate-800 pb-3 mb-6">
        <h2 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
          📢 Régie Publicitaire Intégrée (Mails SaaS)
        </h2>
        <p className="text-xs text-slate-400 mt-1">Configurez l'annonce marketing globale qui s'affichera dans l'en-tête de toutes les notifications e-mails envoyées par Edulink.</p>
      </div>

      {statutMsg && (
        <div className="mb-6 p-3 bg-slate-950 text-orange-400 text-xs font-bold rounded-xl border-l-4 border-orange-500 animate-pulse">
          {statutMsg}
        </div>
      )}

      <form onSubmit={handleSauvegarder} className="space-y-4">
        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-200">Statut de la régie</label>
            <p className="text-[11px] text-slate-400">Activer ou couper instantanément les publicités sur tout le réseau.</p>
          </div>
          <input 
            type="checkbox" 
            checked={activerPub} 
            onChange={(e) => setActiverPub(e.target.checked)}
            className="w-5 h-5 accent-orange-500 cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-slate-400 text-[11px] font-bold uppercase mb-1">Nom de l'Annonceur / Entreprise</label>
            <input 
              type="text" 
              placeholder="Ex: Orange Côte d'Ivoire, Librairie de France..."
              value={nomAnnonceur}
              onChange={(e) => setNomAnnonceur(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-semibold text-white focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-[11px] font-bold uppercase mb-1">Texte de l'annonce marketing</label>
            <textarea 
              rows="3"
              placeholder="Ex: Profitez de la fibre internet ! Bénéficiez de 15% de réduction avec le code EDULINK..."
              value={textePub}
              onChange={(e) => setTextePub(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-semibold text-white focus:outline-none focus:border-orange-500 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-[11px] font-bold uppercase mb-1">Lien internet de redirection (URL)</label>
            <input 
              type="url" 
              placeholder="Ex: https://orange.ci"
              value={lienPub}
              onChange={(e) => setLienPub(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-semibold text-white focus:outline-none focus:border-orange-500 transition"
            />
          </div>
        </div>

        <button 
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-md transition mt-4 cursor-pointer"
        >
          🚀 Déployer la campagne publicitaire
        </button>
      </form>
    </div>
  );
};

export default GestionPubSaas;
