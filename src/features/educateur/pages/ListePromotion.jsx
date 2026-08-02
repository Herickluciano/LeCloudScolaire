import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { enrollStudentOnFirebase, db } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useParams } from 'react-router-dom'; 

const ListePromotion = () => {
  const { user, schoolId } = useAuth();
  const { niveau } = useParams();
  // 1. Détection du niveau assigné à l'éducateur connecté (ex: '6eme')
  const promotionLevel = niveau || user?.assigned_promotion || '6eme';
  const currentSchool = schoolId || 'lycee_classique_abidjan';

  // --- ÉTATS DES DONNÉES CLOUD ---
  const [classesEcole, setClassesEcole] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- ÉTATS DES FILTRES ---
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('liste');

  // --- ÉTATS DE LA MODAL D'INSCRIPTION ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formNom, setFormNom] = useState('');
  const [formPrenoms, setFormPrenoms] = useState('');
  const [formMatricule, setFormMatricule] = useState('');
  const [formGenre, setFormGenre] = useState('M');
  const [formClasse, setFormClasse] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setClassesEcole(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
        setFormClasse(list[0].id);
      }
    });

    // B. Écouter les élèves (stockés dans la table générale users) affectés à cette promotion
    const qStudents = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool),
      where("role", "==", "eleve"),
      where("classeId", "replace", "") // Note: En production, on filtre par le préfixe de la classe
    );

    const unsubStudents = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrage manuel local pour sécuriser le cloisonnement par niveau de l'éducateur
        if (data.role === 'eleve' && data.schoolId === currentSchool && data.classeId?.startsWith(promotionLevel)) {
          list.push({ id: doc.id, ...data });
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

  // 📥 SOUMISSION DU FORMULAIRE D'INSCRIPTION CLOUD
  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const cleanMatricule = formMatricule.trim().toUpperCase();
    const cleanNom = formNom.trim().toUpperCase();
    const cleanPrenoms = formPrenoms.trim();

    if (!cleanMatricule || !cleanNom || !cleanPrenoms || !formClasse) {
      setFormError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const studentData = {
      matricule: cleanMatricule,
      nom: cleanNom,
      prenoms: cleanPrenoms,
      role: 'eleve',
      genre: formGenre,
      classeId: formClasse,
      absences: 0,
      notes: {},
      schoolId: currentSchool
    };

    // Appel de votre fonction d'inscription avec contrôle strict des 50 places maximum
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

  // 🔍 FILTRAGE SYNCHRONE POUR L'AFFICHAGE DU TABLEAU
  const filteredStudents = students.filter(student => {
    const matchesClass = student.classeId === selectedClassId;
    const matchesSearch = student.nom.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.prenoms.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.matricule.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      
      {/* SECTION EN-TÊTE */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Espace Éducateur — Promotion {promotionLevel.toUpperCase()}</h1>
          <p className="text-sm text-gray-500">Établissement : <span className="font-semibold text-orange-600 uppercase">{currentSchool.replace(/-/g, ' ')}</span></p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-green-700 shadow transition duration-150"
          >
            ➕ Inscrire un Élève
          </button>
          
          <select 
            value={selectedClassId} 
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm focus:border-orange-500 focus:outline-none"
          >
            {classesEcole.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.nom}</option>
            ))}
            {classesEcole.length === 0 && <option value="">Aucune classe ouverte par l'admin</option>}
          </select>
        </div>
      </div>

      {/* BARRE D'OUTILS */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher par nom ou matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none shadow-sm"
          />
        </div>

        <div className="flex space-x-1 rounded-lg bg-gray-200 p-1">
          {['liste', 'absences'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-5 py-1.5 text-sm font-semibold capitalize transition ${activeTab === tab ? 'bg-white text-gray-800 shadow' : 'text-gray-600 hover:text-gray-800'}`}
            >
              {tab === 'liste' ? '📋 Liste des dossiers' : '⏱️ Pointage Absences'}
            </button>
          ))}
        </div>
      </div>

      {/* TABLEAU DES ELEVES AVEC LOADER */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-4"></div>
            <p className="text-gray-500 text-sm font-medium">Lecture des dossiers cloud en cours...</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-100 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Numéro Matricule</th>
                <th className="px-6 py-3">Nom & Prénoms</th>
                <th className="px-6 py-3 text-center">Genre</th>
                {activeTab === 'liste' ? <th className="px-6 py-3">Statut Dossier</th> : <th className="px-6 py-3 text-center">Total Absences</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-600">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-mono font-bold text-gray-900">{student.matricule}</td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{student.nom} {student.prenoms}</td>
                  <td className="px-6 py-4 text-center font-bold">{student.genre}</td>
                  
                  {activeTab === 'liste' ? (
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-600/20">
                        Inscrit Actif
                      </span>
                    </td>
                  ) : (
                    <td className="px-6 py-4 text-center font-bold">
                      <span className={`px-2.5 py-1 rounded-md text-xs ${student.absences > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {student.absences || 0} Heures
                      </span>
                    </td>
                  )}
                </tr>
              ))}
                            {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-400 font-medium">
                    Aucun élève enregistré dans cette classe pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL FORMULAIRE D'INSCRIPTION INTERACTIF */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Fiche d'Inscription — Ministère (MENA)</h3>
            
            {formError && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded-lg">{formError}</div>}
            {formSuccess && <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 text-xs font-bold rounded-lg">{formSuccess}</div>}
            
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Numéro Matricule Élève *</label>
                <input type="text" value={formMatricule} onChange={(e) => setFormMatricule(e.target.value)} placeholder="Ex: 26_7482K" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nom de famille *</label>
                  <input type="text" value={formNom} onChange={(e) => setFormNom(e.target.value)} placeholder="Ex: DIOMANDÉ" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tous les Prénoms *</label>
                  <input type="text" value={formPrenoms} onChange={(e) => setFormPrenoms(e.target.value)} placeholder="Ex: Ahmed Junior" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Genre</label>
                  <select value={formGenre} onChange={(e) => setFormGenre(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold">
                    <option value="M">Masculin (M)</option>
                    <option value="F">Féminin (F)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Affectation Classe Physique</label>
                  <select value={formClasse} onChange={(e) => setFormClasse(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold">
                    <option value="">-- Choisir la classe --</option>
                    {classesEcole.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 font-semibold">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 font-bold shadow-md">Confirmer l'Affectation</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListePromotion;
