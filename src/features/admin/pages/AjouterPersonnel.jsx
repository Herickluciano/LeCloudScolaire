import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // 🟢 Import groupé unique nettoyé
import { db } from '../../../services/api';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';


const AjouterPersonnel = () => {
  const navigate = useNavigate();
  const { schoolId } = useAuth(); // Récupère l'ID de l'école active de la session (ex: lycee_oume)

  // 1. État global regroupant tous les critères du personnel requis
 const [formData, setFormData] = useState({
  typePersonnel: '',
  nom: '',
  prenom: '',
  dateNaissance: '',
  matiereEnseignee: '', 
  grade: '', 
  numSecuriteSociale: '', 
  anneesExperience: '0',
  etablissementProvenance: '',
  etablissementActuel: '',
  email: '',      // Initialisé proprement
  telephone: ''   // Initialisé proprement
});


  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // 2. Capture des entrées formulaires
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 3. Traitement de l'image de profil du personnel
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // 4. Soumission des informations vers Firebase Cloud Midnight
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    // Validations obligatoires de base
    if (!formData.typePersonnel || !formData.nom || !formData.prenom || !formData.grade) {
      setMessage({ type: 'error', text: 'Veuillez remplir les champs obligatoires (*)' });
      setLoading(false);
      return;
    }

    if (formData.typePersonnel === 'professeur' && !formData.matiereEnseignee) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner la matière enseignée par le professeur.' });
      setLoading(false);
      return;
    }

    try {
      if (!schoolId) {
        setMessage({
          type: 'error',
          text: "Aucun établissement actif détecté."
        });
        setLoading(false);
        return;
      }

      const cleanNom = formData.nom.trim().toUpperCase();
      const cleanPrenom = formData.prenom.trim();
      const currentSchool = schoolId;

      // 🇨🇮 GENERATION AUTOMATIQUE DU MATRICULE DE CONNEXION DE PRODUCTION
      const prefixeMatricule = formData.typePersonnel === 'professeur' ? 'PROF' : 'EDUC';
      const randomId = Math.floor(100 + Math.random() * 900); // 3 chiffres aléatoires pour éviter les doublons
      const matriculeGenere = `${prefixeMatricule}_${cleanNom.replace(/\s+/g, '')}_${randomId}`;

      // 🟢 CORRECTION : Clé harmonisée en schoolId pour correspondre aux règles de sécurité
      const userCloudData = {
        name: `${cleanNom} ${cleanPrenom}`,
        nom: cleanNom,
        prenoms: cleanPrenom,
        genre: '',
        role: formData.typePersonnel,
        schoolId: currentSchool, 
        photo: photoFile ? photoFile.name : null,
        password: 'password123',
        grade: formData.grade.trim(),
        dateNaissance: formData.dateNaissance,
        numSecuriteSociale: formData.numSecuriteSociale.trim(),
        anneesExperience: formData.anneesExperience,
        etablissementProvenance: formData.etablissementProvenance.trim(),
        etablissementActuel: formData.etablissementActuel.trim(),
        createdAt: new Date().toISOString()
      };

      if (formData.typePersonnel === 'professeur') {
        userCloudData.matiereEnseignee = formData.matiereEnseignee;
        userCloudData.assigned_classes = [];
      } else {
        userCloudData.assigned_promotion = '';
      }

      // 1. Sauvegarde en temps réel sur Cloud Firestore
      await setDoc(doc(db, "users", matriculeGenere), userCloudData);

      // 2. Génération et téléchargement immédiat du Badge PDF avec son QR Code
      await genererFicheAvecQRCodePDF({
        ...formData,
        matricule: matriculeGenere,
        nom: cleanNom,
        prenom: cleanPrenom
      }, 'personnel');

      setMessage({
        type: 'success',
        text: `Inscription réussie ! Le compte a été créé et le badge PDF est en cours de téléchargement.\n\n🔑 Identifiant : ${matriculeGenere}\n🔐 Mot de passe initial : password123`
      });

      // Réinitialisation complète
      setFormData({
  typePersonnel: '', nom: '', prenom: '', dateNaissance: '',
  matiereEnseignee: '', grade: '', numSecuriteSociale: '',
  anneesExperience: '0', etablissementProvenance: '', etablissementActuel: '',
  email: '',      // Nettoyé proprement
  telephone: ''   // Nettoyé proprement
});
      setPhotoPreview(null);
      setPhotoFile(null);

    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: "Erreur technique lors de l'enregistrement sur la base Cloud." });
    } finally { 
      setLoading(false);
    }
  };

     return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-md my-6 font-sans relative">
      
      {/* Bouton de retour vers l'espace admin */}
      <button 
        onClick={() => navigate('/admin/dashboard')} 
        className="absolute top-6 right-6 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
      >
        ⬅️ Retour au Dashboard
      </button>

      <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6">💼 Gestion RH : Recrutement & Personnel</h2>

      {message.text && (
        <div className={`p-4 mb-6 rounded-lg text-sm font-semibold whitespace-pre-line border ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* SECTION RÔLE & PHOTO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center bg-gray-50 p-4 rounded-lg">
          <div className="flex flex-col items-center space-y-2 md:col-span-1">
            <div className="w-28 h-28 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-white shadow-inner">
              {photoPreview ? (
                <img src={photoPreview} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400 text-center px-1 font-bold uppercase">Photo d'identité</span>
              )}
            </div>
            <label className="cursor-pointer bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold py-1 px-2.5 rounded border shadow-sm transition">
              Téléverser
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>
          </div>

          <div className="md:col-span-3 space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-1">Type de personnel *</label>
              <select name="typePersonnel" value={formData.typePersonnel} onChange={handleChange} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium text-sm">
                <option value="">-- Choisir la fonction --</option>
                <option value="professeur">👨‍🏫 Professeur (Enseignant Matière)</option>
                <option value="educateur">🧑‍💼 Éducateur (Suivi Promotion & Discipline)</option>
              </select>
            </div>

            {formData.typePersonnel === 'professeur' && (
              <div className="animate-fadeIn">
                <label className="block text-orange-700 text-sm font-bold mb-1">Spécialité / Matière Enseignée *</label>
                <select name="matiereEnseignee" value={formData.matiereEnseignee} onChange={handleChange} className="w-full px-3 py-2 border-2 border-orange-200 rounded-md focus:ring-2 focus:ring-orange-500 outline-none bg-white text-sm font-semibold">
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
        </div>

        {/* SECTION ÉTAT CIVIL & CONTACTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Nom *</label>
            <input type="text" name="nom" value={formData.nom} onChange={handleChange} placeholder="Ex: KOUASSI" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm uppercase font-bold" />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Prénom *</label>
            <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} placeholder="Ex: Kouame Jean" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" />
          </div>
                        <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Genre / Sexe *</label>
                <select
                  name="genre"
                  value={formData.genre}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none"
                >
                  <option value="">-- Choisir le genre --</option>
                  <option value="Masculin">♂️ Masculin</option>
                  <option value="Féminin">♀️ Féminin</option>
                </select>
              </div>

          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Date de Naissance</label>
            <input type="date" name="dateNaissance" value={formData.dateNaissance} onChange={handleChange} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
          </div>
          <div className="md:col-span-1 lg:col-span-2">
            <label className="block text-gray-700 text-sm font-semibold mb-1">Adresse Émail Professionnelle *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="personnel@gmail.com" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-mono" />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Contact Téléphonique *</label>
            <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} placeholder="Ex: 0708091011" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-mono" />
          </div>
        </div>

        {/* SECTION CARRIÈRE & IDENTIFIANTS SOCIAL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Grade Fonction Publique *</label>
            <input type="text" name="grade" value={formData.grade} onChange={handleChange} placeholder="Ex: A3, A4, Contractuel" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold" />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Numéro Sécurité Sociale (CMU)</label>
            <input type="text" name="numSecuriteSociale" value={formData.numSecuriteSociale} onChange={handleChange} placeholder="Numéro d'immatriculation" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-mono" />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Années d'expérience</label>
            <input type="number" name="anneesExperience" value={formData.anneesExperience} onChange={handleChange} min="0" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-mono" />
          </div>
        </div>

        {/* SECTION RECRUTEMENT / ÉTABLISSEMENTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Établissement d'origine (Provenance)</label>
            <input type="text" name="etablissementProvenance" value={formData.etablissementProvenance} onChange={handleChange} placeholder="Ex: Lycée Classique de Bouaké" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Établissement d'affectation actuel</label>
            <input type="text" name="etablissementActuel" value={formData.etablissementActuel} onChange={handleChange} placeholder="Nom de votre école actuelle" className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" />
          </div>
        </div>

        {/* SECTION BOUTONS D'ACTION */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-3 border-t pt-6">
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border rounded-lg transition duration-200"
          >
            ↩️ Retour arrière
          </button>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm hover:shadow transition duration-200 disabled:bg-orange-300 flex items-center justify-center min-w-[200px]"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              "💾 Valider l'inscription du personnel"
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AjouterPersonnel;
