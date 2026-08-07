import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// 🟢 RECTIFICATION DES CHEMINS : Remontée de 4 niveaux depuis assiduite/
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../services/api';

const MonPointage = () => {
  const { user, schoolId, schoolName } = useAuth();
  
  // Normalisation stricte de la casse de l'école pour s'aligner sur l'éducateur
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

  const [historique, setHistorique] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [pointageActif, setPointageActif] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const dateAujourdhui = new Date().toLocaleDateString('fr-FR');
  
  // 🟢 CORRECTIF IDENTIFIANT UNIQUE : On extrait rigoureusement le matricule Firebase 'PROF_BLEGUY_978'
  const idProfFixe = (user?.matricule || user?.id || "PROF_SECOURS").trim();
  const nomProfFixe = (user?.name || user?.nom || "BLEGUY Eric Luciano").trim();

  // 🔄 ÉCOUTEUR 1 : Chargement des divisions rattachées à l'école
  useEffect(() => {
    if (!currentSchool) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setClasses(list);
      if (list.length > 0 && !selectedClasse) {
        setSelectedClasse(list[0].id.replace(`${currentSchool}_`, ''));
      }
    });
    return () => unsub();
  }, [currentSchool, selectedClasse]);

  // 🔄 ÉCOUTEUR 2 : Synchronisation en temps réel de l'historique personnel du prof
  useEffect(() => {
    if (!idProfFixe) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "pointages_professeurs"),
      where("schoolId", "==", currentSchool),
      where("profId", "==", idProfFixe)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      let pointageEnCours = null;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item = { id: docSnap.id, ...data };
        list.push(item);
        if (data.statut === 'en_cours') {
          pointageEnCours = item;
        }
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistorique(list);
      setPointageActif(pointageEnCours); 
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentSchool, idProfFixe]);

  // 🚀 ACTION : Émargement d'Arrivée (Ouvre une vacation en cours)
  const handleArrivee = async () => {
    if (!selectedClasse) {
      alert("⚠️ Veuillez sélectionner une classe.");
      return;
    }

    const tokenAppareilClasse = localStorage.getItem('sgs_terminal_autorise') || `${currentSchool}_pc_virtual_bypass_hardware`;

    try {
      const heureActuelle = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      // Enregistrement de la ligne de vacation avec les clés partagées de l'éducateur
      await addDoc(collection(db, "pointages_professeurs"), {
        profId: idProfFixe,          // Écrira strictement 'PROF_BLEGUY_978'
        profName: nomProfFixe,       // Écrira strictement 'BLEGUY Eric Luciano'
        professeurId: idProfFixe,    // Double sécurité de mapping pour l'éducateur
        professeurName: nomProfFixe,  // Double sécurité de mapping pour l'éducateur
        matiere: user?.matiereEnseignee || "Français",
        schoolId: currentSchool,
        classeId: selectedClasse.trim().toLowerCase(),
        terminalId: tokenAppareilClasse,
        date: dateAujourdhui, 
        heureArrivee: heureActuelle,
        heureDepart: '--:--',
        heuresEffectuees: 0,
        statut: 'en_cours',
        createdAt: new Date().toISOString()
      });
      setMessage(`⏱️ Arrivée certifiée en ligne à ${heureActuelle} !`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  // 🚀 ACTION : Émargement de Départ (Clôture et calcule le volume horaire)
  const handleDepart = async () => {
    if (!pointageActif) return;
    try {
      const heureDepart = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const [hA, mA] = pointageActif.heureArrivee.split(':').map(Number);
      const [hD, mD] = heureDepart.split(':').map(Number);
      const minutesArrivee = hA * 60 + mA;
      const minutesDepart = hD * 60 + mD;
      const dureeMinutes = minutesDepart - minutesArrivee;
      const heuresCalculees = Math.max(0.5, parseFloat((dureeMinutes / 60).toFixed(2)));

      await updateDoc(doc(db, "pointages_professeurs", pointageActif.id), {
        heureDepart: heureDepart,
        heuresEffectuees: heuresCalculees,
        statut: 'cloture',
        statutVacation: 'certifiee_cloud'
      });
      setMessage(`🛬 Séance close. Volume comptabilisé : ${heuresCalculees} H.`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse">Ouverture de l'horloge...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans text-gray-700 text-left animate-fadeIn">
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
          ⬅️ Bureau Virtuel
        </Link>
      </div>
      
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-2xs mb-6 text-left">
        <h2 className="text-base font-black text-gray-800">⏱️ Émargement des Vacations Numériques</h2>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5">Vos pointages certifient vos heures de cours en temps réel.</p>
      </div>

      {message && <div className="mb-6 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500 animate-pulse text-left">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border flex flex-col justify-between shadow-2xs">
          <div className="text-left">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Classe en cours</label>
            <select disabled={!!pointageActif} value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 text-xs font-bold text-gray-800 outline-none cursor-pointer">
              {classes.map(c => <option key={c.id} value={c.id.replace(`${currentSchool}_`, '')}>{c.id.replace(`${currentSchool}_`, '').toUpperCase()}</option>)}
              {classes.length === 0 && <option value="tle_d_1">TLE D 1</option>}
            </select>
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-around gap-6 border border-slate-800">
          {!pointageActif ? (
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-md">Prêt pour émargement</span>
              <h3 className="text-base font-extrabold mt-2 text-white">Aucun cours actif</h3>
              <button onClick={handleArrivee} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl transition shadow-md cursor-pointer">🛫 Émarger mon Arrivée</button>
            </div>
          ) : (
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-black uppercase text-orange-400 bg-orange-950 px-2.5 py-0.5 rounded-md animate-pulse">Cours en cours...</span>
              <h3 className="text-base font-extrabold mt-2 text-white">Classe : {pointageActif.classeId.toUpperCase()}</h3>
              <p className="text-xs text-slate-400 mt-1">Arrivée validée à : <strong className="text-white font-mono">{pointageActif.heureArrivee}</strong></p>
              <button onClick={handleDepart} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl transition shadow-md cursor-pointer">🛬 Émarger mon Départ</button>
            </div>
          )}
          <div className="text-center border-l border-slate-800 pl-6 hidden sm:block">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date Séance</p>
            <p className="text-sm font-mono font-black text-orange-400 mt-1">{dateAujourdhui}</p>
          </div>
        </div>
      </div>

      {/* HISTORIQUE DE TOUTES LES SÉANCES POINTÉES */}
      <div className="bg-white rounded-2xl border shadow-xs overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Registre de vos vacations émargées</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
                        <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                <th className="p-3">Date</th>
                <th className="p-3">Classe</th>
                <th className="p-3 text-center">Arrivée</th>
                <th className="p-3 text-center">Départ</th>
                <th className="p-3 text-right">Volume Horaire</th>
              </tr>
            </thead>
            <tbody>
              {historique.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-400 italic">
                    Aucune séance consignée dans votre historique.
                  </td>
                </tr>
              ) : (
                historique.map((h) => (
                  <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                    <td className="p-3 font-mono text-gray-500">{h.date}</td>
                    <td className="p-3 text-purple-700 uppercase font-black">{h.classeId?.toUpperCase()}</td>
                    <td className="p-3 text-center font-mono text-gray-600">{h.heureArrivee}</td>
                    <td className="p-3 text-center font-mono text-gray-600">{h.heureDepart}</td>
                    <td className="p-3 text-right font-mono text-gray-900">
                      <span className="bg-slate-100 px-2 py-0.5 rounded">{h.heuresEffectuees} H</span>
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

export default MonPointage;
