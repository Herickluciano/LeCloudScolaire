import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom'; 
import { db, enrollStudentOnFirebase } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore'; 
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';

const AjouterEleve = () => {
  const navigate = useNavigate();
  const { schoolId, schoolName } = useAuth(); // Récupère l'ID de l'école (ex: lycee_oume)

  // 1. Matrice des états initiaux contrôlés
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    genre: '',
    dateNaissance: '',
    ecoleProvenance: '',
    numSecuriteSociale: '',
    niveauPromotion: '', 
    classeId: '',       
    anneeArrivee: new Date().getFullYear().toString(),
    dispensePhysique: 'Non',
    email: '',      
    telephone: ''   
  });

  const [classes, setClasses] = useState([]); 
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 2. Écoute réactive en temps réel des classes créées pour CETTE école spécifique
  useEffect(() => {
    if (!schoolId) return;
    setLoadingClasses(true);
    
    const q = query(collection(db, "classes"), where("schoolId", "==", schoolId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setClasses(list);
      setLoadingClasses(false);
    }, (err) => {
      console.error("Erreur de synchronisation des classes :", err);
      setLoadingClasses(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  // 🟢 PLACEMENT CORRECT : Filtrage calculé à chaque rendu à l'intérieur du composant
  const classesFiltrees = classes.filter(c => {
    const promoClasse = (c.promotion || '').trim().toLowerCase();
    const promoFormulaire = (formData.niveauPromotion || '').trim().toLowerCase();
    return promoClasse === promoFormulaire;
  });

  // Capture des entrées claviers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Traitement de l'image de profil
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // 3. Soumission et écriture Cloud en Temps Réel
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    if (!formData.nom || !formData.prenom || !formData.niveauPromotion || !formData.classeId) {
      setMessage({ type: 'error', text: 'Veuillez remplir les champs obligatoires (*)' });
      setLoading(false);
      return;
    }

    try {
      const currentSchool = schoolId || 'lycee_classique_abidjan';
      const cleanNom = formData.nom.trim().toUpperCase();
      const cleanPrenom = formData.prenom.trim();

      // Formule de calcul du Matricule Ivoirien (ex: 26_7493K)
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const lettreFin = alphabet[Math.floor(Math.random() * alphabet.length)];
      const numAleatoire = Math.floor(1000 + Math.random() * 9000);
      const matriculeGenere = `26_${numAleatoire}${lettreFin}`;

      const targetClass = classes.find(c => c.id === formData.classeId);

      // Payload Cloud relationnel
      const studentCloudData = {
        matricule: matriculeGenere,
        nom: cleanNom,
        prenoms: cleanPrenom,
        role: 'eleve',
        classeId: formData.classeId,
        promotion: formData.niveauPromotion,
        dateNaissance: formData.dateNaissance,
        ecoleProvenance: formData.ecoleProvenance.trim(),
        numSecuriteSociale: formData.numSecuriteSociale.trim(),
        anneeArrivee: formData.anneeArrivee,
        dispensePhysique: formData.dispensePhysique,
        email: formData.email.trim(), // 🟢 Correction : Enregistre le vrai mail saisi
        telephone: formData.telephone.trim(), // 🟢 Correction : Enregistre le vrai numéro saisi
        absences: 0,
        notes: {},
        schoolId: currentSchool
      };

      const response = await enrollStudentOnFirebase(matriculeGenere, studentCloudData, currentSchool);

      if (response.success) {
        await genererFicheAvecQRCodePDF({
          ...studentCloudData,
          prenom: cleanPrenom
        }, 'eleve');

        setMessage({
          type: 'success',
          text: `🎉 L'élève ${cleanPrenom} ${cleanNom} a été inscrit avec succès dans la classe ${targetClass?.nom || ''} !\n\n🔑 Matricule attribué : ${matriculeGenere}\n🔐 Code secret d'accès : ${matriculeGenere}@${cleanNom}!`
        });

        setFormData({
          nom: '', prenom: '', dateNaissance: '', ecoleProvenance: '',
          numSecuriteSociale: '', niveauPromotion: '', classeId: '',
          anneeArrivee: new Date().getFullYear().toString(),
          dispensePhysique: 'Non', email: '', telephone: ''
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

   return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-md my-6 font-sans relative">
      
      {/* Bouton de retour vers l'espace d'administration de l'école */}
      <Link
        to="/admin/dashboard"
        className="absolute top-6 right-6 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-xs transition shadow-xs"
      >
        ← Retour au Dashboard
      </Link>

      <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-2">🏛️ Inscription d'un Nouvel Élève (Temps Réel)</h2>
      <p className="text-xs text-orange-600 font-extrabold uppercase tracking-wider mb-6">Établissement : {schoolName}</p>

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
                <input type="text" name="nom" value={formData.nom || ''} onChange={handleChange} placeholder="Ex: KOFFI" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 uppercase font-bold outline-none" />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Tous les Prénoms *</label>
                <input type="text" name="prenom" value={formData.prenom || ''} onChange={handleChange} placeholder="Ex: Yao Ama" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 font-medium outline-none" />
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

              <div className="md:col-span-2">
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Date de Naissance *</label>
                <input type="date" name="dateNaissance" value={formData.dateNaissance || ''} onChange={handleChange} className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Adresse Mail Parent / Élève *</label>
                <input type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="eleve@gmail.com" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Numéro Parent / Tuteur *</label>
                <input type="tel" name="telephone" value={formData.telephone || ''} onChange={handleChange} placeholder="Ex: 0708091011" className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono" />
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
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 border-b pb-1">2. Affectation Pédagogique (12 Promotions Ivoiriennes)</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sélection de la promotion */}
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Niveau de la Promotion *</label>
              <select name="niveauPromotion" value={formData.niveauPromotion || ''} onChange={handleChange} className="w-full px-3 py-2.5 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none">
                <option value="">-- Sélectionner la promotion --</option>
                <optgroup label="Premier Cycle">
                  <option value="6eme">6ème</option>
                  <option value="5eme">5ème</option>
                  <option value="4eme">4ème</option>
                  <option value="3eme">3ème</option>
                </optgroup>
                <optgroup label="Second Cycle - Secondes">
                  <option value="2nd_A">2nd A</option>
                  <option value="2nd_C">2nd C</option>
                </optgroup>
                <optgroup label="Second Cycle - Premières">
                  <option value="1ere_A">1ere A</option>
                  <option value="1ere_C">1ere C</option>
                </optgroup>
                <optgroup label="Second Cycle - Terminales">
                  <option value="T_A1">Terminale A1</option>
                  <option value="T_A2">Terminale A2</option>
                  <option value="T_D">Terminale D</option>
                  <option value="T_C">Terminale C</option>
                </optgroup>
              </select>
            </div>

                        {/* Liste déroulante des classes physiques de l'école */}
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Classe Physique Disponible *</label>
              <select 
                name="classeId" 
                value={formData.classeId || ''} 
                onChange={handleChange} 
                disabled={loadingClasses || !formData.niveauPromotion}
                className="w-full px-3 py-2.5 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-semibold outline-none disabled:bg-gray-100"
              >
                <option value="">-- Choisir la structure cloud active --</option>
                {classesFiltrees.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nom} (Effectif : {c.elevesCount || 0} / 50)
                  </option>
                ))}
              </select>
              {formData.niveauPromotion && classesFiltrees.length === 0 && !loadingClasses && (
                <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ Aucune classe créée par l'admin pour ce niveau.</p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Année Scolaire d'Arrivée</label>
              <input type="number" name="anneeArrivee" value={formData.anneeArrivee || ''} onChange={handleChange} className="w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono" />
            </div>

            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Aptitude Médicale Éducation Physique (EPS)</label>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input type="radio" name="dispensePhysique" value="Non" checked={formData.dispensePhysique === 'Non'} onChange={handleChange} className="focus:ring-orange-500 h-4 w-4 text-orange-600 border-gray-300" />
                  <span>Apte (Normal)</span>
                </label>
                                <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input 
                    type="radio" 
                    name="dispensePhysique" 
                    value="Oui" 
                    checked={formData.dispensePhysique === 'Oui'} 
                    onChange={handleChange} 
                    className="focus:ring-orange-500 h-4 w-4 text-orange-600 border-gray-300" 
                  />
                  <span className="text-red-600 font-bold">Dispensé(e) d'EPS</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Bouton de validation d'envoi Cloud unique */}
        <div className="flex justify-end border-t pt-4">
          <button 
            type="submit" 
            disabled={loading || loadingClasses}
            className="bg-orange-500 text-white font-extrabold px-8 py-2.5 rounded-lg text-sm hover:bg-orange-600 shadow-md transition duration-150 disabled:bg-orange-300 min-w-[200px] flex items-center justify-center"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              "Valider l'Inscription MENA"
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AjouterEleve;
