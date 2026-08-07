import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext'; // 🟢 FIX : Remonte de 4 niveaux vers le contexte global
import { Link, useParams } from 'react-router-dom';

// Configuration Firebase intégrée
const firebaseConfig = {
  apiKey: "AIzaSyBlbV_ExAmPlE_KeY_LuHaMcOdE_2026",
  authDomain: "://firebaseapp.com",
  projectId: "midnight-9d901",
  storageBucket: "midnight-9d901.firebasestorage.app",
  messagingSenderId: "360989143638",
  appId: "1:360989143638:web:737249c340719924e1c1f7"
};
const localApp = initializeApp(firebaseConfig);
const localDb = getFirestore(localApp);

const RegistreAppelEleves = () => {
  const { user, schoolId, schoolName } = useAuth();
  const { classIdUrl } = useParams();

  const currentClasseId = (classIdUrl || user?.classeId || 'tle_d_1').trim().toLowerCase();
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa').trim().toLowerCase();

  const [listeEleves, setListeEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!currentSchool || !currentClasseId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(localDb, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "==", currentClasseId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setListeEleves(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool, currentClasseId]);

  const handleChangerStatutAssiduite = async (eleve, typeAction) => {
    setToast({ type: '', text: '' });
    const eleveRef = doc(localDb, "users", eleve.id);
    const heureActuelle = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const dateActuelle = new Date().toLocaleDateString('fr-FR');

    try {
      let incAbs = 0; let incRet = 0; let msg = ''; let col = '';
      if (typeAction === 'absent') {
        incAbs = 2;
        msg = `🛑 ${(eleve.nom || '').toUpperCase()} marqué ABSENT(E).`;
        col = 'error';
      } else if (typeAction === 'retard') {
        incRet = 1;
        msg = `🟡 ${(eleve.nom || '').toUpperCase()} signalé(E) en RETARD.`;
        col = 'amber';
      } else {
        msg = `🟢 ${(eleve.nom || '').toUpperCase()} marqué PRÉSENT(E).`;
        col = 'success';
      }

      const totalAbsencesFutur = (eleve.absences || 0) + incAbs;

      await updateDoc(eleveRef, {
        absences: totalAbsencesFutur,
        retards: (eleve.retards || 0) + incRet
      });

      await addDoc(collection(localDb, "registre_appels"), {
        eleveId: eleve.id,
        matricule: eleve.matricule || eleve.id,
        eleveName: `${eleve.nom || ''} ${eleve.prenoms || ''}`.toUpperCase(),
        classeId: currentClasseId,
        schoolId: currentSchool,
        typeStatut: typeAction,
        heureAppel: heureActuelle,
        dateAppel: dateActuelle,
        declarePar: user?.name || "Enseignant",
        createdAt: new Date().toISOString()
      });

      if (typeAction === 'absent' && totalAbsencesFutur > 10 && eleve.emailParent) {
        fetch("http://localhost:10000/api/send-document-alert", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: eleve.emailParent.trim(),
            to_name: `${eleve.prenoms || ''} ${eleve.nom || ''}`.toUpperCase(),
            school_name: schoolName || currentSchool.toUpperCase(),
            type_document: `🛑 CRITIQUE : SEUIL D'ABSENCES DÉPASSÉ (${totalAbsencesFutur} Heures Cumulées)`,
            sender_title: "Bureau de Suivi de la Discipline"
          })
        }).catch(e => console.error(e));
        msg += `\n📧 Alerte automatique expédiée au tuteur (>10H) !`;
      }

      setToast({ type: col, text: msg });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: "💥 Erreur réseau cloud." });
    } finally {
      setTimeout(() => setToast({ type: '', text: '' }), 5000);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Ouverture du cahier d'appel de classe...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen relative animate-fadeIn">
      
      {toast.text && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border-l-4 bg-slate-900 text-xs font-bold ${
          toast.type === 'success' ? 'border-emerald-500 text-emerald-400' :
          toast.type === 'amber' ? 'border-amber-500 text-amber-400' : 'border-red-500 text-red-400'
        }`}>
          <p className="whitespace-pre-line text-left">{toast.text}</p>
        </div>
      )}

      <div className="mb-4 text-left">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Retour au Bureau Virtuel
        </Link>
      </div>

      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md mb-6 text-left">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Cahier d'Appel Électronique</h2>
            <p className="text-xs text-slate-400 mt-1">Enseignant : <span className="text-orange-400 font-bold">{user?.name || "M. GOUZI"}</span> — Établissement : <span className="text-white font-bold uppercase">{schoolName || currentSchool}</span></p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-right">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Division active</p>
            <p className="text-sm font-mono font-black text-orange-400">{currentClasseId.toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex justify-between items-center border-b pb-3 mb-4 font-bold text-xs uppercase text-gray-400">
          <h3>Registre d'appel en temps réel</h3>
          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-[11px] font-black">Effectif : {listeEleves.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                <th className="p-3">Matricule</th>
                <th className="p-3">Nom & Prénoms de l'Élève</th>
                <th className="p-3">Absences Cumulées</th>
                <th className="p-3 text-center">Actions d'Assiduité</th>
              </tr>
            </thead>
            <tbody>
              {listeEleves.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-gray-400 italic">Aucun élève enregistré dans cette classe.</td>
                </tr>
              ) : (
                listeEleves.map((el) => (
                  <tr key={el.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition">
                    <td className="p-3 font-mono text-gray-500 tracking-wide">{el.matricule}</td>
                    <td className="p-3 text-gray-900 uppercase font-black text-left">{el.nom} {el.prenoms || el.prenom || ''}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-mono ${el.absences >= 10 ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-gray-100 text-gray-600'}`}>
                        {el.absences || 0} H / 10H Max
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => handleChangerStatutAssiduite(el, 'present')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black transition cursor-pointer">🟢 Présent</button>
                        <button type="button" onClick={() => handleChangerStatutAssiduite(el, 'absent')} className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/60 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black transition cursor-pointer">🛑 Absent</button>
                        <button type="button" onClick={() => handleChangerStatutAssiduite(el, 'retard')} className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black transition cursor-pointer"> Retard</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default RegistreAppelEleves;
