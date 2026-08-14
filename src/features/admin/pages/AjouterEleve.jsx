import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { db, enrollStudentOnFirebase } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';
import FormulaireClasse from './FormulaireClasse.jsx';

const AjouterEleve = () => {
  const navigate = useNavigate();
  const { schoolId, schoolName } = useAuth(); 

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

  // 1. Matrice des états initiaux contrôlés
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    genre: '',
    dateNaissance: '',
    ecoleProvenance: '',
    numSecuriteSociale: '',
    niveauPromotion: '', // Ex: "tle_d", "6eme", "2nd_a"
    classeId: '',       
    anneeArrivee: new Date().getFullYear().toString(),
    dispensePhysique: 'Non',
    email: '',      
    telephone: '',
    emailParent: ''
  });

  const [classes, setClasses] = useState([]); 
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
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
  // 2. Écoute réactive en temps réel de TOUTES les classes de CETTE école (Insensible à la casse de l'ID d'école)
  useEffect(() => {
    if (!currentSchool) return;
    setLoadingClasses(true);
    
    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClasses(list);
      setLoadingClasses(false);
    }, (err) => {
      console.error("Erreur synchronisation live des classes :", err);
      setLoadingClasses(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // 🟢 3. FILTRAGE DES CLASSES PAR PROMOTION
// La valeur du formulaire et celle de Firestore peuvent être écrites
// différemment : "2nd C", "2nd_C", "2nd-c", etc.
// On les transforme en une même clé technique.

// 🟢 FILTRAGE COMPATIBLE AVEC TOUTES LES SÉRIES IVOIRIENNES (C, D, A1, A2...)
const normaliserPromotion = (value = '') => {
  const str = value.toString().toLowerCase().trim();
  
  // Convertit les formats formulaire ou Firestore vers des clés génériques simplifiées
  if (str === '2nd' || str.startsWith('2nd') || str.startsWith('2nde')) return '2nd';
  if (str === '1ere' || str.startsWith('1ere') || str.startsWith('1er')) return '1ere';
  
  // Capture "terminal", "terminale", "tle", ainsi que vos formats Firestore comme "t_a1", "t_a2"
  if (str === 'terminal' || str === 'terminale' || str.startsWith('tle') || str.startsWith('t_') || str === 't') {
    return 'terminal';
  }
  
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\s]+/g, '_')
    .replace(/_+/g, '_');
};

const classesFiltrees = classes.filter((c) => {
  if (!formData.niveauPromotion) return false;

  const promotionSelectionnee = normaliserPromotion(formData.niveauPromotion); // Ex: 'terminal' (formulaire)
  const promotionClasseFirestore = normaliserPromotion(c.promotion);            // Ex: 'terminal' (car c.promotion vaut 'T_A1')

  // Vérification de correspondance stricte après unification du cycle
  return promotionClasseFirestore === promotionSelectionnee;
});

  // 4. Soumission et écriture Cloud en Temps Réel
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.nom || !formData.prenom || !formData.niveauPromotion || !formData.classeId || !formData.emailParent.trim()) {
      setMessage({ type: 'error', text: 'Veuillez remplir les champs obligatoires (*) incluant l\'e-mail du parent.' });
      return;
    }

    setLoading(true);

    try {
      const cleanNom = formData.nom.trim().toUpperCase();
      const cleanPrenom = formData.prenom.trim();
      const mailParentClean = formData.emailParent.trim().toLowerCase();

      // Formule de calcul du Matricule Ivoirien (ex: 26_7493K)
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const lettreFin = alphabet[Math.floor(Math.random() * alphabet.length)];
      const numAleatoire = Math.floor(1000 + Math.random() * 9000);
      const matriculeGenere = `26_${numAleatoire}${lettreFin}`;

      // Formate le mot de passe automatique demandé : matricule@nom_prenom!
      const nFormate = cleanNom.replace(/\s+/g, '');
      const pFormate = cleanPrenom.toLowerCase().replace(/\s+/g, '_');
      const passwordCalcule = `${matriculeGenere.toLowerCase()}@${nFormate.toLowerCase()}_${pFormate}!`;

      const targetClass = classes.find(c => c.id === formData.classeId);

      // Payload Cloud relationnel consolidé
      const studentCloudData = {
        id: matriculeGenere,
        matricule: matriculeGenere,
        nom: cleanNom,
        prenoms: cleanPrenom,
        role: 'eleve',
        classeId: targetClass?.idBrute || formData.classeId, // Sauvegarde la clé propre (ex: tle_d_1)
        promotion: targetClass?.promotion || formData.niveauPromotion,
        dateNaissance: formData.dateNaissance,
        ecoleProvenance: formData.ecoleProvenance.trim(),
        numSecuriteSociale: formData.numSecuriteSociale.trim(),
        anneeArrivee: formData.anneeArrivee,
        dispensePhysique: formData.dispensePhysique,
        email: formData.email.trim() || `${matriculeGenere.toLowerCase()}@school.ci`, 
        telephone: formData.telephone.trim(), 
        emailParent: mailParentClean,
        password: passwordCalcule, 
        statut: "actif",
        absences: 0,
        notes: {},
        schoolId: currentSchool
      };

      const response = await enrollStudentOnFirebase(matriculeGenere, studentCloudData, currentSchool);

      if (response.success) {
        await genererFicheAvecQRCodePDF({
          ...studentCloudData,
          prenom: cleanPrenom,
          password: passwordCalcule
        }, 'eleve');

        setMessage({
          type: 'success',
          text: `🎉 L'élève ${cleanPrenom} ${cleanNom} a été inscrit avec succès dans la classe ${targetClass?.nom || ''} !\n\n🔑 Matricule attribué : ${matriculeGenere}\n🔐 Clé d'accès générée : ${passwordCalcule}\n📧 Alertes parents associées à : ${mailParentClean}`
        });

        setFormData({
          nom: '', prenom: '', genre: '', dateNaissance: '', ecoleProvenance: '',
          numSecuriteSociale: '', niveauPromotion: '', classeId: '',
          anneeArrivee: new Date().getFullYear().toString(),
          dispensePhysique: 'Non', email: '', telephone: '', emailParent: ''
        });
        setPhotoPreview(null);
        setPhotoFile(null);
      } else {
        setMessage({ type: 'error', text: response.msg || "Échec de l'inscription." });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: "Une erreur réseau est survenue lors de l'inscription." });
    } finally {
      setLoading(false);
    }
  };
  const handleChange = (e) => {
  const { name, value } = e.target;

  setFormData((prev) => ({
    ...prev,
    [name]: value
  }));
};

