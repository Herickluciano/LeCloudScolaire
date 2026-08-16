import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, onSnapshot, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import ListeDesClasse from './listeDesClasse';
import EnvoieAdmin from './messages/EnvoieAdmin';
import EmploiDuTempsClasse from './EmploiDuTempsClasse';
import ReceptionAdmin from './messages/ReceptionAdmin';
import { Link } from 'react-router-dom'; 
import ModifierStatut from './ModifierStatut';
import RechercheEleveAdmin from './RechercheEleveAdmin';
const SecretariatAdmin = () => {
  const { schoolId, schoolName } = useAuth();
  
  // 🟢 CORRECTIF CASSE : On garde la version brute et on gère la tolérance dans le snapshot
  const schoolIdRaw = schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa';
  const currentSchool = schoolIdRaw.trim();

  // --- ÉTATS DES DONNÉES EN TEMPS RÉEL ---
  const [listeProfesseurs, setListeProfesseurs] = useState([]);
  const [listeEducateurs, setListeEducateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [modeSecours, setModeSecours] = useState(false);

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

  // 🔄 ÉCOUTEUR RÉACTIF ET INSENSIBLE À LA CASSE (onSnapshot Infaillible)
  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    // On écoute globalement les utilisateurs de l'école
    const qStaff = query(collection(db, "users"));

    const unsubscribe = onSnapshot(qStaff, (snapshot) => {
      let profs = [];
      let educs = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const uSchoolClean = data.schoolId ? data.schoolId.trim().toLowerCase() : '';
        const targetSchoolClean = currentSchool.toLowerCase();
        const roleClean = data.role ? data.role.trim().toLowerCase() : '';
        const item = { id: docSnap.id, ...data };

        // 🎯 COMPARATEUR TOLÉRANT : Valide l'entrée si les chaînes converties en minuscules matchent
        if (uSchoolClean === targetSchoolClean) {
          if (roleClean === 'professeur' || roleClean === 'prof_principal') {
            profs.push(item);
          } else if (roleClean === 'educateur') {
            educs.push(item);
          }
        }
      });

      setListeProfesseurs(profs);
      setListeEducateurs(educs);
      setModeSecours(false);

      // Pré-sélection sécurisée des premiers ID de la liste pour éviter les selects vides
      if (profs.length > 0 && !selectedProfPrincipalId) setSelectedProfPrincipalId(profs[0].id);
      if (educs.length > 0 && !selectedEducateurId) setSelectedEducateurId(educs[0].id);
      
      setLoading(false);
    }, (err) => {
      console.error("Erreur antenne live secrétariat :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool, selectedProfPrincipalId, selectedEducateurId]);

  // 📥 SOUMISSION A : CRÉATION DE CLASSE PHYSIQUE AVEC PROMOTION D'ÉDUCATEUR
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

      // 1. Écriture de la classe physique
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

      // 2. Promotion automatique de l'enseignant affecté en Prof Principal
      if (selectedProfPrincipalId && selectedProfPrincipalId !== 'Aucun') {
        await updateDoc(doc(db, "users", selectedProfPrincipalId), {
          role: 'prof_principal',
          classeId: idBruteCalculee
        });
      }

      // 3. Liaison de la promotion de l'éducateur sur sa fiche personnel (Ex: assigned_promotion = "5eme")
      if (selectedEducateurId && selectedEducateurId !== 'Aucun') {
        const promoRacine = formPromotion.includes('_') ? formPromotion.split('_')[0] : formPromotion;
        await updateDoc(doc(db, "users", selectedEducateurId), {
          assigned_promotion: promoRacine
        });
      }

      setMessage({ type: 'success', text: `🏛️ Structure ${nomAffichagePropre} déployée avec succès. Équipe pédagogique liée !` });
      setFormExtension('');
      setFormDelegue('');
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: '💥 Échec de déploiement cloud.' });
    }
  };

  // 🚀 SOUMISSION B : EXPÉDITION ALERTES DOCUMENTS
  const handleSendDocumentAlert = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const matriculeNettoye = docMatricule.trim().toUpperCase();

    try {
      const qCheck = query(collection(db, "users"), where("role", "==", "eleve"), where("matricule", "==", matriculeNettoye));
      const querySnapshot = await getDocs(qCheck);

      if (querySnapshot.empty) {
        setMessage({ type: 'error', text: `❌ Le matricule (${matriculeNettoye}) n'existe pas dans le système.` });
        return;
      }

      const eleveData = querySnapshot.docs[0].data();

      if (!eleveData.emailParent) {
        setMessage({ type: 'error', text: `🛑 Annulation : Aucun e-mail parental associé au dossier de ${eleveData.nom}.` });
        return;
      }

      await fetch("http://localhost:10000/api/send-document-alert", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: eleveData.emailParent.trim(),
          to_name: `${eleveData.prenoms || ''} ${eleveData.nom || ''}`.toUpperCase(),
          school_name: schoolName || currentSchool.toUpperCase(),
          type_document: docType,
          sender_title: "Le Secrétariat Général"
        })
      });

      setMessage({ type: 'success', text: `🎯 Alerte pour "${docType}" notifiée en direct au parent !` });
      setFormMatricule('');
      setDocCommentaire('');
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: '❌ Erreur réseau lors de la distribution.' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center font-sans bg-white p-8 shadow rounded-xl max-w-7xl mx-auto mt-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-bold animate-pulse">Ouverture des liaisons temps réel...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen relative">
      
      {/* POP-UP TOAST FLOTTANT */}
      {message.text && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border-l-4 flex items-center justify-between gap-4 max-w-sm w-full animate-fadeIn text-xs font-bold bg-slate-900 ${
          message.type === 'success' ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">{message.type === 'success' ? '🎯' : '🛑'}</span>
            <p className="leading-relaxed whitespace-pre-line text-left">{message.text}</p>
          </div>
          <button type="button" onClick={() => setMessage({ type: '', text: '' })} className="text-slate-500 hover:text-white transition text-sm cursor-pointer">✕</button>
        </div>
      )}

      {/* EN-TÊTE ACCUEIL */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black">🏛️ Secrétariat Général {schoolName || "Établissement Scolaire Partenaire"}</h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">
            Pilotage Académique Live — <span className="text-orange-400 font-black">{schoolName || currentSchool.toUpperCase()}</span>
          </p>
        </div>
      </div>
        {/* 🟢 CARTE 0 AJOUTÉE : REDIRECTION VERS LE DASHBOARD DE PILOTAGE GLOBAL */}
        <div className="bg-purple-900 text-purple-100 p-6 rounded-2xl shadow-md border border-purple-950 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-purple-950 text-orange-400 rounded-xl flex items-center justify-center text-lg font-bold">📈</div>
           
            <p className="text-xs text-purple-200 mt-1 leading-relaxed font-medium">
              Base de donnee centralisée de toute l'etablisement.
            </p>
          </div>
          <Link 
            to="/admin/base-centralise" 
            className="w-full text-center bg-orange-500 hover:bg-orange-600 font-black text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-md transition mt-6 block cursor-pointer"
          >
            📈 Liste de tout l'effectifs 
          </Link>
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
       <RechercheEleveAdmin/>
        {/* COMPARTIMENT 2 : EXPÉDITION DE DOCUMENTS */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm h-fit">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">🚨 Expédition et Alertes de Documents Personnels</h3>
          
          <form onSubmit={handleSendDocumentAlert} className="space-y-4 text-xs font-bold text-gray-700">
            <div>
              <label className="block text-gray-400 uppercase mb-1">Matricule MENA Cible de l'Élève *</label>
              <input type="text" placeholder="Ex: 26_8631W" value={docMatricule} onChange={(e) => setFormMatricule(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 font-mono tracking-wide outline-none uppercase focus:ring-2 focus:ring-orange-500" required />
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">Nature de la pièce déposée</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer">
                <option value="Bulletin Trimestriel">📊 Bulletin Civil Trimestriel (Relevé Officiel)</option>
                <option value="Billet de Convocation">⚠️ Billet de Convocation Parent d'Élève</option>
                <option value="Avis d'Exclusion Provisoire">🛑 Avis de Sanction Pédagogique / Exclusion</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">Note explicative / Commentaire de la direction (Optionnel)</label>
              <textarea rows="3" placeholder="Ex: Le bulletin est disponible..." value={docCommentaire} onChange={(e) => setDocCommentaire(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none font-medium text-gray-600"></textarea>
            </div>

            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-2.5 rounded-xl uppercase tracking-wider transition shadow-xs cursor-pointer">
              🚀 Émettre l'Alerte Courriel Instantanée
            </button>
          </form>
        </div>
        <EmploiDuTempsClasse/>
        <ListeDesClasse/>
        <EnvoieAdmin/>
         <ReceptionAdmin/>
      </div>
    </div>
  );
};

export default SecretariatAdmin;
