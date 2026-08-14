import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/api';
// 🟢 ALIGNEMENT FIRESTORE : Importations NoSQL atomiques
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../../../../context/AuthContext';

const RegistreAppelEleves = () => {
  const { user, schoolId, schoolName } = useAuth();
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();
  
  // Variables de session de l'enseignant Edulink
  const nomEnseignant = `${user?.nom || ''} ${user?.prenoms || ''}`.trim() || 'Enseignant';
  const disciplineProf = user?.matiereEnseignee || user?.matiere || 'Général';
  const classeProf = (user?.classeId || '5eme_1').trim().toLowerCase();

  // --- ÉTATS CRITIQUES ---
  const [listeEleves, setListeEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🟢 RECTIFICATION ARCHITECTURALE : Définition de la variable manquante 'trimestre' sous forme d'état contrôlé
  const [trimestreActif, setTrimestreActif] = useState('trimestre_1');

  // Grille d'émargement dynamique de la classe : { [eleveId]: 'present' | 'absent' | 'retard' }
  const [registrePresences, setRegistrePresences] = useState({});

  // 🔄 ÉCOUTEUR EN TEMPS RÉEL (onSnapshot) : Chargement synchrone des apprenants de la division
  useEffect(() => {
    if (!currentSchool || !classeProf) return;

    const q = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "==", classeProf)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      const initialStates = {};

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({ id: docSnap.id, ...d });
        // 🟢 SÉCURITÉ DISCIPLINAIRE : Par défaut, tout élève est marqué 'present' au démarrage du cours
        initialStates[docSnap.id] = 'present';
      });

      // Tri alphabétique standard
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setListeEleves(list);
      setRegistrePresences(initialStates);
      setLoading(false);
    }, (err) => {
      console.error("Erreur écoute élèves classe :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool, classeProf]);

  // 🚀 ACTION DISCIPLINAIRE : Mutation d'état de présence instantanée au clic
  const handleChangerStatutPresences = (eleveId, nouvelEtat) => {
    setRegistrePresences(prev => ({
      ...prev,
      [eleveId]: nouvelEtat
    }));
  };

  // 🚀 ACTION CRITIQUE : Calcul comptable et envoi Cloud du registre d'appel du cours
  const handleValiderFicheAppel = async (e) => {
    e.preventDefault();
    if (listeEleves.length === 0) return alert("❌ Validation impossible : La liste d'appel est vide.");
    
    setIsSubmitting(true);

    try {
      const tableauNomsAbsents = [];
      const tableauNomsRetards = [];
      const listeIdAbsents = [];

      // 1. Analyse de la grille d'émargement de l'heure en cours
      listeEleves.forEach(eleve => {
        const etatEleve = registrePresences[eleve.id] || 'present';
        const nomComplet = `${eleve.nom || ''} ${eleve.prenoms || ''}`.trim().toUpperCase();

        if (etatEleve === 'absent') {
          tableauNomsAbsents.push(nomComplet);
          listeIdAbsents.push(eleve.id);
        } else if (etatEleve === 'retard') {
          tableauNomsRetards.push(nomComplet);
        }
      });

      const dateAujourdhui = new Date().toLocaleDateString('fr-FR');
      const heureActuelle = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // 2. ÉCRITURE TRANSACTIONNELLE : Envoi de la notification d'appel pour alimenter la Main-Courante de l'Éducateur
      await addDoc(collection(db, "registre_appels"), {
        schoolId: currentSchool,
        classeId: classeProf,
        promotion: user?.assigned_promotion || user?.promotion || '5eme', // Tri automatique du niveau
        matiere: disciplineProf,
        professeurId: user?.matricule || user?.id || 'PROF_UNKNOWN',
        professeurNom: nomEnseignant,
        date: dateAujourdhui,
        heureArrivee: heureActuelle, // Repère temporel précis (ex: 10:15)
        createdAt: new Date().toISOString(),
        
        // Rapprochement des tableaux demandés
        elevesAbsents: tableauNomsAbsents, 
        elevesRetards: tableauNomsRetards,
        
        // 🟢 RÉPARATION DU CRASH : Injection de la variable d'état trimestre validée
        trimestre: trimestreActif
      });

      // 3. INCULCATION DISCIPLINAIRE CONTINUE : Incrémentation automatique du compteur d'absences sur la fiche NoSQL de chaque élève (+1 Heure d'absence)
      if (listeIdAbsents.length > 0) {
        for (const idEleve of listeIdAbsents) {
          const eleveRef = doc(db, "users", idEleve);
          await updateDoc(eleveRef, {
            absences: increment(1) // Augmente de 1 heure son grand livre trimestriel d'absentéisme
          });
        }
      }

      alert(`📝 APPEL VALIDÉ ET SCÉLLÉ VIA EDULINK !\n\n- ${tableauNomsAbsents.length} absents et ${tableauNomsRetards.length} retards enregistrés à ${heureActuelle}.\n- Compteurs d'absences élèves incrémentés.\n- Main-courante Vie Scolaire alimentée en temps réel.`);
      
      // Réinitialisation de sécurité de la grille après envoi
      const resetStates = {};
      listeEleves.forEach(el => { resetStates[el.id] = 'present'; });
      setRegistrePresences(resetStates);

    } catch (err) {
      console.error("Erreur lors du commit d'appel NoSQL :", err);
      alert("❌ Échec technique : Impossible de sérialiser la fiche d'appel sur le Cloud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase tracking-wider">Ouverture des fiches civiles de la classe...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans text-gray-700 text-left bg-gray-50 min-h-screen animate-fadeIn">
      
      {/* BANDEAU SUPÉRIEUR DE COMMANDE */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-3xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
            Émargement horaire synchrone — EDULINK
          </span>
          <h2 className="text-base font-black text-gray-800 uppercase mt-1">📝 Registre d'Appel Numérique par Heure de Cours</h2>
          <p className="text-[11px] text-gray-400 font-medium">Classe : <span className="font-bold text-gray-600 uppercase">{classeProf}</span> — Discipline : <span className="font-bold text-gray-600 uppercase">{disciplineProf}</span> — Prof : <span className="font-bold text-gray-600">{nomEnseignant}</span></p>
        </div>

        {/* CONTROLEUR SÉCURISÉ DU TRIMESTRE ACADÉMIQUE */}
        <div className="w-full sm:w-auto">
          <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Trimestre en cours *</label>
          <select 
            value={trimestreActif}
            onChange={(e) => setTrimestreActif(e.target.value)}
            className="w-full sm:w-auto bg-gray-50 border p-2 text-xs font-black uppercase rounded-xl outline-none text-gray-800 cursor-pointer bg-white"
          >
            <option value="trimestre_1">1er Trimestre Académique</option>
            <option value="trimestre_2">2ème Trimestre Académique</option>
            <option value="trimestre_3">3ème Trimestre Académique</option>
          </select>
        </div>
      </div>

      {/* GRILLE D'ÉMARGEMENT CENTRAL */}
      <form onSubmit={handleValiderFicheAppel} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-3xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b text-[10px] tracking-wider">
                <th className="p-3">Code Matricule</th>
                <th className="p-3">Nom & Prénoms de l'Élève</th>
                <th className="p-3 text-center">Cumul Absences</th>
                <th className="p-3 text-right">Statut d'Émargement</th>
              </tr>
            </thead>
            <tbody>
              {listeEleves.length === 0 ? (
                <tr><td colSpan="4" className="p-12 text-center text-gray-400 italic">Aucun élève répertorié pour cette division de classe.</td></tr>
              ) : (
                listeEleves.map((student) => {
                  const statutActuel = registrePresences[student.id] || 'present';

                  return (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-slate-50/40 transition items-center">
                      <td className="p-3 font-mono text-purple-700 uppercase truncate max-w-[120px]">{student.matricule || student.id}</td>
                      <td className="p-3 text-gray-900 uppercase font-black">{student.nom} {student.prenoms || ''}</td>
                      <td className="p-3 text-center font-mono text-red-600 bg-red-50/10 font-black text-sm">{student.absences || 0} H</td>
                      
                      {/* BOUTONS TRILATÉRAUX : PRÉSENT - ABSENT - RETARD */}
                      <td className="p-3 text-right">
                        <div className="inline-flex p-0.5 bg-gray-100 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-tight shadow-2xs">
                                                    <button
                            type="button"
                            onClick={() => handleChangerStatutPresences(student.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-black ${statutActuel === 'present' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            ✓ Présent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangerStatutPresences(student.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-black ${statutActuel === 'absent' ? 'bg-red-600 text-white shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            ❌ Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangerStatutPresences(student.id, 'retard')}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-black ${statutActuel === 'retard' ? 'bg-amber-500 text-white shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            ⏱️ Retard
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* VALIDATION CLOUD */}
        <div className="text-right pt-4 border-t border-gray-100 border-dashed">
          <button
            type="submit"
            disabled={isSubmitting || listeEleves.length === 0}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase px-6 py-3.5 rounded-xl shadow-md transition cursor-pointer border-0 disabled:bg-gray-200"
          >
            {isSubmitting ? "Enregistrement Cloud..." : "🚀 Valider et Clôturer l'Appel du Cours"}
          </button>
        </div>
      </form>

    </div>
  );
};

export default RegistreAppelEleves;

