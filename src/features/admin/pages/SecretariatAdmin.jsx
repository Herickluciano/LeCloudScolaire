import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { jsPDF } from 'jspdf';

const SecretariatAdmin = () => {
  const { schoolId, schoolName, user } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  // --- ÉTATS ---
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' ou 'messages'
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({ eleves: 0, profs: 0, educs: 0, classes: 0, absences: 0 });
  const [loading, setLoading] = useState(true);

  // 🔄 ÉCOUTEUR MULTI-COLLECTIONS EN TEMPS RÉEL
  useEffect(() => {
    if (!currentSchool) return;

    // 1. Écoute des messages/demandes des élèves
    const qMessages = query(collection(db, "messages"), where("schoolId", "==", currentSchool));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMessages(list);
    });

    // 2. Calcul des statistiques globales
    const calculerStats = async () => {
      try {
        const qUsers = query(collection(db, "users"), where("schoolId", "==", currentSchool));
        const qClasses = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
        
        const [usersSnap, classesSnap] = await Promise.all([getDocs(qUsers), getDocs(qClasses)]);
        
        let eleves = 0, profs = 0, educs = 0, totalAbsences = 0;
        usersSnap.forEach(docSnap => {
          const u = docSnap.data();
          if (u.role === 'eleve') {
            eleves++;
            totalAbsences += (u.absences || 0);
          }
          if (u.role === 'professeur' || u.role === 'prof_principal') profs++;
          if (u.role === 'educateur') educs++;
        });

        setStats({
          eleves,
          profs,
          educs,
          classes: classesSnap.size,
          absences: totalAbsences
        });
        setLoading(false);
      } catch (err) {
        console.error("Erreur de calcul analytique :", err);
        setLoading(false);
      }
    };

    calculerStats();
    return () => {
      unsubMessages();
    };
  }, [currentSchool, messages.length]); // Se recalcule si un message change

  // 📜 GÉNÉRATEUR OFFICIEL : Certificat de Fréquentation PDF
  const imprimerCertificatFrequentation = (msg) => {
    const docPdf = new jsPDF();
    
    // En-tête national 🇨🇮
    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(11);
    docPdf.text("RÉPUBLIQUE DE CÔTE D'IVOIRE", 15, 20);
    docPdf.setFontSize(9);
    docPdf.setFont('Helvetica', 'normal');
    docPdf.text("Union - Discipline - Travail", 23, 25);
    docPdf.text("-------------", 32, 29);
    docPdf.setFont('Helvetica', 'bold');
    docPdf.text("MINISTÈRE DE L'ÉDUCATION NATIONALE", 15, 34);
    docPdf.text("ET DE L'ALPHABÉTISATION", 24, 39);

    docPdf.setFont('Helvetica', 'normal');
    docPdf.text(`ANNÉE SCOLAIRE : 2025-2026`, 140, 20);
    docPdf.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 140, 26);

    docPdf.setDrawColor(15, 23, 42);
    docPdf.line(15, 45, 195, 45);

    // Titre du document
    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(18);
    docPdf.setTextColor(211, 84, 0);
    docPdf.text("CERTIFICAT DE FRÉQUENTATION", 105, 65, { align: 'center' });

    // Corps du texte légal
    docPdf.setFont('Helvetica', 'normal');
    docPdf.setFontSize(12);
    docPdf.setTextColor(0, 0, 0);
    
    let texteUsage = `Le Proviseur de l'établissement dénommé ${schoolName || 'Lycée Moderne'}, soussigné, ` +
      `certifie que l'élève nommé(e) ${msg.eleveName || 'Non renseigné'} est inscrit(e) régulier(e) ` +
      `dans notre établissement pour l'année scolaire en cours.\n\n` +
      `Classe d'affectation : ${msg.classeId ? msg.classeId.replace(/_/g, ' ').toUpperCase() : 'N/A'}\n` +
      `Numéro de Matricule MENA : ${msg.eleveId || 'N/A'}\n\n` +
      `En foi de quoi, ce certificat lui est délivré pour servir et valoir ce que de droit.`;

    docPdf.text(docPdf.splitTextToSize(texteUsage, 170), 15, 85);

    // Bloc de signature et tampon automatique
    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(11);
    docPdf.text("Pour l'Administration, Le Proviseur", 130, 150);
    
    // Faux tampon de sécurité numérique
    docPdf.setDrawColor(211, 84, 0);
    docPdf.setLineWidth(0.5);
    docPdf.rect(132, 155, 45, 20);
    docPdf.setFontSize(8);
    docPdf.setTextColor(211, 84, 0);
    docPdf.text("TAMPON NUMÉRIQUE", 154, 164, { align: 'center' });
    docPdf.text("SGS SAAS MIDNIGHT", 154, 169, { align: 'center' });

    docPdf.save(`Certificat_${msg.eleveName?.replace(/\s+/g, '_')}.pdf`);
  };

  // 🟢 ACTION : Traiter la demande sur le Cloud
  const modifierStatutMessage = async (id, nouveauStatut) => {
    try {
      await updateDoc(doc(db, "messages", id), { statut: nouveauStatut });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400">Analyse du secrétariat...</div>;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 font-sans">
      
      {/* 🧭 Onglets de Navigation Intérieurs */}
      <div className="flex border-b mb-6">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition ${activeTab === 'stats' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          📊 Tableau de Bord Analytique
        </button>
        <button 
          onClick={() => setActiveTab('messages')}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition relative ${activeTab === 'messages' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          ✉️ Secrétariat & Courriers ({messages.filter(m => m.statut === 'en_attente').length})
        </button>
      </div>

      {/* ================= CONTENU 1 : STATISTIQUES GLOBALES ================= */}
      {activeTab === 'stats' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <span className="text-xl">🎓</span>
              <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mt-1">Élèves Inscrits</h4>
              <p className="text-2xl font-black text-blue-900 mt-1">{stats.eleves}</p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
              <span className="text-xl">👨‍🏫</span>
              <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mt-1">Enseignants</h4>
              <p className="text-2xl font-black text-purple-900 mt-1">{stats.profs}</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <span className="text-xl">🧑‍💼</span>
              <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">Éducateurs</h4>
              <p className="text-2xl font-black text-emerald-900 mt-1">{stats.educs}</p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <span className="text-xl">🏛️</span>
              <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-1">Classes Ouvertes</h4>
              <p className="text-2xl font-black text-amber-900 mt-1">{stats.classes}</p>
            </div>
          </div>

          <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide">Alerte Assiduité Établissement</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Cumul total des heures de cours manquées par l'ensemble des élèves.</p>
            </div>
            <p className="text-2xl font-mono font-black text-red-600">{stats.absences} H</p>
          </div>
        </div>
      )}

      {/* ================= CONTENU 2 : SECRÉTARIAT NUMÉRIQUE ================= */}
      {activeTab === 'messages' && (
        <div className="space-y-4 animate-fadeIn">
          {messages.length === 0 ? (
            <p className="text-xs font-medium text-gray-400 text-center py-6 border border-dashed rounded-xl">Aucune demande reçue au secrétariat de la direction.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-sm uppercase tracking-wider ${msg.statut === 'valide' ? 'bg-green-100 text-green-700' : msg.statut === 'refuse' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {msg.statut || 'En attente'}
                      </span>
                      <h4 className="text-sm font-bold text-gray-800">{msg.objetMessage}</h4>
                    </div>
                    <p className="text-xs text-gray-600 font-medium italic">"{msg.contenuMessage}"</p>
                                         <p className="text-[10px] text-gray-400 font-bold uppercase">
                      Demandeur : {msg.eleveName} ({msg.eleveId}) — Classe : {msg.classeId?.replace(/_/g, ' ')}
                    </p>
                  </div>

                  {/* 🟢 CORRECTION : Structure des boutons d'actions réactifs réparée */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {msg.statut === 'en_attente' && (
                      <>
                        <button 
                          onClick={() => modifierStatutMessage(msg.id, 'refuse')}
                          className="bg-white hover:bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                        >
                          ❌ Rejeter
                        </button>
                        <button 
                          onClick={() => modifierStatutMessage(msg.id, 'valide')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-2xs transition"
                        >
                          ✅ Valider la demande
                        </button>
                      </>
                    )}
                    
                    {msg.statut === 'valide' && (
                      <button 
                        onClick={() => imprimerCertificatFrequentation(msg)}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1"
                      >
                        🖨️ Imprimer le Certificat
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SecretariatAdmin;
