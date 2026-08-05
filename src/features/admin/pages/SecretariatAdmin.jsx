import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
// 🟢 RECTIFICATION : Ajout de 'updateDoc' dans l'importation Firebase
import { collection, query, where, onSnapshot, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const SecretariatAdmin = () => {
  const { schoolId, schoolName } = useAuth();
  
  // 🟢 COMPORTEMENT SAAS ULTRA-TOLÉRANT : Forçage en minuscules propre
  const schoolIdRaw = schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa';
  const currentSchool = schoolIdRaw.trim().toLowerCase();

  // --- ÉTATS DES DONNÉES EN TEMPS RÉEL ---
  const [listeProfesseurs, setListeProfesseurs] = useState([]);
  const [listeEducateurs, setListeEducateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

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

  // 🔄 1. ÉCOUTEUR EN TEMPS RÉEL CORRIGÉ (S'ÉTEINT À TOUT PRIX)
  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    const qStaff = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribe = onSnapshot(qStaff, (snapshot) => {
      const profs = [];
      const educs = [];

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

      // Pré-sélection automatique sécurisée
      if (profs.length > 0) setSelectedProfPrincipalId(profs[0].id);
      if (educs.length > 0) setSelectedEducateurId(educs[0].id);
      
      setLoading(false); // 🟢 Éteint le loader dès que Firebase répond
    }, (err) => {
      console.error("Erreur antenne admin :", err);
      setLoading(false); // 🟢 SÉCURITÉ CRASH : Éteint le loader même s'il y a un problème de réseau
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // 📥 SOUMISSION A : OUVERTURE D'UNE CLASSE
  const handleCreateClassePhysique = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formExtension.trim()) {
      setMessage({ type: 'error', text: '⚠️ Spécifiez l\'extension (Ex: 1, A).' });
      return;
    }

    try {
      const extensionClean = formExtension.trim().toLowerCase();
      const documentClasseId = `${currentSchool}_${formPromotion}_${extensionClean}`;

      const profData = listeProfesseurs.find(p => p.id === selectedProfPrincipalId);
      const educData = listeEducateurs.find(e => e.id === selectedEducateurId);

      // 1. Déploiement de la classe physique
      await setDoc(doc(db, "classes", documentClasseId), {
        id: documentClasseId,
        nom: `${formPromotion.toUpperCase()} ${extensionClean.toUpperCase()}`,
        promotion: formPromotion.toLowerCase(),
        schoolId: currentSchool,
        delegueName: formDelegue.trim() || 'Non désigné',
        profPrincipalId: selectedProfPrincipalId || 'Aucun',
        profPrincipalName: profData ? `M. ${profData.nom}` : 'Non assigné',
        educateurId: selectedEducateurId || 'Aucun',
        educateurName: educData ? `M. ${educData.nom}` : 'Non assigné',
        createdAt: new Date().toISOString()
      });

      // 🟢 AUTOMATISATION DU RÔLE : Modifie le statut de l'enseignant en Prof Principal sur le Cloud
      if (selectedProfPrincipalId && selectedProfPrincipalId !== 'Aucun') {
        const profRef = doc(db, "users", selectedProfPrincipalId);
        await updateDoc(profRef, {
          role: 'prof_principal',
          classeId: `${formPromotion}_${extensionClean}` // Ex: 6eme_1
        });
      }

      setMessage({ type: 'success', text: `🏛️ Division ${formPromotion.toUpperCase()} ${extensionClean.toUpperCase()} déployée et enseignant promu Professeur Principal !` });
      setFormExtension('');
      setFormDelegue('');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: '💥 Échec de création de la structure de classe.' });
    }
  }; // 🟢 CORRECTION DE SYNTAXE : L'accolade manquante fermant la fonction est rajoutée ici

  // 🚀 SOUMISSION B : ALERTES DOCUMENTS
  const handleSendDocumentAlert = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const matriculeNettoye = docMatricule.trim().toUpperCase();

    try {
      const qCheck = query(
        collection(db, "users"),
        where("schoolId", "==", currentSchool),
        where("role", "==", "eleve"),
        where("matricule", "==", matriculeNettoye)
      );

      const querySnapshot = await getDocs(qCheck);

      if (querySnapshot.empty) {
        setMessage({ type: 'error', text: `❌ Le matricule (${matriculeNettoye}) n'existe pas dans l'établissement.` });
        return;
      }

      const eleveData = querySnapshot.docs[0].data();

      if (eleveData.email) {
        await fetch("http://localhost:10000/api/send-document-alert", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: eleveData.email.trim(),
            to_name: `${eleveData.prenoms || ''} ${eleveData.nom || ''}`,
            school_name: schoolName || currentSchool.toUpperCase(),
            type_document: docType,
            sender_title: "Le Secrétariat Général"
          })
        });
      }

      setMessage({ type: 'success', text: `✉️ Alerte courriel transmise pour ${eleveData.nom} !` });
      setFormMatricule('');
      setDocCommentaire('');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: '❌ Erreur réseau lors de la distribution.' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center font-sans bg-white p-8 shadow rounded-xl max-w-7xl mx-auto mt-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-bold animate-pulse">Ouverture des registres du secrétariat...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen">
      
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black">🏛️ Secrétariat Général d'Établissement</h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">
            Pilotage Académique Multi-Écoles — <span className="text-orange-400 font-black">{schoolName || currentSchool.replace(/_/g, ' ').toUpperCase()}</span>
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`mb-6 p-3 text-xs font-bold rounded-lg border-l-4 animate-fadeIn ${
          message.type === 'success' ? 'bg-emerald-950 text-emerald-400 border-emerald-500' : 'bg-red-950 text-red-400 border-red-500'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COMPARTIMENT 1 : OUVERTURE DE CLASSE PHYSIQUE */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">🏛️ Ouverture d'une Classe Physique</h3>
          
          <form onSubmit={handleCreateClassePhysique} className="space-y-4 text-xs font-bold text-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 uppercase mb-1">1. Promotion / Niveau</label>
                <select value={formPromotion} onChange={(e) => setFormPromotion(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer">
                  <option value="6eme">6ème</option>
                  <option value="5eme">5ème</option>
                  <option value="4eme">4ème</option>
                  <option value="3eme">3ème</option>
                  <option value="2nde">2nde</option>
                  <option value="1ere">1ère</option>
                  <option value="tle">Terminale</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 uppercase mb-1">2. Extension / Numéro</label>
                <input type="text" placeholder="Ex: 1, 2, A, B..." value={formExtension} onChange={(e) => setFormExtension(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none" required />
              </div>
            </div>

                        <div>
              <label className="block text-gray-400 uppercase mb-1">3. Sélection Éducateur de Niveau référent</label>
              {listeEducateurs.length === 0 ? (
                <p className="p-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px]">
                  ⚠️ Aucun éducateur trouvé dans la base pour l'école "{currentSchool}".
                </p>
              ) : (
                <select value={selectedEducateurId} onChange={(e) => setSelectedEducateurId(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer">
                  {listeEducateurs.map(ed => (
                    <option key={ed.id} value={ed.id}>M. {ed.nom.toUpperCase()} {ed.prenoms || ed.prenom || ''}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">4. Sélection Professeur Principal Titulaire</label>
              {listeProfesseurs.length === 0 ? (
                <p className="p-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px]">
                  ⚠️ Aucun enseignant trouvé dans la base pour l'école "{currentSchool}".
                </p>
              ) : (
                <select value={selectedProfPrincipalId} onChange={(e) => setSelectedProfPrincipalId(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer">
                  {listeProfesseurs.map(pr => (
                    <option key={pr.id} value={pr.id}>M. {pr.nom.toUpperCase()} ({pr.matiereEnseignee || "Matière"})</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">5. Nom complet du Délégué de classe</label>
              <input type="text" placeholder="Ex: Traoré Mamadou" value={formDelegue} onChange={(e) => setFormDelegue(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none" />
            </div>

            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-2.5 rounded-xl uppercase tracking-wider transition shadow-xs cursor-pointer">
              🏛️ Valider et Déployer la Structure
            </button>
          </form>
        </div>

        {/* COMPARTIMENT 2 : FORMULAIRE ENVOI DES NOTIFICATIONS DOCUMENTS */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm h-fit">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">🚨 Expédition et Alertes de Documents Personnels</h3>
          
          <form onSubmit={handleSendDocumentAlert} className="space-y-4 text-xs font-bold text-gray-700">
            <div>
              <label className="block text-gray-400 uppercase mb-1">Matricule MENA Cible de l'Élève *</label>
              <input type="text" placeholder="Ex: 26_8631W" value={docMatricule} onChange={(e) => setFormMatricule(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none uppercase font-mono tracking-wide" required />
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
              <textarea rows="3" placeholder="Ex: Votre livret scolaire du 1er trimestre est disponible..." value={docCommentaire} onChange={(e) => setDocCommentaire(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none font-medium text-gray-600"></textarea>
            </div>

            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-2.5 rounded-xl uppercase tracking-wider transition shadow-xs cursor-pointer">
              🚀 Émettre l'Alerte Courriel Instantanée
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default SecretariatAdmin;
