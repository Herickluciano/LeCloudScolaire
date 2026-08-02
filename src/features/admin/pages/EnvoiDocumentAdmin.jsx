import { useState } from 'react';
import { db } from '../../../services/api';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const EnvoiDocumentAdmin = () => {
  const { schoolName, schoolId, user } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  const [matricule, setMatricule] = useState('');
  const [typeDoc, setTypeDocument] = useState('Bulletin de Notes');
  const [noteTxt, setNoteTxt] = useState('');
  const [fileBase64, setFileBase64] = useState(null);
  const [fileName, setFileName] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Fichier trop lourd (Max 2Mo)");
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setFileBase64(reader.result);
  };

  const handleSendDocument = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    if (!matricule.trim() || !fileBase64) {
      setMsg({ type: 'error', text: 'Veuillez saisir un matricule valide et joindre un fichier.' });
      return;
    }

    setSending(true);
    try {
      // 1. Vérification de l'existence de l'élève sur Firestore
      const targetMatricule = matricule.trim().toUpperCase();
      const studentSnap = await getDoc(doc(db, "users", targetMatricule));

      if (!studentSnap.exists() || studentSnap.data().schoolId !== currentSchool) {
        setMsg({ type: 'error', text: '❌ Ce matricule élève n\'existe pas dans votre établissement.' });
        setSending(false);
        return;
      }

      const studentData = studentSnap.data();

      // 2. Stockage de la pièce dans l'Armoire à documents privée de l'élève
      await addDoc(collection(db, "documents_prives"), {
        eleveId: targetMatricule,
        schoolId: currentSchool,
        type: typeDoc,
        titre: fileName,
        commentaire: noteTxt.trim() || "Aucune note explicative rattachée.",
        fileData: fileBase64,
        date: new Date().toLocaleDateString('fr-FR'),
        createdAt: new Date().toISOString()
      });

      // 3. Appel asynchrone instantané vers l'API de notification par e-mail
      if (studentData.email) {
        fetch("http://localhost:10000/api/send-document-alert", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: studentData.email.trim(),
            to_name: `${studentData.prenoms || ''} ${studentData.nom || ''}`,
            school_name: schoolName,
            type_document: typeDoc,
            sender_title: user.name || "La Direction"
          })
        }).catch(err => console.error(err));
      }

      setMsg({ type: 'success', text: `📢 Document archivé sur l'espace de ${studentData.nom} et notifié par mail !` });
      setMatricule('');
      setNoteTxt('');
      setFileBase64(null);
      setFileName('');
      document.getElementById('docInput').value = '';
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Erreur lors de la transmission.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-700 shadow-xl">
      <h3 className="text-sm font-black text-orange-400 uppercase mb-4 flex items-center gap-2">📂 Dépôt de Documents Confidentiels individualisés</h3>
      {msg.text && <div className={`p-3 mb-4 rounded-lg text-xs font-bold ${msg.type === 'success' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>{msg.text}</div>}
      
      <form onSubmit={handleSendDocument} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Matricule de l'Élève (Ex: 26_6450P)" value={matricule} onChange={(e) => setMatricule(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white uppercase outline-none focus:ring-2 focus:ring-orange-500" />
          
          <select value={typeDoc} onChange={(e) => setTypeDocument(e.target.value)} className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-orange-400 font-bold outline-none focus:ring-2 focus:ring-orange-500">
            <option value="Bulletin de Notes Officiel">📊 Bulletin de Notes du Trimestre</option>
            <option value="Convocation Officielle">🛑 Convocation Disciplinaire</option>
            <option value="Fiche de Justification d'Absences">📝 Justificatif d'Absence</option>
            <option value="Document Administratif Personnel">🗂️ Autre Document Civil Personnel</option>
          </select>
        </div>

        <input type="text" placeholder="Note explicative / Commentaire de la direction (Optionnel)" value={noteTxt} onChange={(e) => setNoteTxt(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500" />

        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
          <input id="docInput" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} className="text-xs text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer" />
        </div>

        <button type="submit" disabled={sending} className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold px-6 py-2.5 rounded-lg text-xs uppercase ml-auto block transition disabled:bg-slate-700">{sending ? "Dépôt..." : "🚀 Envoyer à l'élève"}</button>
      </form>
    </div>
  );
};

export default EnvoiDocumentAdmin;
