import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../../../services/api';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';

const AjouterPersonnel = () => {
  const navigate = useNavigate();
  const { schoolId, schoolName } = useAuth(); // Récupère les infos de l'école active

  // 1. État global regroupant tous les critères du personnel requis
  const [formData, setFormData] = useState({
    typePersonnel: '',
    nom: '',
    prenom: '',
    genre: '',
    dateNaissance: '',
    matiereEnseignee: '', 
    grade: '', 
    numSecuriteSociale: '', 
    anneesExperience: '0',
    etablissementProvenance: '',
    etablissementActuel: '',
    email: '',      
    telephone: ''   
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

    // Validations obligatoires de base
    if (!formData.typePersonnel || !formData.nom || !formData.prenom || !formData.grade || !formData.genre) {
      setMessage({ type: 'error', text: 'Veuillez remplir les champs obligatoires (*)' });
      return;
    }

    if (formData.typePersonnel === 'professeur' && !formData.matiereEnseignee) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner la matière enseignée par le professeur.' });
      return;
    }

    setLoading(true);

    try {
      if (!schoolId) {
        setMessage({ type: 'error', text: "Aucun établissement actif détecté." });
        setLoading(false);
        return;
      }

      const cleanNom = formData.nom.trim().toUpperCase();
      const cleanPrenom = formData.prenom.trim();
      const currentSchool = schoolId.trim().toLowerCase();

      // 🇨🇮 GENERATION AUTOMATIQUE DU MATRICULE DE CONNEXION DE PRODUCTION
      const prefixeMatricule = formData.typePersonnel === 'professeur' ? 'PROF' : 'EDUC';
      const randomId = Math.floor(100 + Math.random() * 900); // 3 chiffres aléatoires pour éviter les doublons
      const matriculeGenere = `${prefixeMatricule}_${cleanNom.replace(/\s+/g, '')}_${randomId}`;

      // 🔴 RECTIFICATION : Formule dynamique matricule@nom_prenom! demandée
      const nFormate = cleanNom.replace(/\s+/g, '').toLowerCase();
      const pFormate = cleanPrenom.replace(/\s+/g, '_').toLowerCase();
      const passwordCalcule = `${matriculeGenere.toLowerCase()}@${nFormate}_${pFormate}!`;

      // Payload Cloud relationnel
      const userCloudData = {
        id: matriculeGenere,
        matricule: matriculeGenere,
        name: `${cleanNom} ${cleanPrenom}`,
        nom: cleanNom,
        prenoms: cleanPrenom,
        genre: formData.genre,
        role: formData.typePersonnel,
        schoolId: currentSchool, 
        photo: photoFile ? photoFile.name : null,
        password: passwordCalcule, // 🚨 Stockage du mot de passe algorithmique sur-mesure
        grade: formData.grade.trim(),
        dateNaissance: formData.dateNaissance,
        numSecuriteSociale: formData.numSecuriteSociale.trim(),
        anneesExperience: formData.anneesExperience,
        etablissementProvenance: formData.etablissementProvenance.trim(),
        etablissementActuel: formData.etablissementActuel.trim(),
        email: formData.email.trim().toLowerCase(),
        telephone: formData.telephone.trim(),
        statut: "actif",
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
        ...userCloudData,
        password: passwordCalcule
      }, 'personnel');

      setMessage({
        type: 'success',
        text: `🎉 Recrutement enregistré avec succès !\nLe profil a été poussé sur le cloud et le badge d'identité PDF est en cours de téléchargement.\n\n🔑 Identifiant unique : ${matriculeGenere}\n🔐 Clé d'accès générée : ${passwordCalcule}`
      });

      // Réinitialisation complète
      setFormData({
        typePersonnel: '', nom: '', prenom: '', genre: '', dateNaissance: '',
        matiereEnseignee: '', grade: '', numSecuriteSociale: '',
        anneesExperience: '0', etablissementProvenance: '', etablissementActuel: '',
        email: '', telephone: ''
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
  // --- ÉTAT D'INTERNATIONALISATION DE L'EN-TÊTE ---
  const [metaSchool, setMetaSchool] = useState({
    pays: "RÉPUBLIQUE DE CÔTE D'IVOIRE",
    devise: "Union - Discipline - Travail",
    ministere: "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION"
  });

  useEffect(() => {
    const extrairePaysMeta = async () => {
      try {
        const docRef = doc(db, "schools", currentSchool);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          setMetaSchool({
            pays: d.pays || "RÉPUBLIQUE DE CÔTE D'IVOIRE",
            devise: d.devise || "Union - Discipline - Travail",
            ministere: d.ministere || "MINISTÈRE DE L'ÉDUCATION NATIONALE"
          });
        }
      } catch (e) { console.error(e); }
    };
    extrairePaysMeta();
  }, [currentSchool]);

  return (
    <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 rounded-xl shadow-md my-6 font-sans relative animate-fadeIn">
      
      {/* Bouton de retour vers l'espace admin */}
      <button 
        type="button"
        onClick={() => navigate('/admin/home')} 
        className="absolute top-6 right-6 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition cursor-pointer shadow-2xs"
      >
        ⬅️ Retour au Secrétariat
      </button>

      <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-2">💼 Gestion RH : Recrutement & Personnel</h2>
      <p className="text-xs text-orange-600 font-extrabold uppercase tracking-wider mb-6">Établissement : {schoolName || 'Enregistrement Live'}</p>

      {message.text && (
        <div className={`p-4 mb-6 rounded-lg text-sm font-semibold whitespace-pre-line border ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* SECTION RÔLE & PHOTO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-2xs">
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

          <div className="md:col-span-3 space-y-4 text-xs font-bold text-gray-700">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-1">Type de personnel *</label>
              <select name="typePersonnel" value={formData.typePersonnel} onChange={handleChange} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium text-sm text-gray-900 font-bold" required>
                <option value="">-- Choisir la fonction --</option>
                <option value="professeur">👨‍🏫 Professeur (Enseignant Matière)</option>
                <option value="educateur">🧑‍💼 Éducateur (Suivi Promotion & Discipline)</option>
              </select>
            </div>

            {formData.typePersonnel === 'professeur' && (
              <div className="animate-fadeIn">
                <label className="block text-orange-700 text-sm font-bold mb-1">Spécialité / Matière Enseignée *</label>
                <select name="matiereEnseignee" value={formData.matiereEnseignee} onChange={handleChange} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-bold text-sm outline-none text-gray-900" required>
                  <option value="">-- Sélectionner la discipline --</option>
                  <option value="Français">Français</option>
                  <option value="Mathématiques">Mathématiques</option>
                  <option value="Histoire-Géographie">Histoire-Géographie</option>
                  <option value="Physique-Chimie">Physique-Chimie</option>
                  <option value="SVT">Sciences de la Vie et de la Terre (SVT)</option>
                  <option value="Anglais">Anglais</option>
                  <option value="Allemand">Anglais / Allemand</option>
                  <option value="Espagnol">Anglais / Espagnol</option>
                  <option value="Philosophie">Philosophie</option>
                  <option value="EPS">Éducation Physique et Sportive (EPS)</option>
                </select>
              </div>
            )}
                      </div>
        </div>

        {/* SECTION ETAT CIVIL */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide border-b pb-1">1. Fiche d'État Civil & Identification</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
            <div>
              <label className="block text-gray-600 mb-1">Nom de famille *</label>
              <input type="text" name="nom" value={formData.nom} onChange={handleChange} placeholder="Ex: BLEGUY" className="w-full px-3 py-2 border rounded-md uppercase font-black tracking-wide outline-none focus:ring-2 focus:ring-orange-500" required />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Tous les Prénoms *</label>
              <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} placeholder="Ex: Eric Luciano" className="w-full px-3 py-2 border rounded-md font-medium outline-none focus:ring-2 focus:ring-orange-500" required />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Genre / Sexe *</label>
              <select name="genre" value={formData.genre} onChange={handleChange} className="w-full px-3 py-2 border rounded-md bg-white font-medium outline-none focus:ring-2 focus:ring-orange-500 text-gray-900" required>
                <option value="">-- Choisir le genre --</option>
                <option value="Masculin">♂️ Masculin</option>
                <option value="Féminin">♀️ Féminin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
            <div>
              <label className="block text-gray-600 mb-1">Date de Naissance *</label>
              <input type="date" name="dateNaissance" value={formData.dateNaissance} onChange={handleChange} className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-orange-500" required />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Adresse E-mail Professionnelle *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Ex: bleguy@school.ci" className="w-full px-3 py-2 border rounded-md font-mono outline-none focus:ring-2 focus:ring-orange-500" required />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Numéro Mobile Personnel *</label>
              <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} placeholder="Ex: +225 0708091011" className="w-full px-3 py-2 border rounded-md font-mono outline-none focus:ring-2 focus:ring-orange-500" required />
            </div>
          </div>
        </div>

        {/* SECTION ADMINISTRATIVE */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide border-b pb-1">2. Volume Carrière, Grade & Antécédents</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
            <div>
              <label className="block text-gray-600 mb-1">Grade Fonction publique *</label>
              <select name="grade" value={formData.grade} onChange={handleChange} className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 font-bold outline-none focus:ring-2 focus:ring-orange-500" required>
                <option value="">-- Sélectionner le grade --</option>
                <option value="A3">Grade A3 (Professeur de Collège)</option>
                <option value="A4">Grade A4 (Professeur de Lycée)</option>
                <option value="B3">Grade B3 (Adjoint d'Éducation)</option>
                <option value="A1">Contractuel Externe / Vacataire</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Années d'Expérience Réelles</label>
              <input type="number" name="anneesExperience" value={formData.anneesExperience} onChange={handleChange} min="0" max="45" className="w-full px-3 py-2 border rounded-md font-mono outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Numéro d'Immatriculation CNPS / MUGEFCI</label>
              <input type="text" name="numSecuriteSociale" value={formData.numSecuriteSociale} onChange={handleChange} placeholder="Ex: 001-2345-X" className="w-full px-3 py-2 border rounded-md font-mono outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
            <div>
              <label className="block text-gray-600 mb-1">Établissement d'origine (Dernière affectation)</label>
              <input type="text" name="etablissementProvenance" value={formData.etablissementProvenance} onChange={handleChange} placeholder="Ex: Lycée Classique de Bouaké" className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Structure Affectation Actuelle</label>
              <input type="text" name="etablissementActuel" value={formData.etablissementActuel} onChange={handleChange} placeholder="Ex: Lycée Moderne de Gagnoa" className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
        </div>

        {/* VALIDER LE RECRUTEMENT */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-md transition disabled:bg-gray-300 cursor-pointer flex justify-center items-center"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              "💾 Enregistrer le Personnel & Générer le Badge"
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AjouterPersonnel;

