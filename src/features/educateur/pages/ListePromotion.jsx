// src/features/educateur/pages/ListePromotion.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const ListePromotion = () => {
  const { user, schoolId } = useAuth();
  const navigate = useNavigate(); // 🟢 AJOUTÉ POUR PERMETTRE LA REDIRECTION
  
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();

  // --- ÉTATS NUAGIQUES DU HUB PARTAGÉ ---
  const [eleves, setEleves] = useState([]);
  const [dictionnaireClasses, setDictionnaireClasses] = useState({}); 
  const [loading, setLoading] = useState(true);

  // --- ÉTATS FILTRES ---
  const [termeRecherche, setTermeRecherche] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('all');

  // 🔄 ÉCOUTEUR 1 : Chargement et dictionnaire intelligent des classes
  useEffect(() => {
    if (!currentSchool) return;

    const qClasses = query(collection(db, "classes"), where("schoolId", "==", currentSchool));
    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
      const pucesClasses = {};
      snapshot.forEach((docSnap) => {
        const cData = docSnap.data();
        const rawId = docSnap.id.toLowerCase();
        
        pucesClasses[rawId] = cData.nom || cData.idBrute || docSnap.id;
        
        const segmentId = docSnap.id.replace(`${currentSchool}_`, '').toLowerCase();
        pucesClasses[segmentId] = cData.nom || cData.idBrute || docSnap.id;

        if (cData.idBrute) {
          pucesClasses[cData.idBrute.toLowerCase()] = cData.nom || cData.idBrute;
        }
      });
      setDictionnaireClasses(pucesClasses);
    });

    return () => unsubscribeClasses();
  }, [currentSchool]);

  // 🔄 ÉCOUTEUR 2 : Synchronisation des élèves
  useEffect(() => {
    if (!currentSchool) return;

    const qEleves = query(
      collection(db, "users"), 
      where("schoolId", "==", currentSchool), 
      where("role", "==", "eleve")
    );

    const unsubscribeEleves = onSnapshot(qEleves, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEleves(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribeEleves();
  }, [currentSchool]);

  // --- TRAITEMENT ET FILTRAGE ---
  const elevesFiltres = eleves.filter((e) => {
    const nomComplet = `${e.nom || ''} ${e.prenoms || e.prenom || ''} ${e.matricule || e.id || ''}`.toLowerCase();
    const matcheTexte = nomComplet.includes(termeRecherche.toLowerCase().trim());
    
    const idClasseEleve = String(e.classeId || '').toLowerCase().trim();
    const matcheClasse = classeFiltre === 'all' || idClasseEleve === classeFiltre;
    
    return matcheTexte && matcheClasse;
  });

  if (loading) {
    return <div className="p-8 text-center text-xs font-black text-purple-600 animate-pulse uppercase">Chargement du registre...</div>;
  }

  return (
    <div className="space-y-4 text-left">
      
      {/* BARRE DE FILTRAGE ET RECHERCHE RAPIDE */}
      <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select 
            value={classeFiltre} 
            onChange={(e) => setClasseFiltre(e.target.value)}
            className="bg-gray-50 border rounded-xl px-3 py-2 outline-none text-xs font-black text-purple-700 cursor-pointer bg-white"
          >
            <option value="all">🔍 Toutes les classes</option>
            {Object.entries(dictionnaireClasses)
              .filter(([key]) => !key.includes(currentSchool)) 
              .map(([id, nom]) => (
                <option key={id} value={id}>🔹 {String(nom).toUpperCase()}</option>
            ))}
          </select>

          {/* 🟢 BOUTON DE REDIRECTION VERS LE DASHBOARD ÉDUCATEUR (SÉCURISÉ PAR RÔLE) */}
          {user?.role === 'educateur' && (
            <button
              type="button"
              onClick={() => navigate('/educateur/dashboard')}
              className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase px-4 py-2 rounded-xl transition shadow-sm border-0 cursor-pointer flex items-center gap-1.5"
            >
              📊 Ouvrir le Tableau Éducateur
            </button>
          )}
        </div>

        <input 
          type="text" 
          placeholder="Rechercher un élève..." 
          value={termeRecherche} 
          onChange={(e) => setTermeRecherche(e.target.value)} 
          className="w-full sm:max-w-md bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 bg-white" 
        />
      </div>

      {/* ================= LE TABLEAU DES PROMOTIONS COMPLET ================= */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-fadeIn">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100 text-[10px] tracking-wider">
                <th className="p-4">Élève</th>
                <th className="p-4">Matricule</th>
                <th className="p-4">Classe</th>
                <th className="p-4">Email</th>
                <th className="p-4 text-center">Statut</th>
                <th className="p-4 text-right print:hidden">Actions Propres</th>
              </tr>
            </thead>
            <tbody>
              {elevesFiltres.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-400 italic font-medium">Aucun élève dans cette section.</td>
                </tr>
              ) : (
                elevesFiltres.map((e) => {
                  const estActif = e.statut === 'actif';
                  const cléClasseSaisie = String(e.classeId || '').toLowerCase().trim();
                  const nomClasseAffiche = dictionnaireClasses[cléClasseSaisie] || e.promotion || e.classeNom || "Non assignée";

                  return (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50/40 transition">
                      <td className="p-4 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-900 text-orange-400 flex items-center justify-center font-black uppercase text-[11px]">
                          {e.nom ? e.nom.substring(0, 2) : "🎓"}
                        </div>
                        <div>
                          <p className="text-gray-900 font-black uppercase leading-tight">{e.nom}</p>
                          <p className="text-gray-400 font-bold uppercase text-[10px] mt-0.5">{e.prenoms || e.prenom || ''}</p>
                        </div>
                      </td>

                      <td className="p-4 font-mono font-black text-gray-900 text-[11px] tracking-wide">
                        {e.matricule || e.id || "—"}
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-black rounded-lg text-[10px] border border-purple-100 uppercase tracking-wide">
                          🔹 {nomClasseAffiche}
                        </span>
                      </td>

                      <td className="p-4 font-medium text-gray-500 font-sans lowercase">
                        {e.email || "—"}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${estActif ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {e.statut || 'actif'}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-2 whitespace-nowrap print:hidden">
                        <button 
                          type="button" 
                          onClick={() => alert(`Visualisation du bulletin de : ${e.nom}`)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase cursor-pointer transition"
                        >
                          📜 Bulletin
                        </button>
                        
                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                          <button 
                            type="button"
                            onClick={() => alert(`Archivage : ${e.matricule}`)}
                            className="text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg font-black text-[10px] uppercase cursor-pointer transition"
                          >
                            ⚠️ Archiver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ListePromotion;
