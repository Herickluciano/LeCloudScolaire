import React, { useState } from 'react';
import { db } from '../../../services/api'; 
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom'; 

const FormulaireClasse = ({ onClose, currentSchool }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nomClasse: '',
    niveauPromotion: '',
    capaciteMaximale: '100',
    professeurPrincipal: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 🟢 ALGORITHME D'INJECTION DIRECTE AUTONOME (Évite l'erreur d'export de api.js)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nomClasse || !formData.niveauPromotion) {
      alert("❌ Veuillez renseigner les champs obligatoires (*).");
      return;
    }

    setSaving(true);
    try {
      const idEcole = currentSchool || sessionStorage.getItem('sgs_school_id') || "lycee_saint_bernard";
      
      // Nettoyage de l'ID du document pour Firestore (Ex: 6eme_1)
      const idClasseDocument = `${formData.niveauPromotion}_${formData.nomClasse.toLowerCase().replace(/\s+/g, '_')}`;

      // Écriture NoSQL étanche dans la collection "classes"
      await setDoc(doc(db, "classes", idClasseDocument.trim()), {
        id: idClasseDocument,
        schoolId: idEcole,
        name: formData.nomClasse.toUpperCase(),
        promotion: formData.niveauPromotion, // Clé unifiée : 6eme, 5eme, 2nd, terminal, etc.
        capacite: parseInt(formData.capaciteMaximale) || 100,
        professeurPrincipalId: formData.professeurPrincipal || "NON_ASSIGNE",
        createdAt: serverTimestamp()
      });

      alert("🎉 Classe créée et raccordée en temps réel avec succès !");
      if (onClose) onClose();
      window.location.reload();

    } catch (error) {
      console.error("Erreur d'écriture NoSQL :", error);
      alert("❌ Échec technique lors de la création de la classe.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 text-left max-w-md w-full rounded-2xl">
      <div className="border-b pb-2 mb-4">
        <h3 className="text-sm font-black text-slate-900 uppercase">🏫 Créer une Nouvelle Classe</h3>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5">Ajoutez une division pédagogique raccordée aux filtres de promotions unifiées.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold uppercase text-slate-700">
        
        <div>
          <label className="block mb-1 text-gray-600">Niveau de la Promotion *</label>
          <select 
            name="niveauPromotion" 
            value={formData.niveauPromotion} 
            onChange={handleChange} 
            className="w-full px-3 py-2.5 border text-sm rounded-md font-medium bg-white outline-none focus:ring-2 focus:ring-purple-600" 
            required
          >
            <option value="">-- Choisir le niveau --</option>
            <option value="6eme">6ème</option>
            <option value="5eme">5ème</option>
            <option value="4eme">4ème</option>
            <option value="3eme">3ème</option>
            <option value="2nd">2nd</option>
            <option value="1ere">1ère</option>
            <option value="terminal">Terminal</option>
          </select>
        </div>
         <div>
          <label className="block mb-1 text-gray-600">Nom de la classe (Ex: 1, 2, A, B) *</label>
          <input 
            type="text" 
            name="nomClasse" 
            value={formData.nomClasse} 
            onChange={handleChange} 
            placeholder="Ex: 1" 
            className="w-full px-3 py-2.5 border text-sm rounded-md font-medium outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-600" 
            required 
          />
        </div>
        <div>
          <label className="block mb-1 text-gray-600">Capacité maximale</label>
          <input 
            type="number" 
            name="capaciteMaximale" 
            value={formData.capaciteMaximale} 
            onChange={handleChange} 
            className="w-full px-3 py-2.5 border text-sm rounded-md font-medium bg-slate-50 outline-none" 
          />
        </div>

        <div className="flex gap-2 pt-4 text-xs font-black uppercase">
          {onClose && (
            <button 
              type="button" 
              onClick={onClose} 
              className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-500 px-4 py-2.5 rounded-xl cursor-pointer"
            >
              Annuler
            </button>
          )}
          <div className="flex-1" />
          <button 
            type="submit" 
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl border-0 font-black cursor-pointer shadow-xs transition"
          >
            {saving ? "Création..." : "💾 Valider la création"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormulaireClasse;
