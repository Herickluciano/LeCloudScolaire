import React, { useState } from 'react';
import { db } from '../services/api';
import { doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
const ModifierEleve = () => {
  const { schoolId, schoolName } = useAuth();
  
  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_saint_bernard'
  )
    .trim()
    .toLowerCase();

  // États de recherche
  const [matriculeRecherche, setMatriculeRecherche] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [eleveTrouve, setEleveTrouve] = useState(null);

  // États du formulaire dynamique
  const [formData, setFormData] = useState({
    nom: '',
    prenoms: '',
    email: '',
    emailParent: '',
    telephone: '',
    classe: '',
    classeNom: '',
    classeId: '',
    promotion: '',
    dateNaissance: '',
    genre: '',
    numSecuriteSociale: '',
    ecoleProvenance: '',
    dispensePhysique: '',
    anneeArrivee: '',
    password: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  const afficherMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  /* =========================================================
     🔍 RECHERCHE EN TEMPS RÉEL PAR MATRICULE UNIQUE
  ========================================================= */
  const handleRechercherParMatricule = async (e) => {
    e.preventDefault();
    if (!matriculeRecherche.trim()) return;

    setLoadingSearch(true);
    setEleveTrouve(null);
    const docRef = doc(db, 'users', matriculeRecherche.trim());

    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const schoolClean = String(data.schoolId || '').trim().toLowerCase();
        const roleClean = String(data.role || '').trim().toLowerCase();

        // Vérification de sécurité Multi-Tenant
        if (schoolClean === currentSchool && roleClean === 'eleve') {
          setEleveTrouve(docSnap.id);
          setFormData({
            nom: data.nom || '',
            prenoms: data.prenoms || '',
            email: data.email || '',
            emailParent: data.emailParent || '',
            telephone: data.telephone || '',
            classe: data.classe || '',
            classeNom: data.classeNom || '',
            classeId: data.classeId || '',
            promotion: data.promotion || '',
            dateNaissance: data.dateNaissance || '',
            genre: data.genre || '',
            numSecuriteSociale: data.numSecuriteSociale || '',
            ecoleProvenance: data.ecoleProvenance || '',
            dispensePhysique: data.dispensePhysique || '',
            anneeArrivee: data.anneeArrivee || '',
            password: data.password || '',
            photoBase64: data.photoBase64 || data.photoUrl || data.photo || null
          });
          afficherMessage('success', '✓ Dossier NoSQL localisé avec succès.');
        } else {
          afficherMessage('error', '❌ Cet identifiant n\'appartient pas à un élève de votre établissement.');
        }
      } else {
        afficherMessage('error', '❌ Aucun élève trouvé avec ce matricule dans la base Firestore.');
      }
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Erreur de communication avec la base de données.');
    } finally {
      setLoadingSearch(false);
    }
  };

  /* =========================================================
     💾 ACTION : METTRE À JOUR ET CORRIGER LES INFORMATIONS
  ========================================================= */
  const handleModifierInformations = async (e) => {
    e.preventDefault();
    if (!eleveTrouve) return;

    setLoadingAction(true);
    const docRef = doc(db, 'users', eleveTrouve);

    try {
      await updateDoc(docRef, {
        nom: formData.nom.trim().toUpperCase(), // Force la casse administrative
        prenoms: formData.prenoms.trim(),
        email: formData.email.trim().toLowerCase(),
        emailParent: formData.emailParent.trim().toLowerCase(),
        telephone: formData.telephone.trim(),
        classe: formData.classe.trim(),
        classeNom: formData.classe.trim(),
        promotion: formData.promotion.trim(),
        dateNaissance: formData.dateNaissance,
        genre: formData.genre,
        numSecuriteSociale: formData.numSecuriteSociale.trim(),
        ecoleProvenance: formData.ecoleProvenance.trim(),
        dispensePhysique: formData.dispensePhysique,
        anneeArrivee: formData.anneeArrivee.trim(),
        password: formData.password.trim(),
        updatedAt: new Date().toISOString()
      });

      afficherMessage('success', '✅ Fiche élève mise à jour et synchronisée avec succès.');
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Échec de la mise à jour des données NoSQL.');
    } finally {
      setLoadingAction(false);
    }
  };

  /* =========================================================
     ❌ ACTION : SUPPRIMER DÉFINITIVEMENT LE DOSSIER ÉLÈVE
  ========================================================= */
  const handleSupprimerDossierEleve = async () => {
    if (!eleveTrouve) return;

    const confirmation = window.confirm(
      `⚠️ ACTION IRRÉVERSIBLE\n\n` +
      `Êtes-vous certain de vouloir supprimer définitivement le dossier de ${formData.nom} ${formData.prenoms} ?\n` +
      `Toutes ses notes, absences et données d'identification seront perdues.`
    );

    if (!confirmation) return;

    setLoadingAction(true);
    try {
      await deleteDoc(doc(db, 'users', eleveTrouve));
      setEleveTrouve(null);
      setMatriculeRecherche('');
      setFormData({
        nom: '', prenoms: '', email: '', emailParent: '', telephone: '',
        classe: '', classeNom: '', classeId: '', promotion: '', dateNaissance: '',
        genre: '', numSecuriteSociale: '', ecoleProvenance: '', dispensePhysique: '',
        anneeArrivee: '', password: ''
      });
      afficherMessage('success', '🗑️ Le dossier de l\'élève a été purgé de Cloud Firestore.');
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Échec lors de la suppression de la fiche élève.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 font-sans p-4 sm:p-6 lg:p-8 text-left">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* BANDEAU EN-TÊTE */}
        <div className="bg-slate-950 p-6 rounded-2xl shadow-sm text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-xl">👤</div>
              <div>
                <p className="text-[9px] font-black tracking-widest text-purple-400 uppercase">Secrétariat Académique</p>
                <h1 className="text-lg font-black uppercase">Modification & Édition des Profils</h1>
              </div>
            </div>
          </div>
          <div className="bg-white/10 px-3 py-2 border border-white/10 rounded-xl text-right">
            <p className="text-[8px] text-slate-400 font-black uppercase">Structure active</p>
            <p className="text-xs font-black uppercase text-purple-300">{schoolName || currentSchool}</p>
          </div>
        </div>

        {/* RECHERCHE INITIALE PAR MATRICULE */}
        <div className="bg-white border p-5 rounded-2xl shadow-xs">
          <form onSubmit={handleRechercherParMatricule} className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rechercher un dossier apprenant :</label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Entrez le n° matricule exact (Ex: 26_3014R)..."
                value={matriculeRecherche}
                onChange={(e) => setMatriculeRecherche(e.target.value)}
                disabled={loadingSearch || loadingAction}
                className="flex-1 bg-slate-50 border p-3 rounded-xl text-xs font-mono font-bold outline-none uppercase text-indigo-700 focus:ring-2 focus:ring-purple-500"
                required
              />
              <button
                type="submit"
                disabled={loadingSearch || loadingAction}
                className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-6 py-3 rounded-xl transition shadow-sm whitespace-nowrap"
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

        {/* FORMULAIRE GLOBAL D'ÉDITION FIRESTORE */}
        {eleveTrouve && (
          <form onSubmit={handleModifierInformations} className="bg-white border rounded-2xl shadow-xs overflow-hidden divide-y">
            
                        {/* APERÇU RAPIDE DE L'AVATAR BINAIRE */}
            <div className="p-6 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-5">
              {formData.photoBase64 ? (
                <img
                  src={formData.photoBase64}
                  alt="Profil"
                  className="w-16 h-16 rounded-xl border object-cover bg-white shadow-2xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl border bg-slate-200 flex items-center justify-center text-2xl">🎓</div>
              )}
              <div className="text-center sm:text-left">
                <h2 className="text-sm font-black text-slate-900 uppercase">{formData.nom} {formData.prenoms}</h2>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID Document : {eleveTrouve}</p>
              </div>
            </div>

            {/* CHAMPS CIVILS & SCOLAIRES */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Nom de famille *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl uppercase outline-none focus:ring-1 focus:ring-purple-500 font-black text-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Prénoms de l'élève *</label>
                <input
                  type="text"
                  value={formData.prenoms}
                  onChange={(e) => setFormData({ ...formData, prenoms: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">E-mail Élève / Personnel</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 font-mono text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">E-mail Parent / Tuteur Légal *</label>
                <input
                  type="email"
                  value={formData.emailParent}
                  onChange={(e) => setFormData({ ...formData, emailParent: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 font-mono text-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Numéro Téléphone Contact</label>
                <input
                  type="text"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Structure Classe Nom *</label>
                <input
                  type="text"
                  value={formData.classe}
                  onChange={(e) => setFormData({ ...formData, classe: e.target.value, classeNom: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Promotion d'Attachement (Ex: 6eme) *</label>
                <input
                  type="text"
                  value={formData.promotion}
                  onChange={(e) => setFormData({ ...formData, promotion: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Date de Naissance *</label>
                <input
                  type="date"
                  value={formData.dateNaissance}
                  onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">N° Sécurité Sociale (CMU)</label>
                <input
                  type="text"
                  value={formData.numSecuriteSociale}
                  onChange={(e) => setFormData({ ...formData, numSecuriteSociale: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 font-mono text-slate-900 uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Année Académique d'Arrivée</label>
                <input
                  type="text"
                  value={formData.anneeArrivee}
                  onChange={(e) => setFormData({ ...formData, anneeArrivee: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Genre</label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900"
                >
                  <option value="Féminin">Féminin</option>
                  <option value="Masculin">Masculin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Mot de passe de session d'accès *</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 font-mono"
                  required
                />
              </div>
            </div>

            {/* BARRE D'ACTIONS SECU */}
            <div className="p-6 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleSupprimerDossierEleve}
                className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs uppercase px-5 py-3 rounded-xl border border-red-200 transition cursor-pointer"
              >
                🗑️ Supprimer l'élève de la structure
              </button>
              
              <button
                type="submit"
                disabled={loadingAction}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-6 py-3 rounded-xl transition shadow-md cursor-pointer"
              >
                {loadingAction ? '⏳ Enregistrement...' : '💾 Sauvegarder les modifications'}
              </button>
            </div>
          </form>
        )}
        
      </div>
    </div>
  );
};

export default ModifierEleve;
