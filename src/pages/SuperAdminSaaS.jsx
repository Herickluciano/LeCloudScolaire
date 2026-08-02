import { useState } from 'react';
import { db } from '../services/api'; // Ajustez le chemin vers votre api.js
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const SuperAdminSaaS = () => {
  const [schoolId, setSchoolId] = useState(''); // Clé unique (ex: lycee_oume)
  const [schoolName, setSchoolName] = useState(''); // Nom réel (ex: Lycée Moderne d'Oumé)
  const [adminMatricule, setAdminMatricule] = useState(''); // Identifiant de connexion (ex: ADMIN_OUME)
  const [adminName, setAdminName] = useState(''); // Nom du Proviseur
  const [adminPassword, setAdminPassword] = useState('password123'); // Mot de passe par défaut

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleProvisionSchool = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);

    const sIdClean = schoolId.trim().toLowerCase().replace(/\s+/g, '_');
    const matriculeClean = adminMatricule.trim().toUpperCase();

    if (!sIdClean || !schoolName.trim() || !matriculeClean || !adminName.trim()) {
      setError('Veuillez remplir tous les champs de configuration.');
      setLoading(false);
      return;
    }

    try {
      // 1. Vérifier si l'école existe déjà
      const schoolRef = doc(db, "schools", sIdClean);
      const schoolSnap = await getDoc(schoolRef);

      if (schoolSnap.exists()) {
        setError('Ce code d\'établissement existe déjà sur la plateforme.');
        setLoading(false);
        return;
      }

      // 2. ÉCRITURE TABLE MAÎTRESSE : Création de la compagnie/école
      await setDoc(schoolRef, {
        nom: schoolName.trim(),
        status: "actif",
        createdAt: new Date().toISOString()
      });

      // 3. ÉCRITURE TABLE RELATIONNELLE : Création immédiate du compte Admin de cette école
      await setDoc(doc(db, "users", matriculeClean), {
        name: adminName.trim(),
        role: "admin",
        schoolId: sIdClean,
        password: adminPassword.trim()
      });

      setStatus(`🎉 Succès ! L'espace a été provisionné en temps réel.\n\n🏫 Établissement : ${schoolName}\n🔐 Identifiant Admin : ${matriculeClean}\n🔑 Mot de passe : ${adminPassword}`);
      
      // Réinitialisation
      setSchoolId('');
      setSchoolName('');
      setAdminMatricule('');
      setAdminName('');
    } catch (err) {
      console.error(err);
      setError(`Erreur Cloud : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans flex items-center justify-center">
      <div className="w-full max-w-xl bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-orange-400">🚀 Plateforme Midnight — Super Admin SaaS</h2>
          <p className="text-xs text-slate-400 mt-1">Génération des accès d'administration et activation des licences clients</p>
        </div>

        <form onSubmit={handleProvisionSchool} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">1. Code Unique École (Slug)</label>
              <input type="text" placeholder="Ex: lycee_oume" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">2. Nom Réel Établissement</label>
              <input type="text" placeholder="Ex: Lycée Moderne d'Oumé" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4 mt-2">
            <h3 className="text-xs font-bold text-orange-400 uppercase mb-3 tracking-wider">🔐 Configuration du premier accès Admin Client</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Matricule / Identifiant Connexion</label>
                <input type="text" placeholder="Ex: ADMIN_OUME" value={adminMatricule} onChange={(e) => setAdminMatricule(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Nom Complet du Gestionnaire</label>
                <input type="text" placeholder="Ex: M. le Proviseur" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Mot de passe initial de l'école</label>
              <input type="text" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-sm focus:outline-none font-mono" />
            </div>
          </div>

          {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 text-xs rounded-lg font-bold">{error}</div>}
          {status && <div className="p-4 bg-slate-900 border border-slate-700 text-emerald-400 text-xs rounded-lg font-mono whitespace-pre-line shadow-inner">{status}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-orange-500 text-white font-bold p-3 rounded-lg text-sm hover:bg-orange-600 transition shadow-lg flex justify-center items-center disabled:bg-orange-300"
          >
            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : '🚀 Provisionner l\'Espace Client & Générer les Accès'}
          </button>
          <button 
      onClick={() => navigate('/login')} 
      className="absolute top-6 left-6 text-xs font-bold bg-slate-800 border border-slate-700 hover:bg-slate-700 px-4 py-2 rounded-lg transition"
    >
      ⬅️ Retour au Login
    </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminSaaS;
