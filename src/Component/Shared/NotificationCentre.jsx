import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; 
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/api';
import { collection, query, onSnapshot, doc, addDoc } from 'firebase/firestore';

const NotificationCentre = () => {
  const { user, schoolId, schoolName } = useAuth();
  
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();
  const idUtilisateurConnecte = user?.matricule || user?.id || 'UNKNOWN';

  // --- ÉTATS MATRIX DU HUB CENTRAL ---
  const [tousLesMessagesDuEtablissement, setTousLesMessagesDuEtablissement] = useState([]);
  const [listeCamaradesEtPersonnels, setListeCamaradesEtPersonnels] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ÉTATS NAVIGATION INTERNE ---
  const [canalActif, setCanalActif] = useState('OFFICIEL'); 
  const [scopeFiltreContacts, setScopeFiltreContacts] = useState('eleve'); // 'eleve' | 'professeur' | 'educateur'
  const [barreRechercheContact, setBarreRechercheContact] = useState('');

  // --- ÉTATS REDACTION ---
  const [titreAnnonce, setTitreAnnonce] = useState('');
  const [corpsAnnonceOrChat, setCorpsAnnonceOrChat] = useState('');
  const [cibleAudienceGlobale, setCibleAudienceGlobale] = useState('all');
  const [sending, setSending] = useState(false);

  const [fileBase64, setFileBase64] = useState(null);
  const [fileName, setFileName] = useState('');

  // 🔄 ÉCOUTEUR UNIVERSEL 100% TEMPS RÉEL (OUVERTURE BILATÉRALE DES CANAUX)
  useEffect(() => {
    if (!idUtilisateurConnecte || !currentSchool) return;

    // 🟢 FLUX 1 RECTIFIÉ : Aspiration et écoute universelle des messages privés et publics
    const qNotifications = query(collection(db, "notifications"));
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const schoolCleanDoc = (d.schoolId || '').trim().toLowerCase();

        if (schoolCleanDoc === currentSchool) {
          list.push({ id: docSnap.id, ...d });
        }
      });
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Tri chronologique des bulles
      setTousLesMessagesDuEtablissement(list);
    });

    // 🟢 FLUX 2 RECTIFIÉ : Chargement de tous les rôles de l'établissement sans exclusion
    const qUsers = query(collection(db, "users"));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const uList = [];
      snapshot.forEach((docSnap) => {
        const uData = docSnap.data();
        const schoolCleanDoc = (uData.schoolId || '').trim().toLowerCase();
        
        if (schoolCleanDoc === currentSchool && docSnap.id !== idUtilisateurConnecte) {
          uList.push({ id: docSnap.id, ...uData });
        }
      });
      setListeCamaradesEtPersonnels(uList);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => {
      unsubNotifications();
      unsubUsers();
    };
  }, [idUtilisateurConnecte, currentSchool]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setFileBase64(reader.result);
  };

  // 🚀 AIGUILLAGE UNIVERSEL DU ROUTEUR DE MESSAGERIE
  const handlePublishMessageCentral = async (e) => {
    e.preventDefault();
    if (!corpsAnnonceOrChat.trim()) return;

    setSending(true);
    try {
      const expediteurNomComplet = `${user?.nom || ''} ${user?.prenoms || user?.name || ''}`.trim().toUpperCase();

      if (canalActif === 'OFFICIEL') {
        await addDoc(collection(db, "notifications"), {
          schoolId: currentSchool,
          expediteurId: idUtilisateurConnecte,
          expediteurNom: expediteurNomComplet || "DIRECTION",
          destinataireId: "ALL", 
          destinataireNom: "TOUT L'ÉTABLISSEMENT",
          titre: titreAnnonce.trim() || "COMMUNIQUÉ OFFICIEL",
          message: corpsAnnonceOrChat.trim(),
          audience: cibleAudienceGlobale,
          type: "global", 
          pjName: fileName || null,
          pjData: fileBase64 || null,
          createdAt: new Date().toISOString()
        });
        setTitreAnnonce('');
      } else {
        // 🟢 INTERCEPTION CHAT PRIVÉ : Fonctionne désormais pour les Élèves, Profs, Administrateurs et Éducateurs
        const contactCibleObj = listeCamaradesEtPersonnels.find(x => x.id === canalActif);
        const typeMessageCalcule = canalActif === 'ADMIN' ? "reclamation" : "chat_eleve";

        await addDoc(collection(db, "notifications"), {
          schoolId: currentSchool,
          expediteurId: idUtilisateurConnecte,
          expediteurNom: expediteurNomComplet || "UTILISATEUR",
          destinataireId: canalActif, 
          destinataireNom: canalActif === 'ADMIN' ? "ADMINISTRATION CENTRALE" : `${contactCibleObj?.nom || ''} ${contactCibleObj?.prenoms || ''}`.trim().toUpperCase(),
          message: corpsAnnonceOrChat.trim(),
          type: typeMessageCalcule, 
          createdAt: new Date().toISOString()
        });
      }

      setCorpsAnnonceOrChat('');
      setFileBase64(null);
      setFileName('');
      if (document.getElementById('fileCentralInput')) document.getElementById('fileCentralInput').value = '';

    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // --- FILTRES DE RENDU DES SÉCTIONS DE CONTACTS ---
  const filtrerFichesDestinatairesLeft = listeCamaradesEtPersonnels.filter(contact => {
    const matcheRole = contact.role === scopeFiltreContacts || (scopeFiltreContacts === 'professeur' && contact.role === 'prof_principal');
    const nomComplet = `${contact.nom || ''} ${contact.prenoms || ''} ${contact.id}`.toLowerCase();
    return matcheRole && nomComplet.includes(barreRechercheContact.toLowerCase().trim());
  });

  // 🟢 ALGORITHME DE CORRECTION DE CAPTATION UNIVERSELLE : Synchronise le tchat pour TOUS les rôles
  const messagesFiltresAAfficher = tousLesMessagesDuEtablissement.filter(m => {
    if (canalActif === 'OFFICIEL') {
      if (m.type !== 'global') return false;
      if (user?.role === 'admin' || user?.role === 'super_admin') return true;
      return m.audience === 'all' || m.audience === user?.role;
    }
    
    if (canalActif === 'ADMIN') {
      return m.type === 'reclamation' && (m.expediteurId === idUtilisateurConnecte || m.destinataireId === idUtilisateurConnecte);
    }

    // Capture bidirectionnelle universelle Élève ⇄ Élève, Prof ⇄ Élève, Prof ⇄ Éducateur
    return (m.type === 'chat_eleve' || m.type === 'reclamation') && (
      (m.expediteurId === idUtilisateurConnecte && m.destinataireId === canalActif) ||
      (m.expediteurId === canalActif && m.destinataireId === idUtilisateurConnecte)
    );
  });

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">Ouverture de la centrale des messages...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans text-gray-700 text-left animate-fadeIn min-h-screen bg-gray-50">
      
      {/* BOUTON RETOUR */}
      <div className="mb-4">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center text-xs font-black bg-white border hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl transition shadow-2xs cursor-pointer">
          ⬅️ Retour au Bureau Établissement
        </button>
      </div>

      {/* TITRAGE BANDEAU */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border shadow-md mb-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-950/40 px-3 py-1 rounded-full">
          📡 Routeur de Flux NoSQL Universel Débloqué
        </span>
        <h2 className="text-xl font-black mt-2 text-white">Centre National des Correspondances Scolaires</h2>
        <p className="text-xs text-slate-400 mt-0.5">Utilisateur connecté : <span className="text-white font-bold uppercase">{user?.nom || "UTILISATEUR"} ({idUtilisateurConnecte})</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ================= BARRE GAUCHE : CARNET D'ADRESSES MULTI-ROLES ================= */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-4 h-[540px] flex flex-col justify-start">
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">Canaux d'Aiguillage</h3>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            <button type="button" onClick={() => setCanalActif('OFFICIEL')} className={`w-full text-left p-3 rounded-xl transition font-black text-xs flex items-center justify-between cursor-pointer border ${canalActif === 'OFFICIEL' ? 'bg-purple-600 text-white border-purple-700 shadow-md' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
              <span>📢 Communiqués Officiels</span>
              <span className="text-[8px] bg-white/20 text-white px-2 py-0.5 rounded uppercase">Général</span>
            </button>

            {user?.role !== 'admin' && (
              <button type="button" onClick={() => setCanalActif('ADMIN')} className={`w-full text-left p-3 rounded-xl transition font-black text-xs flex items-center justify-between cursor-pointer border ${canalActif === 'ADMIN' ? 'bg-red-600 text-white border-red-700 shadow-md' : 'bg-red-50 text-red-700 hover:bg-red-100/50'}`}>
                <span>🏛️ Réclamation Secrétariat Admin</span>
                <span className="text-[8px] bg-red-950 text-red-300 px-2 py-0.5 rounded font-mono">SOS</span>
              </button>
            )}

                        {/* 🟢 RECTIFICATION PAR FILTRAGE DE ROLES COMPLETS */}
            <div className="pt-4 border-t mt-4 space-y-2">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Carnet de Contacts Interconnecté</span>
              <div className="flex bg-gray-100 p-0.5 rounded-lg border text-[9px] font-black uppercase">
                <button type="button" onClick={() => setScopeFiltreContacts('eleve')} className={`flex-1 py-1 rounded transition cursor-pointer ${scopeFiltreContacts === 'eleve' ? 'bg-slate-900 text-orange-400' : 'text-gray-400'}`}>Camarades</button>
                <button type="button" onClick={() => setScopeFiltreContacts('professeur')} className={`flex-1 py-1 rounded transition cursor-pointer ${scopeFiltreContacts === 'professeur' ? 'bg-slate-900 text-orange-400' : 'text-gray-400'}`}>Professeurs</button>
                <button type="button" onClick={() => setScopeFiltreContacts('educateur')} className={`flex-1 py-1 rounded transition cursor-pointer ${scopeFiltreContacts === 'educateur' ? 'bg-slate-900 text-orange-400' : 'text-gray-400'}`}>Éducateurs</button>
              </div>
              <input type="text" placeholder="🔍 Filtrer par nom ou prénom..." value={barreRechercheContact} onChange={(e) => setBarreRechercheContact(e.target.value)} className="w-full bg-gray-50 border p-2 rounded-lg text-[11px] font-bold outline-none text-gray-700 focus:ring-1 focus:ring-purple-500 bg-white" />
            </div>

            <div className="space-y-1 max-h-[160px] overflow-y-auto pt-2">
              {filtrerFichesDestinatairesLeft.map(contact => (
                <button key={contact.id} type="button" onClick={() => setCanalActif(contact.id)} className={`w-full text-left p-2 rounded-lg text-[11px] transition flex justify-between items-center cursor-pointer ${canalActif === contact.id ? 'bg-slate-900 text-orange-400 font-black shadow-xs' : 'bg-white border hover:bg-gray-50'}`}>
                  <span className="truncate uppercase font-black">{contact.nom} {contact.prenoms || contact.prenom || ''}</span>
                  <span className="font-mono text-[8px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase font-bold">{contact.classeId || contact.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= COLONNE DROITE : LE FIL DE DISCUSSION LIVE ================= */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-white rounded-2xl border shadow-sm h-[540px] overflow-hidden">
          
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center text-xs font-black text-gray-800">
            <p>Fil Connecté : <span className="text-purple-700 uppercase">{canalActif === 'OFFICIEL' ? "Affichage Communiqués Généraux" : canalActif === 'ADMIN' ? "Secrétariat de la Direction" : `Discussion avec ${listeCamaradesEtPersonnels.find(v => v.id === canalActif)?.nom || 'Membre Équipe'}`}</span></p>
            <span className="text-[10px] font-mono text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded animate-pulse">● Canal Actif</span>
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-gray-50/40 max-h-[340px]">
            {messagesFiltresAAfficher.length === 0 ? (
              <div className="text-center py-20 text-gray-400 italic text-xs font-medium">Aucun message échangé. Saisissez votre texte ci-dessous pour démarrer le dialogue en direct.</div>
            ) : (
              messagesFiltresAAfficher.map((m, index) => {
                const estAnnonceOfficielle = m.type === 'global';
                const estMoi = m.expediteurId === idUtilisateurConnecte;

                if (estAnnonceOfficielle) {
                  return (
                    <div key={m.id || index} className="p-4 rounded-xl border-l-4 border-l-purple-600 bg-white shadow-2xs text-xs font-medium space-y-2 animate-fadeIn">
                      <div className="flex justify-between items-center font-bold text-gray-900 border-b pb-1">
                        <span className="text-purple-700 uppercase">📣 {m.titre}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-bold">DIRECTION</span>
                      </div>
                      <p className="text-gray-600 leading-relaxed font-medium whitespace-pre-wrap">{m.message}</p>
                      {m.pjName && m.pjData && (
                        <div className="mt-2 p-2 bg-gray-50 border rounded-lg flex items-center justify-between font-bold">
                          <span className="text-[10px] font-mono text-gray-400">📎 {m.pjName}</span>
                          <a href={m.pjData} download={m.pjName} className="text-purple-700 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded text-[10px] uppercase font-black">📥 Télécharger</a>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div key={m.id || index} className={`flex flex-col max-w-[80%] p-3 rounded-2xl shadow-2xs text-xs ${estMoi ? 'ml-auto bg-slate-900 text-white rounded-br-none' : 'mr-auto bg-white border text-gray-800 rounded-bl-none'}`}>
                      <span className="text-[8px] font-black uppercase text-purple-400 mb-1">{m.expediteurNom}</span>
                      <p className="leading-relaxed whitespace-pre-wrap font-medium">{m.message}</p>
                    </div>
                  );
                }
              })
            )}
          </div>

          {/* SAISIE DE TEXTE UNIQUE */}
          <form onSubmit={handlePublishMessageCentral} className="p-3 border-t bg-gray-50 space-y-3 font-bold text-xs">
            {canalActif === 'OFFICIEL' && user?.role === 'admin' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
                <input type="text" placeholder="Objet du communiqué officiel *" value={titreAnnonce} onChange={(e) => setTitreAnnonce(e.target.value)} className="sm:col-span-2 bg-white border rounded-xl px-3 py-2 outline-none text-gray-800 focus:ring-1 focus:ring-purple-500 font-bold" required />
                <select value={cibleAudienceGlobale} onChange={(e) => setCibleAudienceGlobale(e.target.value)} className="bg-white border rounded-xl px-3 py-2 outline-none cursor-pointer text-purple-700 font-black">
                  <option value="all">🌍 Tout l'Établissement</option>
                  <option value="professeur">👨‍🏫 Corps Enseignant</option>
                  <option value="educateur">🧑‍💼 Éducateurs Promotion</option>
                  <option value="eleve">🎓 Élèves & Parents</option>
                </select>
              </div>
            )}

            {canalActif === 'OFFICIEL' && user?.role === 'admin' && (
              <div className="bg-white border p-2 rounded-xl text-[10px] text-gray-400 flex items-center justify-between gap-4 animate-fadeIn">
                <span>📎 Attacher un document officiel (Max 2 Mo) :</span>
                <input id="fileCentralInput" type="file" accept=".pdf,.png,.jpg" onChange={handleFileChange} />
              </div>
            )}

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder={canalActif === 'OFFICIEL' ? (user?.role === 'admin' ? "Saisissez l'annonce administrative..." : "Lecture seule. Droits d'écriture réservés à la Direction.") : canalActif === 'ADMIN' ? "Exprimez votre réclamation d'urgence..." : "Écrire un message privé direct..."}
                value={corpsAnnonceOrChat}
                onChange={(e) => setCorpsAnnonceOrChat(e.target.value)}
                disabled={canalActif === 'OFFICIEL' && user?.role !== 'admin'}
                className="flex-1 bg-white border rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 disabled:bg-gray-100 bg-white"
                required
              />
              <button 
                type="submit" 
                disabled={sending || (canalActif === 'OFFICIEL' && user?.role !== 'admin') || !corpsAnnonceOrChat.trim()} 
                className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:bg-gray-200"
              >
                {sending ? "Envoi..." : "⚡ Envoyer"}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default NotificationCentre;
