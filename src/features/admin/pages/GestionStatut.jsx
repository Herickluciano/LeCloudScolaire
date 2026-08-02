import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js'; 

const GestionStatut = () => {
  const { schoolId } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  const [recherche, setRecherche] = useState('');
  const [utilisateurs, setAllUsers] = useState([]);
  const [userSelectionne, setUnUserSelectionne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // 🔄 Écoute en temps réel de tous les comptes de l'école (Profs + Élèves)
  useEffect(() => {
    if (!currentSchool) return;
    const q = query(collection(db, "users"), where("schoolId", "==", currentSchool));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllUsers(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentSchool]);

  // Filtrage clavier
  const resultats = recherche.trim() === '' ? [] : utilisateurs.filter(u => {
    const term = recherche.toLowerCase();
    return (u.nom || '').toLowerCase().includes(term) || 
           (u.prenoms || u.prenom || '').toLowerCase().includes(term) || 
           (u.matricule || u.id || '').toLowerCase().includes(term);
  });

  // 🟢 ACTION CLOUD INSTANTANÉE : Verrouiller ou débloquer le compte
  const handleChangeStatut = async (nouveauStatut) => {
    if (!userSelectionne) return;
    try {
      const userRef = doc(db, "users", userSelectionne.id);
      await updateDoc(userRef, { 
        statut: nouveauStatut 
      });
      
      // Actualise instantanément la fiche affichée à l'écran
      setUnUserSelectionne(prev => ({ ...prev, statut: nouveauStatut }));
      setMessage(`🎯 Statut synchronisé sur le Cloud : Compte configuré sur "${nouveauStatut.toUpperCase()}"`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6 text-center text-xs font-bold text-gray-400">Canal de contrôle sécurisé...</div>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 font-sans">
      <div className="border-b pb-3 mb-4">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          🛑 Cellule de Gestion des Statuts, Sanctions & Scolarités
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Suspension immédiate d'accès pour scolarité impayée ou faute lourde administrative.</p>
      </div>

      <input 
        type="text" 
        placeholder="Entrez un Nom, un Matricule ou un ID Personnel..."
        value={recherche}
        onChange={(e) => {
          setRecherche(e.target.value);
          if (e.target.value === '') setUnUserSelectionne(null);
        }}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition"
      />

      {resultats.length > 0 && !userSelectionne && (
        <div className="mt-2 border rounded-xl bg-white shadow-xl max-h-40 overflow-y-auto divide-y relative z-50">
          {resultats.map((u) => (
            <div key={u.id} onClick={() => setUnUserSelectionne(u)} className="p-3 hover:bg-red-50/30 cursor-pointer flex justify-between items-center text-xs transition">
              <div>
                <span className="font-bold uppercase text-gray-800">{u.nom}</span> {u.prenoms || u.prenom} 
                <span className="text-[10px] text-gray-400 font-mono ml-2">({u.matricule || u.id})</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                u.statut === 'actif' || !u.statut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {u.statut || 'actif'}
              </span>
            </div>
          ))}
        </div>
      )}

      {message && <div className="mt-4 p-2.5 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg animate-pulse">{message}</div>}

      {userSelectionne && (
        <div className="mt-6 border border-slate-200 bg-slate-50/50 rounded-xl p-5 animate-fadeIn">
          <div className="flex justify-between items-start border-b pb-3 mb-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase">{userSelectionne.nom} {userSelectionne.prenoms || userSelectionne.prenom}</h4>
              <p className="text-[10px] font-mono text-gray-400 mt-0.5">Rôle système : <span className="uppercase font-bold text-slate-600">{userSelectionne.role}</span></p>
            </div>
            <span className={`text-xs font-black uppercase px-3 py-1 rounded-md ${
              userSelectionne.statut === 'actif' || !userSelectionne.statut ? 'bg-green-600 text-white' :
              userSelectionne.statut === 'suspendu_scolarite' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
            }`}>
              État actuel : {userSelectionne.statut || 'actif'}
            </span>
          </div>

          {/* 🔘 Commutateurs d'états d'urgence administratifs */}
          // 1. Assurez-vous d'avoir cet import tout en haut de GestionStatut.jsx :
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';

// 2. Remplacez le bloc des boutons de bas de page par cette version augmentée :
          {/* 🔘 Commutateurs d'états d'urgence administratifs */}
          <div className="flex flex-wrap gap-2 items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleChangeStatut('actif')} className="bg-white hover:bg-green-50 text-green-600 border border-green-200 text-[11px] font-extrabold px-3 py-2 rounded-lg transition">
                ✅ Autoriser (Actif)
              </button>
              <button onClick={() => handleChangeStatut('suspendu_scolarite')} className="bg-white hover:bg-amber-50 text-amber-600 border border-amber-200 text-[11px] font-extrabold px-3 py-2 rounded-lg transition">
                💳 Scolarité Impayée
              </button>
              <button onClick={() => handleChangeStatut('exclu')} className="bg-white hover:bg-red-50 text-red-600 border border-red-200 text-[11px] font-extrabold px-3 py-2 rounded-lg transition">
                🛑 Exclusion / Faute
              </button>
              <button onClick={() => handleChangeStatut('transfere')} className="bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-extrabold px-3 py-2 rounded-lg transition">
                ✈️ Transféré
              </button>
            </div>

            {/* 🟢 LE BOUTON DE RÉIMPRESSION MAJ EST ICI */}
                        {/* 🔄 Version augmentée avec notification flash */}
                       {/* Le bouton doit uniquement appeler la fonction, rien d'autre ne doit être écrit en dessous */}
            <button 
              onClick={async () => {
                setMessage(`⏳ Traitement et téléchargement du badge de sécurité...`);
                await genererFicheAvecQRCodePDF(
                  { ...userSelectionne, prenom: userSelectionne.prenoms || userSelectionne.prenom }, 
                  userSelectionne.role === 'eleve' ? 'eleve' : 'personnel'
                );
                setMessage(`🎉 Le PDF mis à jour a été enregistré dans vos téléchargements !`);
                setTimeout(() => setMessage(''), 4000);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-[11px] uppercase px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1"
            >
              🖨️ Générer PDF Mis à Jour
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionStatut;
