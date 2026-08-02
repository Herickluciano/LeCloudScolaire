import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../../services/api';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function ModifierStatut() {
  const navigate = useNavigate();
  const { schoolId } = useParams(); // Contexte SaaS multi-écoles

  // --- ÉTATS INTERNES ---
  const [matriculeRecherche, setMatriculeRecherche] = useState('');
  const [personnel, setPersonnel] = useState(null);
  const [formData, setFormData] = useState({
    typePersonnel: '',
    matiereEnseignee: '',
    grade: '',
    etablissementActuel: ''
  });

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- RECHERCHE DU PERSONNEL PAR MATRICULE ---
  const handleSearch = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setPersonnel(null);

    if (!matriculeRecherche.trim()) {
      setMessage({ type: 'error', text: 'Veuillez saisir un matricule RH valide.' });
      return;
    }

    setLoading(true);
    try {
      const cleanKey = matriculeRecherche.trim().toUpperCase();
      const userRef = doc(db, "users", cleanKey);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setMessage({ type: 'error', text: 'Aucun membre du personnel trouvé avec ce matricule.' });
        setLoading(false);
        return;
      }

      const data = userSnap.data();

      // Sécurité : Interdire la modification des élèves ou des super-admins ici
      if (data.role === 'eleve' || data.role === 'admin') {
        setMessage({ type: 'error', text: 'Cette interface est réservée exclusivement aux Professeurs et Éducateurs.' });
        setLoading(false);
        return;
      }

      // Remplissage de la fiche
      setPersonnel(data);
      setFormData({
        typePersonnel: data.role || '',
        matiereEnseignee: data.matiere || '',
        grade: data.grade || '',
        etablissementActuel: data.etablissementActuel || ''
      });

    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Erreur lors de la communication avec le serveur Cloud.' });
    } finally {
      setLoading(false);
    }
  };

  // --- CAPTURE DES CHANGEMENTS D'INPUT ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- ACTION DU BOUTON DE MISE À JOUR FIREBASE ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setIsSubmitting(true);

    if (formData.typePersonnel === 'professeur' && !formData.matiereEnseignee) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner la matière pour le professeur.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const cleanKey = matriculeRecherche.trim().toUpperCase();
      const userRef = doc(db, "users", cleanKey);

      // Mise à jour partielle sans écraser le reste de l'état civil (nom, prénom, photo...)
      await updateDoc(userRef, {
        role: formData.typePersonnel,
        matiere: formData.typePersonnel === 'professeur' ? formData.matiereEnseignee : null,
        grade: formData.grade.trim(),
        etablissementActuel: formData.etablissementActuel.trim(),
        updatedAt: new Date().toISOString()
      });

      setMessage({ type: 'success', text: `✨ Statut professionnel mis à jour avec succès pour le matricule ${cleanKey} !` });
      
      // Actualiser le bandeau visuel informatif
      setPersonnel(prev => ({
        ...prev,
        role: formData.typePersonnel,
        matiere: formData.typePersonnel === 'professeur' ? formData.matiereEnseignee : null,
        grade: formData.grade.trim()
      }));

    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: "Échec de l'application de la mise à jour cloud." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-md my-6 font-sans">
      <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6">⚙️ Gestion RH : Mise à jour de Statut</h2>

      {message.text && (
        <div className={`p-4 mb-6 rounded-md text-sm font-semibold ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* BARRE DE RECHERCHE INITIALE */}
      <form onSubmit={handleSearch} className="bg-gray-50 p-4 rounded-lg flex flex-col sm:flex-row gap-3 items-end mb-6">
        <div className="flex-1">
          <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Entrer le Matricule RH de l'agent</label>
          <input 
            type="text" 
            placeholder="Ex: RH_KOUASSI_4821" 
            value={matriculeRecherche}
            onChange={(e) => setMatriculeRecherche(e.target.value)}
            className="w-full px-3 py-2 border rounded-md uppercase outline-none font-mono tracking-wider text-sm"
            disabled={loading || isSubmitting}
          />
        </div>
        <button 
          type="submit"
          disabled={loading || isSubmitting}
          className="w-full sm:w-auto px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold rounded-md transition"
        >
          {loading ? 'Recherche...' : '🔍 Trouver la fiche'}
        </button>
      </form>

      {/* FORMULAIRE DE MODIFICATION (Apparaît uniquement si la recherche trouve un profil) */}
      {personnel && (
        <form onSubmit={handleUpdate} className="space-y-6 border-t pt-6 animate-fadeIn">
          
          {/* BANDEAU INFORMATIONS ACTUELLES NON MODIFIABLES */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center text-sm">
            <div>
              <p className="text-gray-500 font-medium text-xs uppercase">Agent sélectionné :</p>
              <h3 className="font-bold text-gray-800 text-base">{personnel.nom} {personnel.prenoms}</h3>
            </div>
            <span className="bg-blue-600 text-white font-mono text-xs font-bold px-3 py-1 rounded">
              {personnel.matricule}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            {/* Mutation du poste principal */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-1">Nouveau Type de personnel *</label>
              <select name="typePersonnel" value={formData.typePersonnel || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium">
                <option value="professeur">👨‍🏫 Professeur (Enseignant Matière)</option>
                <option value="educateur">🧑‍💼 Éducateur (Suivi Promotion & Discipline)</option>
              </select>
            </div>

            {/* Conditionnel : Spécialité si Professeur */}
            {formData.typePersonnel === 'professeur' && (
              <div>
                <label className="block text-orange-700 text-sm font-bold mb-1">Discipline Assignée *</label>
                <select name="matiereEnseignee" value={formData.matiereEnseignee || ''} onChange={handleChange} className="w-full px-3 py-2 border-2 border-orange-200 rounded-md focus:ring-2 focus:ring-orange-500 outline-none bg-white font-semibold">
                  <option value="">-- Sélectionner la discipline --</option>
                  <option value="Français">Français</option>
                  <option value="Mathématiques">Mathématiques</option>
                  <option value="Anglais">Anglais</option>
                  <option value="Physique-Chimie">Physique-Chimie</option>
                  <option value="SVT">SVT (Sciences de la Vie et de la Terre)</option>
                  <option value="Histoire-Géo">Histoire-Géographie</option>
                  <option value="Philosophie">Philosophie</option>
                  <option value="EDHC">EDHC</option>
                  <option value="EPS">EPS (Éducation Physique et Sportive)</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-1">Grade Actuel (Fonction Publique)</label>
              <input type="text" name="grade" value={formData.grade || ''} onChange={handleChange} placeholder="Ex: A3, A4" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-1">Établissement d'affectation actuel</label>
              <input type="text" name="etablissementActuel" value={formData.etablissementActuel || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
          </div>

          {/* SECTION BOUTONS D'ACTION AVEC BOUTON MISE A JOUR ORANGE COMPATIBLE 🇨🇮 */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-3 border-t pt-6">
            <button 
              type="button" 
              onClick={() => navigate(-1)} 
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border rounded-lg transition duration-200"
            >
              ↩️ Annuler / Retour
            </button>
            
                        <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-extrabold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-md hover:shadow transition duration-200 flex justify-center items-center disabled:bg-orange-300"
            >
              {isSubmitting ? 'Mise à jour Cloud...' : '🔄 Mettre à jour le statut'}
            </button>
          </div>

        </form>
      )}
    </div>
  );
}
