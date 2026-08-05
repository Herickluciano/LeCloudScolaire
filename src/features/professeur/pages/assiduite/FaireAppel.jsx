import { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';
import { Link } from 'react-router-dom';

const FaireAppel = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  // --- ÉTATS SÉCURISÉS ---
  const [classes, setClasses] = useState([]);
  const [classeSelectionnee, setClasseSelectionnee] = useState('');
  const [eleves, setEleves] = useState([]);
  const [absentsDuJour, setAbsentsDuJour] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // --- ÉTATS DES FILTRES ---
  const [jourSemaine, setJourSemaine] = useState('Lundi');
  const [periodeHeure, setPeriodeHeure] = useState('H1 (07h-08h)');
  const [searchQuery, setSearchQuery] = useState('');

  const dateAujourdhui = new Date().toLocaleDateString('fr-FR');

  // 🔄 1. Écouteur des classes
  useEffect(() => {
    if (!currentSchool) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setClasses(list);
      if (list.length > 0 && !classeSelectionnee) {
        setClasseSelectionnee(list[0].id.replace(`${currentSchool}_`, ''));
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentSchool, classeSelectionnee]);

  // 🔄 2. Écouteur des élèves
  useEffect(() => {
    if (!classeSelectionnee) return;
    const q = query(
      collection(db, "users"), 
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "==", classeSelectionnee)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setEleves(list);
    });
    return () => unsub();
  }, [classeSelectionnee, currentSchool]);

  // 🔄 3. Écouteur des pointages de l'heure
  useEffect(() => {
    if (!classeSelectionnee) return;
    const qAbsences = query(
      collection(db, "registre_appels"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", classeSelectionnee),
      where("jour", "==", jourSemaine),
      where("heure", "==", periodeHeure),
      where("date", "==", dateAujourdhui)
    );
    const unsub = onSnapshot(qAbsences, (snapshot) => {
      const activeAbsences = [];
      snapshot.forEach(docSnap => activeAbsences.push({ id: docSnap.id, ...docSnap.data() }));
      setAbsentsDuJour(activeAbsences);
    });
    return () => unsub();
  }, [classeSelectionnee, jourSemaine, periodeHeure, currentSchool, dateAujourdhui]);

  // 🛠️ MOTEUR D'ÉMARGEMENT À ACTIONS DIRECTES
  const handleSetPresenceStatus = async (student, targetStatus) => {
    const studentRef = doc(db, "users", student.id);
    const enregistrementExistant = absentsDuJour.find(a => a.eleveId === student.id);
    
    let cumulAbsences = student.absences || 0;
    let cumulRetards = student.retards || 0;

    try {
      // CAS DE REPRISE / CORRECTION : Remet l'élève en Présent complet
      if (targetStatus === 'correction') {
        if (!enregistrementExistant) return;

        if (enregistrementExistant.status === 'absent') {
          await updateDoc(studentRef, { absences: cumulAbsences > 0 ? cumulAbsences - 1 : 0 });
        } else if (enregistrementExistant.status === 'retard') {
          await updateDoc(studentRef, { retards: cumulRetards > 0 ? cumulRetards - 1 : 0 });
        }
        await deleteDoc(doc(db, "registre_appels", enregistrementExistant.id));
        setMessage(`🔄 Pointage réinitialisé avec succès pour ${student.nom}.`);
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      // Si l'élève change d'état (ex: de retard à absent)
      if (enregistrementExistant) {
        if (enregistrementExistant.status === 'absent') cumulAbsences = cumulAbsences > 0 ? cumulAbsences - 1 : 0;
        if (enregistrementExistant.status === 'retard') cumulRetards = cumulRetards > 0 ? cumulRetards - 1 : 0;
        await deleteDoc(doc(db, "registre_appels", enregistrementExistant.id));
      }

      // Application des nouveaux calculs
      if (targetStatus === 'absent') {
        await updateDoc(studentRef, { absences: cumulAbsences + 1, retards: cumulRetards });
      } else if (targetStatus === 'retard') {
        await updateDoc(studentRef, { retards: cumulRetards + 1, absences: cumulAbsences });
      }

      // Insertion du log de cours
      await addDoc(collection(db, "registre_appels"), {
        eleveId: student.id,
        eleveName: `${student.nom} ${student.prenoms || student.prenom}`,
        classeId: classeSelectionnee,
        schoolId: currentSchool,
        matiere: user?.matiereEnseignee || "Général",
        profName: user?.nom || "Professeur",
        jour: jourSemaine,
        heure: periodeHeure,
        date: dateAujourdhui,
        status: targetStatus,
        createdAt: new Date().toISOString()
      });

      // E-mail d'urgence uniquement pour les absences
      if (student.email && targetStatus === 'absent') {
        fetch("http://localhost:10000/api/send-email", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: student.email.trim(),
            to_name: `${student.prenoms || ''} ${student.nom || ''}`,
            school_name: schoolName,
            subject_title: `Absence d'urgence : ${jourSemaine} à ${periodeHeure}`,
            sender_title: `M. ${user.nom}`
          })
        }).catch(err => console.error(err));
      }

      setMessage(targetStatus === 'absent' ? `🛑 ${student.nom} marqué ABSENT.` : `🟡 ${student.nom} signalé EN RETARD.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredStudents = eleves.filter(student => {
    const term = searchQuery.toLowerCase();
    return student.nom.toLowerCase().includes(term) || 
           (student.prenoms || '').toLowerCase().includes(term) ||
           student.matricule.toLowerCase().includes(term);
  });

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse">Ouverture de la feuille d'appel...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 font-sans">
      
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
          ⬅️ Bureau Virtuel
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-xs mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-gray-800">📋 Registre d'Appel Horaire Réactif</h2>
          <p className="text-[11px] text-gray-400 font-medium">Sélectionnez le créneau puis émergez la présence civile des apprenants.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
          <select value={classeSelectionnee} onChange={(e) => setClasseSelectionnee(e.target.value)} className="bg-gray-50 border text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
            {classes.map(c => {
              const cleanName = c.id.replace(`${currentSchool}_`, '').toUpperCase();
              return <option key={c.id} value={c.id.replace(`${currentSchool}_`, '')}>Classe : {cleanName}</option>;
            })}
          </select>

          <select value={jourSemaine} onChange={(e) => setJourSemaine(e.target.value)} className="bg-gray-50 border text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-purple-700 cursor-pointer">
            <option value="Lundi">📅 Lundi</option>
            <option value="Mardi">📅 Mardi</option>
            <option value="Mercredi">📅 Mercredi</option>
            <option value="Jeudi">📅 Jeudi</option>
            <option value="Vendredi">📅 Vendredi</option>
            <option value="Samedi">📅 Samedi</option>
          </select>

          <select value={periodeHeure} onChange={(e) => setPeriodeHeure(e.target.value)} className="bg-gray-50 border text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
            <option value="H1 (07h-08h)">H1 (07h-08h)</option>
            <option value="H2 (08h-09h)">H2 (08h-09h)</option>
            <option value="H3 (09h-10h)">H3 (09h-10h)</option>
            <option value="H4 (10h-11h)">H4 (10h-11h)</option>
            <option value="H5 (11h-12h)">H5 (11h-12h)</option>
            <option value="H6 (13h-14h)">H6 (13h-14h)</option>
            <option value="H7 (14h-15h)">H7 (14h-15h)</option>
            <option value="H8 (15h-16h)">H8 (15h-16h)</option>
          </select>
        </div>
      </div>

      {message && <div className="mb-4 p-2.5 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg animate-pulse">{message}</div>}

      <div className="mb-4 relative">
        <input 
          type="text"
          placeholder="🔍 Rechercher rapidement un élève pour ajuster son pointage..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl p-3 pl-10 text-xs font-bold text-gray-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
        />
                <span className="absolute left-3.5 top-3.5 text-gray-400 text-xs">🔍</span>
      </div>

      {/* FEUILLE D'ÉMARGEMENT FILTRÉE */}
      <div className="bg-white border rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2 mb-3">
          Feuille d'émargement — {jourSemaine} ({filteredStudents.length} Affichés)
        </h3>
        
        {filteredStudents.length === 0 ? (
          <p className="text-xs text-center text-gray-400 py-8 font-bold">❌ Aucun élève ne correspond à cette recherche.</p>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto pr-1">
            {filteredStudents.map((student) => {
              const billetSeance = absentsDuJour.find(a => a.eleveId === student.id);
              const estAbsent = billetSeance?.status === 'absent';
              const estEnRetard = billetSeance?.status === 'retard';
              const aUneAnomalie = !!billetSeance;
              
              return (
                <div key={student.id} className={`py-3 flex flex-col md:flex-row justify-between md:items-center text-xs px-2 rounded-lg transition gap-3 ${
                  estAbsent ? 'bg-red-50/30' : estEnRetard ? 'bg-amber-50/30' : 'bg-white'
                }`}>
                  <div>
                    <p className="font-black text-gray-800 uppercase">
                      {student.nom} <span className="font-normal lowercase first-letter:uppercase text-gray-600">{student.prenoms || student.prenom}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">Matricule : {student.matricule}</p>
                    <div className="flex gap-3 text-[10px] text-slate-400 font-bold mt-0.5">
                      <span>Absences : <strong className={student.absences > 4 ? "text-red-600" : "text-gray-600"}>{student.absences || 0}H</strong></span>
                      <span>Retards cumulés : <strong className="text-amber-600">{student.retards || 0}</strong></span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 self-end md:self-auto">
                    {/* BUTTON 1 : REPRENDRE / CORRIGER */}
                    <button 
                      type="button"
                      disabled={!aUneAnomalie}
                      onClick={() => handleSetPresenceStatus(student, 'correction')}
                      className={`font-black text-[10px] uppercase px-2.5 py-1.5 rounded-lg border transition ${
                        aUneAnomalie 
                          ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 cursor-pointer' 
                          : 'bg-gray-50 text-gray-300 border-gray-100 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      🔄 Corriger
                    </button>

                    {/* BUTTON 2 : RETARD */}
                    <button 
                      type="button"
                      onClick={() => handleSetPresenceStatus(student, 'retard')}
                      className={`font-black text-[10px] uppercase px-3 py-1.5 rounded-lg border transition min-w-[70px] ${
                        estEnRetard 
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs font-black' 
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-amber-50 hover:text-amber-600'
                      }`}
                    >
                      Retard
                    </button>

                    {/* BUTTON 3 : ABSENT */}
                    <button 
                      type="button"
                      onClick={() => handleSetPresenceStatus(student, 'absent')}
                      className={`font-black text-[10px] uppercase px-3 py-1.5 rounded-lg border transition min-w-[70px] ${
                        estAbsent 
                          ? 'bg-red-600 text-white border-red-600 shadow-2xs font-black' 
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      Absent
                    </button>
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

export default FaireAppel;
