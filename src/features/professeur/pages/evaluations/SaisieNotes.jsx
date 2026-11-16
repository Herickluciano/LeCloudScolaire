// src/features/professeur/pages/evaluations/SaisieNotes.jsx
import { useState, useEffect } from 'react';
import { db } from '../../../../services/api'; 
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore'; 
import { useAuth } from '../../../../context/AuthContext'; 
import { useParams, Link } from 'react-router-dom';
import MoyennesTrimestres from './MoyennesTrimestre';
import Header from '../../../../pages/Header';

const SaisieNotes = () => {
  const { user, schoolId } = useAuth();
  const { classIdUrl } = useParams();
  
  const currentSchool = (schoolId || user?.schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();

  // --- ÉTATS INTERNES ---
  const [classesAutorisees, setClassesAutorisees] = useState([]);
  const [classeSelectionnee, setClasseSelectionnee] = useState('');
  const [matiereActive, setMatiereActive] = useState('');
  const [listeEleves, setListeEleves] = useState([]);
  const [trimestre, setTrimestre] = useState('1');
  const [notesState, setNotesState] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });

  /* =========================================================
     🔄 ÉTAPE 1 : EXTRACTION DES CLASSES DE L'EDT DU PROF
  ========================================================= */
  useEffect(() => {
    if (!user?.id || !currentSchool) {
      setLoading(false);
      return;
    }

    const qEdt = query(
      collection(db, "emplois_du_temps"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribeEdt = onSnapshot(qEdt, (snapshot) => {
      const classesTrouvees = [];
      let disciplineDetectee = '';

      snapshot.forEach((docSnap) => {
        const edtData = docSnap.data();
        const creneaux = edtData.creneaux || [];

        creneaux.forEach((creneau) => {
          if (String(creneau.professeurId).trim() === String(user.id).trim()) {
            if (!disciplineDetectee) {
              disciplineDetectee = creneau.matiere;
            }
            if (!classesTrouvees.some(c => c.id === creneau.classeId)) {
              classesTrouvees.push({
                id: creneau.classeId,
                nom: creneau.nomClasse || creneau.classeNom || "N/A"
              });
            }
          }
        });
      });

      setClassesAutorisees(classesTrouvees);
      setMatiereActive(disciplineDetectee || user?.matiereEnseignee || 'Anglais');

      if (classesTrouvees.length > 0) {
        const classeParDefaut = classIdUrl && classesTrouvees.some(c => c.id === classIdUrl)
          ? classIdUrl
          : classesTrouvees[0].id;
        setClasseSelectionnee(classeParDefaut);
      } else {
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribeEdt();
  }, [user, currentSchool, classIdUrl]);

  /* =========================================================
     🔄 ÉTAPE 2 : LISTE DES ELEVES DE LA CLASSE SELECTIONNEE
  ========================================================= */
  useEffect(() => {
    if (!currentSchool || !classeSelectionnee || !matiereActive) {
      if (!loading && classesAutorisees.length === 0) setLoading(false);
      return undefined;
    }

    setLoading(true);
    const qEleves = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "==", classeSelectionnee)
    );

    const unsubscribeEleves = onSnapshot(qEleves, (snapshot) => {
      const list = [];
      const initialInputs = {};
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data });
        // Les champs restent vides à l'ouverture pour saisir une nouvelle série de notes librement
        initialInputs[docSnap.id] = { interro: '', ds: '', devCommun: '' };
      });
      
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setListeEleves(list);
      setNotesState(initialInputs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribeEleves();
  }, [currentSchool, classeSelectionnee, trimestre, matiereActive, classesAutorisees]);

  const handleNoteChange = (eleveId, champ, value) => {
    if (value !== '') {
      const num = parseFloat(value.replace(',', '.'));
      if (isNaN(num) || num < 0 || num > 20) return; 
    }

    setNotesState(prev => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], [champ]: value }
    }));
  };

  /* =========================================================
     🚀 TRANSMISSION ACCUMULATIVE SANS LIMITE VERS FIRESTORE (arrayUnion)
  ========================================================= */
  const handleSauvegarderNotesNotes = async (e) => {
    e.preventDefault();
    setToast({ type: '', text: '' });
    setIsSubmitting(true);

    try {
      const cleTrimestre = `notes_trimestre_${trimestre}`;

      await Promise.all(
        listeEleves.map(async (el) => {
          const Saisie = notesState[el.id];
          if (!Saisie) return;

          const nouveauxObjetsNotes = [];

          if (Saisie.interro !== '') {
            nouveauxObjetsNotes.push({
              note: parseFloat(String(Saisie.interro).replace(',', '.')),
              type: "Interrogation",
              date: new Date().toLocaleDateString('fr-FR'),
              professeurId: user?.id || "PROF_AFFECTE"
            });
          }

          if (Saisie.ds !== '') {
            nouveauxObjetsNotes.push({
              note: parseFloat(String(Saisie.ds).replace(',', '.')),
              type: "Devoir Surveillé",
              date: new Date().toLocaleDateString('fr-FR'),
              professeurId: user?.id || "PROF_AFFECTE"
            });
          }

          if (Saisie.devCommun !== '') {
            nouveauxObjetsNotes.push({
              note: parseFloat(String(Saisie.devCommun).replace(',', '.')),
              type: "Devoir Commun",
              date: new Date().toLocaleDateString('fr-FR'),
              professeurId: user?.id || "PROF_AFFECTE"
            });
          }

          // arrayUnion ajoute chaque note sans écraser le passé
          if (nouveauxObjetsNotes.length > 0) {
            const studentRef = doc(db, "users", el.id);
            await updateDoc(studentRef, {
              [`notes.${cleTrimestre}.${matiereActive}`]: arrayUnion(...nouveauxObjetsNotes),
              updatedAt: new Date().toISOString()
            });
          }
        })
      );

      setToast({
        type: 'success',
        text: sessionStorage.getItem("sgs_toast_save_success") || "🎯 Relevé enregistré et synchronisé avec succès !"
      });

      // Remise à blanc complète des inputs après envoi réussi pour la session de saisie suivante
      const clearedNotes = {};
      listeEleves.forEach(el => {
        clearedNotes[el.id] = { interro: '', ds: '', devCommun: '' };
      });
      setNotesState(clearedNotes);

    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        text: sessionStorage.getItem("sgs_toast_save_error") || "💥 Erreur technique lors du téléversement."
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToast({ type: '', text: '' }), 4000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">
        {sessionStorage.getItem("sgs_loading_carnet") || "Ouverture du carnet de notes cloud..."}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto  sm:p-6 font-sans bg-white min-h-screen relative animate-fadeIn text-left text-slate-700">
      <Header/>
      {/* TOAST POP-UP */}
      {toast.text && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border-l-4 bg-slate-900 text-xs font-bold ${
          toast.type === 'success' ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'
        }`}>
          <p className="whitespace-pre-line text-left">{toast.text}</p>
        </div>
      )}

      {/* BOUTON RETOUR */}
      <div className="mb-4 text-left">
        <Link to="/professeur/dashboard" className="bgvalidbnt inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg transition shadow-2xs">
          {sessionStorage.getItem("sgs_btn_back_bureau") || "⬅ Bureau Virtuel"}
        </Link>
      </div>

      {/* BANDEAU INTERACTIF */}
      <div className="bg-slate-900  p-6 rounded-2xl shadow-md mb-6 text-left">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center flex-wrap gap-4">
          <div>
            <h2 className="bgvalidtext text-xl font-black uppercase tracking-tight">
              {sessionStorage.getItem("sgs_title_registre") || "Registre d'Évaluations & Coefficients"}
            </h2>
            <p className="bgvalidtext-1 text-xs text-slate-400 mt-1">
              {sessionStorage.getItem("sgs_label_discipline") || "Discipline :"} <span className="text-orange-400 font-bold">{matiereActive || "—"}</span>
            </p>
          </div>
          
          <div className="bgvalidtext-btn flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={classeSelectionnee} 
              onChange={(e) => setClasseSelectionnee(e.target.value)} 
              className="cla border border-slate-700 rounded-xl px-2 py-2 text-xs font-black  outline-none cursor-pointer flex-1 sm:flex-initial"
            >
                           {classesAutorisees.length === 0 ? (
                <option value="">{sessionStorage.getItem("sgs_opt_no_class") || "Aucune classe assignée"}</option>
              ) : (
                classesAutorisees.map((c) => (
                  <option key={c.id} value={c.id}>{String(c.nom).toUpperCase()}</option>
                ))
              )}
            </select>

            <select 
              value={trimestre} 
              onChange={(e) => setTrimestre(e.target.value)} 
              className="bg-slate-800 border border-slate-700 rounded-xl px-1 py-2 text-xs font-black text-orange-400 outline-none cursor-pointer"
            >
              <option value="1">{sessionStorage.getItem("sgs_opt_t1") || "1er Trimestre"}</option>
              <option value="2">{sessionStorage.getItem("sgs_opt_t2") || "2ème Trimestre"}</option>
              <option value="3">{sessionStorage.getItem("sgs_opt_t3") || "3ème Trimestre"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLEAU DE SAISIE DES MOYENNES */}
      <form onSubmit={handleSauvegarderNotesNotes} className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="claform w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                <th className="p-3">{sessionStorage.getItem("sgs_th_apprenant_name") || "Nom & Prénoms de l'Apprenant"}</th>
                <th className="p-3 text-center">{sessionStorage.getItem("sgs_th_interro_label") || "Interrogation (Coeff 1)"}</th>
                <th className="p-3 text-center">{sessionStorage.getItem("sgs_th_ds_label") || "Devoir Surveillé (Coeff 2)"}</th>
                <th className="p-3 text-center">{sessionStorage.getItem("sgs_th_dc_label") || "Devoir Commun (Coeff 2)"}</th>
              </tr>
            </thead>
            <tbody>
              {listeEleves.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-gray-400 italic">
                    {sessionStorage.getItem("sgs_label_no_student_classe") || "Aucun élève enregistré dans cette classe."}
                  </td>
                </tr>
              ) : (
                listeEleves.map((el) => (
                  <tr key={el.id} className="border-b border-gray-100 hover:bg-gray-50/40 transition">
                    <td className="p-3 text-gray-900 uppercase font-black text-left">{el.nom} {el.prenoms || el.prenom || ''}</td>
                    <td className="p-3 text-center">
                      <input type="text" placeholder="—" value={notesState[el.id]?.interro || ''} onChange={(e) => handleNoteChange(el.id, 'interro', e.target.value)} className="w-16 p-1.5 border bg-gray-50 rounded-lg text-center font-mono font-black outline-none focus:ring-2 focus:ring-orange-500" disabled={isSubmitting} />
                    </td>
                    <td className="p-3 text-center">
                      <input type="text" placeholder="—" value={notesState[el.id]?.ds || ''} onChange={(e) => handleNoteChange(el.id, 'ds', e.target.value)} className="w-16 p-1.5 border bg-gray-50 rounded-lg text-center font-mono font-black outline-none focus:ring-2 focus:ring-orange-500" disabled={isSubmitting} />
                    </td>
                    <td className="p-3 text-center">
                      <input type="text" placeholder="—" value={notesState[el.id]?.devCommun || ''} onChange={(e) => handleNoteChange(el.id, 'devCommun', e.target.value)} className="w-16 p-1.5 border bg-gray-50 rounded-lg text-center font-mono font-black outline-none focus:ring-2 focus:ring-orange-500" disabled={isSubmitting} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting || listeEleves.length === 0}
          className="bgvalido w-full bg-orange-600 hover:bg-orange-700  font-black py-1 px-0 rounded-xl uppercase tracking-wider transition shadow-sm cursor-pointer mt-6 disabled:bg-gray-200 text-xs border-0"
        >
          {isSubmitting ? (sessionStorage.getItem("sgs_btn_saving") || "⏳ Synchronisation...") : (sessionStorage.getItem("sgs_btn_save_notes") || "Valider et Enregistrer les Notes de la Classe")}
        </button>
      </form>
      <div className="mb-4 text-left">
        <Link to="/professeur/voir-moyenne-trimestrielle" className="bgvalida inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-0 py-1 rounded-lg transition shadow-2xs">
         Confrontation & Calcul des Moyennes
        </Link>
      </div>

    </div>
  );
};

export default SaisieNotes;
