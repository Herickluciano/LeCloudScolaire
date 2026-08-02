/**
 * 🇨🇮 BASE DE DONNÉES VIDE POUR LA PRODUCTION REAL-TIME
 */
const initialData = {
  classes: [], // Plus de données pré-écrites
  eleves: [],  // Plus de données pré-écrites
  professeurs: [] // Plus de données pré-écrites
};

export const getRealtimeDatabase = () => {
  const localDb = localStorage.getItem('school_saas_realtime_db');
  if (!localDb) {
    localStorage.setItem('school_saas_realtime_db', JSON.stringify(initialData));
    return initialData;
  }
  return JSON.parse(localDb);
};

export const saveRealtimeDatabase = (updatedData) => {
  localStorage.setItem('school_saas_realtime_db', JSON.stringify(updatedData));
};

export let dbData = getRealtimeDatabase();
