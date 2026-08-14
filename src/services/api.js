// src/services/api.js

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import { getStorage } from "firebase/storage";

// ============================================================
// FIREBASE CONFIG
// ============================================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// ============================================================
// INITIALISATION UNIQUE
// ============================================================

const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

// ============================================================
// FIRESTORE / STORAGE
// ============================================================

export const db = getFirestore(app);
export const storage = getStorage(app);

// ============================================================
// ANALYTICS
// ============================================================

let analytics = null;

if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      analytics = null;
    });
}

// ============================================================
// UTILITAIRES
// ============================================================

export const nettoyerTexte = (value) =>
  String(value ?? "").trim();

export const normaliserTexte = (value) =>
  nettoyerTexte(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// ============================================================
// CONNEXION UTILISATEUR
// ============================================================

export const verifyUserOnCloud = async (matricule, password) => {
  try {
    const identifiantSaisi = nettoyerTexte(matricule);
    const motDePasseSaisi = nettoyerTexte(password);

    if (!identifiantSaisi || !motDePasseSaisi) {
      return {
        success: false,
        msg: "Identifiant ou mot de passe manquant.",
      };
    }

    const usersRef = collection(db, "users");
    let userSnap = null;

    // Recherche directe
    const directRef = doc(db, "users", identifiantSaisi);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      userSnap = directSnap;
    }

    // Recherche majuscule
    if (!userSnap) {
      const upperId = identifiantSaisi.toUpperCase();
      const upperRef = doc(db, "users", upperId);
      const upperSnap = await getDoc(upperRef);

      if (upperSnap.exists()) {
        userSnap = upperSnap;
      }
    }

    // Recherche par matricule
    if (!userSnap) {
      const q = query(usersRef, where("matricule", "==", identifiantSaisi));
      const result = await getDocs(q);

      if (!result.empty) {
        userSnap = result.docs[0];
      }
    }

    // Recherche matricule majuscule
    if (!userSnap) {
      const q = query(usersRef, where("matricule", "==", identifiantSaisi.toUpperCase()));
      const result = await getDocs(q);

      if (!result.empty) {
        userSnap = result.docs[0];
      }
    }

    if (!userSnap) {
      return {
        success: false,
        msg: "Identifiant incorrect ou compte inexistant.",
      };
    }

    const userData = userSnap.data();

    // Compte inactif
    if (userData.statut && normaliserTexte(userData.statut) === "inactif") {
      return {
        success: false,
        msg: "Ce compte est actuellement inactif.",
      };
    }

    // Vérification mot de passe
    const passwordCandidates = [
      userData.password,
      userData.motDePasse,
      userData.cleAcces,
    ].filter(Boolean);

    const passwordCorrecte = passwordCandidates.includes(motDePasseSaisi);

    if (!passwordCorrecte) {
      return {
        success: false,
        msg: "Mot de passe erroné.",
      };
    }

    return {
      success: true,
      user: {
        ...userData,
        id: userSnap.id,
        matricule: userData.matricule || userSnap.id,
        role: userData.role || "professeur",
        schoolId: userData.schoolId || "lycee_saint_bernard",
        schoolName: userData.schoolName || userData.etablissementActuel || "Lycée Saint Bernard",
        statut: userData.statut || "actif",
      },
    };

  } catch (error) {
    console.error("❌ Erreur verifyUserOnCloud :", error);
    return {
      success: false,
      msg: "Erreur réseau avec l'infrastructure Cloud.",
    };
  }
};

// ============================================================
// CRÉATION CLASSE
// ============================================================

