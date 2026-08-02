import { db } from './api';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * 🚀 Crée un nouvel abonné (Une école) et lui génère son premier compte ADMIN
 */
export const registerNewSchoolClient = async (schoolSlug, schoolName, adminName, adminPassword) => {
  try {
    const slugClean = schoolSlug.trim().toLowerCase().replace(/\s+/g, '-');
    const schoolRef = doc(db, "schools", slugClean);
    const schoolSnap = await getDoc(schoolRef);

    if (schoolSnap.exists()) {
      return { success: false, msg: "Ce nom d'établissement ou ce lien est déjà utilisé." };
    }

    // 1. Enregistrer l'école dans le registre des abonnés globaux
    await setDoc(schoolRef, {
      schoolName: schoolName.trim(),
      status: "actif",
      createdAt: new Date().toISOString()
    });

    // 2. Initialiser IMMEDIATEMENT le premier compte ADMIN de cette école dans la table users
    const adminRef = doc(db, "users", `${slugClean}_ADMIN`);
    await setDoc(adminRef, {
      name: adminName.trim(),
      role: "admin",
      schoolId: slugClean,
      password: adminPassword.trim() // En production, ce mot de passe sera haché
    });

    return { success: true, schoolId: slugClean };
  } catch (error) {
    console.error("Erreur de création de l'espace client SaaS :", error);
    return { success: false, msg: "Erreur lors du provisionnement de l'espace." };
  }
};
