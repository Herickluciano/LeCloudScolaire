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
// CONFIGURATION VARIABLE D'ENVIRONNEMENT PROJET MIDNIGHT
// ============================================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDOt_1bIuRpdrFn2IHw1uMpFjy2fYVC1Ew",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "://firebaseapp.com",
  databaseURL: "https://firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "midnight-9d901",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "midnight-9d901.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "360989143638",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:360989143638:web:768ed5be1b177a82e1c1f7",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PWY6DRVBE7"
};

// ============================================================
// INITIALISATION UNIQUE DE L'APPLICATION (ANTI-DUPLICATE HMR)
// ============================================================
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialisation asynchrone sécurisée de Google Analytics
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
// UTILITAIRES DE RECONNAISSANCE ET NORMALISATION
// ============================================================
export const nettoyerTexte = (value) => String(value ?? "").trim();

export const normaliserTexte = (value) =>
  nettoyerTexte(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// ============================================================
// 🔑 AUTHENTIFICATION 100% TEMPS RÉEL (AVEC ACCÈS MAÎTRE ROOT)
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

    // 🟢 ACCÈS COUPE-FILTRES : Validation du compte ROOT Maître d'urgence
    if (identifiantSaisi.toUpperCase() === "ROOT_LUHAMCODE_2024" && motDePasseSaisi === "HERICK2024") {
      console.log("🔑 Connexion d'urgence Super-Admin ROOT interceptée avec succès.");
      return {
        success: true,
        user: {
          id: "ROOT_LUHAMCODE_2024",
          matricule: "ROOT_LUHAMCODE_2024",
          nom: "SUPER-ADMIN",
          prenoms: "Edulink",
          role: "super_admin",
          schoolId: "lycee_saint_bernard",
          schoolName: "Portail Central Edulink _ Le lien scolaire",
          statut: "actif"
        }
      };
    }

    const usersRef = collection(db, "users");
    let userSnap = null;

    // 1. Recherche par identifiant brut
    const directRef = doc(db, "users", identifiantSaisi);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      userSnap = directSnap;
    }

    // 2. Recherche par identifiant en majuscules
    if (!userSnap) {
      const upperId = identifiantSaisi.toUpperCase();
      const upperRef = doc(db, "users", upperId);
      const upperSnap = await getDoc(upperRef);

      if (upperSnap.exists()) {
        userSnap = upperSnap;
      }
    }

    // 3. Recherche par champ matricule
    if (!userSnap) {
      const q = query(usersRef, where("matricule", "==", identifiantSaisi));
      const result = await getDocs(q);

      if (!result.empty) {
        // 🟢 FIX : Récupération du premier document de la liste
        userSnap = result.docs[0];
      }
    }

    // 4. Recherche par champ matricule en majuscules
    if (!userSnap) {
      const q = query(usersRef, where("matricule", "==", identifiantSaisi.toUpperCase()));
      const result = await getDocs(q);

      if (!result.empty) {
        // 🟢 FIX : Récupération du premier document de la liste
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

    // Vérification du statut actif
    if (userData.statut && normaliserTexte(userData.statut) === "inactif") {
      return {
        success: false,
        msg: "Ce compte est actuellement inactif.",
      };
    }

    // Comparaison des mots de passe NoSQL
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
// 🏛️ CRÉATION CLASSE SAAS
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
// 🧑‍💼 INSCRIPTION ÉLÈVE SAAS (AVEC SÉCURISATION DU COMPTEUR REEL)
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

        if (nombreEleves >= 100) {
          return {
            success: false,
            msg: "Limite de 100 élèves atteinte.",
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Mutation atomique d'écriture de la fiche de l'élève
        await setDoc(doc(db, "users", cleanMatricule), finalData);

        // Incrémentation synchronisée du compteur
        await updateDoc(classRef, {
          elevesCount: nombreEleves + 1,
          updatedAt: new Date()
        });

        return { success: true, id: cleanMatricule, data: finalData };
      }
    }

    // Ré-aiguillage alternatif si la classe n'est pas configurée dans Firestore
    const fallbackData = {
      ...studentData,
      id: cleanMatricule,
      matricule: cleanMatricule,
      role: "eleve",
      statut: "actif",
      schoolId: currentSchool,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setDoc(doc(db, "users", cleanMatricule), fallbackData);
    return { success: true, id: cleanMatricule, data: fallbackData };

  } catch (error) {
    console.error("Erreur d'inscription élève :", error);
    return {
      success: false,
      msg: error.message,
    };
  }
};

// ============================================================
// 📚 RÉCUPÉRER TOUS LES ENSEIGNANTS (STANDARD & PRINCIPAUX)
// ============================================================
export const getAllProfesseursFromFirebase = async (schoolId) => {
  try {
    // 🟢 AMÉLIORATION : On récupère tous les utilisateurs pour filtrer les deux rôles enseignants
    const snapshot = await getDocs(collection(db, "users"));
    
    const resultats = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.role === "professeur" || p.role === "prof_principal");
    
    if (schoolId) {
      const ecoleCible = schoolId.trim().toLowerCase();
      return resultats.filter(p => (p.schoolId || '').toString().trim().toLowerCase() === ecoleCible);
    }
    return resultats;
  } catch (error) {
    console.error("Erreur getAllProfesseurs :", error);
    return [];
  }
};

// ============================================================
// 📋 RÉCUPÉRER TOUS LES ÉDUCATEURS
// ============================================================
export const getAllEducateursFromFirebase = async (schoolId) => {
  try {
    const snapshot = await getDocs(query(collection(db, "users"), where("role", "==", "educateur")));
    const resultats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (schoolId) {
      const ecoleCible = schoolId.trim().toLowerCase();
      return resultats.filter(e => (e.schoolId || '').toString().trim().toLowerCase() === ecoleCible);
    }
    return resultats;
  } catch (error) {
    console.error("Erreur getAllEducateurs :", error);
    return [];
  }
};

// ============================================================
// 📦 ENCAPSULATION FINALE POUR LES EXPORTS CONSOLIDÉS
// ============================================================
const apiCentralExports = {
  db,
  storage,
  analytics,
  nettoyerTexte,
  normaliserTexte,
  verifyUserOnCloud,
  createClassOnFirebase,
  enrollStudentOnFirebase,
  getAllProfesseursFromFirebase,
  getAllEducateursFromFirebase
};

export default apiCentralExports;