export const createClassOnFirebase = async (classId, classData, schoolId) => {
  try {
    const currentSchool = nettoyerTexte(schoolId) || "lycee_saint_bernard";
    const uniqueClassKey = `${currentSchool.toLowerCase()}_${nettoyerTexte(classId).toLowerCase()}`;
    const classRef = doc(db, "classes", uniqueClassKey);

    const dataToSave = {
      ...classData,
      id: uniqueClassKey,
      idBrute: classId,
      schoolId: currentSchool,
      nom: classData.nom || classData.name || classId,
      createdAt: classData.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await setDoc(classRef, dataToSave);

    return {
      success: true,
      id: uniqueClassKey,
      data: dataToSave,
    };

  } catch (error) {
    console.error("Erreur création classe :", error);
    return {
      success: false,
      msg: error.message,
    };
  }
};

// ============================================================
// INSCRIPTION ÉLÈVE
// ============================================================

export const enrollStudentOnFirebase = async (studentMatricule, studentData, schoolId) => {
  try {
    const currentSchool = nettoyerTexte(schoolId) || "lycee_saint_bernard";
    const cleanMatricule = nettoyerTexte(studentMatricule);
    const cleanClassId = nettoyerTexte(studentData.classeId || studentData.classId || "").toLowerCase();

    if (!cleanMatricule) {
      throw new Error("Le matricule est obligatoire.");
    }

    if (cleanClassId) {
      const uniqueClassKey = `${currentSchool.toLowerCase()}_${cleanClassId}`;
      const classRef = doc(db, "classes", uniqueClassKey);
      const classSnap = await getDoc(classRef);

      if (classSnap.exists()) {
        const classInfo = classSnap.data();
        const nombreEleves = Number(classInfo.elevesCount || 0);

        if (nombreEleves >= 50) {
          return {
            success: false,
            msg: "Limite de 50 élèves atteinte.",
          };
        }

        const finalData = {
          ...studentData,
          id: cleanMatricule,
          matricule: cleanMatricule,
          classeId: uniqueClassKey,
          classeNom: classInfo.nom || cleanClassId,
          classe: classInfo.nom || cleanClassId,
          promotion: classInfo.promotion || studentData.promotion || "",
          role: "eleve",
          statut: "actif",
          schoolId: currentSchool,
          updatedAt: new Date()
        };

        await setDoc(doc(db, "users", cleanMatricule), finalData);
        await updateDoc(classRef, { elevesCount: nombreEleves + 1 });

        return { success: true, msg: "Élève inscrit avec succès." };
      }
    }
    
    await setDoc(doc(db, "users", cleanMatricule), {
      ...studentData,
      id: cleanMatricule,
      matricule: cleanMatricule,
      role: "eleve",
      statut: "actif",
      schoolId: currentSchool,
      updatedAt: new Date()
    });

    return { success: true, msg: "Élève inscrit (sans classe)." };

  } catch (error) {
    console.error("Erreur inscription élève :", error);
    return { success: false, msg: error.message };
  }
};

// ============================================================
// RÉCUPÉRATION DES PROFESSEURS
// ============================================================

export const getAllProfesseursFromFirebase = async (schoolId) => {
  try {
    const currentSchool = nettoyerTexte(schoolId) || "lycee_saint_bernard";
    const usersRef = collection(db, "users");
    
    const q = query(
      usersRef, 
      where("schoolId", "==", currentSchool),
      where("role", "in", ["professeur", "prof_principal"])
    );
    
    const snapshot = await getDocs(q);
    const liste = [];
    
    snapshot.forEach((docSnap) => {
      liste.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    return { success: true, data: liste };
  } catch (error) {
    console.error("Erreur getAllProfesseursFromFirebase :", error);
    return { success: false, msg: error.message, data: [] };
  }
};

// ============================================================
// RÉCUPÉRATION DES ÉDUCATEURS
// ============================================================

export const getAllEducateursFromFirebase = async (schoolId) => {
  try {
    const currentSchool = nettoyerTexte(schoolId) || "lycee_saint_bernard";
    const usersRef = collection(db, "users");
    
    const q = query(
      usersRef, 
      where("schoolId", "==", currentSchool),
      where("role", "==", "educateur")
    );
    
    const snapshot = await getDocs(q);
    const liste = [];
    
    snapshot.forEach((docSnap) => {
      liste.push({ id: docSnap.id, ...docSnap.data() });
    });
    
        return { success: true, data: liste };
  } catch (error) {
    console.error("Erreur getAllEducateursFromFirebase :", error);
    return { success: false, msg: error.message, data: [] };
  }
};

// ============================================================
// MODULE D'EXPORTATION PAR DÉFAUT GLOBAL
// ============================================================

const api = {
  db,
  storage,
  analytics,
  nettoyerTexte,
  normaliserTexte,
  verifyUserOnCloud,
  createClassOnFirebase,
  enrollStudentOnFirebase,
  getAllProfesseursFromFirebase,
  getAllEducateursFromFirebase,
};

export default api;
