import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';

const RechercheEleveAdmin = () => {
  const { schoolId } = useAuth();
  const currentSchool = schoolId || 'lycee_saint_bernard';

  // --- ÉTATS CONTROLÉS ---
  const [recherche, setRecherche] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [classesPP, setClassesPP] = useState({}); // Cartographie dynamique des profs principaux {matricule: nom_classe}
  const [profilSelectionne, setProfilSelectionne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [badgeMsg, setBadgeMsg] = useState(''); 

  // 🔄 ÉCOUTEUR 1 : Annuaire des utilisateurs en temps réel
  useEffect(() => {
    if (!currentSchool) return;

    const q = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool.trim().toLowerCase())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur annuaire global :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // 🔄 ÉCOUTEUR 2 : Cartographie relationnelle des classes pour identifier les Professeurs Principaux (PP)
  useEffect(() => {
    if (!currentSchool) return;

    const qClasses = query(
      collection(db, "classes"),
      where("schoolId", "==", currentSchool.trim().toLowerCase())
    );

    const unsubscribe = onSnapshot(qClasses, (snapshot) => {
      const mapping = {};
      snapshot.forEach(docSnap => {
        const cData = docSnap.data();
        if (cData.profPrincipalId) {
          // Liaison entre le matricule du prof et le nom propre de sa classe
          mapping[cData.profPrincipalId.trim()] = cData.nom || cData.idBrute || "Classe";
        }
      });
      setClassesPP(mapping);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // 🔍 MOTEUR DE RECHERCHE UNIFIÉ ET ADAPTATIF
  const elevesFiltres = allUsers.filter((user) => {
    const nomFils = String(user?.nom || user?.name || "").toLowerCase();
    const prenomFils = String(user?.prenoms || user?.prenom || "").toLowerCase();
    const matriculeFils = String(user?.matricule || user?.id || "").toLowerCase();
    const termeSaisi = recherche.toLowerCase().trim();

    return (
      nomFils.includes(termeSaisi) ||
      prenomFils.includes(termeSaisi) ||
      matriculeFils.includes(termeSaisi)
    );
  });

  const handleRegenererBadge = async (student) => {
    setBadgeMsg(`⏳ Compilation du badge de ${student.nom} en cours...`);
    try {
      await genererFicheAvecQRCodePDF({
        ...student,
        prenom: student.prenoms || student.prenom || ''
      }, student.role === 'eleve' ? 'eleve' : 'personnel');
      
      setBadgeMsg(`🎉 Badge de ${student.nom} généré et téléchargé avec succès !`);
      setTimeout(() => setBadgeMsg(''), 4000);
    } catch (err) {
      setBadgeMsg(`❌ Échec de génération du document PDF.`);
      setTimeout(() => setBadgeMsg(''), 4000);
    }
  };

  const handleChange = (e) => {
    setRecherche(e.target.value);
    if (e.target.value === '') setProfilSelectionne(null);
  };

  if (loading) return <div className="text-center py-4 text-xs font-bold text-gray-400">Synchronisation de l'annuaire de l'établissement...</div>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 font-sans">
      <div className="border-b pb-3 mb-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          🔍 Moteur de Recherche Global & Consultation des Fiches (Élèves, Profs, Éducs)
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Saisissez un matricule, un nom ou un prénom pour inspecter un dossier complet.</p>
      </div>

      {/* Barre de saisie interactive */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="Rechercher un membre (Ex: EDUC_N'GUESSAN_243, PROF_GNANHI_201...)"
          value={recherche}
          onChange={handleChange}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
        />
        <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">🔍</span>
      </div>

      {/* 📋 LISTE DES RÉSULTATS FLUIDES AVEC BADGES ADAPTATIFS */}
      {elevesFiltres.length > 0 && !profilSelectionne && recherche.trim() !== '' && (
        <div className="mt-2 border rounded-xl bg-white shadow-xl max-h-56 overflow-y-auto divide-y z-50 relative">
          {elevesFiltres.map((item) => {
            const matriculeCle = (item.matricule || item.id || '').trim();
            const estProfPrincipal = !!classesPP[matriculeCle];
            
            return (
              <div 
                key={item.id}
                onClick={() => setProfilSelectionne(item)}
                className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center text-xs transition"
              >
                <div>
                  <span className="font-mono font-black text-gray-400 mr-2">{matriculeCle}</span>
                  <span className="font-bold text-gray-800 uppercase">{item.nom}</span> <span className="font-medium text-gray-600">{item.prenoms || item.prenom}</span>
                </div>
                
                              {/* 🟢 CORRECTIF : Affichage dynamique de la classe de l'élève dans la liste */}
              <span className={`font-extrabold px-2 py-0.5 rounded text-[9px] uppercase ${
                item.role === 'eleve' ? 'bg-blue-600 text-white' :
                estProfPrincipal ? 'bg-purple-600 text-white' :
                item.role === 'professeur' ? 'bg-purple-100 text-purple-700' :
                item.role === 'educateur' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {item.role === 'eleve' 
                  ? `${item.classeNom || item.classe || item.classeId || 'Élève'}`.replace(/_/g, ' ') 
                  : estProfPrincipal 
                    ? `PP — ${classesPP[matriculeCle]}` 
                    : item.role
                }
              </span>

              </div>
            );
          })}
        </div>
      )}

      {recherche.trim() !== '' && elevesFiltres.length === 0 && (
        <p className="text-[11px] text-red-500 font-bold mt-2">❌ Aucune correspondance trouvée dans l'annuaire de votre école.</p>
      )}

      {/* ================= 🗂️ AFFICHAGE DU DOSSIER MULTI-RÔLES DYNAMIQUE ================= */}
      {profilSelectionne && (() => {
        const profilMatricule = (profilSelectionne.matricule || profilSelectionne.id || '').trim();
        const affectationClassePP = classesPP[profilMatricule];

        return (
          <div className="mt-6 border border-gray-200 bg-gray-50/30 rounded-xl p-5 animate-fadeIn">
            
            {/* BLOC DE NOTIFICATION PDF */}
            {badgeMsg && (
              <div className="mb-4 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500 animate-pulse">
                {badgeMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-3 mb-4">
              <div>
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                  profilSelectionne.role === 'eleve' ? 'bg-blue-100 text-blue-700' :
                  affectationClassePP ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  {profilSelectionne.role === 'eleve' ? `Matricule Élève : ${profilMatricule}` : `Matricule RH : ${profilMatricule}`}
                </span>
                <h4 className="text-lg font-black text-gray-900 uppercase mt-1">
                  {profilSelectionne.nom} <span className="font-normal text-gray-700 lowercase first-letter:uppercase">{profilSelectionne.prenoms || profilSelectionne.prenom}</span>
                </h4>
              </div>
              
              <button
                onClick={() => handleRegenererBadge(profilSelectionne)}
                className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs px-4 py-2.5 rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                🖨️ Imprimer Badge PVC
              </button>
            </div>

            {/* Fiche technique adaptative selon les 3 profils scolaires */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-gray-600">
              
              {/* BOÎTE 1 : STATUT DES ENCADREMENTS (ÉLÈVE, EDUC, PROF, PP) */}
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-2xs">
                <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Affectation Académique</p>
                {profilSelectionne.role === 'eleve' ? (
                  <>
                    <p className="text-sm font-black text-blue-700 mt-1 uppercase">🏛️ Classe : {profilSelectionne.classeId ? profilSelectionne.classeId.replace(/_/g, ' ').replace(/[a-z0-9]+_/i, '') : 'Non assignée'}</p>
                    <p className="text-[11px] mt-0.5 text-gray-500">Niveau d'étude : <span className="font-bold text-gray-700 uppercase">{profilSelectionne.promotion || '6eme'}</span></p>
                  </>
                                ) : profilSelectionne.role === 'educateur' ? (
                  <>
                    <p className="text-sm font-black text-emerald-700 mt-1">👮 Niveau en Charge</p>
                    <p className="text-[11px] mt-0.5 text-gray-500">
                      Promotion gérée : <span className="font-extrabold text-emerald-600 uppercase">{profilSelectionne.assigned_promotion || profilSelectionne.promotion || 'Toutes (Général)'}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black text-purple-700 mt-1">👨‍🏫 Discipline : {profilSelectionne.matiereEnseignee || 'Enseignant'}</p>
                    {affectationClassePP ? (
                      <p className="text-[11px] mt-0.5 text-emerald-600 font-extrabold animate-pulse">👑 Professeur Principal : Classe {affectationClassePP}</p>
                    ) : (
                      <p className="text-[11px] mt-0.5 text-gray-400">Rôle : Enseignant de matière</p>
                    )}
                  </>
                )}
              </div>

              {/* 📦 BOÎTE 2 : COMMUNICATIONS */}
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-2xs">
                <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Canaux de Communication</p>
                <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                  📞 {profilSelectionne.role === 'eleve' ? 'Parent : ' : 'Direct : '} 
                  {profilSelectionne.telephone || 'Non renseigné'}
                </p>
                <p className="text-[11px] mt-0.5 text-gray-400 truncate">E-mail : {profilSelectionne.email || 'Non configuré'}</p>
              </div>

              {/* 📦 BOÎTE 3 : HISTORIQUE ET ABSENCES */}
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-2xs">
                <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Données Cloud & Activité</p>
                {profilSelectionne.role === 'eleve' ? (
                  <>
                    <p className="text-sm font-black mt-1 text-gray-800">
                      Absences : <span className={(profilSelectionne.absences || 0) > 4 ? "text-red-600" : "text-green-600"}>{profilSelectionne.absences || 0} Heures</span>
                    </p>
                    <p className="text-[11px] mt-0.5 text-emerald-600 font-bold">Statut Accès : Autorisé (Actif)</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black mt-1 text-gray-800">Expérience : {profilSelectionne.anneesExperience || profilSelectionne.experience || 1} ans</p>
                    <p className="text-[11px] mt-0.5 text-gray-400">Grade RH : {profilSelectionne.grade || 'A3'}</p>
                  </>
                )}
              </div>
            </div>

            {/* 📊 PIED DE FICHE TECHNIQUE NOSQL COMMUN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs font-medium text-gray-600 border-t border-dashed border-gray-200 pt-4">
              <p>📅 <span className="text-gray-400">Date de Naissance :</span> <span className="text-gray-700 font-bold">{profilSelectionne.dateNaissance || 'Non spécifiée'}</span></p>
              {profilSelectionne.role === 'eleve' ? (
                <>
                  <p>🏫 <span className="text-gray-400">Etablissement d'Origine :</span> <span className="text-gray-700 font-bold">{profilSelectionne.ecoleProvenance || 'N/A'}</span></p>
                  <p>💳 <span className="text-gray-400">Numéro CMU :</span> <span className="text-gray-700 font-mono font-bold">{profilSelectionne.numSecuriteSociale || 'Non fourni'}</span></p>
                </>
              ) : (
                <>
                  <p>🏫 <span className="text-gray-400">Provenance RH :</span> <span className="text-gray-700 font-bold">{profilSelectionne.etablissementProvenance || 'Lycée Saint Bernard'}</span></p>
                  <p>🔑 <span className="text-gray-400">Clé d'accès chiffrée :</span> <span className="text-gray-700 font-mono font-bold">{profilSelectionne.password || 'Non définie'}</span></p>
                </>
              )}
            </div>

          </div>
        );
      })()}
    </div>
  );
};

export default RechercheEleveAdmin;
