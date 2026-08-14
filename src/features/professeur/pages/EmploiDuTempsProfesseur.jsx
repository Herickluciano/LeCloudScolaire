import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const EmploiDuTempsProfesseur = () => {
  const { user, schoolId } = useAuth();
  const [monPlanning, setMonPlanning] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();
  const idProfLogge = user?.id || user?.matricule || sessionStorage.getItem('sgs_user_id') || '';

  useEffect(() => {
    if (!idProfLogge || !currentSchool) {
      setLoading(false);
      return;
    }

    // Requête temps réel pour récupérer la fiche d'emploi du temps de ce professeur spécifique
    const q = query(
      collection(db, 'emplois_du_temps'),
      where('schoolId', '==', currentSchool),
      where('professeurId', '==', idProfLogge.trim())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let coursTrouves = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (Array.isArray(data.creneaux)) {
          coursTrouves = [...coursTrouves, ...data.creneaux];
        }
      });

      // Tri chronologique des heures de cours
      coursTrouves.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
      setMonPlanning(coursTrouves);
      setLoading(false);
    }, (error) => {
      console.error("Erreur récupération planning prof :", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [idProfLogge, currentSchool]);

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">⏳ Synchronisation de votre feuille de route...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen text-gray-700">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-left">
        <h2 className="text-base font-black text-slate-900 uppercase border-b pb-3 mb-4 flex items-center gap-2">
          📅 Mon Emploi du Temps Officiel — Mission Quotidienne
        </h2>

        <div className="bg-slate-50 p-4 rounded-xl border mb-6 text-xs font-bold space-y-1">
          <p>👨‍🏫 <strong>Professeur :</strong> {user?.name || `${user?.nom || ''} ${user?.prenoms || ''}`}</p>
          <p>📚 <strong>Discipline :</strong> {user?.matiere || user?.specialite || 'Général'}</p>
          <p>🏛️ <strong>Établissement :</strong> {sessionStorage.getItem('sgs_school_name') || 'Lycée Saint Bernard'}</p>
        </div>

        {monPlanning.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-amber-600 bg-amber-50 rounded-xl border border-dashed border-amber-200 uppercase">
            ⚠️ Aucun créneau horaire ne vous a encore été assigné par la direction.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase font-black text-[10px] tracking-wider">
                  <th className="p-3">Horaires de Service</th>
                  <th className="p-3">Classe / Structure Pédagogique</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                {monPlanning.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-orange-600">⏰ {c.heureDebut} — {c.heureFin}</td>
                    <td className="p-3 font-black text-blue-900 uppercase">🏛️ {c.nomClasse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmploiDuTempsProfesseur;
