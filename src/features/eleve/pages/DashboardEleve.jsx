import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc 
} from 'firebase/firestore';

import NotificationCentre from '../../../component/Shared/NotificationCentre.jsx';

const DashboardEleve = () => {
  const { user, schoolName, logout } = useAuth();

  const identifiantEleve = user?.matricule || user?.id;
  const currentSchool = user?.schoolId || 'lycee_Moderne_Gagnoa';
  const statutActuel = (user?.statut || "actif").trim().toLowerCase();

  // --- ÉTATS ACADÉMIQUES & MESSAGERIE ---
  const [trimestre, setTrimestre] = useState("1");
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [documentsPrives, setDocumentsPrives] = useState([]);
  const [messagesRecus, setMessagesRecus] = useState([]); // 🟢 Stockage des messages filtrés de l'élève

  // --- FORMULAIRE REQUÊTE ---
  const [objet, setObjet] = useState("Demande de Certificat de Fréquentation");
  const [motif, setMotif] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestMsg, setRequestMsg] = useState({ type: "", text: "" });

  const accesAutorise = statutActuel === "actif";

  // ==========================================
  // 🔄 1. CHARGEMENT DES NOTES SÉCURISÉES
  // ==========================================
  useEffect(() => {
    if (!accesAutorise || !identifiantEleve) {
      setNotes([]);
      setLoadingNotes(false);
      return;
    }
    const q = query(
      collection(db, "notes"),
      where("schoolId", "==", currentSchool),
      where("eleveId", "==", identifiantEleve)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const liste = [];
      snapshot.forEach(doc => {
        liste.push({ id: doc.id, ...doc.data() });
      });
      setNotes(liste);
      setLoadingNotes(false);
    }, error => {
      console.error("Erreur chargement notes :", error);
      setLoadingNotes(false);
    });

    return () => unsubscribe();
  }, [identifiantEleve, currentSchool, accesAutorise]);

  // ==========================================
  // 🔄 2. CHARGEMENT DES PIÈCES JOINTES PRIVÉES
  // ==========================================
  useEffect(() => {
    if (!accesAutorise || !identifiantEleve) {
      setDocumentsPrives([]);
      return;
    }
    const qDoc = query(
      collection(db, "documents_prives"),
      where("schoolId", "==", currentSchool),
      where("eleveId", "==", identifiantEleve)
    );

    const unsubscribe = onSnapshot(qDoc, snapshot => {
      const liste = [];
      snapshot.forEach(doc => {
        liste.push({ id: doc.id, ...doc.data() });
      });
      liste.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDocumentsPrives(liste);
    });

    return () => unsubscribe();
  }, [identifiantEleve, currentSchool, accesAutorise]);

  // ==========================================
  // 🔄 3. 🟢 ÉCOUTEUR CLOISONNÉ ÉTANCHEMENT DES MESSAGES ENVOYÉS
  // ==========================================
  useEffect(() => {
    if (!accesAutorise || !identifiantEleve) {
      setMessagesRecus([]);
      return;
    }
    // L'élève ne capte strictement que les messages liés à son identifiant unique
    const qMsg = query(
      collection(db, "messages"),
      where("schoolId", "==", currentSchool),
      where("eleveId", "==", identifiantEleve)
    );

    const unsubscribe = onSnapshot(qMsg, snapshot => {
      const liste = [];
      snapshot.forEach(doc => {
        liste.push({ id: doc.id, ...doc.data() });
      });
      liste.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMessagesRecus(liste);
    }, error => {
      console.error("Erreur écoute messages élève :", error);
    });

    return () => unsubscribe();
  }, [identifiantEleve, currentSchool, accesAutorise]);

  // ==========================================
  // 🚀 4. SOUVENT ÉMIS DU GUICHET UNIQUE VERS L'ADMIN
  // ==========================================
  const handleSendSecretariatRequest = async (e) => {
    e.preventDefault();
    setRequestMsg({ type: '', text: '' });

    if (!motif.trim()) {
      setRequestMsg({ type: 'error', text: 'Veuillez préciser le motif de votre demande.' });
      return;
    }

    setSendingRequest(true);
    try {
      await addDoc(collection(db, "messages"), {
        eleveId: identifiantEleve,
        eleveName: `${user?.nom || ''} ${user?.prenoms || user?.prenom || ''}`,
        matricule: identifiantEleve,
        classeId: user?.classeId || '5eme_1',
        schoolId: currentSchool,
        objetMessage: objet,
        contenuMessage: motif.trim(),
        statut: "en_attente",
        createdAt: new Date().toISOString(),
        expediteurRole: "eleve"
      });

      setRequestMsg({ type: 'success', text: '🎯 Votre demande a été transmise au secrétariat.' });
      setMotif('');
    } catch (error) {
      console.error("Erreur envoi demande administrative :", error);
      setRequestMsg({ type: 'error', text: 'Erreur lors de la transmission.' });
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn">
      {!accesAutorise ? (
        <div className="max-w-xl mx-auto mt-20 bg-white rounded-2xl shadow-lg border border-red-200 p-8 text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-black text-red-700 uppercase mb-3">Accès portail suspendu</h1>
          <p className="text-sm text-gray-600 font-semibold">Votre compte élève n'est pas autorisé à accéder aux services numériques.</p>
          <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-black text-red-800 uppercase">Statut actuel :</p>
            <p className="text-lg font-black text-red-600 uppercase mt-1">{user?.statut || 'suspendu'}</p>
          </div>
        </div>
      ) : (
        <>
          {/* ================= EN-TÊTE PROFIL ================= */}
          <div className="max-w-7xl mx-auto bg-white border border-gray-100 rounded-2xl p-6 shadow-xs mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🎓</span>
                <span className="text-xs font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-md">Espace Élève Connecté</span>
              </div>
              <h1 className="text-2xl font-black text-gray-800 tracking-tight mt-2 uppercase">
                {user?.nom} <span className="font-normal lowercase first-letter:uppercase text-gray-600 ml-2">{user?.prenoms || user?.prenom}</span>
              </h1>
              <p className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-wide">
                🏛️ {schoolName} — MATRICULE : <span className="font-mono text-gray-700">{identifiantEleve}</span> — CLASSE : <span className="text-orange-500 font-extrabold">{(user?.classeId || '5eme_1').toUpperCase()}</span>
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>
              <div>
                <h4 className="text-[10px] font-bold text-emerald-600 uppercase">Statut d'accès</h4>
                <p className="text-sm font-black text-emerald-900 uppercase">Autorisé</p>
              </div>
            </div>
          </div>

          {/* ================= CONTENU CORE DASHBOARD ================= */}
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              
              {/* NOTES TRIMESTRIELLES */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">📝 Relevé Continu des Notes</h3>
                  <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} className="bg-gray-50 border text-xs font-bold rounded-lg p-1.5 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer">
                    <option value="1">1er Trimestre</option>
                    <option value="2">2ème Trimestre</option>
                    <option value="3">3ème Trimestre</option>
                  </select>
                </div>

                {loadingNotes ? (
                  <p className="text-xs text-center py-6 text-gray-400 font-bold animate-pulse">Chargement de votre livret...</p>
                ) : notes.length === 0 ? (
                  <p className="text-xs text-center py-6 text-gray-400 font-medium">Aucune note répertoriée.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-bold border-collapse">
                      <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b">
                        <tr><th className="p-3">Discipline</th><th className="p-3 text-center">Type</th><th className="p-3 text-center">Note</th></tr>
                      </thead>
                                            <tbody className="divide-y text-gray-700">
                        {notes.map((n) => (
                          <tr key={n.id} className="hover:bg-gray-50/40 transition">
                            <td className="p-3 font-black uppercase text-gray-900">{n.matiere}</td>
                            <td className="p-3 text-center text-gray-400">{n.typeEvaluation || "Devoir"}</td>
                            <td className="p-3 text-center font-mono text-base text-purple-700 font-black">
                              {n.valeur !== undefined && n.valeur !== null ? `${parseFloat(n.valeur).toFixed(2)} / 20` : "-- / 20"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 📥 SECTION SCELLÉE DES BULLETINS (SANS GPS) */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">📥 Téléchargement des Bulletins Officiels</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs hover:border-orange-500/30 transition">
                  <div>
                    <h4 className="text-sm font-black text-gray-800">📊 Livret Scolaire Trimestriel — T{trimestre}</h4>
                    <p className="text-[11px] text-emerald-600 font-bold mt-1">Statut : Prêt à l'impression</p>
                  </div>
                  <button type="button" onClick={() => alert("📥 Extraction du fichier PDF... Génération en cours.")} className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer shadow-xs">
                    📥 Extraire
                  </button>
                </div>
              </div>

              {/* 🟢 CLOISONNÉ : BOÎTE DE RÉCEPTION PERSONNELLE DES REQUÊTES ENVOYÉES */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">✉️ Historique Privé de mes Demandes au Secrétariat</h3>
                </div>
                {messagesRecus.length === 0 ? (
                  <p className="text-xs text-center text-gray-400 py-4 font-medium">Aucun courrier envoyé dans vos archives personnelles.</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {messagesRecus.map((m) => (
                      <div key={m.id} className="p-3 bg-gray-50 border rounded-xl flex justify-between items-center text-xs font-bold">
                        <div>
                          <p className="text-gray-900 uppercase">{m.objetMessage}</p>
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">Soumis le : {new Date(m.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-black ${
                          m.statut === 'en_attente' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {m.statut === 'en_attente' ? 'En étude' : 'Traité'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* COLONNE DROITE */}
            <div className="space-y-8">
              <NotificationCentre />

              {/* ENVOI REQUÊTE SÉCURISÉ */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">📜 Guichet Unique Administratif</h3>
                </div>
                {requestMsg.text && (
                  <div className={`mb-4 p-2.5 text-xs font-bold rounded-lg border-l-4 ${
                    requestMsg.type === 'success' ? 'bg-emerald-950 text-emerald-400 border-emerald-500' : 'bg-red-950 text-red-400 border-red-500'
                  }`}>
                    {requestMsg.text}
                  </div>
                )}
                
                <form onSubmit={handleSendSecretariatRequest} className="space-y-4 text-xs font-bold text-gray-700">
                  <div>
                    <label className="block text-gray-400 uppercase mb-1">Pièce demandée</label>
                    <select value={objet} onChange={(e) => setObjet(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer focus:ring-2 focus:ring-orange-500">
                      <option value="Demande de Certificat de Fréquentation">📜 Certificat de Fréquentation & Scolarité</option>
                      <option value="Demande de Relevé Provisoire">📊 Relevé de Notes Provisoire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 uppercase mb-1">Justificatif détaillé</label>
                    <textarea rows="4" placeholder="Ex: Motif..." value={motif} onChange={(e) => setMotif(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 font-medium"></textarea>
                  </div>
                  <button type="submit" disabled={sendingRequest} className="w-full bg-slate-900 text-orange-400 font-black py-2.5 rounded-xl uppercase tracking-wider transition disabled:bg-gray-300 cursor-pointer">
                    {sendingRequest ? "Acheminement..." : "🚀 Soumettre ma demande"}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};

export default DashboardEleve;
