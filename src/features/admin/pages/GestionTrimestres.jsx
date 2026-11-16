import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { doc, onSnapshot, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../../../pages/Header';
const GestionTrimestres = () => {
  const { schoolId } = useAuth();
  const currentSchool = (
    schoolId || 
    sessionStorage.getItem('sgs_school_id') || 
    'lycee_saint_bernard'
  ).trim().toLowerCase();

  const [trimestreActif, setTrimestreActif] = useState('1');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');

  /* =========================================================
     🔄 ÉCOUTE EN TEMPS RÉEL DE L'HORLOGE SCOLAIRE GLOBALE
  ========================================================= */
  useEffect(() => {
    if (!currentSchool) return;

    const schoolRef = doc(db, "schools", currentSchool);
    const unsub = onSnapshot(schoolRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const nvTrimestre = String(data.trimestreActif || '1');
        
        // Synchronisation immédiate de la session locale de l'admin
        setTrimestreActif(nvTrimestre);
        sessionStorage.setItem('sgs_trimestre', nvTrimestre);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erreur écoute live school:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [currentSchool]);

  /* =========================================================
     🚀 AUTOMATISATION : BASCULE SYNCHRONE IMMÉDIATE POUR TOUS
  ========================================================= */
  const handleChangerTrimestreGlobal = async (nouveauTrimestre) => {
    const confirmation = window.confirm(
      `⚠️ VERROUILLAGE INSTITUTIONNEL AUTOMATIQUE\n\n` +
      `Êtes-vous sûr de vouloir basculer l'établissement sur le Trimestre ${nouveauTrimestre} ?\n\n` +
      `Tous les comptes (élèves, profs, éducateurs) basculeront INSTANTANÉMENT en temps réel sans leur intervention.\n` +
      `Les absences actuelles et statuts de bulletins seront réinitialisés à zéro pour la nouvelle période.`
    );

    if (!confirmation) return;

    setUpdating(true);
    setMessage('⏳ Archiving et réinitialisation en temps réel de tous les comptes...');

    try {
      // 1. Extraction de la liste de tous les élèves rattachés à la structure
      const usersRef = collection(db, "users");
      const qEleves = query(
        usersRef, 
        where("schoolId", "==", currentSchool), 
        where("role", "==", "eleve")
      );
      const snapEleves = await getDocs(qEleves);

      // Initiation du lot d'écriture atomique Firestore (Batch)
      const batch = writeBatch(db);

      snapEleves.forEach((studentDoc) => {
        const studentData = studentDoc.data();
        const studentRef = doc(db, "users", studentDoc.id);

        const cleTrimestreSortant = `notes_trimestre_${trimestreActif}`;
        const notesSortantes = studentData.notes?.[cleTrimestreSortant] || {};

        // Compilation rapide de secours de la moyenne du trimestre qui se ferme
        let sommeMoyennes = 0;
        let totalMatieres = 0;
        Object.values(notesSortantes).forEach((notesArray) => {
          if (!Array.isArray(notesArray) || notesArray.length === 0) return;
          const notesNumeriques = notesArray
            .map((item) => (typeof item === 'object' && item !== null ? parseFloat(item.note) : parseFloat(item)))
            .filter((n) => !Number.isNaN(n));
          
          if (notesNumeriques.length > 0) {
            sommeMoyennes += (notesNumeriques.reduce((s, n) => s + n, 0) / notesNumeriques.length);
            totalMatieres++;
          }
        });
        const moyenneArchivee = totalMatieres > 0 ? parseFloat((sommeMoyennes / totalMatieres).toFixed(2)) : 0;

        // 🌟 MISE À JOUR ATOMIQUE DU PROFIL DE L'ÉLÈVE
        batch.update(studentRef, {
          // Archivage sécurisé dans des clés indépendantes NoSQL
          [`moyenne_archive_t${trimestreActif}`]: moyenneArchivee,
          [`absences_archive_t${trimestreActif}`]: Number(studentData.absences || 0),
          
          // 🔄 REMISE À ZÉRO INSTANTANÉE POUR LE NOUVEAU TRIMESTRE
          absences: 0, 
          [`bulletin_somme_t${nouveauTrimestre}`]: 0, 
          [`bulletin_statut_t${nouveauTrimestre}`]: "en_cours",
          updatedAt: new Date().toISOString()
        });
      });

      // 2. Commutation de l'horloge centrale de l'école (déclenche le onSnapshot global)
      const schoolRef = doc(db, "schools", currentSchool);
      batch.update(schoolRef, {
        trimestreActif: nouveauTrimestre,
        updatedAt: new Date().toISOString()
      });

      // Exécution de la transaction NoSQL globale
      await batch.commit();

      setMessage(`🎉 Bascule globale réussie ! L'établissement est configuré sur le Trimestre ${nouveauTrimestre}.`);
      window.setTimeout(() => setMessage(''), 6000);

    } catch (err) {
      console.error("Erreur lors de la bascule NoSQL :", err);
      alert("❌ Une anomalie technique a bloqué la mise à jour globale.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white border p-8 rounded-2xl text-center shadow-xs animate-pulse">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Chargement des verrous temporels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-700 text-left p-0 sm:p-6 lg:p-8">
      <Header/>
      <div className="max-w-4xl mx-auto space-y-6">

          {/* COMMANDES ADMINISTRATEUR */}
          <div className="md:col-span-2 bg-white  shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <h3 className="confect text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2 mb-4">
               Centrale de Verrouillage & Clôture Institutionnelle des trimestres
              </h3>
               <h2 className="tiretem text-lg font-black text-gray-900 uppercase">Recrutement & Gestion des Équipes RH</h2>
              <p className="confec text-xs text-gray-500 mb-4 leading-relaxed">
                En sélectionnant un trimestre ci-dessous, vous basculez l'intégralité des terminaux de l'école et purgez les registres d'appels :
              </p>
              
              <div className="lestrimestres flex flex-wrap gap-3">
                <button 
                  type="button"
                  onClick={() => handleChangerTrimestreGlobal('1')} 
                  disabled={updating || trimestreActif === '1'}
                  className={`Trimestre1 px-4 py-3 rounded-xl font-black text-xs border uppercase tracking-wide transition cursor-pointer ${trimestreActif === '1' ? 'bg-success text-white border border-gray-200 cursor-not-allowed' : 'bg-white hover:bg-purple-700 shadow-xs'}`}
                >
                  1er Trimestre
                </button>
                <button 
                  type="button"
                  onClick={() => handleChangerTrimestreGlobal('2')} 
                  disabled={updating || trimestreActif === '2'}
                  className={`Trimestre2 px-4 py-3 rounded-xl font-black text-xs border uppercase tracking-wide transition cursor-pointer ${trimestreActif === '2' ? 'bg-success text-white border border-gray-200 cursor-not-allowed' : 'bg-purple-600  hover:bg-purple-700 shadow-xs'}`}
                >
                  2ème Trimestre
                </button>
                              <button 
                  type="button"
                  onClick={() => handleChangerTrimestreGlobal('3')} 
                  disabled={updating || trimestreActif === '3'}
                  className={`Trimestre3 px-4 py-3 rounded-xl font-black text-xs border uppercase tracking-wide transition cursor-pointer ${trimestreActif === '3' ? 'bg-success text-white border border-gray-200 cursor-not-allowed' : 'bg-purple-600  hover:bg-purple-700 shadow-xs'}`}
                >
                  3ème Trimestre
                </button>
              </div>
            </div>

            <div className="cloisonnement p-3 bg-amber-50 text-[11px] text-amber-800 font-medium">
              💡<strong>Cloisonnement Multi-Tenant</strong> : L'historique reste préservé dans votre console.L'activation du Trimestre 2 crée un nouveau couloir de notes vierge pour les enseignants tout en figeant le Trimestre 1.
            </div>
          </div>
        
        {/* COMPOSANT EN-TÊTE */}
        <div className="deplace bg-white p-6 rounded-2xl  shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
            
          </span>
          <h2 className="cloisonneme text-xl font-black text-gray-900 mt-3">Contrôle Réseau des Périodes Trimestrielles</h2>
          <p className="cloisonnemen text-[11px] text-slate-400 mt-3 leading-relaxed px-3 py-1">
            Les changements appliqués ici forcent la bascule immédiate des comptes élèves, professeurs et éducateurs en direct.
          </p>
        </div>

        {message && (
          <div className="p-4 bg-slate-950 text-orange-400 text-xs font-black  animate-pulse">
            {message}
          </div>
        )}

        {/* BLOC PANNEAU MAÎTRE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> 
          
          {/* HORLOGE ACTIVE */}
          <div className="bg-white  rounded-2xl flex flex-col justify-between shadow-md">
            <div>
              <span className="trimestreactive text-[9px] font-black uppercase text-orange-400 tracking-wider">Trimestre Globale Active : </span>
              <span className="trimestreacti text-3xl font-black mt-2 font-mono text-purple-300"> TRIMESTRE {trimestreActif}</span>
              <div className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                Toutes les notes insérées et absences relevées à l'écran par vos équipes se synchronisent sur ce trimestre.
              </div>
            </div>
            <span className="text-success bg-emerald-950 t font-black rounded-full w-fit mt-4 animate-pulse uppercase tracking-wider">
              ● Systeme Edulink : v2.0.26 — Cloud Connected
            </span>
          </div>
          {/* BOUTON RETOUR */}
        <div>
          <Link to="/admin/home" className="btn-recuptenp inline-flex items-center  font-black  border hover: text-gray-700 px-4 py-2.5 rounded-xl transition  cursor-pointer uppercase tracking-wider">
            Tableau de Bord Admin
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
};

export default GestionTrimestres;
