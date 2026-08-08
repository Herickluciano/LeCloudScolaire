import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationCentre from '../../../component/Shared/NotificationCentre';
import ReceptionEleve from './message/ReceptionEleve';
import { imprimerBulletinTrimestriel } from '../../../utils/bulletinUtils';

const DashboardEleve = () => {
  const { user, schoolId, schoolName, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();
  const idEleveLogge = user?.matricule || user?.id || 'ELEVE_UNKNOWN';
  const classeEleve = (user?.classeId || '5eme_1').trim().toLowerCase();
  const promoEleve = (user?.promotion || '5eme').trim().toLowerCase();
   const activeSchoolName = schoolName || sessionStorage.getItem('sgs_school_name') || "Lycée Moderne Gagnoa";
  const activeSchoolId = schoolId || sessionStorage.getItem('sgs_school_id') || "lycee_moderne_gagnoa";

  // --- ÉTATS SÉLECTIONS ---
  const [activeSubSection, setActiveSubSection] = useState('accueil'); 
  const [trimestreSelectionne, setTrimestreSelectionne] = useState('1');
  const [filtreScopeChat, setFiltreScopeChat] = useState('classe'); 
  const [rechercheContactChat, setRechercheContactChat] = useState('');

  // --- ÉTATS MATRIX CLOUD TEMPS RÉEL ---
  const [schoolMeta, setSchoolMeta] = useState(null);
  const [tousElevesPromo, setTousElevesPromotion] = useState([]);
  const [discussionsMessages, setDiscussionsMessages] = useState([]);
  const [filtreMessageCible, setFiltreMessageCible] = useState('ADMIN'); 
  const [texteMessageUrgent, setTexteMessageUrgent] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.pathname.includes('bulletins')) setActiveSubSection('bulletins');
    if (location.pathname.includes('messagerie')) setActiveSubSection('messages');
  }, [location]);

  // 🔄 ÉCOUTEUR MATRICE DOUBLE FLUX (onSnapshot)
  useEffect(() => {
    if (!idEleveLogge || !currentSchool) return;

    // A. Lecture en temps réel des données de l'école
    const unsubSchool = onSnapshot(doc(db, "schools", currentSchool), (d) => {
      if (d.exists()) setSchoolMeta(d.data());
    });

    // B. Lecture en temps réel de tous les élèves de la même promotion (Cas tolérant à la casse)
    const qPromo = query(collection(db, "users"), where("role", "==", "eleve"));
    const unsubPromo = onSnapshot(qPromo, (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const schoolCleanDoc = (data.schoolId || '').trim().toLowerCase();
        const promoCleanDoc = (data.promotion || '').trim().toLowerCase();
        
        if (schoolCleanDoc === currentSchool && promoCleanDoc === promoEleve) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setTousElevesPromotion(list);
    });

    // 🟢 C. RECTIFICATION DU FILTRAGE DE MESSAGERIE LIVE : Capture instantanée bidirectionnelle
    const qMsg = query(collection(db, "notifications")); 
    const unsubMsg = onSnapshot(qMsg, (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const schoolCleanDoc = (d.schoolId || '').trim().toLowerCase();
        
        if (schoolCleanDoc === currentSchool) {
          list.push({ id: docSnap.id, ...d });
        }
      });
      // Tri chronologique strict des bulles de texte
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setDiscussionsMessages(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur messagerie live :", err);
      setLoading(false);
    });

    return () => {
      unsubSchool();
      unsubPromo();
      unsubMsg();
    };
  }, [idEleveLogge, currentSchool, promoEleve, classeEleve]);

  // --- INTERCEPTEURS DE COMPTEURS NOTES ET ABSENCES ---
  const profilLoggeLive = tousElevesPromo.find(e => e.id === idEleveLogge);
  
  const absencesDuTrimestre = trimestreSelectionne === '1' 
    ? (profilLoggeLive?.absences || 0) 
    : (profilLoggeLive?.[`absences_trimestre_${trimestreSelectionne}`] || 0);

  const extraireNotesDuTrimestre = (studentObj) => {
    if (!studentObj) return [];
    const sourceCarte = trimestreSelectionne === '1' 
      ? (studentObj.notes || {}) 
      : (studentObj[`notes_trimestre_${trimestreSelectionne}`] || {});

    const list = [];
    Object.entries(sourceCarte).forEach(([matiere, notesArray]) => {
      if (Array.isArray(notesArray) && notesArray.length > 0) {
        notesArray.forEach((val, idx) => {
          list.push({ matiere, valeur: parseFloat(val) || 0, idx: idx + 1 });
        });
      }
    });
    return list;
  };

  const mesNotesFiltrees = extraireNotesDuTrimestre(profilLoggeLive);
  const sommePoints = mesNotesFiltrees.reduce((acc, c) => acc + c.valeur, 0);
  const maMoyenneEstimee = mesNotesFiltrees.length > 0 ? (sommePoints / mesNotesFiltrees.length).toFixed(2) : '--';

  const listeClassementPromo = tousElevesPromo.map(student => {
    const notesStudent = extraireNotesDuTrimestre(student);
    const totalPoints = notesStudent.reduce((acc, c) => acc + c.valeur, 0);
    return { ...student, totalPoints, nbrDevoirs: notesStudent.length };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  const monRangDansLaPromo = listeClassementPromo.findIndex(e => e.id === idEleveLogge) + 1;

  // 🚀 ACTIONNEUR : Distribution instantanée du message vers le Cloud Midnight
  const handleExpedierMessage = async (e) => {
    e.preventDefault();
    if (!texteMessageUrgent.trim()) return;

    setSendingMsg(true);
    try {
      const expediteurNomComplet = `${profilLoggeLive?.nom || ''} ${profilLoggeLive?.prenoms || ''}`.trim().toUpperCase();
      
      await addDoc(collection(db, "notifications"), {
        schoolId: currentSchool,
        expediteurId: idEleveLogge,
        expediteurNom: expediteurNomComplet || "ÉLÈVE",
        destinataireId: filtreMessageCible, 
        destinataireNom: filtreMessageCible === 'ADMIN' ? "ADMINISTRATION CENTRALE" : (tousElevesPromo.find(el => el.id === filtreMessageCible)?.nom || "ÉLÈVE CIBLE"),
        message: texteMessageUrgent.trim(),
        roleEmetteur: "eleve",
        type: filtreMessageCible === 'ADMIN' ? "reclamation" : "chat_eleve",
        createdAt: new Date().toISOString()
      });
      setTexteMessageUrgent('');
    } catch (err) {
      console.error("Erreur d'envoi du message :", err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleTelechargerBulletinPDF = () => {
    alert(`🖨️ Génération du Bulletin PDF officiel...\n\nPays : ${schoolMeta?.pays || "RÉPUBLIQUE DE CÔTE D'IVOIRE"}\nMinistère : ${schoolMeta?.ministere || "Éducation Nationale"}\nInitiales Certifiées : ${schoolMeta?.initiales || "L.M.G"}`);
  };

  // 🟢 RECTIFICATION CRITIQUE DU FILTRAGE DE RENDU DES BULLES DE CONVERSATION
  const messagesFiltresChat = discussionsMessages.filter(m => {
    if (filtreMessageCible === 'ADMIN') {
      return m.type === 'reclamation' && (m.expediteurId === idEleveLogge || m.destinataireId === idEleveLogge);
    }
    // Chat individuel entre élèves de classe ou promo
    return m.type === 'chat_eleve' && (
      (m.expediteurId === idEleveLogge && m.destinataireId === filtreMessageCible) ||
      (m.expediteurId === filtreMessageCible && m.destinataireId === idEleveLogge)
    );
  });

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">Ouverture du canal de communication...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn text-gray-700 text-left">
      
      {/* BARRE DE CAPTURE SUPÉRIEURE */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-4 mb-6 gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
            Espace Numérique Compagnon de l'Apprenant
          </span>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 mt-2 uppercase">
            🎒 {profilLoggeLive?.nom} {profilLoggeLive?.prenoms}
          </h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Matricule : <span className="font-mono font-bold text-purple-700">{idEleveLogge}</span> — Division Active : <span className="uppercase font-black text-gray-600">{classeEleve}</span></p>
        </div>

                <div className="flex flex-wrap bg-white p-1 rounded-xl border border-gray-200 shadow-2xs text-xs font-black uppercase">
          <button type="button" onClick={() => setActiveSubSection('accueil')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeSubSection === 'accueil' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>🏠 Accueil</button>
          <button type="button" onClick={() => setActiveSubSection('bulletins')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeSubSection === 'bulletins' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>📊 Mon Bulletin</button>
          <button type="button" onClick={() => setActiveSubSection('classement')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeSubSection === 'classement' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>🏆 Top Promotion</button>
          <button type="button" onClick={() => setActiveSubSection('messages')} className={`px-3 py-2 rounded-lg transition cursor-pointer ${activeSubSection === 'messages' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>✉️ Messagerie</button>
          <button type="button" onClick={() => { logout(); navigate('/login'); }} className="px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition cursor-pointer">🚪 Déconnexion</button>
        </div>
      </div>

      {/* ZONE DE SÉLECTION DE PÉRIODE */}
      <div className="max-w-7xl mx-auto bg-white border p-4 rounded-xl shadow-2xs mb-6 flex justify-between items-center text-xs font-bold text-left">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 uppercase text-[10px]">Période active :</span>
          <select value={trimestreSelectionne} onChange={(e) => setTrimestreSelectionne(e.target.value)} className="bg-gray-50 border p-2 rounded-lg outline-none cursor-pointer bg-white text-gray-800">
            <option value="1">Premier Trimestre</option>
            <option value="2">Deuxième Trimestre</option>
            <option value="3">Troisième Trimestre</option>
          </select>
        </div>
        <p className="text-[11px] font-mono text-gray-400 font-bold uppercase">Régime horaire limite : 18H00</p>
      </div>

      {/* ================= 🚨 CONTENU SOUS-SECTION A : ACCUEIL VUE GENERALE ================= */}
      {activeSubSection === 'accueil' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 animate-fadeIn items-start text-left">
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border shadow-2xs">
              <p className="text-[10px] font-black uppercase text-gray-400">Absences Trimestre {trimestreSelectionne}</p>
              <p className="text-2xl font-black text-red-600 mt-1">{absencesDuTrimestre} H</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-2xs">
              <p className="text-[10px] font-black uppercase text-gray-400">Position Promotionnelle</p>
              <p className="text-2xl font-black text-purple-700 mt-1">{monRangDansLaPromo}e <span className="text-xs font-bold text-gray-400">/ {tousElevesPromo.length}</span></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-2xs">
              <p className="text-[10px] font-black uppercase text-purple-600">Moyenne Estimée (T{trimestreSelectionne})</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{maMoyenneEstimee} /20</p>
            </div>
          </div>
          
          <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl shadow-xl text-center">
            <div className="w-24 h-24 bg-slate-800 rounded-full mx-auto border-2 border-orange-400 flex items-center justify-center text-3xl font-bold uppercase text-white shadow-md mb-4 font-mono">
              {profilLoggeLive?.nom?.charAt(0)}
            </div>
            <h4 className="text-sm font-black uppercase text-white">{profilLoggeLive?.nom}</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{profilLoggeLive?.prenoms}</p>
          </div>
        </div>
      )}

      {/* ================= 🚨 SOUS-SECTION B : MON BULLETIN ET NOTES IMBRIQUÉES ================= */}
      {activeSubSection === 'bulletins' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border p-6 shadow-sm animate-fadeIn text-left">
          <div className="flex justify-between items-center border-b pb-4 mb-4">
            <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider">📄 Relevé de Notes du Trimestre {trimestreSelectionne}</h3>
            <button type="button" onClick={handleTelechargerBulletinPDF} className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl transition shadow-sm cursor-pointer">
              🖨️ Télécharger mon Bulletin PDF
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                  <th className="p-3">Discipline d'Enseignement</th>
                  <th className="p-3">Type d'Évaluation</th>
                  <th className="p-3 text-center">Note /20</th>
                  <th className="p-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {mesNotesFiltrees.length === 0 ? (
                  <tr><td colSpan="4" className="p-12 text-center text-gray-400 italic">Aucune note enregistrée pour le Trimestre {trimestreSelectionne}.</td></tr>
                ) : (
                  mesNotesFiltrees.map((n, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-purple-50/10 transition">
                      <td className="p-3 text-purple-700 uppercase font-black">📚 {n.matiere}</td>
                      <td className="p-3 text-gray-400">{n.type}</td>
                      <td className="p-3 text-center font-mono text-sm font-black text-gray-900">{n.valeur.toFixed(2)}</td>
                      <td className="p-3 text-right text-emerald-700 italic">✓ Validée en session</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= 🚨 SOUS-SECTION C : CLASSEMENT EXCELLENCE PROMO ================= */}
      {activeSubSection === 'classement' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border p-6 shadow-sm animate-fadeIn text-left">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">🏆 Relevé d'Excellence Promotionnel ({promoEleve.toUpperCase()})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                  <th className="p-4 text-center">Rang</th>
                  <th className="p-4">Matricule</th>
                  <th className="p-4">Division</th>
                  <th className="p-4">Nom & Prénoms</th>
                  <th className="p-4 text-right">Points Trimestriels</th>
                </tr>
              </thead>
              <tbody>
                {listeClassementPromo.map((student, index) => {
                  const estMoi = student.id === idEleveLogge;
                  return (
                    <tr key={student.id} className={`border-b border-gray-100 transition ${estMoi ? 'bg-purple-50/50 border-l-4 border-l-purple-600 font-black' : 'hover:bg-gray-50/50'}`}>
                      <td className="p-4 text-center text-sm font-black text-amber-600">{index + 1} {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '✨'}</td>
                      <td className="p-4 font-mono text-gray-400">{student.matricule || student.id}</td>
                      <td className="p-4 font-mono text-purple-700 uppercase">{student.classeId?.toUpperCase()}</td>
                      <td className="p-4 text-gray-900 uppercase">
                        {student.nom} {student.prenoms || ''} 
                        {estMoi && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded font-mono ml-2">MOI</span>}
                      </td>
                      <td className="p-4 text-right font-mono text-purple-700 text-sm">{student.totalPoints.toFixed(2)} pts</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= 🚨 SOUS-SECTION D : MESSAGERIE DUO & FILTRAGE PROMO ================= */}
      {activeSubSection === 'messages' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-3 animate-fadeIn h-[480px] overflow-hidden text-left">
          
                    {/* BARRE INTERACTIVE CONTACTS */}
          <div className="md:col-span-1 border-r flex flex-col justify-start bg-gray-50/50 h-[480px]">
            <div className="p-4 bg-gray-50 border-b space-y-3">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Canaux & Contacts</h4>
              
              <div className="flex bg-white p-0.5 rounded-lg border text-[10px] font-black uppercase">
                <button type="button" onClick={() => setFiltreScopeChat('classe')} className={`flex-1 py-1 rounded transition text-center cursor-pointer ${filtreScopeChat === 'classe' ? 'bg-purple-600 text-white shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}>Ma Classe</button>
                <button type="button" onClick={() => setFiltreScopeChat('promotion')} className={`flex-1 py-1 rounded transition text-center cursor-pointer ${filtreScopeChat === 'promotion' ? 'bg-purple-600 text-white shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}>Toute la Promo</button>
              </div>

              <input 
                type="text" 
                placeholder="🔍 Rechercher un camarade..." 
                value={rechercheContactChat}
                onChange={(e) => setRechercheContactChat(e.target.value)}
                className="w-full bg-white border p-2 rounded-lg outline-none text-[11px] font-bold text-gray-700 focus:ring-1 focus:ring-purple-500 bg-white"
              />
            </div>
            
            <div className="overflow-y-auto flex-1 p-2 space-y-1 text-xs font-bold text-gray-700 max-h-[340px]">
              <button 
                type="button" 
                onClick={() => setFiltreMessageCible('ADMIN')} 
                className={`w-full text-left p-3 rounded-xl transition font-bold flex items-center justify-between cursor-pointer ${filtreMessageCible === 'ADMIN' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border hover:bg-gray-100'}`}
              >
                <span>🏛️ Secrétariat / Réclamations</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${filtreMessageCible === 'ADMIN' ? 'bg-purple-950 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>ADMIN</span>
              </button>

              <div className="pt-3 pb-1 px-2 border-b">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  {filtreScopeChat === 'classe' ? `Mes camarades de (${classeEleve.toUpperCase()})` : `Liste Promotionnelle (${promoEleve.toUpperCase()})`}
                </span>
              </div>

              {tousElevesPromo
                .filter(e => e.id !== idEleveLogge)
                .filter(student => {
                  const classeDoc = (student.classeId || '').toLowerCase().trim();
                  if (filtreScopeChat === 'classe' && classeDoc !== classeEleve) return false;
                  
                  const nomComplet = `${student.nom || ''} ${student.prenoms || ''}`.toLowerCase();
                  return nomComplet.includes(rechercheContactChat.toLowerCase().trim());
                })
                .map(student => (
                  <button 
                    type="button" 
                    key={student.id} 
                    onClick={() => setFiltreMessageCible(student.id)} 
                    className={`w-full text-left p-2.5 rounded-xl transition flex justify-between items-center cursor-pointer ${filtreMessageCible === student.id ? 'bg-slate-900 text-orange-400 font-black shadow-xs' : 'bg-white border hover:bg-gray-100'}`}
                  >
                    <span className="truncate uppercase">{student.nom} {student.prenoms || ''}</span>
                    <span className="font-mono text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded uppercase">{student.classeId?.toUpperCase()}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* INTERFACE DU FIL DE CHAT LIVE */}
          <div className="md:col-span-2 flex flex-col justify-between bg-white h-[480px]">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center text-xs font-black text-gray-800">
              <p>Fil actif : <span className="text-purple-700 uppercase">{filtreMessageCible === 'ADMIN' ? "Secrétariat central de l'école" : (tousElevesPromo.find(el => el.id === filtreMessageCible)?.nom || "Élève")}</span></p>
              <span className="text-[10px] font-mono text-gray-400 uppercase">Cryptage Cloud Certifié</span>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-gray-50/30 font-medium text-xs max-h-[340px]">
              {messagesFiltresChat.length === 0 ? (
                <div className="text-center py-16 text-gray-400 italic">Aucun message échangé dans ce fil. Saisissez votre texte ci-dessous pour initier le dialogue.</div>
              ) : (
                messagesFiltresChat.map((m) => {
                  const estMoi = m.expediteurId === idEleveLogge;
                  return (
                    <div key={m.id} className={`flex flex-col max-w-[80%] p-3 rounded-2xl shadow-2xs ${estMoi ? 'ml-auto bg-slate-900 text-white rounded-br-none' : 'mr-auto bg-white border text-gray-800 rounded-bl-none'}`}>
                      <span className="text-[8px] font-black uppercase text-purple-400 mb-1">{m.expediteurNom}</span>
                      <p className="leading-relaxed whitespace-pre-wrap font-medium">{m.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleExpedierMessage} className="p-3 border-t bg-gray-50 flex gap-2">
              <input 
                type="text" 
                placeholder={filtreMessageCible === 'ADMIN' ? "Rédigez votre réclamation officielle à l'administration..." : "Tapez votre message privé..."}
                value={texteMessageUrgent}
                onChange={(e) => setTexteMessageUrgent(e.target.value)}
                className="flex-1 bg-white border rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 bg-white"
                required
              />
              <button 
                type="submit" 
                disabled={sendingMsg || !texteMessageUrgent.trim()} 
                className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:bg-gray-200"
              >
                {sendingMsg ? "Envoi..." : "⚡ Envoyer"}
              </button>
            </form>
          </div>
          <ReceptionEleve/>
        </div>
        
      )}
      {/* BLOC BOUTON BULLETIN TRIMESTRIEL D'EXCELLENCE */}
        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-3xs flex flex-col justify-between items-start gap-3">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
              Bulletins trimestriels
            </span>
            <h3 className="text-sm font-black text-gray-900 mt-2 uppercase">Mon Relevé de Notes Certifié NoSQL</h3>
            <p className="text-[11px] text-gray-400 font-medium mt-1">Générez et téléchargez votre bulletin trimestriel officiel muni de son QR Code de certification de l'établissement.</p>
          </div>
          
          <button
            type="button"
            onClick={() => imprimerBulletinTrimestriel(user, schoolName || "Lycée Moderne Gagnoa", schoolId || "lycee_moderne_gagnoa")}
            className="bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase px-4 py-2.5 rounded-xl transition shadow-xs cursor-pointer border-0"
          >
            📥 Imprimer / Télécharger mon Bulletin PDF
          </button>
        </div>
    </div>
  );
};

export default DashboardEleve;
