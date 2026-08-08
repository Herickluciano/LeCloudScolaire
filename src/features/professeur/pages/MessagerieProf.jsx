import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, addDoc, getDocs } from 'firebase/firestore';

const MessagerieProf = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = (schoolId || 'lycee_Moderne_Gagnoa').trim().toLowerCase();

  // --- ÉTATS ---
  const [activeTab, setActiveTab] = useState('lire'); 
  const [messagesRecus, setMessagesRecus] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulaire du professeur
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [classeCible, setClasseCible] = useState('');
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMessage] = useState({ type: '', text: '' });

  const dateAujourdhui = new Date().toLocaleDateString('fr-FR');

  // 🔄 ÉCOUTEUR RÉACTIF TEMPS RÉEL (onSnapshot) : Messages reçus de la Direction
  useEffect(() => {
    if (!currentSchool) return;
    const q = query(collection(db, "notifications"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const schoolCleanDoc = (data.schoolId || '').trim().toLowerCase();
        
        if (schoolCleanDoc === currentSchool) {
          if (data.audience === 'all' || data.audience === 'professeur') {
            list.push({ id: docSnap.id, ...data });
          }
        }
      });
      list.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      setMessagesRecus(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [currentSchool]);

  // 🚀 ACTION : Publication Cloud + Expédition immédiate de l'e-mail d'alerte
  const handleProfPublishNotification = async (e) => {
    e.preventDefault();
    setFormMessage({ type: '', text: '' });

    if (!titre.trim() || !corps.trim() || !classeCible.trim()) {
      setFormMessage({ type: 'error', text: "Veuillez remplir l'objet, le message et spécifier la classe." });
      return;
    }

    setSending(true);
    try {
      const cleanClasse = classeCible.trim().toLowerCase();
      const disciplineProf = user?.matiereEnseignee || user?.matiere || 'Matière';
      const enTeteOfficiel = `Message du Professeur de ${disciplineProf} : ${titre.trim()}`;

      // 1. Insertion sur Firestore pour l'affichage permanent dans l'Espace Élève
      await addDoc(collection(db, "notifications"), {
        titre: enTeteOfficiel,
        corps: corps.trim(),
        audience: 'eleve',
        classeId: cleanClasse, 
        schoolId: currentSchool,
        expediteur: `M. ${user?.nom || user?.name || 'Enseignant'} (${disciplineProf})`,
        createdAt: new Date().toISOString(),
        date: dateAujourdhui,
        lusPar: []
      });

      // 2. Récupération instantanée de tous les élèves inscrits dans cette classe spécifique
      const emailQuery = query(collection(db, "users"));
      const usersSnapshot = await getDocs(emailQuery);
      
      // 3. Boucle d'envoi vers le serveur d'e-mails asynchrone Node.js
      usersSnapshot.forEach((userDoc) => {
        const student = userDoc.data();
        const studentSchool = (student.schoolId || '').trim().toLowerCase();
        const studentClass = (student.classeId || '').trim().toLowerCase();
        
        if (studentSchool === currentSchool && student.role === 'eleve' && studentClass === cleanClasse && student.email) {
          fetch("http://localhost:10000/api/send-email", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_email: student.email.trim(),
              to_name: `${student.prenoms || ''} ${student.nom || ''}`.toUpperCase(),
              school_name: schoolName || "LeCloudScolaire",
              subject_title: enTeteOfficiel,
              sender_title: `M. ${user?.nom || 'Enseignant'} - Enseignant de ${disciplineProf}`,
              body_text: corps.trim()
            })
          })
          .then(res => res.json())
          .catch(err => console.error("Erreur e-mail élève :", err));
        }
      });

      setFormMessage({ type: 'success', text: `📢 Communiqué envoyé en direct à la classe ${cleanClasse.toUpperCase()} ! Les notifications par e-mail ont été transmises.` });
      setTitre('');
      setCorps('');
      setClasseCible('');
    } catch (err) {
      console.error(err);
      setFormMessage({ type: 'error', text: "Erreur réseau lors de l'envoi." });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase tracking-wider">Ouverture du centre d'alertes...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans text-gray-700 text-left animate-fadeIn">
      
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-black bg-white border hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl transition shadow-2xs">
          ⬅️ Retour au Bureau Virtuel
        </Link>
      </div>

      <div className="bg-white border rounded-2xl p-5 shadow-3xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-gray-800">✉️ Centre de Messagerie Enseignant</h2>
          <p className="text-[11px] text-gray-400 font-medium">Consultez les directives de la Direction ou transmettez une alerte à vos classes.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-black uppercase shadow-3xs">
          <button 
            type="button"
            onClick={() => setActiveTab('lire')}
            className={`px-4 py-2 rounded-lg transition uppercase tracking-wider cursor-pointer ${activeTab === 'lire' ? 'bg-white text-purple-700 shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}
          >
            🔔 Notes Reçues ({messagesRecus.length})
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('ecrire')}
            className={`px-4 py-2 rounded-lg transition uppercase tracking-wider cursor-pointer ${activeTab === 'ecrire' ? 'bg-white text-purple-700 shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}
          >
            ✍️ Alerter une Classe
          </button>
        </div>
      </div>

      {activeTab === 'lire' && (
        <div className="bg-white rounded-2xl border p-5 shadow-3xs space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">Directives Officielles et Circulaires</h3>
          {messagesRecus.length === 0 ? (
            <p className="text-xs text-center text-gray-400 py-8 font-medium italic">Aucune note de service reçue de la direction pour le moment.</p>
          ) : (
            <div className="space-y-4">
              {messagesRecus.map((notif) => (
                <div key={notif.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition relative text-left">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-black text-purple-950 uppercase">📣 {notif.titre}</h4>
                    <span className="text-[10px] text-gray-400 font-mono font-bold bg-white border px-2 py-0.5 rounded shadow-3xs">{notif.date}</span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-line mb-3 font-medium leading-relaxed">"{notif.corps || notif.message}"</p>
                  
                  {notif.pjData && (
                    <a href={notif.pjData} download={notif.pjName} className="inline-flex items-center text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-3 py-2 rounded-xl hover:bg-purple-100 transition shadow-3xs">
                      📥 Télécharger la pièce : {notif.pjName}
                    </a>
                  )}

                  <div className="mt-4 pt-2 border-t border-dashed border-gray-200 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Émetteur : <span className="text-slate-600 font-black">{notif.expediteur || 'La Direction'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ecrire' && (
        <div className="bg-white rounded-2xl border p-5 shadow-3xs space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">✍️ Rédiger un communiqué de classe</h3>
          
          {formMsg.text && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${formMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {formMsg.text}
            </div>
          )}

          <form onSubmit={handleProfPublishNotification} className="space-y-4 text-xs font-bold text-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-gray-400 uppercase mb-1">Objet du message *</label>
                <input type="text" placeholder="Ex: Devoir de rattrapage ou Note de cours" value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full bg-gray-50 border p-3 rounded-xl outline-none text-gray-900 bg-white" required />
              </div>
                            <div>
                <label className="block text-gray-400 uppercase mb-1">Classe ciblée (ID exact) *</label>
                <input type="text" placeholder="Ex: 5eme_1, 4eme_2" value={classeCible} onChange={(e) => setClasseCible(e.target.value)} className="w-full bg-gray-50 border p-3 rounded-xl outline-none text-gray-900 uppercase bg-white" required />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">Message destiné aux élèves *</label>
              <textarea rows="5" placeholder="Rédigez les consignes de travail..." value={corps} onChange={(e) => setCorps(e.target.value)} className="w-full bg-gray-50 border p-3 rounded-xl outline-none font-medium leading-relaxed text-gray-900 bg-white" required />
            </div>

            <div className="text-right">
              <button type="submit" disabled={sending || !titre.trim() || !corps.trim() || !classeCible.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase px-6 py-3 rounded-xl shadow-md transition cursor-pointer border-0 disabled:bg-gray-200">
                {sending ? "Transmission SMTP..." : "🚀 Envoyer le communiqué"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default MessagerieProf;
