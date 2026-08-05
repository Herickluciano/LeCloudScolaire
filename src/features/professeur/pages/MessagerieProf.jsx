import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, addDoc, getDocs } from 'firebase/firestore';

const MessagerieProf = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

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
    const q = query(collection(db, "notifications"), where("schoolId", "==", currentSchool));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.audience === 'all' || data.audience === 'professeur') {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMessagesRecus(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentSchool]);

  // 🚀 ACTION : Publication Cloud + Expédition immédiate de l'e-mail d'alerte
  const handleProfPublishNotification = async (e) => {
    e.preventDefault();
    setFormMessage({ type: '', text: '' });

    if (!titre.trim() || !corps.trim() || !classeCible.trim()) {
      setFormMessage({ type: 'error', text: 'Veuillez remplir l\'objet, le message et spécifier la classe.' });
      return;
    }

    setSending(true);
    try {
      const cleanClasse = classeCible.trim().toLowerCase();
      const disciplineProf = user?.matiereEnseignee || 'Matière';
      const enTeteOfficiel = `Message du Professeur de ${disciplineProf} : ${titre.trim()}`;

      // 1. Insertion sur Firestore pour l'affichage permanent dans l'Espace Élève
      await addDoc(collection(db, "notifications"), {
        titre: enTeteOfficiel,
        corps: corps.trim(),
        audience: 'eleve',
        classeId: cleanClasse, 
        schoolId: currentSchool,
        expediteur: `M. ${user.nom} (${disciplineProf})`,
        createdAt: new Date().toISOString(),
        date: dateAujourdhui,
        lusPar: []
      });

      // 2. Récupération instantanée de tous les élèves inscrits dans cette classe spécifique
      const emailQuery = query(
        collection(db, "users"), 
        where("schoolId", "==", currentSchool),
        where("role", "==", "eleve"),
        where("classeId", "==", cleanClasse)
      );
      
      const usersSnapshot = await getDocs(emailQuery);
      
      // 3. Boucle d'envoi vers le serveur d'e-mails asynchrone Node.js
      usersSnapshot.forEach((userDoc) => {
        const student = userDoc.data();
        
        // 🚨 DÉCLENCHEMENT DE L'E-MAIL DE L'ÉLÈVE SI RENSEIGNÉ
        if (student.email) {
          fetch("http://localhost:10000/api/send-email", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_email: student.email.trim(),
              to_name: `${student.prenoms || ''} ${student.nom || ''}`,
              school_name: schoolName,
              subject_title: enTeteOfficiel,
              sender_title: `M. ${user.nom} - Enseignant de ${disciplineProf}`
            })
          })
          .then(res => res.json())
          .then(data => console.log("Confirmation d'envoi e-mail élève :", data))
          .catch(err => console.error("Erreur de liaison backend e-mail :", err));
        }
      });

      setFormMessage({ type: 'success', text: `📢 Communiqué envoyé en direct à la classe ${cleanClasse.toUpperCase()} ! Les notifications par e-mail ont été transmises.` });
      setTitre('');
      setCorps('');
      setClasseCible('');
    } catch (err) {
      console.error(err);
      setFormMessage({ type: 'error', text: 'Erreur réseau lors de l\'envoi.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse">Ouverture du centre d'alertes...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans">
      
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Retour au Bureau Virtuel
        </Link>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-2xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-gray-800">✉️ Centre de Messagerie Enseignant</h2>
          <p className="text-[11px] text-gray-400 font-medium">Consultez les directives de la Direction ou transmettez une alerte à vos classes.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg border w-fit">
          <button 
            onClick={() => setActiveTab('lire')}
            className={`text-[11px] font-extrabold px-3 py-1.5 rounded-md transition uppercase tracking-wider ${activeTab === 'lire' ? 'bg-white text-purple-700 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🔔 Notes Reçues ({messagesRecus.length})
          </button>
          <button 
            onClick={() => setActiveTab('ecrire')}
            className={`text-[11px] font-extrabold px-3 py-1.5 rounded-md transition uppercase tracking-wider ${activeTab === 'ecrire' ? 'bg-white text-purple-700 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ✍️ Alerter une Classe
          </button>
        </div>
      </div>

      {activeTab === 'lire' && (
        <div className="bg-white rounded-xl border p-5 shadow-2xs space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">Directives Officielles et Circulaires</h3>
          {messagesRecus.length === 0 ? (
            <p className="text-xs text-center text-gray-400 py-6 font-medium">Aucun message reçu de la direction pour le moment.</p>
          ) : (
            <div className="space-y-4">
              {messagesRecus.map((notif) => (
                <div key={notif.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition relative">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-black text-gray-900">{notif.titre}</h4>
                    <span className="text-[10px] text-gray-400 font-mono font-bold bg-white border px-2 py-0.5 rounded">{notif.date}</span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-line mb-3">{notif.corps}</p>
                  
                  {notif.pjData && (
                    <a href={notif.pjData} download={notif.pjName} className="inline-flex items-center text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1.5 rounded-md hover:bg-purple-100 transition">
                      📥 Télécharger la pièce : {notif.pjName}
                    </a>
                  )}

                  <div className="mt-3 pt-2 border-t border-dashed border-gray-200 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Émetteur : <span className="text-slate-600">{notif.expediteur || 'La Direction'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ecrire' && (
        <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-700 shadow-xl">
          <h3 className="text-sm font-extrabold text-orange-400 uppercase mb-4">📢 Émettre un Communiqué de Classe</h3>
          
          {formMsg.text && (
            <div className={`p-3 mb-4 rounded-lg text-xs font-bold ${formMsg.type === 'success' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
              {formMsg.text}
            </div>
          )}

          <form onSubmit={handleProfPublishNotification} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input 
                type="text" 
                placeholder="Objet / Titre de l'alerte" 
                value={titre} 
                onChange={(e) => setTitre(e.target.value)} 
                className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" 
              />
              <input 
                type="text" 
                placeholder="Code Classe Élève (Ex: 6eme_1)" 
                value={classeCible} 
                onChange={(e) => setClasseCible(e.target.value)} 
                className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-orange-400 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500" 
                required
              />
            </div>

                        <textarea 
              rows="4" 
              placeholder="Rédigez les consignes, devoirs de maison ou alertes de comportement pour vos élèves..." 
              value={corps} 
              onChange={(e) => setCorps(e.target.value)} 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            ></textarea>

            <button 
              type="submit" 
              disabled={sending} 
              className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold px-6 py-2.5 rounded-lg text-xs uppercase ml-auto block transition disabled:bg-slate-700"
            >
              {sending ? "Envoi..." : "🚀 Diffuser à la classe"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default MessagerieProf;

