import { createContext, useContext, useState, useEffect } from 'react';
import api, { db } from '../services/api';
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

  // 🔄 ÉCOUTEUR LIVE AVEC EXTRACTEUR D'INDEX SECURISÉ
  useEffect(() => {
    const refreshUserStatus = async () => {
      const matriculeCible = user?.matricule || user?.id || (sessionStorage.getItem('sgs_user') ? JSON.parse(sessionStorage.getItem('sgs_user'))?.matricule : null);
      
      if (!matriculeCible || matriculeCible === 'ROOT_LUHAMCODE_2024' || user?.id === 'SUPERADMIN_MASTER') {
        setLoading(false);
        return;
      }

      const firestoreInstance = db || api?.db;
      if (!firestoreInstance) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(firestoreInstance, "users", matriculeCible.trim());
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const cloudData = snap.data();
          let classeAssigneeOfficielle = cloudData.classeId || '';
          let roleDetermine = cloudData.role || 'professeur';

          if (roleDetermine === 'professeur' || roleDetermine === 'prof_principal') {
            const qClasseCheck = query(
              collection(firestoreInstance, "classes"),
              where("profPrincipalId", "==", matriculeCible.trim())
            );
            const classSnapshot = await getDocs(qClasseCheck);
            
            // 🟢 CORRECTIF : Ciblage direct du premier index pour tuer le plantage de boucle
            if (!classSnapshot.empty && classSnapshot.docs.length > 0) {
              roleDetermine = 'prof_principal'; 
              const classeDoc = classSnapshot.docs[0].data();
              classeAssigneeOfficielle = classeDoc.idBrute || classeDoc.id || ''; 
            }
          }

          const updatedUser = {
            ...user,
            id: matriculeCible.trim(),
            matricule: matriculeCible.trim(),
            nom: cloudData.nom || cloudData.name || '',
            prenoms: cloudData.prenoms || cloudData.prenom || '',
            role: roleDetermine, 
            statut: (cloudData.statut || "actif").trim().toLowerCase(),
            schoolId: cloudData.schoolId || 'lycee_saint_bernard',
            matiereEnseignee: cloudData.matiereEnseignee || '',
            classeId: classeAssigneeOfficielle, 
            grade: cloudData.grade || user?.grade || 'A3',
            experience: cloudData.anneesExperience || cloudData.experience || "0", 
            absences: cloudData.absences || 0,
            retards: cloudData.retards || 0
          };

          setUser(updatedUser);
          sessionStorage.setItem("sgs_user", JSON.stringify(updatedUser));
          
          if (cloudData.schoolId) {
            setSchoolId(cloudData.schoolId);
            sessionStorage.setItem("sgs_school_id", cloudData.schoolId);
          }
        }
      } catch (err) {
        console.error("Erreur de rafraîchissement atténuée :", err);
      } finally {
        setLoading(false);
      }
    };

    refreshUserStatus();
  }, [user?.matricule, user?.id]);

  const login = async (matriculeInput, passwordInput) => {
    setLoading(true);
    try {
      const authService = api?.verifyUserOnCloud || verifyUserOnCloud;
      const res = await authService(matriculeInput, passwordInput);

      if (res && res.success && res.user) {
        const u = res.user;
        setUser(u);
        setSchoolId(u.schoolId || 'lycee_saint_bernard');
        setSchoolName(u.schoolName || 'Lycée Saint Bernard');
        
        sessionStorage.setItem("sgs_user", JSON.stringify(u));
        sessionStorage.setItem("sgs_school_id", u.schoolId || "lycee_saint_bernard");
        sessionStorage.setItem("sgs_school_name", u.schoolName || "Lycée Saint Bernard");
        sessionStorage.setItem("sgs_user_role", u.role || "professeur");
        
        return { success: true, role: u.role };
      }
      return { success: false, msg: res?.msg || "Identifiant ou mot de passe incorrect." };
    } catch (err) {
      return { success: false, msg: "Erreur technique de liaison avec le Cloud." };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null); setSchoolId(''); setSchoolName(''); sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, schoolId, setSchoolId, schoolName, setSchoolName, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être encapsulé au sein d'un AuthProvider.");
  return context;
};
export default AuthProvider;