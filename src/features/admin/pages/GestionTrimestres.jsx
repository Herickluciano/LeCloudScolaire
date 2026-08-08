import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';

const GestionTrimestres = () => {
  const { schoolId } = useAuth();
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

  const [trimestreActif, setTrimestreActif] = useState('1');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');

  // 🔄 ÉCOUTE EN TEMPS RÉEL DE LA PÉRIODE SCOLAIRE GLOBALE
  useEffect(() => {
    if (!currentSchool) return;

    const schoolRef = doc(db, "schools", currentSchool);
    const unsub = onSnapshot(schoolRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTrimestreActif(String(data.trimestreActif || '1'));
      }
      setLoading(false);
    });

    return () => unsub();
  }, [currentSchool]);

  // 🚀 ACTION : BASCULER D'UNE PÉRIODE À L'AUTRE ET TOUT ACTUALISER
  const handleChangerTrimestreGlobal = async (nouveauTrimestre) => {
    if (!window.confirm(`⚠️ Êtes-vous sûr de vouloir basculer l'établissement sur le Trimestre ${nouveauTrimestre} ? Cela réinitialisera les compteurs actifs des profs et éducateurs.`)) return;

    setUpdating(true);
    try {
      const schoolRef = doc(db, "schools", currentSchool);
      await updateDoc(schoolRef, {
        trimestreActif: nouveauTrimestre,
        updatedAt: new Date().toISOString()
      });
      setMessage(`🎉 Succès ! L'école est passée au Trimestre ${nouveauTrimestre}. Tout le système s'est actualisé.`);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la mise à jour de la période globale.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Chargement des verrous temporels...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans text-gray-700 text-left animate-fadeIn">
      
      {/* BOUTON RETOUR */}
      <div className="mb-4">
        <Link to="/admin/dashboard" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
          ⬅️ Tableau de Bord Admin
        </Link>
      </div>

      {/* EN-TÊTE */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xs mb-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
          🔐 Clôture et Verrouillage Institutionnel
        </span>
        <h2 className="text-xl font-black text-gray-800 mt-2">Contrôle des Périodes Trimestrielles</h2>
        <p className="text-xs text-gray-400 font-medium mt-0.5">En tant qu'administrateur, vous ouvrez et gelez les trimestres de l'année scolaire en cours [local].</p>
      </div>

      {message && <div className="mb-6 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500 animate-pulse">{message}</div>}

      {/* PANNEAU DE CONTRÔLE SOUVERAIN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* STATUT ACTUEL */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-between shadow-md">
          <div>
            <span className="text-[10px] font-black uppercase text-orange-400">Horloge Scolaire Active</span>
            <p className="text-3xl font-black mt-2 font-mono">TRIMESTRE {trimestreActif}</p>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">Tous les enseignants écrivent actuellement dans les registres liés à cette période.</p>
          </div>
          <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-3 py-1 rounded-full w-fit mt-4 animate-pulse">● SYSTÈME EN DIRECT</span>
        </div>

        {/* BOUTONS DE COMMANDE DE BASCULE */}
        <div className="md:col-span-2 bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2 mb-4">Ouvrir une nouvelle période d'apprentissage</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">Choisir le trimestre d'activité pour l'ensemble des utilisateurs de l'établissement :</p>
            
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => handleChangerTrimestreGlobal('1')} 
                disabled={updating || trimestreActif === '1'}
                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition cursor-pointer ${trimestreActif === '1' ? 'bg-gray-100 text-gray-400 border' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
              >
                1er Trimestre
              </button>
              <button 
                onClick={() => handleChangerTrimestreGlobal('2')} 
                disabled={updating || trimestreActif === '2'}
                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition cursor-pointer ${trimestreActif === '2' ? 'bg-gray-100 text-gray-400 border' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
              >
                2ème Trimestre
              </button>
              <button 
                onClick={() => handleChangerTrimestreGlobal('3')} 
                disabled={updating || trimestreActif === '3'}
                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition cursor-pointer ${trimestreActif === '3' ? 'bg-gray-100 text-gray-400 border' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
              >
                3ème Trimestre
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-dashed border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium">
            💡 <strong>Rappel Historique</strong> : Même si l'école passe au Trimestre 2, l'administration conserve ses accès exclusifs pour consulter les archives et gérer les réclamations de notes sur les périodes passées.
          </div>
        </div>

      </div>
    </div>
  );
};

export default GestionTrimestres;
