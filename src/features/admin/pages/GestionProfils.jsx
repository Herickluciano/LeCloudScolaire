import React, { useState } from 'react';
import { db } from '../../../services/api'; // Ajusté à 3 niveaux pour le dossier src/features/admin/pages/
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext'; 

// 🌟 UNE SEULE ET UNIQUE LIGNE POUR TOUT FIRESTORE (CORRIGÉE SANS DOUBLON)
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import Header from '../../../pages/Header';


const GestionProfils = () => {
  const { schoolId, schoolName } = useAuth();
  
  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_saint_bernard'
  )
    .trim()
    .toLowerCase();

  // Mode de gestion : 'eleve' ou 'professeur'
  const [typeProfil, setTypeProfil] = useState('eleve');

  // États de recherche
  const [idRecherche, setIdRecherche] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [profilTrouveId, setProfilTrouveId] = useState(null);

  // Formulaire unifié NoSQL
  const [formData, setFormData] = useState({
    nom: '',
    prenoms: '',
    email: '',
    emailParent: '', // Spécifique Élève
    telephone: '',
    classe: '',      // Utilisé pour le changement de classe
    classeNom: '',
    classeId: '',
    promotion: '',
    dateNaissance: '', // Spécifique Élève
    genre: 'Masculin',
    numSecuriteSociale: '', // Spécifique Élève
    anneeArrivee: '',
    password: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  const afficherMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const réinitialiserFormulaire = () => {
    setProfilTrouveId(null);
    setFormData({
      nom: '', prenoms: '', email: '', emailParent: '', telephone: '',
      classe: '', classeNom: '', classeId: '', promotion: '', dateNaissance: '',
      genre: 'Masculin', numSecuriteSociale: '', anneeArrivee: '', password: ''
    });
  };

  /* =========================================================
     🔍 RECHERCHE PAR MATRICULE / ID UNIQUE
  ========================================================= */
  const handleRechercherProfil = async (e) => {
    e.preventDefault();
    if (!idRecherche.trim()) return;

    setLoadingSearch(true);
    setProfilTrouveId(null);
    const docRef = doc(db, 'users', idRecherche.trim());

    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const schoolClean = String(data.schoolId || '').trim().toLowerCase();
        const roleClean = String(data.role || '').trim().toLowerCase();

        // Validation du filtre Multi-Tenant et du rôle sélectionné
        const validationRole = typeProfil === 'eleve' 
          ? roleClean === 'eleve'
          : (roleClean === 'professeur' || roleClean === 'prof_principal');

        if (schoolClean === currentSchool && validationRole) {
          setProfilTrouveId(docSnap.id);
          setFormData({
            nom: data.nom || '',
            prenoms: data.prenoms || '',
            email: data.email || '',
            emailParent: data.emailParent || '',
            telephone: data.telephone || '',
            classe: data.classe || data.classeNom || '',
            classeNom: data.classeNom || data.classe || '',
            classeId: data.classeId || '',
            promotion: data.promotion || '',
            dateNaissance: data.dateNaissance || '',
            genre: data.genre || 'Masculin',
            numSecuriteSociale: data.numSecuriteSociale || '',
            anneeArrivee: data.anneeArrivee || '',
            password: data.password || '',
            photoBase64: data.photoBase64 || data.photoUrl || null
          });
          afficherMessage('success', '✓ Dossier NoSQL localisé et chargé.');
        } else {
          afficherMessage('error', `❌ Cet ID n'appartient pas à un ${typeProfil} de votre établissement.`);
        }
      } else {
        afficherMessage('error', '❌ Aucun profil trouvé avec cet identifiant dans la base Firestore.');
      }
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Erreur de synchronisation réseau.');
    } finally {
      setLoadingSearch(false);
    }
  };

  /* =========================================================
     💾 SAUVEGARDE ET SYNC (CHANGEMENT DE CLASSE INCLUS)
  ========================================================= */
  const handleSauvegarderModification = async (e) => {
    e.preventDefault();
    if (!profilTrouveId) return;

    setLoadingAction(true);
    const docRef = doc(db, 'users', profilTrouveId);

    try {
      // Configuration de l'objet de mise à jour NoSQL
      const updateData = {
        nom: formData.nom.trim().toUpperCase(),
        prenoms: formData.prenoms.trim(),
        email: formData.email.trim().toLowerCase(),
        telephone: formData.telephone.trim(),
        classe: formData.classe.trim(),
        classeNom: formData.classe.trim(),
        promotion: formData.promotion.trim(),
        genre: formData.genre,
        password: formData.password.trim(),
        updatedAt: new Date().toISOString()
      };

      // Injection des champs spécifiques Élève
      if (typeProfil === 'eleve') {
        updateData.emailParent = formData.emailParent.trim().toLowerCase();
        updateData.dateNaissance = formData.dateNaissance;
        updateData.numSecuriteSociale = formData.numSecuriteSociale.trim().toUpperCase();
        updateData.anneeArrivee = formData.anneeArrivee.trim();
      }

      await updateDoc(docRef, updateData);
      afficherMessage('success', '✅ Profil mis à jour et réaffecté en base de données.');
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Échec de l\'écriture Cloud Firestore.');
    } finally {
      setLoadingAction(false);
    }
  };

  /* =========================================================
     🗑️ SUPPRESSION IRRÉVERSIBLE DU COMPTE
  ========================================================= */
  const handleSupprimerProfil = async () => {
    if (!profilTrouveId) return;

    const confirmation = window.confirm(
      `⚠️ ACTION CRITIQUE SANS RECOURS\n\n` +
      `Voulez-vous supprimer définitivement le compte NoSQL de ${formData.nom} ${formData.prenoms} ?\n` +
      `Toutes ses données d'historique de l'année en cours seront effacées.`
    );

    if (!confirmation) return;

    setLoadingAction(true);
    try {
      await deleteDoc(doc(db, 'users', profilTrouveId));
      réinitialiserFormulaire();
      setIdRecherche('');
      afficherMessage('success', '🗑️ Profil supprimé et radié des registres de l\'établissement.');
    } catch (err) {
      console.error(err);
      afficherMessage('error', '❌ Erreur lors de la suppression.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-700 font-sans sm:p-6 lg:p-8 text-left">
      <Header/>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* BANDEAU EN-TÊTE CENTRAL */}
        <div className="bg-slate-950 p-6 rounded-2xl shadow-sm  flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">

            <div>
              <p className="administration text-[9px] font-black tracking-widest text-indigo-400 uppercase">⚙️Administration Générale</p>
              <h1 className="administration-1 text-lg font-black uppercase">Veillez changer ici les information sur l'eleve losqu'il est renvoyé, redoublant ou passe en classe superieur</h1>
            </div>
          </div>
          <div className="administration-2 bg-white/10 px-3 py-2 rounded-xl text-right">
            <p className="text-[8px] text-slate-400 font-black uppercase">Établissement</p>
            <p className="text-xs font-black uppercase text-indigo-300">{schoolName || currentSchool}</p>
          </div>
        </div>

        {/* RECHERCHE ET COMMUTATION D'ONGLETS */}
        <div className="bg-white  p-5 rounded-2xl shadow-xs space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl  text-xs font-black uppercase max-w-sm">
            <button
              type="button"
              onClick={() => { setTypeProfil('eleve'); réinitialiserFormulaire(); }}
              className={`btn-admin-3 flex-1 py-2 rounded-lg transition text-center cursor-pointer ${typeProfil === 'eleve' ? 'bg-slate-900  shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
            >
              🎓 Profils Élèves
            </button>
            <button
              type="button"
              onClick={() => { setTypeProfil('professeur'); réinitialiserFormulaire(); }}
              className={`btn-admin-3 flex-1 py-2 rounded-lg transition text-center cursor-pointer ${typeProfil === 'professeur' ? 'bg-slate-900  shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
            >
              👨‍🏫 Enseignants
            </button>
          </div>

                   <form onSubmit={handleRechercherProfil} className="form-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Rechercher par Matricule ou Identifiant unique :
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={typeProfil === 'eleve' ? "Ex: 26_3014R..." : "Ex: PROF_FORGIE_491..."}
                value={idRecherche}
                onChange={(e) => setIdRecherche(e.target.value)}
                disabled={loadingSearch || loadingAction}
                className="flex-1 bg-slate-50 border p-3 rounded-xl text-xs font-mono font-bold outline-none uppercase text-indigo-700 focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="submit"
                disabled={loadingSearch || loadingAction}
                className="bg-indigo-600 hover:bg-indigo-700 font-black text-xs uppercase px-6 py-3 rounded-xl transition shadow-sm whitespace-nowrap cursor-pointer"
              >
                {loadingSearch ? '⏳ Recherche...' : '🔍 Localiser'}
              </button>
               <p className='matri'>Fiches & Modification des Statuts</p>
            </div>
          </form>
        </div>

        {/* MESSAGES DE NOTIFICATION */}
        {message.text && (
          <div className={`messageel p-4 rounded-xl text-xs font-black border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {message.text}
          </div>
        )}

        {/* PANNEAU FORMULAIRE DE MISE A JOUR */}
        {profilTrouveId && (
          <form onSubmit={handleSauvegarderModification} className="form-3 bg-white  rounded-2xl shadow-xs overflow-hidden divide-y">
            <div className="p-6 bg-slate-50/50 flex items-center gap-5">
              {typeProfil === 'eleve' && formData.photoBase64 ? (
                <img src={formData.photoBase64} alt="Profil" className="photoeleve w-14 h-16 rounded-xl border object-cover bg-white" />
              ) : (
                <div className="w-14 h-14 rounded-xl border bg-slate-200 flex items-center justify-center text-2xl">
                  {typeProfil === 'eleve' ? '🎓' : '👨‍🏫'}
                </div>
              )}
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase">{formData.nom} {formData.prenoms}</h2>
                <p className="idregistre text-[16px] text-danger text-slate-400 font-mono mt-0.5">Registre ID : {profilTrouveId}</p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
              <div className='datenaissan form-floating mb-3'>
                <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">Nom de famille *</label>
                <input
                  type="text"
                   id="floatingInput"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="datenaissaninput form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>

              <div className='datenaissan-1 form-floating mb-3'>
                <label  htmlFor="floatingInput" className="nomp block text-gray-700 text-xs font-bold uppercase mb-1">Prénoms *</label>
                <input
                  type="text"
                  value={formData.prenoms}
                  onChange={(e) => setFormData({ ...formData, prenoms: e.target.value })}
                  className="datenaissaninput-1 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>

              <div className='datenaissan-2 form-floating mb-3'>
                <label  htmlFor="floatingInput" className="nomp-1 block  font-bold uppercase mb-1">Adresse E-mail de l'eleve *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                 className="datenaissaninput-2 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>

              {typeProfil === 'eleve' && (
               <div className='datenaissan-3 form-floating mb-3'>
                  <label htmlFor="floatingInput" className="nomp-2 block  font-bold uppercase mb-1">E-mail Parent / Tuteur Légal *</label>
                  <input
                    type="email"
                    value={formData.emailParent}
                    onChange={(e) => setFormData({ ...formData, emailParent: e.target.value })}
                    className="datenaissaninput-3 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                    required
                  />
                </div>
              )}

              <div className='datenaissan-4 form-floating mb-3'>
                <label  htmlFor="floatingInput" className="nomp-3 block  font-bold uppercase mb-1">Numéro Téléphone Contact</label>
                <input
                  type="text"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="datenaissaninput-4 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

             <div className='datenaissan-5 form-floating mb-3'>
                <label htmlFor="floatingInput" className="nomp-4 block  font-bold uppercase mb-1">
                  {typeProfil === 'eleve' ? 'Affectation Classe (Changement immédiat) *' : 'Classe / Niveau Principal *'}
                </label>
                <input
                  type="text"
                  value={formData.classe}
                  onChange={(e) => setFormData({ ...formData, classe: e.target.value })}
                  className="datenaissaninput-5 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>

             <div className='datenaissan-6 form-floating mb-3'>
                <label htmlFor="floatingInput" className="nomp-5 block  font-bold uppercase mb-1">Promotion de Référence (Ex: 6eme) *</label>
                <input
                  type="text"
                  value={formData.promotion}
                  onChange={(e) => setFormData({ ...formData, promotion: e.target.value })}
                  className="datenaissaninput-6 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>

              {typeProfil === 'eleve' && (
                <>
                 <div className='datenaissan-7 form-floating mb-3'>
                    <label htmlFor="floatingInput" className="nomp-6 block  font-bold uppercase mb-1">Date de Naissance *</label>
                    <input
                      type="date"
                      value={formData.dateNaissance}
                      onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
                       className="datenaissaninput-7 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                      required
                    />
                  </div>

                  <div className='datenaissan form-floating mb-3'>
                    <label htmlFor="floatingInput-8" className="nomp-7 block  font-bold uppercase mb-1">N° Sécurité Sociale (CMU)</label>
                    <input
                      type="text"
                      value={formData.numSecuriteSociale}
                      onChange={(e) => setFormData({ ...formData, numSecuriteSociale: e.target.value })}
                      className="datenaissaninput-8 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </>
              )}

              <div className='datenaissan form-floating mb-3'>
                <label htmlFor="floatingInput-9" className="nomp-8 block  font-bold uppercase mb-1">Genre</label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="datenaissaninput-9 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="Masculin">Masculin</option>
                  <option value="Féminin">Féminin</option>
                </select>
              </div>


              <div className='datenaissan form-floating mb-3'>
                <label htmlFor="floatingInput-10" className="nomp-9 block  font-bold uppercase mb-1">Mot de passe de connexion *</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="datenaissaninput-10 form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>
            </div>

            {/* BOUTONS D'ACTIONS DE SECURITE */}
            <div className="p-6 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleSupprimerProfil}
                className="btnsup w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs uppercase px-5 py-3 rounded-xl border border-red-200 transition cursor-pointer"
              >
                🗑️ Supprimer de l'Établissement
              </button>
              
              <button
                type="submit"
                disabled={loadingAction}
                className="btnsup-1 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 font-black text-xs uppercase px-6 py-3 rounded-xl transition shadow-md cursor-pointer"
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

export default GestionProfils;
