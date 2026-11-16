// src/features/admin/pages/SecretariatAdmin.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, onSnapshot, doc, setDoc, getDocs, updateDoc, addDoc, where, limit } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom'; 
import Header from '../../../pages/Header';

const SecretariatAdmin = () => {
  const { schoolId, schoolName } = useAuth();
  
  const schoolIdRaw = schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard';
  const currentSchool = schoolIdRaw.trim();

  // --- ÉTATS DES DONNÉES EN TEMPS RÉEL ---
  const [listeProfesseurs, setListeProfesseurs] = useState([]);
  const [listeEducateurs, setListeEducateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [sendingAlert, setSendingAlert] = useState(false);

  // --- ÉTATS DU FORMULAIRE D'OUVERTURE DE CLASSE ---
  const [formPromotion, setFormPromotion] = useState('6eme');
  const [formExtension, setFormExtension] = useState('1');
  const [selectedEducateurId, setSelectedEducateurId] = useState('');
  const [selectedProfPrincipalId, setSelectedProfPrincipalId] = useState('');
  const [formDelegue, setFormDelegue] = useState('');

  // --- ÉTATS DU FORMULAIRE D'ALERTES DOCUMENTS ---
  const [docMatricule, setFormMatricule] = useState('');
  const [docType, setDocType] = useState('Bulletin Trimestriel');
  const [docCommentaire, setDocCommentaire] = useState('');
  
  // 🟢 ÉTATS STOCKAGE BINAIRE POUR LA PIÈCE JOINTE
  const [fichierJointBinaire, setFichierJointBinaire] = useState(null);
  const [nomFichierJoint, setNomFichierJoint] = useState('');

  // 🔄 ÉCOUTEUR RÉACTIF OPTIMISÉ POUR LE PERSONNEL
  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    const qStaff = query(collection(db, "users"), where("schoolId", "==", currentSchool));

    const unsubscribe = onSnapshot(qStaff, (snapshot) => {
      let profs = [];
      let educs = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const roleClean = data.role ? data.role.trim().toLowerCase() : '';
        const item = { id: docSnap.id, ...data };

        if (roleClean === 'professeur' || roleClean === 'prof_principal') {
          profs.push(item);
        } else if (roleClean === 'educateur') {
          educs.push(item);
        }
      });

      setListeProfesseurs(profs);
      setListeEducateurs(educs);

      if (profs.length > 0 && !selectedProfPrincipalId) setSelectedProfPrincipalId(profs[0].id);
      if (educs.length > 0 && !selectedEducateurId) setSelectedEducateurId(educs[0].id);
      
      setLoading(false);
    }, (err) => {
      console.error("Erreur antenne live secrétariat :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool, selectedProfPrincipalId, selectedEducateurId]);

  // 📥 SOUMISSION A : CRÉATION DE CLASSE PHYSIQUE
  const handleCreateClassePhysique = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formExtension.trim()) {
      setMessage({ type: 'error', text: "⚠️ Veuillez renseigner l'extension (Ex: 1, 2, A)." });
      return;
    }

    try {
      const extensionClean = formExtension.trim().toLowerCase().replace(/\s+/g, '_');
      const idBruteCalculee = `${formPromotion}_${extensionClean}`;
      const documentClasseId = `${currentSchool.toLowerCase()}_${idBruteCalculee}`;

      const profData = listeProfesseurs.find(p => p.id === selectedProfPrincipalId);
      const educData = listeEducateurs.find(e => e.id === selectedEducateurId);

      const nomAffichagePropre = idBruteCalculee.toUpperCase().replace(/_/g, ' ');

      await setDoc(doc(db, "classes", documentClasseId), {
        id: documentClasseId,
        idBrute: idBruteCalculee,
        nom: nomAffichagePropre,
        promotion: formPromotion.includes('_') ? formPromotion.split('_')[0] : formPromotion,
        serie: formPromotion.includes('_') ? formPromotion.split('_')[1] : 'generale',
        schoolId: currentSchool,
        delegueName: formDelegue.trim() || 'Non désigné',
        profPrincipalId: selectedProfPrincipalId || 'Aucun',
        profPrincipalName: profData ? `M. ${profData.nom || profData.name}` : 'Non assigné',
        educateurId: selectedEducateurId || 'Aucun',
        educateurName: educData ? `M. ${educData.nom || educData.name}` : 'Non assigné',
        createdAt: new Date().toISOString()
      });

      if (selectedProfPrincipalId && selectedProfPrincipalId !== 'Aucun') {
        await updateDoc(doc(db, "users", selectedProfPrincipalId), {
          role: 'prof_principal',
          classeId: idBruteCalculee
        });
      }

      if (selectedEducateurId && selectedEducateurId !== 'Aucun') {
        const promoRacine = formPromotion.includes('_') ? formPromotion.split('_')[0] : formPromotion;
        await updateDoc(doc(db, "users", selectedEducateurId), {
          assigned_promotion: promoRacine
        });
      }

      setMessage({ type: 'success', text: `🏛️ Structure ${nomAffichagePropre} déployée avec succès !` });
      setFormExtension('');
      setFormDelegue('');
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: '💥 Échec de déploiement cloud.' });
    }
  };

  // 🟢 CAPTURE ET CONVERSION DU FICHIER EN STR BASE64 COMPATIBLE SMTP
  const handleChangementFichierBulletin = (e) => {
    const fichierSelectionne = e.target.files[0];
    if (!fichierSelectionne) return;

    setNomFichierJoint(fichierSelectionne.name);

    const lecteur = new FileReader();
    lecteur.onloadend = () => {
      // Stocke le contenu binaire pur converti en Base64
      setFichierJointBinaire(lecteur.result);
    };
    lecteur.readAsDataURL(fichierSelectionne);
  };

  // 🚀 SOUMISSION B : EXPÉDITION D'ALERTE ET INJECTION RÉELLE DE LA PIÈCE JOINTE DANS LE MAIL
  const handleSendDocumentAlert = async (e) => {
    e.preventDefault();
    if (sendingAlert) return;
    
    setMessage({ type: '', text: '' });
    setSendingAlert(true);

    const matriculeNettoye = docMatricule.trim().toUpperCase();

    try {
      const qCheck = query(
        collection(db, "users"), 
        where("schoolId", "==", currentSchool),
        where("role", "==", "eleve"), 
        where("matricule", "==", matriculeNettoye),
        limit(1)
      );
      
      const querySnapshot = await getDocs(qCheck);

      if (querySnapshot.empty) {
        setMessage({ type: 'error', text: `❌ Le matricule (${matriculeNettoye}) n'existe pas dans le système.` });
        setSendingAlert(false);
        return;
      }

      const premierDocSnap = querySnapshot.docs[0];
      const eleveData = premierDocSnap.data();

      if (!eleveData.emailParent) {
        setMessage({ type: 'error', text: `🛑 Annulation : Aucun e-mail parental associé au dossier de ${eleveData.nom || 'cet élève'}.` });
        setSendingAlert(false);
        return;
      }

      const emailParentCible = eleveData.emailParent.trim();
      const nomCompletEleve = `${String(eleveData.nom || '').toUpperCase()} ${eleveData.prenoms || eleveData.prenom || ''}`.trim();
      const classeEffectiveEleve = eleveData.classeNom || eleveData.classe || "Non assignée";
      const matriculeOfficiel = eleveData.matricule || premierDocSnap.id;
      
      const noteAdditionnelle = docCommentaire.trim() || "Une pièce officielle a été émise et mise à votre disposition par le Secrétariat Général.";

      // 1. Sauvegarde de la notification Firestore
      await addDoc(collection(db, "notifications"), {
        schoolId: currentSchool,
        type: "ALERTE_ADMINISTRATIVE",
        titre: `🚨 Alerte Document : ${docType}`,
        message: `Notification concernant l'élève ${nomCompletEleve}. Document : ${docType}.`,
        destinataireId: premierDocSnap.id,
        createdAt: new Date().toISOString()
      });

      // Détermination si une pièce jointe doit être injectée
      const aUnFichierActif = docType === 'Bulletin Trimestriel' && fichierJointBinaire !== null;

     // 2. 📧 ENVOI RÉSEAU AVEC INJECTION DU FICHIER EN PIÈCE JOINTE NODEMAILER
      await fetch("http://localhost:10000/api/send-notification-email", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [emailParentCible],
          schoolName: schoolName || currentSchool.toUpperCase(),
          schoolId: currentSchool,
          title: `⚠️ ALERTE SECRETARIAT \n\n${docType.toUpperCase()}`,
          
          message: `Bonjour chers Parents,\n\nMessage officiel du secrétariat Scolaire:\n\n📌 NATURE DU DOCUMENT : ${docType}\nELEVE : ${nomCompletEleve}\n\nCLASSE : ${classeEffectiveEleve}\n\nMATRICULE : ${matriculeOfficiel}\n\n💬 OBSERVATION DE LA DIRECTION :\n\n${noteAdditionnelle}.\n\nVotre Espace Parent Edulink_Le lien scolaire.\n\nCordialement,\n\nLe Secrétariat Général.`,
          
          /* footer: `Votre Espace Parent Edulink_Le lien scolaire.\n\nCordialement,\n\nLe Secrétariat Général.`,
          senderName: "SECRETARIAT GENERAL", */
          type: "alerte", 
          typeMessage: "alerte",
          appUrl: window.location.origin,
          
          // 🔗 TRANSMISSION DES COMPOSANTS FLUIDES DU FICHIER À NODEMAILER
          hasAttachment: aUnFichierActif,
          fileName: aUnFichierActif ? nomFichierJoint : '',
          fileData: aUnFichierActif ? fichierJointBinaire : null,
          attachmentData: aUnFichierActif ? fichierJointBinaire : null
        })
      });
      setMessage({ type: 'success', text: `🎯 Alerte pour "${docType}" envoyée avec succès au parent de l'élève ${nomCompletEleve} !` });
      setFormMatricule('');
      setDocCommentaire('');
      setFichierJointBinaire(null);
      setNomFichierJoint('');
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error("Erreur distribution alerte :", err);
      setMessage({ type: 'error', text: '❌ Erreur réseau lors de la distribution.' });
    } finally {
      setSendingAlert(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center font-sans bg-white p-8 shadow rounded-xl max-w-7xl mx-auto mt-12 text-left">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-bold animate-pulse">Ouverture des liaisons temps réel...</p>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen p- sm:p-6 lg:p-8 font-sans text-gray-700 text-left">
       <h2 className="tirecl text-lg font-black text-gray-900 uppercase">
        Recrutement & Gestion des Équipes RH
      </h2>
      {/* POP-UP TOAST FLOTTANT */}
      {message.text && (
        <div className={` fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl  flex items-center justify-between gap-4 max-w-sm w-full animate-fadeIn text-xs font-bold bg-slate-900 ${ 
          message.type === 'success' ? ' text-emerald-400' : ' text-red-400' 
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">{message.type === 'success' ? '🎯' : '🛑'}</span>
            <p className="leading-relaxed whitespace-pre-line text-left">{message.text}</p>
          </div>
          <button type="button" onClick={() => setMessage({ type: '', text: '' })} className="text-slate-500 hover: transition text-sm cursor-pointer bg-transparent border-0">✕</button>
        </div>
      )}

      {/* EN-TÊTE ACCUEIL */}
      <div className="bg-white  p-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-3xs">
        <div>
          <h1 className="tirecl-text text-xl md:text-2xl font-black text-slate-900 uppercase">Secrétariat Général</h1>
          <p className="tirecl-text2 text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">
            Pilotage Académique Live — <span className="text-orange-500 font-black">{schoolName || currentSchool.toUpperCase()}</span>
          </p>
        </div>
      </div>

      {/* PANNEAU CENTRAL DE NAVIGATION MAÎTRE */}
      <div className="bg-white text-purple-100 p-6 rounded-2xl shadow-sm  flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="space-y-1">
          <span className="bg-purple-800 text-orange-400 text-[10px] font-black uppercase px-2 py-0.5 "></span>
          <h3 className="text-base font-black uppercase"></h3>
          <p className="tirecl-text3 text-xs text-purple-200 leading-relaxed font-medium">Basculez entre les registres pour auditer les dossiers scolaires de tout l'établissement.</p>
        </div>
        <div className="menutext flex flex-wrap gap-2 w-full md:w-auto">
          <Link to="/admin/base-centralise" className="px-3 py-2 text-[10px] font-black uppercase  bg-white rounded-xl hover:bg-purple-700 transition no-underline border text-center">Gestion centralisée de l'établissement</Link>
          <Link to="/admin/modifier-un-statut" className="px-3 py-2 text-[10px] font-black uppercase  bg-purple-800 rounded-xl hover:bg-purple-700 transition no-underline border text-center">Mise à jour de Statut</Link>
          <Link to="/admin/message-reçu" className="px-3 py-2 text-[10px] font-black uppercase  bg-purple-800 rounded-xl hover:bg-purple-700 transition no-underline border text-center">Boite de Réception</Link>
          <Link to="/admin/gestion-des-profil" className="px-3 py-2 text-[10px] font-black uppercase  bg-purple-800 rounded-xl hover:bg-purple-700 transition no-underline border text-center">Fiches &modification de  Profils</Link>
          <Link to="/admin/gestion-des-statut" className="px-3 py-2 text-[10px] font-black uppercase  bg-purple-800 rounded-xl hover:bg-purple-700 transition no-underline border text-center">Bulletins & Impressions</Link>
          <Link to="/admin/Rechercher-un-eleve" className="px-3 py-2 text-[10px] font-black uppercase  bg-purple-800 rounded-xl hover:bg-purple-700 transition no-underline border text-center">Rechercher un Élève</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* COMPARTIMENT 2 : EXPÉDITION DE DOCUMENTS OUTIL RAPIDE SANS LATENCE */}
        <div className="bg-white p-5 ">
          <h3 className="expe text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">Expédition et Alertes de Documents Personnels</h3>
          
            <form onSubmit={handleSendDocumentAlert} className="space-y-4 text-xs font-bold text-gray-700">
           <div className='nomfami form-floating mb-3'>
              <label htmlFor="floatingInput" className="block text-gray-700 text-xs font-bold uppercase mb-1">Matricule MENA Cible de l'Élève *</label>
              <input 
                type="text"
                id="floatingInput"
                name="nom" 
                placeholder="Ex: 26_6615G" 
                value={docMatricule} 
                onChange={(e) => setFormMatricule(e.target.value)} 
                className="form-control w-full bg-gray-50 border rounded-lg p-2.5 font-mono tracking-wide outline-none uppercase focus:ring-2 focus:ring-orange-500" 
                required 
              />
            </div>

            <div className='genres form-floating mb-3'>
              <label className="block text-gray-400 uppercase mb-1">Nature de la pièce déposée</label>
              <select 
              name="genre"
                value={docType} 
                onChange={(e) => setDocType(e.target.value)} 
                 required
                className="form-select w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer"
              >
                <option selected value="Bulletin Trimestriel">📊 Bulletin Civil Trimestriel (Relevé Officiel)</option>
                <option value="Billet de Convocation">⚠️ Billet de Convocation Parent d'Élève</option>
                <option value="Avis d'Exclusion Provisoire">🛑 Avis de Sanction Pédagogique / Exclusion</option>
              </select>
            </div>

            {/* 🟢 BLOC INTERACTIF AUTOMATIQUE : Intégration conditionnelle de l'uploader */}
            {docType === 'Bulletin Trimestriel' && (
              <div className="fichier p-3 bg-orange-50/50 border border-dashed border-orange-200 rounded-xl space-y-1.5 animate-fadeIn">
                <label className="block text-orange-800 uppercase text-[10px] font-black">📁 Téléverser le Fichier Bulletin Joint (.PDF, .PNG) *</label>
                <input 
                  type="file" 
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleChangementFichierBulletin}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-[11px] font-bold text-gray-500 cursor-pointer"
                  required
                />
                {nomFichierJoint && <p className="text-[9px] text-emerald-600 font-bold">✔️ Document chargé : {nomFichierJoint}</p>}
              </div>
            )}

           <div className='divisionpedamsg form-floating mb-3'>
              <label htmlFor='exampleFormControlTextarea1' className="textar form-label block text-gray-700 text-xs font-bold uppercase mb-1">Note explicative / Commentaire de la direction (Optionnel)</label>
              <textarea 
                rows="3"
            type="text"
            placeholder="Tapez votre message complet ici..."
            id="exampleFormControlTextarea1"
                placeholder="Ex: Le bulletin est disponible..." 
                value={docCommentaire} 
                onChange={(e) => setDocCommentaire(e.target.value)} 
                className="form-control textaremsg w-full bg-gray-50 border rounded-lg p-2.5 outline-none font-medium text-gray-600"
              />
            </div>

            <button 
              type="submit" 
              disabled={sendingAlert}
               className="btnmsg-1  w-full bg-orange-500 hover:bg-orange-600 font-black py-3 rounded-xl uppercase tracking-wider transition cursor-pointer border-0 disabled:bg-slate-800 disabled:cursor-not-allowed"
            >
              {sendingAlert ? "⚡ Routage Réseau en Cours..." : "🚀 Émettre l'Alerte Courriel Instantanée"}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};

export default SecretariatAdmin;