// 📸 Gestion de la photo
const handlePhotoChange = (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  // Vérification simple
  if (!file.type.startsWith('image/')) {
    setMessage({
      type: 'error',
      text: 'Veuillez sélectionner une image valide.'
    });
    return;
  }

  setPhotoFile(file);

  // Libère éventuellement l'ancienne URL
  if (photoPreview) {
    URL.revokeObjectURL(photoPreview);
  }

  setPhotoPreview(URL.createObjectURL(file));
};
 useEffect(() => {
  setFormData((prev) => ({
    ...prev,
    classeId: ''
  }));
}, [formData.niveauPromotion]);
  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-md my-6 font-sans relative animate-fadeIn">
       {/* 🟢 FICHE D'IDENTIFICATION & EN-TÊTE BADGE ÉLÈVE DYNAMIQUE INTERNATIONALE */}
      <div className="flex justify-between items-start border-b pb-4 mb-6 text-[11px] font-black uppercase text-gray-500 tracking-tight leading-relaxed">
        <div>
          <p className="text-gray-900 font-extrabold text-xs">{metaSchool.pays}</p>
          <p className="font-medium italic text-[10px] lowercase first-letter:uppercase text-gray-400">{metaSchool.devise}</p>
          <p className="mt-1 text-gray-700">{metaSchool.ministere}</p>
        </div>
        <div className="text-right font-mono text-[10px] text-gray-400">
          <p>FICHE D'IDENTIFICATION & BADGE ÉLÈVE</p>
          <p className="text-emerald-700 font-bold mt-0.5">SECTION : ACCÈS SÉCURISÉ</p>
        </div>
      </div>
      {/* Bouton de retour */}
      <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-2">🏛️ Inscription d'un Nouvel Élève (Temps Réel)</h2>
      <p className="text-xs text-orange-600 font-extrabold uppercase tracking-wider mb-6">
        Établissement : {schoolName || currentSchool.replace(/_/g, ' ').toUpperCase()}
      </p>

      {message.text && (
        <div className={`p-4 mb-6 rounded-lg text-sm font-semibold whitespace-pre-line border ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ================= 1. INFORMATIONS PERSONNELLES ================= */}
        <div>
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 border-b pb-1">1. Informations Personnelles & CMU</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            {/* Zone Photo d'identité */}
            <div className="flex flex-col items-center space-y-2 md:col-span-1 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
              <div className="w-28 h-28 border-2 border-gray-300 rounded-full flex items-center justify-center overflow-hidden bg-white shadow-inner">
                {photoPreview ? (
                  <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-gray-400 text-center font-bold uppercase">Pas de Photo</span>
                )}
              </div>
              <label className="cursor-pointer bg-white hover:bg-gray-100 text-gray-700 text-[11px] font-extrabold py-1 px-2.5 rounded border shadow-xs transition">
                Téléverser
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>

            {/* État civil et Contacts */}
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-3">
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Nom de famille *</label>
                <input type="text" name="nom" value={formData.nom || ''} onChange={handleChange} placeholder="Ex: KOFFI" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 uppercase font-bold outline-none" required />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Tous les Prénoms *</label>
                <input type="text" name="prenom" value={formData.prenom || ''} onChange={handleChange} placeholder="Ex: Yao Ama" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 font-medium outline-none" required />
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Genre / Sexe *</label>
                <select
                  name="genre"
                  value={formData.genre || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none"
                  required
                >
                  <option value="">-- Choisir le genre --</option>
                  <option value="Masculin">♂️ Masculin</option>
                  <option value="Féminin">♀️ Féminin</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Date de Naissance *</label>
                <input type="date" name="dateNaissance" value={formData.dateNaissance || ''} onChange={handleChange} className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none" required />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">E-mail de l'Élève (Optionnel)</label>
                <input type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="eleve@gmail.com" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Numéro Parent / Tuteur *</label>
                <input type="tel" name="telephone" value={formData.telephone || ''} onChange={handleChange} placeholder="Ex: 0708091011" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono" required />
              </div>

              {/* 🟢 BLOC CHAMP TECHNIQUE PARENTAL AJOUTÉ AVEC SUCCÈS */}
              <div className="md:col-span-2 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                <label className="block text-purple-800 text-xs font-bold uppercase mb-1">📧 Adresse E-mail Parental *</label>
                <input 
                  type="email" 
                  name="emailParent" 
                  value={formData.emailParent || ''} 
                  onChange={handleChange} 
                  placeholder="parent-tuteur@gmail.com" 
                  className="w-full px-3 py-2.5 border bg-white text-sm rounded-md focus:ring-2 focus:ring-purple-500 outline-none font-mono font-bold text-slate-900" 
                  required 
                />
                <p className="text-[10px] text-purple-500 mt-1 font-medium leading-tight">
                  🚨 Vitale : C'est sur cette adresse mail que seront envoyés en temps réel les bulletins PDF officiels, les relevés de notes et les alertes automatiques cumulées de 10H d'absences.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">École de provenance</label>
              <input type="text" name="ecoleProvenance" value={formData.ecoleProvenance || ''} onChange={handleChange} placeholder="Ex: Collège Moderne de Bouaké" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Numéro d'Immatriculation CMU</label>
              <input type="text" name="numSecuriteSociale" value={formData.numSecuriteSociale || ''} onChange={handleChange} placeholder="Ex: CMU-0012345-A" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono" />
            </div>
          </div>
        </div>

                {/* ================= 2. INFORMATIONS ACADÉMIQUES ================= */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 border-b pb-1">2. Affectation Pédagogique (Promotions Unifiées Ivoiriennes)</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Niveau de la Promotion *</label>
              <select name="niveauPromotion" value={formData.niveauPromotion || ''} onChange={handleChange} className="w-full px-3 py-2.5 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none" required>
  <option value="">-- Sélectionner la promotion --</option>
  
  <optgroup label="Premier Cycle">
    <option value="6eme">6ème</option>
    <option value="5eme">5ème</option>
    <option value="4eme">4ème</option>
    <option value="3eme">3ème</option>
  </optgroup>

  <optgroup label="Second Cycle">
    <option value="2nd">2nd</option>
    <option value="1ere">1ère</option>
    <option value="terminal">Terminale</option>
  </optgroup>
</select>

            </div>

            {/* Division de classe dynamique */}
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Division Pédagogique de la Classe *</label>
              {loadingClasses ? (
                <p className="p-2 border text-xs text-gray-400 animate-pulse font-bold bg-gray-50 rounded-md">⏳ Chargement des structures...</p>
              ) : classesFiltrees.length === 0 ? (
                <p className="p-2.5 border text-xs text-red-600 bg-red-50 font-bold rounded-md">⚠️ Aucune classe créée en base pour ce niveau.</p>
              ) : (
                <select name="classeId" value={formData.classeId || ''} onChange={handleChange} className="w-full px-3 py-2.5 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-bold outline-none" required>
                  <option value="">-- Assigner la classe --</option>
                  {classesFiltrees.map(cl => (
                    <option key={cl.id} value={cl.id}>🏛️ {cl.nom || (cl.idBrute || '').toUpperCase()}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ================= 3. DISPENSES ================= */}
        <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Aptitude Physique (EPS)</label>
            <select name="dispensePhysique" value={formData.dispensePhysique} onChange={handleChange} className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none">
              <option value="Non">✅ Apte (Pratique Régulière)</option>
              <option value="Oui">🏥 Inapte (Billet de Dispense Médicale)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Année d'Affectation</label>
            <input type="text" name="anneeArrivee" value={formData.anneeArrivee} onChange={handleChange} className="w-full px-3 py-2 border text-sm rounded-md bg-gray-50 cursor-not-allowed outline-none font-mono" disabled />
          </div>
        </div>

        {/* Bouton de validation d'inscription */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || classesFiltrees.length === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl uppercase tracking-wider text-xs shadow-md transition disabled:bg-gray-300 cursor-pointer flex justify-center items-center"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              "💾 Valider et Immatriculer l'Élève"
            )}
          </button>
        </div>
      </form>
        <Link
        to="/admin/home"
        className="absolute top-6 right-6 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-xs transition shadow-xs"
      >
        ← Retour au Secrétariat
      </Link>
    </div>
  );
};

export default AjouterEleve;
