import { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const DashboardPP = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  // --- ÉTATS ---
  const [eleves, setEleves] = useState([]);
  const [classeNom, setClasseNom] = useState('5EME 1');
  const [loading, setLoading] = useState(true);
  const [trimestre] = useState('1');

  // --- STATISTIQUES CALCULÉES ---
  const [stats, setStats] = useState({
    totalEleves: 0,
    moyenneGenerale: 0,
    totalAbsences: 0,
    elevesEnDanger: 0
  });

  // 🔄 ÉCOUTEUR EN TEMPS RÉEL (onSnapshot) : Synthèse de la classe du Titulaire
  useEffect(() => {
    const maClasseId = user?.classeId || '5eme_1'; 

    const q = query(
      collection(db, "users"),
      where("role", "==", "eleve"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", maClasseId.trim().toLowerCase())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      let sommeMoyennes = 0;
      let countMoyennes = 0;
      let cumulAbsences = 0;
      let enDanger = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data });

        cumulAbsences += (data.absences || 0);

        if (data.absences > 4) enDanger++;

        const moy = data.moyennesTrimestrielles?.[`trimestre_${trimestre}`];
        if (moy !== undefined && moy !== null) {
          sommeMoyennes += parseFloat(moy);
          countMoyennes++;
        }
      });

      setEleves(list);
      setStats({
        totalEleves: list.length,
        moyenneGenerale: countMoyennes > 0 ? parseFloat((sommeMoyennes / countMoyennes).toFixed(2)) : 0,
        totalAbsences: cumulAbsences,
        elevesEnDanger: enDanger
      });
      // 📡 SYNC DE SÉCURITÉ : Vérification du seuil d'absences hebdomadaires (10 Heures)
const verifierEtAlerterParent = async (eleveData) => {
  const heuresAbsences = eleveData.absences || 0;
  const emailDuParent = eleveData.emailParent;

  // Si l'élève atteint 10h ou plus et que le parent a un mail
  if (heuresAbsences >= 10 && emailDuParent) {
    try {
      await fetch("http://localhost:10000/api/send-parent-absence-alert", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_email: emailDuParent.trim(),
          student_name: `${eleveData.nom} ${eleveData.prenoms || ''}`.toUpperCase(),
          school_name: schoolName || "L'Établissement",
          total_hours: heuresAbsences
        })
      });
      console.log(`✉️ Alerte d'absences (>=10h) transmise au parent de ${eleveData.nom}`);
    } catch (err) {
      console.error("Échec d'envoi de l'alerte parent :", err);
    }
  }
};
      setLoading(false);
    }, (err) => {
      console.error("Erreur antenne Dashboard PP :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentSchool, trimestre]);

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse">Ouverture de la Tour de Contrôle du Titulaire...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen">
      
      {/* BOUTON RETOUR DASHBOARD GÉNÉRAL */}
      <div className="mb-4">
        <Link to="/prof/dashboardProf" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Bureau Enseignant
        </Link>
      </div>

      {/* BANDEAU PROFIL CLASSE */}
      <div className="bg-purple-900 text-white p-6 rounded-2xl shadow-md mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-200 bg-purple-950/60 px-3 py-1 rounded-full">
            👑 Tableau de Bord Professeur Principal
          </span>
          <h1 className="text-xl md:text-2xl font-black mt-2">Division Pédagogique : {classeNom}</h1>
          <p className="text-xs text-purple-200 font-medium">Établissement : <span className="font-bold text-orange-400 uppercase">{schoolName}</span> — Titulaire : M. {user?.nom || 'Enseignant'}</p>
        </div>
        
        <span className="text-xs font-mono font-black bg-purple-950 text-orange-400 px-3 py-1.5 rounded-xl border border-purple-800">
          Trimestre {trimestre} Actif
        </span>
      </div>

      {/* 📊 CARTES DE PERFORMANCES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
          <p className="text-[10px] font-black text-gray-400 uppercase">Effectif Inscrit</p>
          <p className="text-xl font-black text-gray-800 mt-1">{stats.totalEleves} Apprenants</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
          <p className="text-[10px] font-black text-gray-400 uppercase">Moyenne Générale</p>
          <p className="text-xl font-black text-purple-700 mt-1">{stats.moyenneGenerale} / 20</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
          <p className="text-[10px] font-black text-gray-400 uppercase">Absences Trimestre</p>
          <p className="text-xl font-black text-red-600 mt-1">{stats.totalAbsences} Heures</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
          <p className="text-[10px] font-black text-gray-400 uppercase">Élèves à Convoquer</p>
          <p className="text-xl font-black text-amber-600 mt-1">{stats.elevesEnDanger} Alertes</p>
        </div>
      </div>

      {/* 🚀 PANNEAU DES ACCÈS RAPIDES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        <div className="bg-white p-5 rounded-xl border border-gray-100 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="text-lg">📋</div>
            <h4 className="text-sm font-black text-gray-800 mt-2">Registre des Présences</h4>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">Contrôler la feuille d'appel du jour ou régulariser les billets de retards.</p>
          </div>
          <Link to="/prof/faire-appel" className="w-full text-center bg-slate-900 text-white font-black text-[10px] uppercase py-2 rounded-lg transition mt-4 block">Ouvrir l'Appel</Link>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="text-lg">📝</div>
            <h4 className="text-sm font-black text-gray-800 mt-2">Suivi des Évaluations</h4>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">Accéder au carnet de notes numérique pour insérer les interrogations de votre matière.</p>
          </div>
          <Link to="/prof/saisie-notes" className="w-full text-center bg-slate-900 text-white font-black text-[10px] uppercase py-2 rounded-lg transition mt-4 block">Saisir mes Notes</Link>
        </div>

        <div className="bg-white p-5 rounded-xl border border-purple-100 bg-linear-to-b from-white to-purple-50/20 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="text-lg">👑</div>
            <h4 className="text-sm font-black text-purple-900 mt-2">Clôture du Conseil</h4>
            <p className="text-[11px] text-purple-500/80 mt-1 font-medium">Arrêter définitivement le trimestre et sceller le livret scolaire de la classe.</p>
          </div>
          <Link to="/prof/espace-pp" className="w-full text-center bg-purple-700 hover:bg-purple-800 text-white font-black text-[10px] uppercase py-2 rounded-lg transition mt-4 block shadow-xs">Clôturer Trimestre</Link>
        </div>

      </div>

      {/* 📋 TABLEAU SYNOPTIQUE DE L'EFFECTIF CIVILE */}
      <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Répertoire provisoire des dossiers élèves</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr>
                <th className="p-3">Matricule</th>
                <th className="p-3">Nom & Prénoms de l'Apprenant</th>
                <th className="p-3 text-center">Moyenne Provisoire</th>
                <th className="p-3 text-center">Cumul Heures</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700 font-bold">
              {eleves.map((student) => {
                const moyenneAffiche = student.moyennesTrimestrielles?.[`trimestre_${trimestre}`];
                return (
                  <tr key={student.id} className="hover:bg-gray-50/30 transition">
                    <td className="p-3 font-mono text-gray-400 text-xs">{student.matricule || student.id}</td>
                    <td className="p-3 uppercase text-gray-900 font-black">
                      {student.nom} <span className="font-normal lowercase first-letter:uppercase text-gray-600">{student.prenoms || student.prenom}</span>
                    </td>
                    <td className="p-3 text-center font-mono text-purple-700 font-black">
                      {moyenneAffiche !== undefined && moyenneAffiche !== null ? `${parseFloat(moyenneAffiche).toFixed(2)}` : '-- / 20'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${student.absences > 4 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
                        {student.absences || 0} H
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default DashboardPP;
