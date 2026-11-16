import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';
import Header from '../../../pages/Header.jsx';

const AjouterPersonnel = () => {
const { user } = useAuth();
  const navigate = useNavigate();

  const currentSchool = (
    user?.schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    ''
  ).trim().toLowerCase();

  const schoolName =
    user?.schoolName ||
    sessionStorage.getItem('sgs_school_name') ||
    '';

  const [formData, setFormData] = useState({
    typePersonnel: '',
    nom: '',
    prenom: '',
    prenoms: '',
    genre: '',
    dateNaissance: '',
    matiereEnseignee: '',
    grade: '',
    anneeArrivee: new Date().getFullYear().toString(),
    numSecuriteSociale: '',
    anneesExperience: '0',
    etablissementProvenance: '',
    etablissementActuel: schoolName,
    email: '',
    telephone: ''
  });

  const [matieres, setMatieres] = useState([]);
  const [metaSchool, setMetaSchool] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState({
    type: '',
    text: ''
  });

  const [pdfDisponible, setPdfDisponible] = useState(false);
  const [dernierPersonnel, setDernierPersonnel] = useState(null);

  const estProfesseur =
    formData.typePersonnel === 'professeur';

  // ==========================================================
  // MATIÈRES
  // ==========================================================

  useEffect(() => {
    if (!currentSchool) {
      setMatieres([]);
      return undefined;
    }

    const qMatieres = query(
      collection(db, 'matieres'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      qMatieres,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};

          const nom =
            data.nom ||
            data.name ||
            data.libelle ||
            data.matiere ||
            data.nomMatiere ||
            '';

          if (String(nom).trim()) {
            liste.push({
              id: docSnap.id,
              nom: String(nom).trim()
            });
          }
        });

        if (liste.length === 0) {
          setMatieres([
  { id: 'sec_math', nom: 'Mathématiques' },
  { id: 'sec_pc', nom: 'Physique-Chimie' },
  { id: 'sec_svt', nom: 'SVT' },
  { id: 'sec_fr', nom: 'Français' },
  { id: 'sec_hg', nom: 'Histoire-Géographie' },
  { id: 'sec_ang', nom: 'Anglais' },
  { id: 'sec_phi', nom: 'Philosophie' },
  { id: 'sec_edhc', nom: 'EDHC' },
  { id: 'sec_eps', nom: 'Éducation Physique et Sportive (EPS)' },
  { id: 'sec_art', nom: 'Arts Plastiques' },
  { id: 'sec_mus', nom: 'Éducation Musicale' },
  { id: 'sec_tice', nom: 'TICE' },
  { id: 'sec_span', nom: 'Espagnol' },
  { id: 'sec_allemand', nom: 'Allemand' }
]);

          
        } else {
          setMatieres(liste);
        }
      },
      (err) => {
        console.error(
          'Erreur extraction matières :',
          err
        );

       setMatieres([
  { id: 'sec_math', nom: 'Mathématiques' },
  { id: 'sec_pc', nom: 'Physique-Chimie' },
  { id: 'sec_svt', nom: 'SVT' },
  { id: 'sec_fr', nom: 'Français' },
  { id: 'sec_hg', nom: 'Histoire-Géographie' },
  { id: 'sec_ang', nom: 'Anglais' },
  { id: 'sec_phi', nom: 'Philosophie' },
  { id: 'sec_edhc', nom: 'EDHC' },
  { id: 'sec_eps', nom: 'Éducation Physique et Sportive (EPS)' },
  { id: 'sec_art', nom: 'Arts Plastiques' },
  { id: 'sec_mus', nom: 'Éducation Musicale' },
  { id: 'sec_tice', nom: 'TICE' },
  { id: 'sec_span', nom: 'Espagnol' },
  { id: 'sec_allemand', nom: 'Allemand' }
]);

      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // ==========================================================
  // MÉTADONNÉES ÉTABLISSEMENT
  // ==========================================================

  useEffect(() => {
    if (!currentSchool) {
      setMetaSchool({});
      return undefined;
    }

    const schoolRef = doc(
      db,
      'schools',
      currentSchool
    );

    const unsubscribe = onSnapshot(
      schoolRef,
      (snap) => {
        if (snap.exists()) {
          setMetaSchool(snap.data() || {});
        } else {
          setMetaSchool({});
        }
      },
      (err) => {
        console.warn(
          'Erreur métadonnées école :',
          err
        );

        setMetaSchool({});
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // ==========================================================
  // CHANGEMENT FORMULAIRE
  // ==========================================================

  const handleChange = (e) => {
    const {
      name,
      value
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'typePersonnel' &&
      value !== 'professeur'
        ? { matiereEnseignee: '' }
        : {})
    }));
  };

  // ==========================================================
  // PHOTO
  // ==========================================================

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setPhotoFile(file);

    const url = URL.createObjectURL(file);

    setPhotoPreview(url);

    sessionStorage.setItem(
      'sgs_last_photo_blob',
      url
    );
  };

  // ==========================================================
  // GÉNÉRATION PDF
  // ==========================================================

 const genererPDFPersonnel = async (personnel) => {
  try {
    const resultat = await genererFicheAvecQRCodePDF(
      {
        ...personnel,
        schoolId: currentSchool,
        schoolName:
          metaSchool.nom ||
          metaSchool.name ||
          schoolName ||
          currentSchool,
        pays: metaSchool.pays || '',
        devise: metaSchool.devise || '',
        ministere:
          metaSchool.ministere ||
          metaSchool.tutelle ||
          '',
        anneeScolaire:
          personnel.anneeScolaire ||
          metaSchool.anneeScolaire ||
          metaSchool.annee_scolaire ||
          '',
        premierResponsable: metaSchool.premierResponsable || '',
        statutAbonnement: metaSchool.statutAbonnement || '',
        signature_admin:
          sessionStorage.getItem('sgs_admin_sig') || '',
        signature_admin_image:
          sessionStorage.getItem('sgs_admin_canvas_img') || ''
      },
      'personnel'
    );

    if (!resultat?.success) {
      throw new Error('Le générateur PDF n’a pas confirmé la création du badge.');
    }
    return true;
  } catch (error) {
    console.error('Erreur génération PDF :', error);
    setPdfDisponible(false);
    setMessage({
      type: 'error',
      text:
        `Le personnel a bien été enregistré, ` +
        `mais la génération du PDF a échoué : ${error?.message || ''}`
    });
    return false;
  }
};
  // ==========================================================
  // ENREGISTREMENT
  // ==========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage({
      type: '',
      text: ''
    });

    setPdfDisponible(false);

    if (!currentSchool) {
      setMessage({
        type: 'error',
        text:
          "L'établissement actif n'a pas été identifié."
      });

      return;
    }

    if (
      !formData.typePersonnel ||
      !formData.nom.trim() ||
      !formData.prenom.trim() ||
      !formData.email.trim() ||
      !formData.telephone.trim()
    ) {
      setMessage({
        type: 'error',
        text:
          'Veuillez remplir tous les critères obligatoires (*).'
      });

      return;
    }

    if (
      estProfesseur &&
      !formData.matiereEnseignee
    ) {
      setMessage({
        type: 'error',
        text:
          'Veuillez sélectionner la matière du professeur.'
      });

      return;
    }

    setLoading(true);

    try {
      // ======================================================
      // MATRICULE
      // ======================================================

      const uniqueIndex =
        Math.floor(
          100 + Math.random() * 900
        );

      const rolePrefix =
        formData.typePersonnel
          .substring(0, 4)
          .toUpperCase();

      const generatedMatricule =
        `${rolePrefix}_${formData.nom
          .toUpperCase()
          .replace(/\s+/g, '')}_${uniqueIndex}`;

            // ======================================================
      // DONNÉES PERSONNEL
      // ======================================================

      // 🟢 CALCUL DU MOT DE PASSE EN AMONT (Évite les champs blancs dans l'alerte)
      const nFormate = formData.nom.trim().replace(/\s+/g, '').toLowerCase();
      const pFormate = formData.prenom.trim().replace(/\s+/g, '_').toLowerCase();
      const passwordCalcule = `${generatedMatricule.toLowerCase()}@${nFormate}_${pFormate}!`;

      const finalRhPayload = {
        id: generatedMatricule,

        matricule: generatedMatricule,

        role: formData.typePersonnel,

        nom:
          formData.nom
            .toUpperCase()
            .trim(),

        prenom:
          formData.prenom.trim(),

        prenoms:
          `${formData.prenom.trim()} ${
            formData.prenoms || ''
          }`.trim(),

        name:
          `${formData.nom
            .toUpperCase()
            .trim()} ${formData.prenom.trim()}`,

        genre:
          formData.genre,

        dateNaissance:
          formData.dateNaissance,

        matiereEnseignee:
          estProfesseur
            ? formData.matiereEnseignee
            : '',

        grade:
          formData.grade
            .toUpperCase()
            .trim(),

            anneeArrivee:
          formData.anneeArrivee,

        numSecuriteSociale:
          formData.numSecuriteSociale ||
          'N/A',

        anneesExperience:
          formData.anneesExperience ||
          '0',

        etablissementProvenance:
          formData.etablissementProvenance ||
          'N/A',

        etablissementActuel:
          formData.etablissementActuel ||
          metaSchool.nom ||
          metaSchool.name ||
          schoolName ||
          '',

        email:
          formData.email
            .toLowerCase()
            .trim(),

        telephone:
          formData.telephone.trim(),

        statut: 'actif',

        schoolId: currentSchool,

        password: passwordCalcule, // 🟢 Stocké temporairement pour l'affichage de l'alerte

        // ====================================================
        // ANNÉE SCOLAIRE ACTIVE
        // ====================================================

        anneeScolaire:
          formData.anneeScolaire.trim(),

        // ====================================================
        // SIGNATURE ADMIN
        // ====================================================

        signature_admin:
          sessionStorage.getItem(
            'sgs_admin_sig'
          ) || '',

        signature_admin_image:
          sessionStorage.getItem(
            'sgs_admin_canvas_img'
          ) || '',

        photo:
          photoFile
            ? photoFile.name
            : 'icons8-github-50.png',

        createdAt:
          new Date().toISOString()
      };

      // ======================================================
      // FIRESTORE
      // ======================================================

      await setDoc(
        doc(
          db,
          'users',
          generatedMatricule
        ),
        finalRhPayload
      );

      // Mémorisation de l'objet complet pour l'alerte
      setDernierPersonnel(finalRhPayload);

      // ======================================================
      // PDF
      // ======================================================

      await genererPDFPersonnel(finalRhPayload);

      // ======================================================
      // RESET
      // ======================================================

      setFormData({
        typePersonnel: '',
        nom: '',
        prenom: '',
        prenoms: '',
        genre: '',
        dateNaissance: '',
        matiereEnseignee: '',
        grade: '',
        numSecuriteSociale: '',
        anneesExperience: '0',
        etablissementProvenance: '',
        etablissementActuel:
          metaSchool.nom ||
          metaSchool.name ||
          schoolName ||
          '',
        email: '',
        telephone: ''
      });

      setPhotoPreview(null);
      setPhotoFile(null);

    } catch (error) {
      console.error(
        "Erreur d'écriture NoSQL :",
        error
      );

      setMessage({
        type: 'error',
        text:
          error?.message ||
          "Une erreur est survenue lors de l'enregistrement du personnel."
      });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // NOM ÉTABLISSEMENT (UNIQUE)
  // ==========================================================

  const nomEtablissement =
    metaSchool.nom ||
    metaSchool.name ||
    schoolName ||
    currentSchool ||
    '';

  // ==========================================================
  // RENDU JSX UNIQUE
  // ==========================================================

  return (
    <div className="bg-white max-w-5xl mx-auto p-0 sm:p-6 lg:p-8 font-sans  min-h-screen text-gray-700 text-left">
    <Header/>
    <form onSubmit={handleSubmit} className="form-personnel">
           {/* 🟢 CORRECTIF TOTAL : Récupération étanche du mot de passe généré */}
          {dernierPersonnel && (
            <div className="messageeleve fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="  max-w-sm text-left space-y-4">
                
                {/* En-tête de l'Alerte */}
                <div className="flex items-center ">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Compte Personnel Activé</h3>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Identifiants de connexion Edulink</p>
                  </div>
                </div>

                <p className="text-gray-600 font-medium text-[11px] leading-relaxed">
                  veillez transmettre à la personnel concerné (Fiche d'inscription: MATRICULE & PASSWORD  ) pour avoir accès a son espace personnel :
                </p>

                {/* Bloc d'affichage des accès */}
                <div className=" p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-black uppercase text-[9px]">Matricule / ID :</span>
                    <span className="font-mono   text-slate-800 font-black text-xs shadow-2xs">
                      {dernierPersonnel.matricule || "GÉNÉRÉ"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-black uppercase text-[9px]">Mot de Passe :</span>
                    <span className="font-mono  px-2.5 py-0.5 rounded text-orange-700 font-black text-xs shadow-2xs">
                      {/* 🟢 FORCE LE CALCUL DE SÉCURITÉ EN CAS D'ÉTAT D'ÉCRITURE ASYNCHRONE VIDE */}
                      {dernierPersonnel.password || `${String(dernierPersonnel.matricule).toLowerCase()}@edulink_saas!`}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-emerald-600  p-2.5 rounded-xl font-medium italic">
                  ✓ Traitement d'enregistrement cloud terminé.
                </div>

                {/* Bouton de fermeture de l'alerte */}
                <button 
                  type="button" 
                  onClick={() => setDernierPersonnel(null)} 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 border border-slate-800 font-black py-2.5 rounded-xl uppercase tracking-wider transition cursor-pointer text-center text-[11px]"
                >
                  Fermer la Notification
                </button>

              </div>
            </div>
          )}
     <div className="separateur"><div className="trait"></div></div>
        <div className="w-full text-center border-t-4 border-t-purple-600 pt-4">

          <div className="mt-4 pt-4 border-t">

            <h2 className="recrut text-lg font-black text-gray-900 uppercase">
              Recrutement d'enseignants , educateurs & Gestion des Équipes RH
            </h2>
          </div>
        </div>

        {message.text && (
          <div
            className={`w-full mb-2 rounded-xl text-xs font-bold border whitespace-pre-line ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}
        
        
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">

          <div className="md:col-span-1 border-b md:border-b-0 md:border-r pb-6 md:pb-0 md:pr-6 flex flex-col items-center gap-4">

            <div className="w-full">

            <div className='partieStatut'>
              <h3 className="statut text-[11px] font-black uppercase text-purple-700 tracking-wider mb-3">
                I _ Statut Institutionnel
              </h3>

              <div className="nomfamille6 form-floating mb-3">
              <label
                htmlFor="floatingInput"
                className=" block text-gray-700 text-xs font-bold uppercase mb-1"
              >
                Rôle au sein de l'École *
              </label>

              <select
                id="floatingInput"
                name="typePersonnel"
                value={formData.typePersonnel}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none cursor-pointer text-xs font-bold text-gray-800"
                required
              >

                <option selected value="">
                  -- Choisir Rôle au sein de l'École --
                </option>

                <option value="professeur">
                  Professeur de Discipline
                </option>

                <option value="educateur">
                  Éducateur de Promotion
                </option>

                <option value="administration">
                  Personnel Administratif
                </option>

                <option value="securite">
                  Agent de Sécurité
                </option>

              </select>

            </div>
            
            <div className="w-full flex flex-col items-center">

              <div
               style={{
                  width: '300px',
                  height: '100px',
                  minWidth: '50px',
                  minHeight: '50px'
                }}
               className="photopersonne border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center overflow-hidden relative bg-gray-50 mt-2 transition hover:border-purple-300 shrink-0">

                {photoPreview ? (
                  <img
                    src={photoPreview}
                    style={{
                      width: '50px',
                      height: '50px'
                    }}
                    alt="Identité Agent"
                    className="object-cover block shrink-0"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full w-full text-center text-gray-400">
                    <span className="text-sm block">
                      📸
                    </span>
                    Photo d'identité
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />

              </div>

            </div>

          </div>
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="nomfamille2 form-floating mb-3">

              <label
                htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1"
              >
                Nom de Famille *
              </label>

              <input
                type="text"
                id="floatingInput"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none uppercase text-xs font-bold text-gray-800"
                required
              />
              </div>

              <div className="nomfamille3 form-floating mb-3">
              <label
                htmlFor="floatingInput"
                className="block text-gray-400 uppercase mb-1 mt-3"
              >
                Prénoms *
              </label>

              <input
                type="text"
                id="floatingInput"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold text-gray-800"
                required
              />
              </div>

              <div className="nomfamille4 form-floating mb-3">
              <label
                htmlFor="floatingInput"
                className="block text-gray-400 uppercase mb-1 mt-3"
              >
                Autres prénoms
              </label>

              <input
                type="text"
                id="floatingInput"
                name="prenoms"
                value={formData.prenoms}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold text-gray-800"
              />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">

                <div className="nomfamille5 form-floating mb-3">

                  <label
                    htmlFor="genre"
                    className="block text-gray-400 uppercase mb-1"
                  >
                    Genre *
                  </label>

                  <select
                    id="genre"
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    className="form-select form-select-lg mb-3 w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
                    required
                    aria-label=".form-select-lg example"
                  >

                    <option selected value="">
                      Sélectionner
                    </option>

                    <option value="M">
                      Masculin
                    </option>

                    <option value="F">
                      Féminin
                    </option>

                  </select>

                </div>

                <div className="nomfamille7 form-floating mb-3">

                  <label
                    htmlFor="dateNaissance"
                    className="block text-gray-400 uppercase mb-1"
                  >
                    Date de naissance
                  </label>

                  <input
                    type="date"
                    id="dateNaissance"
                    name="dateNaissance"
                    value={formData.dateNaissance}
                    onChange={handleChange}
                    className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
                  />

                </div>

              </div>
            <div>
            </div>
            </div>
            <div className='clead'></div>

              <div className='partieStatu'>
              <h3 className="spécifications text-[11px] font-black uppercase text-purple-700 tracking-wider mb-3">
                II _ Spécifications Contractuelles
              </h3>
            
            <div className="nomfamille8 form-floating mb-3">
              <label
                htmlFor="grade"
                className="block text-gray-400 uppercase mb-1"
              >
                Grade *
              </label>

              <input
                type="text"
                id="grade"
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                placeholder="Ex: A3, A4, Contractuel"
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold uppercase"
                required
              />
              </div>
 
               
              {estProfesseur && (
                 <div className="nomfamille12 form-floating mb-3">

                  <label
                    htmlFor="matiereEnseignee"
                    className="block text-gray-400 uppercase mb-1"
                  >
                    Matière enseignée *
                  </label>

                  <select
                    id="matiereEnseignee"
                    name="matiereEnseignee"
                    value={formData.matiereEnseignee}
                    onChange={handleChange}
                    className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
                    required
                  >

                    <option value="">
                      -- Choisir la matière --
                    </option>

                    {matieres.map((matiere) => (
                      <option
                        key={matiere.id}
                        value={matiere.nom}
                      >
                        {matiere.nom}
                      </option>
                    ))}

                  </select>

                </div>
              )}
           
              <div className="nomfamille10 form-floating mb-3">
              <label
                htmlFor="numSecuriteSociale"
                className="block text-gray-400 uppercase mb-1 mt-3"
              >
                Numéro sécurité sociale
              </label>

              <input
                type="text"
                id="numSecuriteSociale"
                name="numSecuriteSociale"
                value={formData.numSecuriteSociale}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
              />
              </div>

              <div className="nomfamille11 form-floating mb-3">
              <label
                htmlFor="anneesExperience"
                className="block text-gray-400 uppercase mb-1 mt-3"
              >
                Années d'expérience
              </label>
              <input
                type="number"
                min="0"
                id="anneesExperience"
                name="anneesExperience"
                value={formData.anneesExperience}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
              />
              </div>

               {/* BLOC RÉACTIF ET MODIFIABLE EN TEMPS RÉEL : ANNÉE D'AFFECTATION */}
          <div className='nomfamille16 form-floating mb-3'>
            <label htmlFor="anneeArriveeInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
              Année d'Affectation
            </label>

            <input
              type="text"
              id="anneeArriveeInput"
              name="anneeArrivee" // Clé correspondante dans votre useState formData
              value={formData.anneeArrivee || ''} // Liaison bidirectionnelle
              onChange={handleChange} // Déclenche la mise à jour à chaque saisie
              placeholder="Ex: 2026, 2026-2027"
              className="form-control w-full px-3 py-2 border text-sm rounded-md bg-gray-50 outline-none font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-purple-500"
              required // Rend la saisie obligatoire pour éviter les fiches vides en base
            />
          </div>

    <div className='nomfamille17 form-floating mb-3'>        
  <label htmlFor="anneeArriveeInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
    Année scolaire
  </label>

  <input
     id="anneeArriveeInput"
     name="anneeArrivee"
    type="text"
    value={formData.anneeScolaire || ''}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        anneeScolaire: e.target.value,
      }))
    }
    placeholder="Ex : 2026-2027"
    className="form-control w-full px-3 py-2 border text-sm rounded-md bg-gray-50 outline-none font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-purple-500"
  />
</div>


             <div className="nomfamille13 form-floating mb-3">
              <label
                htmlFor="etablissementProvenance"
                className="block text-gray-400 uppercase mb-1 mt-3"
              >
                Établissement de provenance
              </label>

              <input
                type="text"
                id="etablissementProvenance"
                name="etablissementProvenance"
                value={formData.etablissementProvenance}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
              />
              </div>

               <div className="nomfamille14 form-floating mb-3">
              <label
                htmlFor="email"
                className="block text-gray-400 uppercase mb-1 mt-3"
              >
                E-mail *
              </label>

              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
                required
              />
              </div>

              <div className="nomfamille15 form-floating mb-3">
              <label
                htmlFor="telephone"
                className="block text-gray-400 uppercase mb-1 mt-3"
              >
                Numéro de Téléphone *
              </label>

              <input
                type="tel"
                id="telephone"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                className="form-control w-full bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold"
                required
              />
              </div>

            </div>

          </div>
        </div>
        </div>

        <div className="w-full mt-6 flex justify-between items-center gap-3">

          <Link
            to="/admin"
            className="btnfamil px-5 py-3 rounded-xl  font-black uppercase"
          >
            Retour
          </Link>

                     <button
            type="submit"
            disabled={loading}
            className="btnfamille py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-xs font-black uppercase"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer le personnel'}
          </button>

          {/* 🟢 MODALE D'ALERTE TOTALEMENT SÉCURISÉE ET INDÉPENDANTE */}
          {dernierPersonnel && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 w-full max-w-sm text-left space-y-4">
                
                <div className="flex items-center gap-2 border-b pb-3">
                  <span className="text-lg">✨</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Compte Personnel Activé</h3>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Identifiants de connexion Edulink</p>
                  </div>
                </div>

                <p className="text-gray-600 font-medium text-[11px] leading-relaxed">
                  Veuillez copier et transmettre ces accès de première connexion à l'agent :
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-black uppercase text-[9px]">Matricule / ID :</span>
                    <span className="font-mono bg-white border border-gray-200 px-2.5 py-0.5 rounded text-slate-800 font-black text-xs shadow-2xs">
                      {dernierPersonnel.matricule || "GÉNÉRÉ"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-200/60 pt-2.5">
                    <span className="text-gray-400 font-black uppercase text-[9px]">Mot de Passe :</span>
                    <span className="font-mono bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded text-orange-700 font-black text-xs shadow-2xs">
                      {dernierPersonnel.password || `${String(dernierPersonnel.matricule).toLowerCase()}@edulink_saas!`}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl font-medium italic">
                  ✓ Traitement d'enregistrement cloud terminé.
                </div>

                <button 
                  type="button" 
                  onClick={() => setDernierPersonnel(null)} 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 border border-slate-800 font-black py-2.5 rounded-xl uppercase tracking-wider transition text-center text-[11px]"
                >
                  Fermer la Notification
                </button>

              </div>
            </div>
          )}

        </div>

      </form>
    </div>
  );
};

export default AjouterPersonnel;
