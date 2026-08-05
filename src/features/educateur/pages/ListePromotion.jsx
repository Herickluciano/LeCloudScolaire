import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { enrollStudentOnFirebase, db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom'; 

const ListePromotion = () => {
  const { user, schoolId, schoolName } = useAuth();
  const { niveau } = useParams();
  
  // Détection du niveau assigné à l'éducateur connecté (ex: '6eme')
  const promotionLevel = niveau || user?.assigned_promotion || '6eme';
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  // --- ÉTATS DES DONNÉES CLOUD ---
  const [classesEcole, setClassesEcole] = useState([]);
  const [students, setStudents] = useState([]);
  const [absentsDuJour, setAbsentsDuJour] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- ÉTATS DES FILTRES ---
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('liste'); // 'liste' ou 'absences'
  const [periodeHeure, setPeriodeHeure] = useState('H1 (07h-08h)');
  const [jourSemaine, setJourSemaine] = useState('Lundi');

  // --- ÉTATS DE LA MODAL D'INSCRIPTION ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formNom, setFormNom] = useState('');
  const [formPrenoms, setFormPrenoms] = useState('');
  const [formMatricule, setFormMatricule] = useState('');
  const [formGenre, setFormGenre] = useState('Masculin');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const dateAujourdhui = new Date().toLocaleDateString('fr-FR');

  // 🔄 ÉCOUTE EN TEMPS RÉEL (Firebase onSnapshot)
  useEffect(() => {
    setLoading(true);

    // A. Écouter uniquement les classes de CETTE école et de CETTE promotion/niveau
    const qClasses = query(
      collection(db, "classes"),
      where("schoolId", "==", currentSchool),
      where("promotion", "==", promotionLevel)
    );

    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setClassesEcole(list);
      if (list.length > 0) {
        setSelectedClassId(list[0].id);
      }
    });

    // B. Écouter les élèves affectés à cette promotion de l'école
    const qStudents = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve")
    );

    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.promotion === promotionLevel) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setStudents(list);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubStudents();
    };
  }, [promotionLevel, currentSchool]);

  // 🔄 C. Écouter les absences pour l'onglet Pointage
  useEffect(() => {
    if (!selectedClassId) return;
    const qAbsences = query(
      collection(db, "registre_appels"),
      where("schoolId", "==", currentSchool),
      where("classeId", "==", selectedClassId.replace(`${currentSchool}_`, '')),
      where("jour", "==", jourSemaine),
      where("heure", "==", periodeHeure),
      where("date", "==", dateAujourdhui)
    );
    const unsubAbsences = onSnapshot(qAbsences, (snapshot) => {
      const activeAbsences = [];
      snapshot.forEach(docSnap => activeAbsences.push({ id: docSnap.id, ...docSnap.data() }));
      setAbsentsDuJour(activeAbsences);
    });
    return () => unsubAbsences();
  }, [selectedClassId, jourSemaine, periodeHeure, currentSchool, dateAujourdhui]);

  // 🟢 / 🛑 COMMUTATEUR LOGIQUE ABSENCES (Double Option)
  const handleTogglePresence = async (student) => {
    const enregistrementExistant = absentsDuJour.find(a => a.eleveId === student.id);
    const studentRef = doc(db, "users", student.id);
    const cumulActuel = student.absences || 0;
    const cleanClassId = selectedClassId.replace(`${currentSchool}_`, '');

    try {
      if (!enregistrementExistant) {
        await updateDoc(studentRef, { absences: cumulActuel + 1 });
        await addDoc(collection(db, "registre_appels"), {
          eleveId: student.id,
          eleveName: `${student.nom} ${student.prenoms || student.prenom}`,
          classeId: cleanClassId,
          schoolId: currentSchool,
          matiere: "Régulation Éducateur",
          profName: user?.name || "Éducateur",
          jour: jourSemaine,
          heure: periodeHeure,
          date: dateAujourdhui,
          createdAt: new Date().toISOString()
        });
      } else {
        const nouveauCumul = cumulActuel > 0 ? cumulActuel - 1 : 0;
        await updateDoc(studentRef, { absences: nouveauCumul });
        await deleteDoc(doc(db, "registre_appels", enregistrementExistant.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 📥 SOUMISSION DU FORMULAIRE D'INSCRIPTION CLOUD ÉDUCATEUR
  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const cleanMatricule = formMatricule.trim().toUpperCase();
    const cleanNom = formNom.trim().toUpperCase();
    const cleanPrenoms = formPrenoms.trim();

    if (!cleanMatricule || !cleanNom || !cleanPrenoms || !selectedClassId) {
      setFormError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const cleanClassId = selectedClassId.replace(`${currentSchool}_`, '');

    const studentData = {
      matricule: cleanMatricule,
      nom: cleanNom,
      prenoms: cleanPrenoms,
      role: 'eleve',
      genre: formGenre,
      classeId: cleanClassId,
      promotion: promotionLevel,
      absences: 0,
      notes: {},
      statut: 'actif',
      schoolId: currentSchool
    };

    const response = await enrollStudentOnFirebase(cleanMatricule, studentData, currentSchool);

    if (response.success) {
      setFormSuccess(`Élève inscrit avec succès ! Mot de passe initial généré : ${cleanMatricule}@${cleanNom}!`);
      setFormNom('');
      setFormPrenoms('');
      setFormMatricule('');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess('');
      }, 2000);
    } else {
      setFormError(response.msg || "Erreur lors de l'enregistrement de l'élève.");
    }
  };

  // 🔍 FILTRAGE SYNCHRONE POUR L'AFFICHAGE
  const filteredStudents = students.filter(student => {
    const matchesClass = student.classeId === selectedClassId.replace(`${currentSchool}_`, '');
    const matchesSearch = student.nom.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (student.prenoms || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.matricule.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans">
      
      {/* SECTION EN-TÊTE */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight">🧑‍💼 Bureau Éducateur — Niveau {promotionLevel.toUpperCase()}</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Instance Établissement : <span className="font-bold text-orange-600 uppercase">{schoolName || currentSchool.replace(/_/g, ' ')}</span></p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs uppercase hover:bg-emerald-700 shadow-sm transition"
          >
            ➕ Inscrire un Élève
          </button>
          
          <select 
            value={selectedClassId} 
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-2xs focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
          >
            {classesEcole.map(cls => (
              <option key={cls.id} value={cls.id}>Classe : {cls.id.replace(`${currentSchool}_`, '').toUpperCase()}</option>
            ))}
            {classesEcole.length === 0 && <option value="">Aucune classe ouverte</option>}
          </select>
        </div>
      </div>

      {/* BARRE D'OUTILS ET FILTRES */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher un dossier (Nom, Matricule...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-2xs"
          />
        </div>

        {/* CONTRÔLES SUPPLÉMENTAIRES POUR L'ONGLET ABSENCES */}
        {activeTab === 'absences' && (
          <div className="flex flex-wrap gap-2 animate-fadeIn">
                        <select value={jourSemaine} onChange={(e) => setJourSemaine(e.target.value)} className="bg-white border text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-orange-500 outline-none text-purple-700 cursor-pointer">
              <option value="Lundi">📅 Lundi</option>
              <option value="Mardi">📅 Mardi</option>
              <option value="Mercredi">📅 Mercredi</option>
              <option value="Jeudi">📅 Jeudi</option>
              <option value="Vendredi">📅 Vendredi</option>
              <option value="Samedi">📅 Samedi</option>
            </select>
            <select value={periodeHeure} onChange={(e) => setPeriodeHeure(e.target.value)} className="bg-white border text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer">
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
        )}

        <div className="flex space-x-1 rounded-xl bg-gray-200 p-1 self-end md:self-auto shadow-2xs">
          {['liste', 'absences'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-1.5 text-xs font-extrabold capitalize transition tracking-wider ${activeTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {tab === 'liste' ? '📋 Liste des dossiers' : '⏱️ Pointage Absences'}
            </button>
          ))}
        </div>
      </div>

      {/* TABLEAU RENDU VISUEL DYNAMIQUE */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-4"></div>
            <p className="text-gray-500 text-xs font-bold animate-pulse">Lecture des dossiers cloud en cours...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <p className="text-xs text-center py-12 text-gray-400 font-bold">Aucun dossier trouvé pour les critères de cette classe.</p>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr>
                <th className="py-3 px-4">Matricule</th>
                <th className="py-3 px-4">Identité de l'Élève</th>
                <th className="py-3 px-4 text-center">Genre</th>
                <th className="py-3 px-4 text-center">Cumul d'Absences</th>
                {activeTab === 'absences' && <th className="py-3 px-4 text-center">Action Appel</th>}
              </tr>
            </thead>
            <tbody className="divide-y font-bold text-gray-700">
              {filteredStudents.map((student) => {
                const estAbsent = absentsDuJour.some(a => a.eleveId === student.id);
                return (
                  <tr key={student.id} className={`hover:bg-gray-50/50 transition ${estAbsent && activeTab === 'absences' ? 'bg-red-50/30' : ''}`}>
                    <td className="py-3.5 px-4 font-mono text-gray-400">{student.matricule}</td>
                    <td className="py-3.5 px-4 text-gray-900 uppercase font-black">
                      {student.nom} <span className="font-normal lowercase first-letter:uppercase text-gray-600">{student.prenoms || student.prenom}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">{student.genre === 'Masculin' || student.genre === 'M' ? '♂️ M' : '♀️ F'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded font-mono ${student.absences > 4 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {student.absences || 0} Heures
                      </span>
                    </td>
                    
                    {activeTab === 'absences' && (
                      <td className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => { if (estAbsent) handleTogglePresence(student); }}
                            className={`px-2.5 py-1 rounded text-[10px] uppercase font-black border transition ${!estAbsent ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                          >
                            Présent
                          </button>
                          <button 
                            type="button"
                            onClick={() => { if (!estAbsent) handleTogglePresence(student); }}
                            className={`px-2.5 py-1 rounded text-[10px] uppercase font-black border transition ${estAbsent ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-400 border-gray-100 hover:text-red-600'}`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 🔳 MODAL INTERACTIVE D'INSCRIPTION ÉLÈVE DIRECTE PAR L'ÉDUCATEUR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border text-slate-800">
            <h3 className="text-base font-black border-b pb-2 mb-4 text-gray-800 uppercase">➕ Formulaire d'Inscription Rapide Niveau {promotionLevel.toUpperCase()}</h3>
            
            {formError && <p className="p-2 mb-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-lg">{formError}</p>}
            {formSuccess && <p className="p-2 mb-3 bg-green-50 border border-green-200 text-green-600 text-xs font-bold rounded-lg animate-pulse">{formSuccess}</p>}

            <form onSubmit={handleEnrollStudent} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-500 uppercase mb-1">Numéro de Matricule MENA *</label>
                <input type="text" placeholder="Ex: 26_3159M" value={formMatricule} onChange={(e) => setFormMatricule(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg uppercase outline-none focus:ring-2 focus:ring-orange-500" required />
              </div>
              <div>
                <label className="block text-gray-500 uppercase mb-1">Nom de Famille Civil *</label>
                <input type="text" placeholder="Ex: KOFFI" value={formNom} onChange={(e) => setFormNom(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg uppercase outline-none focus:ring-2 focus:ring-orange-500" required />
              </div>
              <div>
                <label className="block text-gray-500 uppercase mb-1">Tous les prénoms *</label>
                <input type="text" placeholder="Ex: Yao Ama" value={formPrenoms} onChange={(e) => setFormPrenoms(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" required />
              </div>
              <div>
                <label className="block text-gray-500 uppercase mb-1">Genre / Sexe *</label>
                <select value={formGenre} onChange={(e) => setFormGenre(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                  <option value="Masculin">♂️ Masculin</option>
                  <option value="Féminin">♀️ Féminin</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2 text-xs uppercase font-extrabold">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/2 border py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 transition">Annuler</button>
                <button type="submit" className="w-1/2 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl transition shadow-sm">Inscrire sur le Cloud</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListePromotion;
