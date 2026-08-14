import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'; 
import { db } from '../../../services/api';
// 🟢 RECTIFICATION : Réintégration de "getDoc" pour le flux d'internationalisation de l'école
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';

const AjouterPersonnel = () => {
  const navigate = useNavigate();
  const { schoolId, schoolName } = useAuth(); 

  // 🟢 RECTIFICATION DES VERROUS : Déclaration globale de currentSchool pour la rendre accessible par handleSubmit ET useEffect
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

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

  // --- ÉTAT D'INTERNATIONALISATION DE L'EN-TÊTE ---
  const [metaSchool, setMetaSchool] = useState({
    pays: "RÉPUBLIQUE DE CÔTE D'IVOIRE",
    devise: "Union - Discipline - Travail",
    ministere: "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION"
  });

  // 🔄 ÉCOUTEUR : Chargement dynamique des entêtes de l'État pour l'internationalisation
  useEffect(() => {
    if (!currentSchool) return;
    const extrairePaysMeta = async () => {
      try {
        const docRef = doc(db, "schools", currentSchool);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          setMetaSchool({
            pays: d.pays || "RÉPUBLIQUE DE CÔTE D'IVOIRE",
            devise: d.devise || "Union - Discipline - Travail",
            ministere: d.ministere || "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION"
          });
        }
      } catch (e) { 
        console.error("Erreur meta school :", e); 
      }
    };
    extrairePaysMeta();
  }, [currentSchool]);

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

  // 4. Soumission des informations vers Firebase Cloud
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

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
      const cleanNom = formData.nom.trim().toUpperCase();
      const cleanPrenom = formData.prenom.trim();

      const prefixeMatricule = formData.typePersonnel === 'professeur' ? 'PROF' : 'EDUC';
      const randomId = Math.floor(100 + Math.random() * 900); 
      const matriculeGenere = `${prefixeMatricule}_${cleanNom.replace(/\s+/g, '')}_${randomId}`;

      const nFormate = cleanNom.replace(/\s+/g, '').toLowerCase();
      const pFormate = cleanPrenom.replace(/\s+/g, '_').toLowerCase();
      const passwordCalcule = `${matriculeGenere.toLowerCase()}@${nFormate}_${pFormate}!`;

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
        password: passwordCalcule, 
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

      await setDoc(doc(db, "users", matriculeGenere), userCloudData);

      await genererFicheAvecQRCodePDF({
        ...userCloudData,
        password: passwordCalcule
      }, 'personnel');

      setMessage({
        type: 'success',
        text: `🎉 Recrutement enregistré avec succès !\nLe profil a été poussé sur le cloud et le badge d'identité PDF est en cours de téléchargement.\n\n🔑 Identifiant unique : ${matriculeGenere}\n🔐 Clé d'accès générée : ${passwordCalcule}`
      });

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

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 font-sans bg-gray-50 min-h-screen text-gray-700 text-left animate-fadeIn">
      
      {/* BOUTON RETOUR NAV */}
      <div className="mb-4">
        <Link to="/admin/dashboard" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Console d'Administration
        </Link>
      </div>

      {/* BLOC GRAPHIQUE EN-TÊTE INTERNATIONALISE */}
      <div className="bg-white border rounded-2xl p-6 shadow-2xs mb-8 text-center border-t-4 border-t-purple-600">
        <p className="text-xs font-black uppercase text-gray-800 tracking-wide">{metaSchool.pays}</p>
        <p className="text-[10px] text-gray-400 italic font-medium">{metaSchool.devise}</p>
        <p className="text-[10px] font-bold uppercase text-purple-700 max-w-xl mx-auto mt-2">{metaSchool.ministere}</p>
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-black text-gray-900 uppercase">Recrutement & Gestion des Équipes RH</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Établissement rattaché : <span className="text-purple-600 font-bold uppercase">{schoolName}</span></p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 mb-6 rounded-xl text-xs font-bold border whitespace-pre-line ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* FORMULAIRE GESTION RH */}
      <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-bold">
        
        {/* BANDEAU GAUCHE IMAGE & ROLE */}
        <div className="md:col-span-1 border-b md:border-b-0 md:border-r pb-6 md:pb-0 md:pr-6 flex flex-col items-center justify-start gap-4">
          <div className="w-full">
            <label className="block text-gray-400 uppercase mb-1">Rôle Institutionnel *</label>
            <select name="typePersonnel" value={formData.typePersonnel} onChange={handleChange} className="w-full bg-gray-50 border p-2.5 rounded-lg bg-white outline-none cursor-pointer">
              <option value="">-- Choisir le statut --</option>
              <option value="professeur">👨‍🏫 Professeur de Discipline</option>
              <option value="educateur">👮 Éducateur de Promotion</option>
            </select>
          </div>

          <div className="w-40 h-40 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center overflow-hidden relative bg-gray-50 mt-4 group">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-4 text-gray-400 font-medium">
                <span className="text-2xl block mb-1">📸</span>
                Photo d'identité
              </div>
            )}
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <p className="text-[10px] text-gray-400 font-medium">Fichiers autorisés : JPG, PNG (Max 2 Mo)</p>
        </div>

                {/* CHAMPS CIVILS DROITS */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 uppercase mb-1">Nom de Famille *</label>
            <input type="text" name="nom" value={formData.nom} onChange={handleChange} placeholder="Ex: BLEGUY" className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none uppercase" required />
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Prénoms *</label>
            <input
  type="text"
  name="prenom"
  value={formData.prenom}
  onChange={handleChange}
  placeholder="Ex: Eric Luciano"
  className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none"
  required
/>
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Genre / Sexe *</label>
            <select name="genre" value={formData.genre} onChange={handleChange} className="w-full bg-gray-50 border p-2.5 rounded-lg bg-white outline-none cursor-pointer">
              <option value="">-- Sélectionner --</option>
              <option value="M">Masculin (M)</option>
              <option value="F">Féminin (F)</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Date de Naissance</label>
            <input type="date" name="dateNaissance" value={formData.dateNaissance} onChange={handleChange} className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none cursor-pointer text-gray-800" />
          </div>

          <div className="sm:col-span-2 border-t pt-4 mt-2">
            <h3 className="text-[11px] font-black uppercase text-purple-700 tracking-wider mb-3">Spécifications Contractuelles & Échelon</h3>
          </div>

          <div>
            <label className="block text-gray-400 uppercase mb-1">Grade Fonction publique *</label>
            <input type="text" name="grade" value={formData.grade} onChange={handleChange} placeholder="Ex: A3, A4, Contractuel" className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none" required />
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Matière Spécialisée (Si Professeur)</label>
            <select name="matiereEnseignee" value={formData.matiereEnseignee} onChange={handleChange} disabled={formData.typePersonnel !== 'professeur'} className="w-full bg-gray-50 border p-2.5 rounded-lg bg-white outline-none cursor-pointer disabled:bg-gray-100">
              <option value="">-- Choisir la discipline --</option>
              <option value="Français">Français</option>
              <option value="Mathématiques">Mathématiques</option>
              <option value="Physique-Chimie">Physique-Chimie</option>
              <option value="Sciences de la Vie et de la Terre">SVT</option>
              <option value="Histoire-Géographie">Histoire-Géographie</option>
              <option value="Anglais">Anglais</option>
              <option value="Philosophie">Philosophie</option>
              <option value="Éducation Physique">Éducation Physique</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">N° Sécurité Sociale / CNPS</label>
            <input type="text" name="numSecuriteSociale" value={formData.numSecuriteSociale} onChange={handleChange} placeholder="Ex: 566579045009" className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none font-mono" />
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Années d'Expérience Réelles</label>
            <input type="number" name="anneesExperience" min="0" value={formData.anneesExperience} onChange={handleChange} className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none font-mono" />
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Établissement de Provenance</label>
            <input type="text" name="etablissementProvenance" value={formData.etablissementProvenance} onChange={handleChange} placeholder="Ex: Lycée Classique Abidjan" className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none" />
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Établissement Actuel Detaché</label>
            <input type="text" name="etablissementActuel" value={formData.etablissementActuel} onChange={handleChange} placeholder="Ex: Lycée Moderne Gagnoa" className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none" />
          </div>

          <div className="sm:col-span-2 border-t pt-4 mt-2">
            <h3 className="text-[11px] font-black uppercase text-purple-700 tracking-wider mb-3">Coordonnées Numériques de Contact</h3>
          </div>

          <div>
            <label className="block text-gray-400 uppercase mb-1">Adresse Courriel (Email) *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Ex: nom@lecloudscolaire.com" className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none font-mono" required />
          </div>
          <div>
            <label className="block text-gray-400 uppercase mb-1">Téléphone Mobile Cellulaire *</label>
            <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} placeholder="Ex: +225 0708091011" className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none font-mono" required />
          </div>

          <div className="sm:col-span-2 pt-4 text-right">
            <button 
              type="submit" 
              disabled={loading} 
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl shadow-md transition cursor-pointer disabled:bg-gray-200"
            >
              {loading ? "Déploiement sur la matrice..." : "💼 Enregistrer le Contrat de Recrutement"}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default AjouterPersonnel;
