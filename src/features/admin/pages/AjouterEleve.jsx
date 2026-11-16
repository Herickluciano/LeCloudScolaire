import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, enrollStudentOnFirebase } from '../../../services/api';
import {
  genererFicheAvecQRCodePDF,
} from '../../../utils/genererPDF';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc
} from 'firebase/firestore';

import { useAuth } from '../../../context/AuthContext';
import Header from '../../../pages/Header.jsx';
import RecupererCleAcces from '../../../pages/RecupererCleAcces.jsx';

const AjouterEleve = () => {
  const navigate = useNavigate();

  const { schoolId, schoolName } = useAuth();

  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    ''
  )
    .trim()
    .toLowerCase();

  // =========================================================
  // ÉTATS DU FORMULAIRE
  // =========================================================
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
    anneeScolaire: '',
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

  const [message, setMessage] = useState({
    type: '',
    text: ''
  });

  // =========================================================
  // MÉTADONNÉES DE L'ÉTABLISSEMENT
  //
  // IMPORTANT :
  // Ces informations viennent directement de :
  //
  // schools/{currentSchool}
  //
  // avec une écoute Firestore TEMPS RÉEL.
  //
  // Si l'administration modifie :
  // - pays
  // - devise
  // - ministere
  //
  // l'écran se met automatiquement à jour sans recharger
  // la page.
  // =========================================================
  const [metaSchool, setMetaSchool] = useState({
    pays: '',
    devise: '',
    ministere: ''
  });

  // =========================================================
  // MÉTADONNÉES ÉTABLISSEMENT EN TEMPS RÉEL
  // =========================================================
  useEffect(() => {
    if (!currentSchool) {
      setMetaSchool({
        pays: '',
        devise: '',
        ministere: ''
      });

      return;
    }

    const schoolRef = doc(
      db,
      'schools',
      currentSchool
    );

    const unsubscribe = onSnapshot(
      schoolRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          console.warn(
            `L'établissement ${currentSchool} n'existe pas dans Firestore.`
          );

          setMetaSchool({
            pays: '',
            devise: '',
            ministere: ''
          });

          return;
        }

        const data = snapshot.data();

        // ===================================================
        // TOUT VIENT DE FIRESTORE
        // AUCUNE VALEUR INSTITUTIONNELLE EN DUR
        // ===================================================
        setMetaSchool({
          pays:
            typeof data.pays === 'string'
              ? data.pays.trim()
              : '',

          devise:
            typeof data.devise === 'string'
              ? data.devise.trim()
              : '',

          ministere:
            typeof data.ministere === 'string'
              ? data.ministere.trim()
              : ''
        });
      },
      (error) => {
        console.error(
          "Erreur synchronisation temps réel des métadonnées de l'établissement :",
          error
        );

        setMetaSchool({
          pays: '',
          devise: '',
          ministere: ''
        });
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // =========================================================
  // CLASSES EN TEMPS RÉEL
  // =========================================================
  useEffect(() => {
    if (!currentSchool) {
      setClasses([]);
      setLoadingClasses(false);
      return;
    }

    setLoadingClasses(true);

    const q = query(
      collection(db, 'classes'),
      where(
        'schoolId',
        '==',
        currentSchool
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];

        snapshot.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });

        setClasses(list);
        setLoadingClasses(false);
      },
      (err) => {
        console.error(
          'Erreur synchronisation live des classes :',
          err
        );

        setClasses([]);
        setLoadingClasses(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // =========================================================
  // NORMALISATION DES PROMOTIONS
  // =========================================================
  const normaliserPromotion = (value = '') => {
    const str = value
      .toString()
      .toLowerCase()
      .trim();

    if (
      str === '2nd' ||
      str.startsWith('2nd') ||
      str.startsWith('2nde')
    ) {
      return '2nd';
    }

    if (
      str === '1ere' ||
      str.startsWith('1ere') ||
      str.startsWith('1er')
    ) {
      return '1ere';
    }

    if (
      str === 'terminal' ||
      str === 'terminale' ||
      str.startsWith('tle') ||
      str.startsWith('t_') ||
      str === 't'
    ) {
      return 'terminal';
    }

    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-\s]+/g, '_')
      .replace(/_+/g, '_');
  };

  // =========================================================
  // CLASSES FILTRÉES PAR PROMOTION
  // =========================================================
  const classesFiltrees = classes.filter((c) => {
    if (!formData.niveauPromotion) {
      return false;
    }

    const promotionSelectionnee =
      normaliserPromotion(
        formData.niveauPromotion
      );

    const promotionClasseFirestore =
      normaliserPromotion(
        c.promotion
      );

    return (
      promotionClasseFirestore ===
      promotionSelectionnee
    );
  });

  // =========================================================
  // CONVERSION PHOTO -> BASE64 COMPRESSÉ
  //
  // Firebase Storage n'est pas utilisé ici.
  // =========================================================
  const convertirPhotoEnBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve('');
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        const image = new Image();

        image.onload = () => {
          try {
            const canvas =
              document.createElement(
                'canvas'
              );

            const tailleMax = 500;

            let largeur = image.width;
            let hauteur = image.height;

            if (
              largeur > hauteur &&
              largeur > tailleMax
            ) {
              hauteur =
                (hauteur * tailleMax) /
                largeur;

              largeur = tailleMax;
            } else if (
              hauteur > largeur &&
              hauteur > tailleMax
            ) {
              largeur =
                (largeur * tailleMax) /
                hauteur;

              hauteur = tailleMax;
            } else if (
              largeur === hauteur &&
              largeur > tailleMax
            ) {
              largeur = tailleMax;
              hauteur = tailleMax;
            }

            canvas.width =
              Math.round(largeur);

            canvas.height =
              Math.round(hauteur);

            const ctx =
              canvas.getContext('2d');

            if (!ctx) {
              reject(
                new Error(
                  'Impossible de préparer la photo.'
                )
              );

              return;
            }

            ctx.fillStyle = '#ffffff';

            ctx.fillRect(
              0,
              0,
              canvas.width,
              canvas.height
            );

            ctx.drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );

            const base64 =
              canvas.toDataURL(
                'image/jpeg',
                0.72
              );

            resolve(base64);
          } catch (error) {
            reject(error);
          }
        };

        image.onerror = () => {
          reject(
            new Error(
              "Impossible de lire l'image sélectionnée."
            )
          );
        };

        image.src =
          event.target.result;
      };

      reader.onerror = () => {
        reject(
          new Error(
            'Impossible de convertir la photo.'
          )
        );
      };

      reader.readAsDataURL(file);
    });
  };

  // =========================================================
  // SOUMISSION DE L'INSCRIPTION
  // =========================================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage({
      type: '',
      text: ''
    });

    if (
      !formData.nom ||
      !formData.prenom ||
      !formData.genre ||
      !formData.dateNaissance ||
      !formData.niveauPromotion ||
      !formData.classeId ||
      !formData.emailParent.trim()
    ) {
      setMessage({
        type: 'error',
        text:
          "Veuillez remplir tous les champs obligatoires (*) incluant le genre, la date de naissance et l'e-mail du parent."
      });

      return;
    }

    if (!currentSchool) {
      setMessage({
        type: 'error',
        text:
          "Impossible de déterminer l'établissement connecté."
      });

      return;
    }

    setLoading(true);

    try {
      const cleanNom =
        formData.nom
          .trim()
          .toUpperCase();

      const cleanPrenom =
        formData.prenom.trim();

      const mailParentClean =
        formData.emailParent
          .trim()
          .toLowerCase();

      // =====================================================
      // MATRICULE
      // =====================================================
      const alphabet =
        'ABCDEFGHJKLMNPQRSTUVWXYZ';

      const lettreFin =
        alphabet[
          Math.floor(
            Math.random() *
              alphabet.length
          )
        ];

      const numAleatoire =
        Math.floor(
          1000 +
            Math.random() * 9000
        );

      const matriculeGenere =
        `26_${numAleatoire}${lettreFin}`;

      // =====================================================
      // CLÉ D'ACCÈS
      // =====================================================
      const nFormate =
        cleanNom.replace(
          /\s+/g,
          ''
        );

      const pFormate =
        cleanPrenom
          .toLowerCase()
          .replace(
            /\s+/g,
            '_'
          );

      const passwordCalcule =
        `${matriculeGenere.toLowerCase()}@${nFormate.toLowerCase()}_${pFormate}!`;

      // =====================================================
      // CLASSE
      // =====================================================
      const targetClass =
        classes.find(
          (c) =>
            c.id ===
            formData.classeId
        );

      if (!targetClass) {
        setMessage({
          type: 'error',
          text:
            "La classe sélectionnée n'existe plus ou n'est plus disponible."
        });

        setLoading(false);

        return;
      }

      // =====================================================
      // PHOTO
      // =====================================================
      let photoBase64 = '';

      if (photoFile) {
        photoBase64 =
          await convertirPhotoEnBase64(
            photoFile
          );
      }

      // =====================================================
      // DONNÉES CLOUD
      // =====================================================
      const studentCloudData = {
        id: matriculeGenere,

        matricule:
          matriculeGenere,

        nom: cleanNom,

        prenoms:
          cleanPrenom,

        genre:
          formData.genre,

        role: 'eleve',

        classeId:
          targetClass?.idBrute ||
          formData.classeId,

        promotion:
          targetClass?.promotion ||
          formData.niveauPromotion,

        dateNaissance:
          formData.dateNaissance,

        ecoleProvenance:
          formData.ecoleProvenance.trim(),

        numSecuriteSociale:
          formData.numSecuriteSociale.trim(),

        anneeArrivee:
          formData.anneeArrivee,

        anneeScolaire:
          formData.anneeScolaire.trim(),

        dispensePhysique:
          formData.dispensePhysique,

        email:
          formData.email.trim() ||
          `${matriculeGenere.toLowerCase()}@school.ci`,

        telephone:
          formData.telephone.trim(),

        emailParent:
          mailParentClean,

        password:
          passwordCalcule,

        statut: 'actif',

        absences: 0,

        notes: {},

        schoolId:
          currentSchool,

        // =================================================
        // PHOTO FIRESTORE
        // =================================================
        photoUrl:
          photoBase64 || '',

        photo:
          photoBase64 || '',

        photoBase64:
          photoBase64 || '',

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      };

      // =====================================================
      // ENREGISTREMENT FIREBASE
      // =====================================================
      const response =
        await enrollStudentOnFirebase(
          matriculeGenere,
          studentCloudData,
          currentSchool
        );

      if (response.success) {
        // ===================================================
        // GÉNÉRATION DE LA FICHE PDF
        // ===================================================
        await genererFicheAvecQRCodePDF(
          {
            ...studentCloudData,

            prenom:
              cleanPrenom,

            genre:
              formData.genre,

            photo:
              photoBase64 || '',

            photoUrl:
              photoBase64 || '',

            photoBase64:
              photoBase64 || '',

            password:
              passwordCalcule
          },
          'eleve'
        );

        setMessage({
          type: 'success',
          text:
            `🎉 L'élève ${cleanPrenom} ${cleanNom} a été inscrit avec succès dans la classe ${targetClass?.nom || ''} !\n\n` +
            `👤 Genre : ${formData.genre}\n` +
            `📷 Photo : ${photoBase64 ? 'Enregistrée' : 'Aucune photo'}\n` +
            `🔑 Matricule attribué : ${matriculeGenere}\n` +
            `🔐 Clé d'accès générée : ${passwordCalcule}\n` +
            `📧 Alertes parents associées à : ${mailParentClean}`
        });

        // ===================================================
        // RÉINITIALISATION
        // ===================================================
        setFormData({
          nom: '',
          prenom: '',
          genre: '',
          dateNaissance: '',
          ecoleProvenance: '',
          numSecuriteSociale: '',
          niveauPromotion: '',
          classeId: '',
          anneeArrivee:
            new Date()
              .getFullYear()
              .toString(),
          anneeScolaire: '',
          dispensePhysique:
            'Non',
          email: '',
          telephone: '',
          emailParent: ''
        });

        if (photoPreview) {
          URL.revokeObjectURL(
            photoPreview
          );
        }

        setPhotoPreview(null);
        setPhotoFile(null);
      } else {
        setMessage({
          type: 'error',
          text:
            response.msg ||
            "Échec de l'inscription."
        });
      }
    } catch (error) {
      console.error(
        "Erreur complète d'inscription :",
        error
      );

      setMessage({
        type: 'error',
        text:
          "Une erreur réseau est survenue lors de l'inscription : " +
          (error?.message || '')
      });
    } finally {
      setLoading(false);
    }
  };

    // =========================================================
  // MODIFICATION DES CHAMPS COMPORTEMENTAL EN TEMPS RÉEL
  // =========================================================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: value
      };

      // 👑 SÉCURITÉ DE RÉPLICATION ACADÉMIQUE FIRESTORE
      // Garantit que si l'input HTML utilise name="prenom", 
      // la clé "prenoms" attendue par votre base NoSQL est aussi remplie
      if (name === 'prenom') {
        updated.prenoms = value;
      }
      if (name === 'prenoms') {
        updated.prenom = value;
      }

      return updated;
    });
  };

  // =========================================================
  // PHOTO
  // =========================================================
  const handlePhotoChange = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      setMessage({
        type: 'error',
        text:
          'Veuillez sélectionner une image valide.'
      });

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setMessage({
        type: 'error',
        text:
          'La photo ne doit pas dépasser 5 Mo avant compression.'
      });

      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(
        photoPreview
      );
    }

    setPhotoFile(file);

    setPhotoPreview(
      URL.createObjectURL(file)
    );

    setMessage({
      type: '',
      text: ''
    });
  };

  // =========================================================
  // CHANGEMENT DE PROMOTION
  // =========================================================
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      classeId: ''
    }));
  }, [formData.niveauPromotion]);

  // =========================================================
  // AFFICHAGE
  // =========================================================
  return (
    <div className=" bg-white  rounded-xl shadow-md my-6 font-sans relative animate-fadeIn">
      {/* =====================================================
          EN-TÊTE
      ====================================================== */}
      <div className="flex justify-between items-start border-b pb-4 mb-6 text-[11px] font-black uppercase text-gray-500 tracking-tight leading-relaxed">
         <Header/>
        <div className="separateur"><div className="traite"></div></div>
         <h2 className="tireclassee text-lg font-black text-gray-900 uppercase">
        Recrutement & Gestion des Équipes RH
      </h2>
       <h2 className="recrute text-lg font-black text-gray-900 uppercase">
            Inscription  et Génération de la fiche d'identification de l'éléve
            </h2>
        <div className=" text-lg font-black text-gray-900 uppercase">
          <h2 className='tireeleve'>
            I _ FICHE D'IDENTIFICATION & BADGE ACCÈS SÉCURISÉ
          </h2>
        </div>
      </div>
      {/* =====================================================
          MESSAGE
      ====================================================== */}
      {message.text && (
        <div
          className={`messageeleve p-4 mb-6 rounded-lg text-sm font-semibold whitespace-pre-line border ${
            message.type ===
            'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          veillez transmettre a l'eleve (Fiche d'inscription: MATRICULE & PASSWORD  ) pour avoir accès a son espace personnel  <br/>{message.text}
        </div>
      )}
      {/* =====================================================
          FORMULAIRE
      ====================================================== */}
      <form
        onSubmit={handleSubmit}
        className="space-y-8"
      >

        {/* ===================================================
            1. INFORMATIONS PERSONNELLES
        ==================================================== */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">

            {/* PHOTO */}
          <div
                style={{
                  width: '300px',
                  height: '100px',
                  minWidth: '50px',
                  minHeight: '50px'
                }}
                className="photoprofil border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center overflow-hidden relative bg-gray-50 mt-2 transition hover:border-purple-300 shrink-0"
              >

                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Aperçu"
                    style={{
                      width: '50px',
                      height: '50px'
                    }}
                    className="object-cover block shrink-0"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full w-full text-center text-gray-400">
                    <span className="text-sm block">
                      📸
                    </span>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />

              </div>

            {/* ÉTAT CIVIL */}
            <div className="etatcivil grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-3">

              <div className='nomfamille form-floating mb-3'>
                <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                  Nom de famille *
                </label>

                <input
                  type="text"
                  id="floatingInput"
                  name="nom"
                  value={
                    formData.nom ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ex: KOFFI"
                  className="form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 uppercase font-bold outline-none"
                  required
                />
              </div>

             <div className='touslesprenom form-floating mb-3'>
                <label htmlFor="floatingInput" className=" block text-gray-700 text-xs font-bold uppercase mb-1">
                  Tous les Prénoms *
                </label>

                <input
                  type="text"
                  id="floatingInput"
                  name="prenom"
                  value={
                    formData.prenom ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ex: Yao Ama"
                  className="form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 font-medium outline-none"
                  required
                />
              </div>

              {/* GENRE */}
              <div className='genresexe form-floating mb-3'>
                <label className="block text-gray-700 text-xs font-bold uppercase mb-1">
                  Genre / Sexe *
                </label>

                <select
                  name="genre"
                  value={
                    formData.genre ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  className="form-select w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none"
                  required
                >
                  <option selected value="">
                    -- Choisir le genre --
                  </option>

                  <option value="Masculin">
                    ♂️ Masculin
                  </option>

                  <option value="Féminin">
                    ♀️ Féminin
                  </option>
                </select>
              </div>

              {/* DATE NAISSANCE */}
              <div className='datenaissance form-floating mb-3'>
                <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                  Date de Naissance *
                </label>

                <input
                  type="date"
                  id="floatingInput"
                  name="dateNaissance"
                  value={
                    formData.dateNaissance ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  className="form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>

              {/* EMAIL ELEVE */}
              <div className='maileleve form-floating mb-3'>
                <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                  E-mail de l'Élève*
                </label>

                <input
                  type="email"
                  id="floatingInput"
                  name="email"
                  value={
                    formData.email ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="eleve@gmail.com"
                  className="form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                />
              </div>

              {/* TELEPHONE */}
             <div className='tuteur form-floating mb-3'>
                <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                  Numéro Parent / Tuteur *
                </label>

                <input
                  type="tel"
                  id="floatingInput"
                  name="telephone"
                  value={
                    formData.telephone ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ex: 0708091011"
                  className="form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                  required
                />
              </div>

              {/* EMAIL PARENT */}
              <div className="vitale form-floating mb-3 md:col-span-2 bg-purple-50/50 p-3 rounded-lg border border-purple-100">

                <label htmlFor="floatingInput" className="block text-purple-800 text-xs font-bold uppercase mb-1">
                  Adresse E-mail Parental *
                </label>

                <input
                  type="email"
                  id="floatingInput"
                  name="emailParent"
                  value={
                    formData.emailParent ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="parent-tuteur@gmail.com"
                  className="form-control w-full px-3 py-2.5 border bg-white text-sm rounded-md focus:ring-2 focus:ring-purple-500 outline-none font-mono font-bold text-slate-900"
                  required
                />

                <p className="text-[10px] text-purple-500 mt-1 font-medium leading-tight">
                  🚨 Vitale : cette adresse pourra
                  recevoir les bulletins PDF officiels et alertes  automatiques.
                </p>
              </div>
            </div>
          </div>

          {/* PROVENANCE / CMU */}
          <div className="partiprovenance grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

           <div className='formecorect1 form-floating mb-3'>
              <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                École de provenance*
              </label>

              <input
                type="text"
                id="floatingInput"
                name="ecoleProvenance"
                value={
                  formData.ecoleProvenance ||
                  ''
                   
                }
                onChange={
                  handleChange
                }
                 required
                placeholder="Ex: Collège Moderne de Bouaké"
                className="form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

           <div className='formecorect2 form-floating mb-3'>
              <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Numéro d'Immatriculation CMU*
              </label>

              <input
                type="text"
                id="floatingInput"
                name="numSecuriteSociale"
                value={
                  formData.numSecuriteSociale ||
                  ''
                }
                 required
                onChange={
                  handleChange
                }
                placeholder="Ex: CMU-0012345-A"
                className="form-control w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* ===================================================
            2. INFORMATIONS ACADÉMIQUES
        ==================================================== */}
        <div className="border-t pt-6">

          <h3 className="informa text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 border-b pb-1">
            II _ AFFECTATION PEDAGOGIQUE (Promotions Unifiées)
          </h3>

          <div className="etatcivilprovenance grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* PROMOTION */}
            <div className='nivaeupromo form-floating mb-3'>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Niveau de la Promotion *
              </label>

              <select
                name="niveauPromotion"
                aria-label="Default select example"
                value={
                  formData.niveauPromotion ||
                  ''
                }
                onChange={
                  handleChange
                }
                className="form-select w-full px-3 py-2.5 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none"
                required
              >
                <option selected value="">
                  -- Sélectionner la promotion --
                </option>

                <optgroup label="Premier Cycle">
                  <option value="6eme">
                    6ème
                  </option>

                  <option value="5eme">
                    5ème
                  </option>

                  <option value="4eme">
                    4ème
                  </option>

                  <option value="3eme">
                    3ème
                  </option>
                </optgroup>

                <optgroup label="Second Cycle">
                  <option value="2nd">
                    2nd
                  </option>

                  <option value="1ere">
                    1ère
                  </option>

                  <option value="terminal">
                    Terminale
                  </option>
                </optgroup>
              </select>
            </div>

            {/* CLASSE */}
           <div className='divisionpedagogique form-floating mb-3'>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">
                Division Pédagogique de la Classe *
              </label>

              {loadingClasses ? (
                <p className="p-2 border text-xs text-gray-400 animate-pulse font-bold bg-gray-50 rounded-md">
                  ⏳ Chargement des structures...
                </p>
              ) : classesFiltrees.length ===
                0 ? (
                <p className="form-select p-2.5 border text-xs text-red-600 bg-red-50 font-bold rounded-md">
                  ⚠️ Aucune classe créée en base
                  pour ce niveau.
                </p>
              ) : (
                <select 
                  name="classeId"
                  value={
                    formData.classeId ||
                    ''
                  }
                  onChange={
                    handleChange
                  }
                  className="form-select w-full px-3 py-2.5 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-bold outline-none"
                  required
                >
                  <option selected value="">
                    -- Assigner la classe --
                  </option>

                  {classesFiltrees.map(
                    (cl) => (
                      <option
                        key={cl.id}
                        value={cl.id}
                      >
                        🏛️{' '}
                        {cl.nom ||
                          (
                            cl.idBrute ||
                            ''
                          ).toUpperCase()}
                      </option>
                    )
                  )}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================
            3. DISPENSES
        ==================================================== */}
        <div className="etatcivilprovenance border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">

         <div className='aptitude form-floating mb-3'>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">
              Aptitude Physique (EPS)
            </label>

            <select
              name="dispensePhysique"
              value={
                formData.dispensePhysique
              }
              onChange={
                handleChange
              }
              className="form-select w-full px-3 py-2 border text-sm rounded-md focus:ring-2 focus:ring-orange-500 bg-white font-medium outline-none"
            >
              <option selected value="Non">
                ✅ Apte (Pratique Régulière)
              </option>

              <option value="Oui">
                🏥 Inapte (Billet de Dispense Médicale)
              </option>
            </select>
          </div>

          {/* BLOC RÉACTIF ET MODIFIABLE EN TEMPS RÉEL : ANNÉE D'AFFECTATION */}
          <div className='affect form-floating mb-3'>
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

          <div className='affectannee form-floating mb-3'>
            <label htmlFor="anneeScolaireInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">
              Année scolaire
            </label>

            <input
              type="text"
              id="anneeScolaireInput"
              name="anneeScolaire"
              value={formData.anneeScolaire || ''}
              onChange={handleChange}
              placeholder="Ex: 2026-2027"
              className="form-control w-full px-3 py-2 border text-sm rounded-md bg-gray-50 outline-none font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>
        </div>


        {/* ===================================================
            BOUTON
        ==================================================== */}
        <div className="pt-4">

          <button
            type="submit"
            disabled={
              loading ||
              classesFiltrees.length ===
                0 ||
              !currentSchool
            }
            className="btn-sea w-full bg-orange-500 hover:bg-orange-600 font-black py-3 rounded-xl uppercase tracking-wider text-xs shadow-md transition disabled:bg-gray-300"
          >
            {loading ? (
              <div className=" h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              " Valider et Immatriculer l'Élève"
            )}
          </button>
        </div>
      </form>

      {/* =====================================================
          RETOUR
      ====================================================== */}
      <Link
        to="/admin/home"
        className="btnsubeleve hover:bg-gray-200 text-gray-700 px-2 py-2 rounded-lg font-bold text-xs transition shadow-xs"
      >
        ← Retour
      </Link>
    </div>
  );
};

export default AjouterEleve;