import React, { useState, useEffect } from 'react';
import { db } from '../../../services/api';
// 🟢 ALIGNEMENT FIRESTORE NoSQL
import { collection, query, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const GestionStatut = () => {
  const { schoolId, schoolName } = useAuth();
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

  // --- ÉTATS ---
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrePromotion, setFiltrePromotion] = useState('all');

  // 🔄 ÉCOUTEUR EN TEMPS RÉEL : Récupération de tous les élèves de l'école
  useEffect(() => {
    if (!currentSchool) return;

    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const schoolCleanDoc = (d.schoolId || '').trim().toLowerCase();
        
        // On isole uniquement les élèves rattachés à cet établissement
        if (schoolCleanDoc === currentSchool && d.role === 'eleve') {
          // Algorithme de cumul NoSQL des points pour l'affichage de la somme des notes
          const sourceNotes = d.notes || {};
          let totalPointsCumules = 0;
          Object.values(sourceNotes).forEach(notesArray => {
            if (Array.isArray(notesArray)) {
              notesArray.forEach(val => totalPointsCumules += (parseFloat(val) || 0));
            }
          });
          list.push({ id: docSnap.id, totalPointsCumules, ...d });
        }
      });
      
      // Tri alphabétique par nom de famille par défaut
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setEleves(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur d'écoute de la table des statuts :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // 🚀 ACTION ADMISTRATEUR : Envoi automatisé du bulletin condensé par e-mail aux familles
  const handleAdminEnvoyerBulletinAuxParents = async (studentTarget) => {
    if (!studentTarget.email) {
      alert("❌ Envoi impossible : L'adresse e-mail de la famille est absente de la fiche NoSQL de cet élève.");
      return;
    }

    try {
      // Calcul synchrone de la moyenne générale d'après les divisions de sa fiche
      const sourceNotes = studentTarget.notes || {};
      let totalPts = 0; 
      let countMat = 0;
      
      Object.values(sourceNotes).forEach(arr => {
        if (Array.isArray(arr) && arr.length > 0) {
          const sommeMat = arr.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
          totalPts += (sommeMat / arr.length);
          countMat++;
        }
      });
      
      const moyenneCalculee = countMat > 0 ? parseFloat((totalPts / countMat).toFixed(2)) : 0;

      // Détermination de la mention d'après vos tranches (0-6: exclus, 7-9: redoublant, 10+: bravo)
      let mentionCourriel = "";
      if (moyenneCalculee >= 10) mentionCourriel = "Félicitations du Conseil de Classe (Passage accordé).";
      else if (moyenneCalculee >= 7) mentionCourriel = "Avertissement de travail : Redoublant du niveau.";
      else mentionCourriel = "Décision d'exclusion définitive pour insuffisance de résultats.";

      // Déclenchement de la requête asynchrone SMTP Node.js
      await fetch("http://localhost:10000/api/send-email", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: studentTarget.email.trim().toLowerCase(),
          to_name: `PARENTS DE L'ÉLÈVE ${studentTarget.nom || ''}`.toUpperCase(),
          school_name: schoolName || "LeCloudScolaire",
          subject_title: `📜 RELEVÉ DE NOTES TRIMESTRIEL CERTIFIÉ NoSQL`,
          sender_title: "Secrétariat Général de la Direction Académique",
          body_text: `Chers parents,\n\nNous vous prions de trouver ci-dessous le bilan d'évaluation de fin de période de votre enfant ${studentTarget.nom?.toUpperCase()} ${studentTarget.prenoms || ''}.\n\n- Moyenne Générale : ${moyenneCalculee.toFixed(2)} / 20\n- Heures d'absences comptabilisées : ${studentTarget.absences || 0} H\n- Décision administrative : ${mentionCourriel}\n\nCe relevé officiel est muni d'un QR Code de certification infalsifiable, consultable et téléchargeable en direct depuis son Espace Personnel Élève.\n\nCordialement,\nLa Direction.`
        })
      });

      alert(`⚡ Le bulletin de notes certifié de ${studentTarget.nom?.toUpperCase()} a été transmis avec succès à sa famille !`);
    } catch (err) {
      console.error("Erreur routage SMTP bulletin :", err);
      alert("❌ Une erreur technique a bloqué l'envoi de l'e-mail.");
    }
  };

  // 🚀 ACTION ADMINISTRATEUR : Mutation ou basculement de statut NoSQL manuel
  const handleChangerStatutManuel = async (studentId, nouveauStatut) => {
    try {
      await updateDoc(doc(db, "users", studentId), {
        statut: nouveauStatut,
        updatedAtStatut: new Date().toISOString()
      });
      alert(`💼 Statut de l'élève mis à jour avec succès en : ${nouveauStatut.toUpperCase()}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtrage à l'écran par promotion
  const elevesFiltres = eleves.filter(st => {
    if (filtrePromotion === 'all') return true;
    return (st.promotion || '').trim().toLowerCase() === filtrePromotion.trim().toLowerCase();
  });

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase tracking-wider">Analyse des registres et des fiches civils...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans text-gray-700 text-left bg-gray-50 min-h-screen animate-fadeIn">
      
      {/* BANDEAU DE COMMANDE */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-3xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-gray-800 uppercase tracking-wide">⚖️ Console de Gestion des Statuts & Décisions Trimestrielles</h2>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Modifiez le statut contractuel des apprenants ou expédiez leur livret de notes aux parents.</p>
        </div>

        {/* FILTRE DE PROMOTION */}
        <div>
          <select 
            value={filtrePromotion} 
            onChange={(e) => setFiltrePromotion(e.target.value)}
            className="bg-gray-50 border p-2 text-xs font-black uppercase rounded-xl outline-none text-gray-800 cursor-pointer bg-white"
          >
            <option value="all">⭐ Toutes les promotions</option>
            <option value="5eme">Promotion 5ème</option>
            <option value="4eme">Promotion 4ème</option>
            <option value="3eme">Promotion 3ème</option>
          </select>
        </div>
      </div>

      {/* TABLEAU CENTRAL DES STATUTS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-3xs p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase border-b text-[10px] tracking-wider">
                <th className="p-3">Matricule</th>
                <th className="p-3">Promotion</th>
                <th className="p-3">Classe</th>
                <th className="p-3">Nom & Prénoms</th>
                <th className="p-3 text-center">Somme Notes</th>
                <th className="p-3 text-center">Fiche Statut</th>
                <th className="p-3 text-right">Actions Comptables & Courriels</th>
              </tr>
            </thead>
            <tbody>
              {elevesFiltres.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-gray-400 italic font-medium">Aucun élève trouvé dans les bases pour cette section.</td></tr>
              ) : (
                elevesFiltres.map((student) => {
                  const estExclu = student.statut === 'exclu';
                  const estRedoublant = student.statut === 'redoublant';

                  return (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-purple-50/10 transition">
                      <td className="p-3 font-mono text-purple-700 truncate max-w-[100px]">{student.matricule || student.id}</td>
                      <td className="p-3 uppercase text-gray-500 font-sans">{student.promotion || "5EME"}</td>
                      <td className="p-3 uppercase text-gray-900 font-black">{student.classeId || "5EME_1"}</td>
                      <td className="p-3 text-gray-900 uppercase font-black truncate max-w-[150px]">{student.nom} {student.prenoms || ''}</td>
                      <td className="p-3 text-center font-mono text-purple-800 text-sm">{student.totalPointsCumules.toFixed(1)} pts</td>
                      
                      {/* CELLULE DU STATUT ACTUEL DE L'APPRENANT */}
                      <td className="p-3 text-center">
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black ${
                          estExclu ? 'bg-red-100 text-red-800' : estRedoublant ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {student.statut || "actif"}
                        </span>
                      </td>

                      {/* 🟢 LA CASE DES ACTIONS CONTENANT VOTRE BOUTON REPOSITIONNÉ */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
                          
                                                    {/* MUTATION RAPIDE DE PRIVILÈGES */}
                          <select
                            onChange={(e) => handleChangerStatutManuel(student.id, e.target.value)}
                            defaultValue={student.statut || "actif"}
                            className="bg-gray-50 border text-[9px] font-black uppercase p-1 rounded-md outline-none text-gray-700 cursor-pointer bg-white"
                          >
                            <option value="actif">✓ Actif</option>
                            <option value="redoublant">⚠️ Redoublant</option>
                            <option value="exclu">❌ Exclue</option>
                          </select>

                          {/* 🟢 LE BOUTON DEMANDÉ : Aligné de façon ergonomique sur chaque ligne */}
                          <button
                            type="button"
                            onClick={() => handleAdminEnvoyerBulletinAuxParents(student)}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-[9px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer border-0 shadow-2xs whitespace-nowrap"
                          >
                            ✉️ Envoyer Bulletin
                          </button>

                        </div>
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

export default GestionStatut;
