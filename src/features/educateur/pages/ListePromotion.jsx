import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { enrollStudentOnFirebase, db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom'; 
import DashboardEducateur from './DashboardEducateur';

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
    <DashboardEducateur/>
    </div>
  );
};

export default ListePromotion;
