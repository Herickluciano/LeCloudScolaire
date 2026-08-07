import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom'; 
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';

const NotificationCentre = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMessage] = useState({ type: '', text: '' });

  // 🟢 ÉTATS POUR LA PIÈCE JOINTE DÉPLOYÉE
  const [fileBase64, setFileBase64] = useState(null);
  const [fileName, setFileName] = useState('');

  // 🔄 ÉCOUTEUR RÉACTIF FLUX DES ALERTES FIRESTORE
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("schoolId", "==", currentSchool));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const matchesAudience = data.audience === 'all' || data.audience === user.role;
        if (user.role === 'admin' || matchesAudience) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, currentSchool]);

  // 🟢 TRAITEMENT DU FICHIER : Conversion instantanée en Base64 pour le Cloud
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // Limite technique de sécurité de 2 Mo
      alert("⚠️ Ce fichier est trop lourd. Veuillez choisir un document de moins de 2 Mo.");
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setFileBase64(reader.result); // Capture la chaîne base64
    };
    reader.onerror = (error) => {
      console.error("Erreur de conversion du fichier :", error);
    };
  };

  // 🚀 EXPÉDITION ASYNCHRONE DES NOTIFICATIONS EMAILS AVEC PIÈCE JOINTE
  const handlePublishNotification = async (e) => {
    e.preventDefault();
    setFormMessage({ type: '', text: '' });
    if (!titre.trim() || !corps.trim()) {
      setFormMessage({ type: 'error', text: 'Veuillez remplir tous les champs.' });
      return;
    }
    setSending(true);
    try {
      // 1. Insertion sur Firestore pour consultation ultérieure dans les espaces
      await addDoc(collection(db, "notifications"), {
        titre: titre.trim(),
        corps: corps.trim(),
        audience: audience,
        schoolId: currentSchool,
        expediteur: user.name || "Direction",
        createdAt: new Date().toISOString(),
        date: new Date().toLocaleDateString('fr-FR'),
        pjName: fileName || null,
        pjData: fileBase64 || null, // Sauvegarde de la pièce jointe en BDD
        lusPar: []
      });

      // 2. Détermination de la cible sur la table globale des profils users
      const emailQuery = audience === 'all' 
        ? query(collection(db, "users"), where("schoolId", "==", currentSchool))
        : query(collection(db, "users"), where("schoolId", "==", currentSchool), where("role", "==", audience));
      
      const usersSnapshot = await getDocs(emailQuery);
      
      // 3. Boucle d'envoi non-bloquante vers l'API asynchrone locale du backend Node.js
      usersSnapshot.forEach((userDoc) => {
        const target = userDoc.data();
        
        if (target.email) {
          fetch("http://localhost:10000/api/send-email", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_email: target.email.trim(),
              to_name: `${target.prenoms || ''} ${target.nom || ''}`,
              school_name: schoolName,
              subject_title: titre.trim(),
              sender_title: user.name || "La Direction",
              attachmentData: fileBase64, // 🟢 Transmet le fichier converti
              attachmentName: fileName    // 🟢 Transmet le nom du fichier
            })
          })
          .then(res => res.json())
          .then(resData => console.log("Statut envoi backend :", resData))
          .catch(err => console.error("Erreur appel local node :", err));
        }
      });

      setFormMessage({ type: 'success', text: '📢 Alerte diffusée ! Le fichier et l\'invitation par e-mail ont été traités avec succès.' });
      setTitre('');
      setCorps('');
      setFileBase64(null);
      setFileName('');
      document.getElementById('fileInput').value = ''; // Nettoie le champ input fichier
    } catch (err) {
      setFormMessage({ type: 'error', text: 'Erreur réseau lors du stockage cloud.' });
    } finally {
      setSending(false);
    }
  };

  const marquerCommeLu = async (notif) => {
    if (notif.lusPar?.includes(user.id)) return;
    try {
      await updateDoc(doc(db, "notifications", notif.id), {
        lusPar: [...(notif.lusPar || []), user.id]
      });
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400">Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans">
      <div className="mb-4">
        
      </div>

      {user?.role === 'admin' && (
        <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-700 shadow-xl mb-8">
          <h3 className="text-base font-extrabold text-orange-400 uppercase mb-4 flex items-center gap-2">📢 Diffuser un message</h3>
          {formMsg.text && <div className="p-3 mb-4 rounded-lg text-xs font-bold bg-emerald-950 text-emerald-400">{formMsg.text}</div>}
          <form onSubmit={handlePublishNotification} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" placeholder="Titre de la Notification" value={titre} onChange={(e) => setTitre(e.target.value)} className="md:col-span-2 bg-slate-800 border rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className="bg-slate-800 border rounded-lg p-2.5 text-sm text-orange-400 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="all">🌍 Tout l'Établissement</option>
                <option value="professeur">👨‍🏫 Enseignants</option>
                <option value="educateur">🧑‍💼 Éducateurs</option>
                <option value="eleve">🎓 Élèves</option>
              </select>
            </div>
            
            <textarea rows="3" placeholder="Rédigez votre communiqué..." value={corps} onChange={(e) => setCorps(e.target.value)} className="w-full bg-slate-800 border rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"></textarea>
            
            {/* 🟢 ACTION D'IMPORTATION DE FICHIER DEPUIS L'ORDINATEUR */}
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Joindre un document officiel (Optionnel, Max 2Mo)</label>
              <input 
                id="fileInput"
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                onChange={handleFileChange}
                className="text-xs text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-orange-500 file:text-white hover:file:bg-orange-600 file:cursor-pointer cursor-pointer"
              />
              {fileName && <p className="text-[11px] text-orange-400 font-mono mt-1">📎 Fichier chargé : {fileName}</p>}
            </div>

            <button type="submit" disabled={sending} className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold px-6 py-2.5 rounded-lg text-xs uppercase ml-auto block shadow-md transition disabled:bg-slate-700">
              {sending ? "Envoi..." : "🚀 Diffuser"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border p-6">
        <h3 className="text-base font-black text-gray-800 border-b pb-3 mb-4">🔔 Liste des Communications Officielles</h3>
        {notifications.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Aucun message.</p> : (
          <div className="space-y-4">
            {notifications.map((notif) => {
              const estLu = user?.role === 'admin' || notif.lusPar?.includes(user?.id);
              return (
                <div key={notif.id} onClick={() => marquerCommeLu(notif)} className={`p-4 rounded-xl border transition cursor-pointer relative ${estLu ? 'bg-gray-50 border-gray-100 opacity-75' : 'bg-white border-orange-200 shadow-sm'}`}>
                  {!estLu && <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-orange-500"></span>}
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-black text-gray-900">{notif.titre}</h4>
                    <span className="text-[10px] text-gray-400 font-mono font-bold bg-gray-50 px-2 py-0.5 rounded">{notif.date}</span>
                  </div>
                                    <p className="text-xs text-gray-600 whitespace-pre-line mb-2">
                    {notif.corps}
                  </p>
                  
                  {/* 🟢 AFFICHAGE DU LIEN DE TÉLÉCHARGEMENT DU DOCUMENT SI COMPTE RENDU EXISTE */}
                  {notif.pjData && (
                    <div className="mt-2">
                      <a 
                        href={notif.pjData} 
                        download={notif.pjName || 'Document_Officiel'}
                        onClick={(e) => e.stopPropagation()} // Évite de marquer comme lu lors du téléchargement
                        className="inline-flex items-center text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-md transition border border-orange-200"
                      >
                        📥 Télécharger la pièce jointe : {notif.pjName}
                      </a>
                    </div>
                  )}

                  <div className="mt-4 pt-2.5 border-t border-dashed border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    <span>Par : <strong className="text-gray-600">{notif.expediteur}</strong></span>
                    <span className="font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      Cible : {notif.audience}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default NotificationCentre;
