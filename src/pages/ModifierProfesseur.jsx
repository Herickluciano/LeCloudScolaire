import React, { useState } from 'react';
import { db } from '../services/api';
import { doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
const ModifierProfesseur = () => {
  const { schoolId, schoolName } = useAuth();
  
  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_saint_bernard'
  )
    .trim()
    .toLowerCase();

  // États de recherche
  const [idRecherche, setIdRecherche] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [profTrouve, setProfTrouve] = useState(null);

  // États du formulaire enseignant
  const [formData, setFormData] = useState({
    nom: '',
    prenoms: '',
    email: '',
    telephone: '',
    promotion: '', // Optionnel pour les profs principaux
    genre: '',
    password: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  const afficherMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  /* =========================================================
     🔍 RECHERCHE PAR IDENTIFIANT UNIQUE (Ex: PROF_FORGIE_491)
  ========================================================= */
  const handleRechercherProfesseur = async (e) => {
    e.preventDefault();
    if (!idRecherche.trim()) return;

    setLoadingSearch(true);
    setProfTrouve(null);
    const docRef = doc(db, 'users', idRecherche.trim());

    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const schoolClean = String(data.schoolId || '').trim().toLowerCase();
        const roleClean = String(data.role || '').trim().toLowerCase();

        // Sécurisation Multi-Tenant : Vérifie l'école et le rôle de l'enseignant
        if (schoolClean === currentSchool && (roleClean === 'professeur' || roleClean === 'prof_principal')) {
          setProfTrouve(docSnap.id);
          setFormData({
            nom: data.nom || '',
            prenoms: data.prenoms || '',
            email: data.email || '',
            telephone: data.telephone || '',
            promotion: data.promotion || '',
            genre: data.genre || 'Masculin',
            password: data.password || ''
          });
          afficherMessage('success', '✓ Fiche enseignant localisée.');
        } else {
          afficherMessage('error', '❌ Cet identifiant n\'appartient pas à un enseignant de votre établissement.');
        }
      } else {
        afficherMessage('error', '❌ Aucun enseignant trouvé avec cet identifiant dans la base Firestore.');
      }
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Erreur de communication avec la base de données.');
    } finally {
      setLoadingSearch(false);
    }
  };

  /* =========================================================
     💾 SAUVEGARDER LES MODIFICATIONS ENSEIGNANT
  ========================================================= */
  const handleModifierProfesseur = async (e) => {
    e.preventDefault();
    if (!profTrouve) return;

    setLoadingAction(true);
    const docRef = doc(db, 'users', profTrouve);

    try {
      await updateDoc(docRef, {
        nom: formData.nom.trim().toUpperCase(), // Casse administrative
        prenoms: formData.prenoms.trim(),
        email: formData.email.trim().toLowerCase(),
        telephone: formData.telephone.trim(),
        promotion: formData.promotion.trim(),
        genre: formData.genre,
        password: formData.password.trim(),
        updatedAt: new Date().toISOString()
      });

      afficherMessage('success', '✅ Fiche enseignant mise à jour et synchronisée.');
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Échec de l\'enregistrement NoSQL.');
    } finally {
      setLoadingAction(false);
    }
  };

  /* =========================================================
     🗑️ SUPPRIMER DÉFINITIVEMENT LE PROFESSEUR
  ========================================================= */
  const handleSupprimerProfesseur = async () => {
    if (!profTrouve) return;

    const confirmation = window.confirm(
      `⚠️ RECOURS CRITIQUE DE SÉCURITÉ\n\n` +
      `Êtes-vous certain de vouloir révoquer et supprimer définitivement l'enseignant ${formData.nom} ${formData.prenoms} ?\n` +
      `Ses attributions de notes et accès aux cahiers de textes seront coupés.`
    );

    if (!confirmation) return;

    setLoadingAction(true);
    try {
      await deleteDoc(doc(db, 'users', profTrouve));
      setProfTrouve(null);
      setIdRecherche('');
      setFormData({ nom: '', prenoms: '', email: '', telephone: '', promotion: '', genre: '', password: '' });
      afficherMessage('success', '🗑️ L\'enseignant a été dissocié et radié du registre.');
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Échec lors de la purge de la fiche enseignant.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 font-sans p-4 sm:p-6 lg:p-8 text-left">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* EN-TÊTE ACCUEIL */}
        <div className="bg-slate-950 p-6 rounded-2xl shadow-sm text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-xl">👨‍🏫</div>
            <div>
              <p className="text-[9px] font-black tracking-widest text-orange-400 uppercase">Direction des Ressources Humaines</p>
              <h1 className="text-lg font-black uppercase">Fiches d'Édition du Corps Enseignant</h1>
            </div>
          </div>
          <div className="bg-white/10 px-3 py-2 border border-white/10 rounded-xl text-right">
            <p className="text-[8px] text-slate-400 font-black uppercase">Établissement</p>
            <p className="text-xs font-black uppercase text-orange-300">{schoolName || currentSchool}</p>
          </div>
        </div>

        {/* MOTEUR DE RECHERCHE D'INDEX */}
        <div className="bg-white border p-5 rounded-2xl shadow-xs">
          <form onSubmit={handleRechercherProfesseur} className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rechercher un enseignant par identifiant :</label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Entrez l'ID du professeur (Ex: PROF_FORGIE_491)..."
                value={idRecherche}
                onChange={(e) => setIdRecherche(e.target.value)}
                disabled={loadingSearch || loadingAction}
                className="flex-1 bg-slate-50 border p-3 rounded-xl text-xs font-mono font-bold outline-none uppercase text-orange-700 focus:ring-2 focus:ring-orange-500"
                required
              />
              <button
                type="submit"
                disabled={loadingSearch || loadingAction}
                className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-6 py-3 rounded-xl transition shadow-sm whitespace-nowrap cursor-pointer"
              >
                {loadingSearch ? '🔍 Recherche...' : '🔍 Localiser'}
              </button>
            </div>
          </form>
        </div>

        {message.text && (
          <div className={`p-4 rounded-xl text-xs font-black border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {message.text}
          </div>
        )}

        {/* PANNEAU DE MODIFICATION */}
        {profTrouve && (
          <form onSubmit={handleModifierProfesseur} className="bg-white border rounded-2xl shadow-xs overflow-hidden divide-y">
            
            <div className="p-6 bg-slate-50/50 flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl border bg-orange-100 flex items-center justify-center text-2xl">👨‍🏫</div>
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase">{formData.nom} {formData.prenoms}</h2>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID Enseignant : {profTrouve}</p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Nom de famille *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl uppercase outline-none focus:ring-1 focus:ring-orange-500 font-black text-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Prénoms *</label>
                <input
                  type="text"
                  value={formData.prenoms}
                  onChange={(e) => setFormData({ ...formData, prenoms: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-orange-500 text-slate-900 font-bold"
                  required
                />
              </div>

                           <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Adresse E-mail Professionnelle *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-orange-500 font-mono text-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Numéro Téléphone Contact</label>
                <input
                  type="text"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-orange-500 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Niveau / Promotion de référence (Optionnel)</label>
                <input
                  type="text"
                  value={formData.promotion}
                  onChange={(e) => setFormData({ ...formData, promotion: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-orange-500 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Genre</label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-orange-500 text-slate-900"
                >
                  <option value="Masculin">Masculin</option>
                  <option value="Féminin">Féminin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Clé d'Accès Clôture Session *</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-orange-500 text-slate-900 font-mono"
                  required
                />
              </div>
            </div>

            {/* BARRE D'ACTIONS SÉCURISÉE */}
            <div className="p-6 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleSupprimerProfesseur}
                className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs uppercase px-5 py-3 rounded-xl border border-red-200 transition cursor-pointer"
              >
                🗑️ Révoquer & Radier l'Enseignant
              </button>
              
              <button
                type="submit"
                disabled={loadingAction}
                className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-6 py-3 rounded-xl transition shadow-md cursor-pointer"
              >
                {loadingAction ? '⏳ Alignement...' : '💾 Sauvegarder les modifications'}
              </button>
            </div>
          </form>
        )}
        
      </div>
    </div>
  );
};

export default ModifierProfesseur;
