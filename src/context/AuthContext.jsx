"use no memo";

import { createContext, useContext, useState, useEffect } from 'react';
import { verifyUserOnCloud } from '../services/api';
import { db } from '../services/api';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('sgs_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [schoolName, setSchoolName] = useState(sessionStorage.getItem('sgs_school_name') || '');
  const [schoolId, setSchoolId] = useState(sessionStorage.getItem('sgs_school_id') || '');
  const [loading, setLoading] = useState(true);

  // 🔄 ÉCOUTEUR ET SYNC EN TEMPS RÉEL (Insensible aux conflits de Casse)
  useEffect(() => {
    const refreshUserStatus = async () => {
      const matriculeCible = user?.matricule || user?.id || (sessionStorage.getItem('sgs_user') ? JSON.parse(sessionStorage.getItem('sgs_user'))?.matricule : null);
      
      if (!matriculeCible || matriculeCible === 'ROOT_LUHAMCODE_2024') {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", matriculeCible.trim());
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const cloudData = snap.data();
          let classeAssigneeOfficielle = cloudData.classeId || '';
          let roleDetermine = cloudData.role || 'professeur';

          const qClasseCheck = query(
            collection(db, "classes"),
            where("profPrincipalId", "==", matriculeCible.trim())
          );
          const classSnapshot = await getDocs(qClasseCheck);
          
          if (!classSnapshot.empty) {
            roleDetermine = 'prof_principal'; 
            const classeDoc = classSnapshot.docs[0].data();
            classeAssigneeOfficielle = classeDoc.idBrute || classeDoc.id || '5eme_1'; 
          }

          const updatedUser = {
            ...user,
            id: matriculeCible.trim(),
            matricule: matriculeCible.trim(),
            nom: cloudData.nom || cloudData.name || '',
            prenoms: cloudData.prenoms || cloudData.prenom || '',
            role: roleDetermine, 
            statut: (cloudData.statut || "actif").trim().toLowerCase(),
            schoolId: cloudData.schoolId || 'lycee_Moderne_Gagnoa',
            matiereEnseignee: cloudData.matiereEnseignee || 'Français',
            classeId: classeAssigneeOfficielle, 
            grade: cloudData.grade || user?.grade || 'A3',
            experience: cloudData.anneesExperience || cloudData.experience || "20", 
            absences: cloudData.absences || 0,
            retards: cloudData.retards || 0
          };

          setUser(updatedUser);
          sessionStorage.setItem("sgs_user", JSON.stringify(updatedUser));
        }
      } catch (err) {
        console.error("Erreur sync Auth :", err);
      }
      setLoading(false);
    };

    refreshUserStatus();
  }, [user?.matricule, user?.id]);

  // 🔑 CONNEXION INITIALE CLIENTS DÉBLOQUÉE
  const login = async (matricule, password) => {
    setLoading(true);
    try {
      const result = await verifyUserOnCloud(matricule, password);

      if (result?.success) {
        // Extraction et sécurisation de la clé d'établissement d'origine
        const originalSchoolId = result.user.schoolId ? result.user.schoolId.trim() : 'lycee_Moderne_Gagnoa';
        
        // Label d'affichage cosmétique propre pour l'interface
        const cleanDisplayName = originalSchoolId.replace(/_/g, " ").toUpperCase();

        const profil = {
          id: result.user.matricule, 
          matricule: result.user.matricule,
          nom: result.user.nom || result.user.name || '',
          prenoms: result.user.prenoms || result.user.prenom || '',
          role: result.user.role || 'professeur',
          statut: (result.user.statut || "actif").trim().toLowerCase(),
          classeId: result.user.classeId || '5eme_1',
          schoolId: originalSchoolId, // 🟢 FIXE IMMUTABLE : Conserve la vraie clé Firestore (ex: lycee_Moderne_Gagnoa)
          matiereEnseignee: result.user.matiereEnseignee || 'Français', 
          grade: result.user.grade || 'A3',
          experience: result.user.anneesExperience || "20",
          absences: result.user.absences || 0,
          retards: result.user.retards || 0
        };

        setUser(profil);
        setSchoolId(originalSchoolId);
        setSchoolName(cleanDisplayName);

        // Remplissage étanche du stockage persistant
        sessionStorage.setItem("sgs_user", JSON.stringify(profil));
        sessionStorage.setItem("sgs_school_id", originalSchoolId);
        sessionStorage.setItem("sgs_school_name", cleanDisplayName);

        setLoading(false);
        return { success: true, role: profil.role };
      }

      setLoading(false);
      return { success: false, msg: result?.msg || "Identifiants incorrects" };
    } catch (error) {
      console.error(error);
      setLoading(false);
      return { success: false, msg: "Erreur de communication cloud." };
    }
  };

  const logout = () => {
    setUser(null);
    setSchoolId("");
    setSchoolName("");
    sessionStorage.clear();
    localStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, schoolName, schoolId, loading, login, logout, setUser, setSchoolId, setSchoolName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
};
