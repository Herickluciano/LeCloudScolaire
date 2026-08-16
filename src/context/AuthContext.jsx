// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from 'react'; // 🟢 useMemo est maintenant déclaré !

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

  // 🟢 Extraction et mémorisation de l'ID brute hors du state user pour briser la boucle infinie
  const matriculeFige = useMemo(() => {
    if (user?.matricule || user?.id) return (user.matricule || user.id).trim();
    const saved = sessionStorage.getItem('sgs_user');
    return saved ? (JSON.parse(saved)?.matricule || JSON.parse(saved)?.id || null) : null;
  }, [user?.matricule, user?.id]);

  // 🔄 ÉCOUTEUR ET RAFRAÎCHISSEMENT SÉCURISÉ SANS BOUCLE INFINIE
  useEffect(() => {
    const refreshUserStatus = async () => {
      if (!matriculeFige || matriculeFige === 'ROOT_LUHAMCODE_2024' || matriculeFige === 'SUPERADMIN_MASTER') {
        setLoading(false);
        return;
      }

      const firestoreInstance = db || api?.db;
      if (!firestoreInstance) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(firestoreInstance, "users", matriculeFige);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const cloudData = snap.data();
          let classeAssigneeOfficielle = cloudData.classeId || '';
          let roleDetermine = cloudData.role || 'professeur';

          // Vérification croisée pour l'attribution automatique du statut PP
          if (roleDetermine === 'professeur' || roleDetermine === 'prof_principal') {
            const qClasseCheck = query(
              collection(firestoreInstance, "classes"),
              where("profPrincipalId", "==", matriculeFige)
            );
            const classSnapshot = await getDocs(qClasseCheck);
            
            if (!classSnapshot.empty && classSnapshot.docs.length > 0) {
              roleDetermine = 'prof_principal'; 
              const classeDoc = classSnapshot.docs[0].data();
              classeAssigneeOfficielle = classeDoc.idBrute || classeDoc.id || ''; 
            }
          }

          // Construction du profil rafraîchi
          const updatedUser = {
            id: matriculeFige,
            matricule: matriculeFige,
            nom: cloudData.nom || cloudData.name || '',
            prenoms: cloudData.prenoms || cloudData.prenom || '',
            role: roleDetermine, 
            statut: (cloudData.statut || "actif").trim().toLowerCase(),
            schoolId: cloudData.schoolId || 'lycee_saint_bernard',
            matiereEnseignee: cloudData.matiereEnseignee || '',
            classeId: classeAssigneeOfficielle, 
            promotion: cloudData.promotion || cloudData.assigned_promotion || '', // 🟢 GREFFAGE SÉCURISÉ ÉDUCATEUR
            grade: cloudData.grade || cloudData.grade || 'A3',
            experience: cloudData.anneesExperience || cloudData.experience || "0", 
            absences: cloudData.absences || 0,
            retards: cloudData.retards || 0
          };

          // On ne déclenche la mise à jour que si les données critiques ont changé
          const savedStr = sessionStorage.getItem("sgs_user");
          if (!savedStr || savedStr !== JSON.stringify(updatedUser)) {
            setUser(updatedUser);
            sessionStorage.setItem("sgs_user", JSON.stringify(updatedUser));
          }
          
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
  }, [matriculeFige]); // 🟢 CORRECTIF : Dépendance sur la clé figée uniquement pour tuer la boucle infinie

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
    setUser(null); 
    setSchoolId(''); 
    setSchoolName(''); 
    sessionStorage.clear();
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
