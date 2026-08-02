import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';

const RechercheEleveAdmin = () => {
  const { schoolId } = useAuth();
  const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

  // --- ÉTATS CONTROLÉS ---
  const [recherche, setRecherche] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [profilSelectionne, setProfilSelectionne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [badgeMsg, setBadgeMsg] = useState(''); // 🟢 Déclaré proprement en haut

  // 🔄 Écouteur en temps réel de TOUS les utilisateurs de l'établissement SaaS
  useEffect(() => {
    if (!currentSchool) return;

    const q = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur de synchronisation de l'annuaire global :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // 🔍 FILTRAGE MUTLI-CRITÈRES & MULTI-RÔLES EN DIRECT AU CLAVIER
  const resultatsFiltres = recherche.trim() === '' ? [] : allUsers.filter(user => {
    const term = recherche.toLowerCase();
    const idDoc = (user.id || '').toLowerCase();
    const matricule = (user.matricule || '').toLowerCase();
    const nom = (user.nom || '').toLowerCase();
    const prenoms = (user.prenoms || '').toLowerCase();
    const role = (user.role || '').toLowerCase();

    return idDoc.includes(term) || matricule.includes(term) || nom.includes(term) || prenoms.includes(term) || role.includes(term);
  });

  // 🟢 UNIQUE DÉCLARATION : Action de réimpression avec alerte visuelle intégrée
  const handleRegenererBadge = async (student) => {
    setBadgeMsg(`⏳ Compilation du badge de ${student.nom} en cours...`);
    try {
      await genererFicheAvecQRCodePDF({
        ...student,
        prenom: student.prenoms || student.prenom
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
        <p className="text-[11px] text-gray-400 mt-0.5">Saisissez un matricule, un identifiant réseau, un nom ou un prénom pour inspecter un dossier complet.</p>
      </div>

      {/* Barre de saisie interactive */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="Rechercher un membre (Ex: GOUEDE, BOLOU, 26_, Professeur...)"
          value={recherche}
          onChange={handleChange}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
        />
        <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">🔍</span>
      </div>

      {/* 📋 LISTE DES RÉSULTATS FLUIDES AVEC COULEURS DE RÔLES */}
      {resultatsFiltres.length > 0 && !profilSelectionne && (
        <div className="mt-2 border rounded-xl bg-white shadow-xl max-h-56 overflow-y-auto divide-y z-50 relative">
          {resultatsFiltres.map((item) => (
            <div 
              key={item.id}
              onClick={() => setProfilSelectionne(item)}
              className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center text-xs transition"
            >
              <div>
                <span className="font-mono font-black text-gray-400 mr-2">{item.matricule || item.id}</span>
                <span className="font-bold text-gray-800 uppercase">{item.nom}</span> <span className="font-medium text-gray-600">{item.prenoms || item.prenom}</span>
              </div>
              
              <span className={`font-extrabold px-2 py-0.5 rounded text-[9px] uppercase ${
                item.role === 'eleve' ? 'bg-blue-100 text-blue-700' :
                item.role === 'professeur' || item.role === 'prof_principal' ? 'bg-purple-100 text-purple-700' :
                item.role === 'educateur' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {item.role === 'prof_principal' ? 'Prof. Principal' : item.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {recherche.trim() !== '' && resultatsFiltres.length === 0 && (
        <p className="text-[11px] text-red-500 font-bold mt-2">❌ Aucune correspondance trouvée dans l'annuaire de votre école.</p>
      )}

      {/* ================= 🗂️ AFFICHAGE DYNAMIQUE DU DOSSIER MULTI-RÔLES ================= */}
      {profilSelectionne && (
        <div className="mt-6 border border-gray-200 bg-gray-50/30 rounded-xl p-5 animate-fadeIn">
          
          {/* 🟢 BLOC DE NOTIFICATION INTELLIGENT INTÉGRÉ AU DOSSIER */}
          {badgeMsg && (
            <div className="mb-4 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500 animate-pulse">
              {badgeMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-3 mb-4">
            <div>
              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                profilSelectionne.role === 'eleve' ? 'bg-blue-100 text-blue-700' :
                profilSelectionne.role === 'professeur' || profilSelectionne.role === 'prof_principal' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {profilSelectionne.role === 'eleve' ? `Matricule : ${profilSelectionne.matricule}` : `Identifiant : ${profilSelectionne.id}`}
              </span>
              <h4 className="text-lg font-black text-gray-900 uppercase mt-1">
                {profilSelectionne.nom} <span className="font-normal text-gray-700 lowercase first-letter:uppercase">{profilSelectionne.prenoms || profilSelectionne.prenom}</span>
              </h4>
            </div>
            
            {/* Bouton Noir Universel de téléchargement Notifié */}
            <button
              onClick={() => handleRegenererBadge(profilSelectionne)}

              className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs px-4 py-2.5 rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              🖨️ Générer PDF Mis à Jour
            </button>
          </div>

          {/* Fiche technique */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-gray-600">
            <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-2xs">
              <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Affectation & Profil</p>
              {profilSelectionne.role === 'eleve' ? (
                <>
                  <p className="text-sm font-black text-gray-800 mt-1 uppercase">Classe : {profilSelectionne.classeId ? profilSelectionne.classeId.replace(/_/g, ' ') : 'N/A'}</p>
                  <p className="text-[11px] mt-0.5">Promotion : <span className="uppercase text-orange-600 font-bold">{profilSelectionne.promotion}</span></p>
                </>
              ) : profilSelectionne.role === 'professeur' || profilSelectionne.role === 'prof_principal' ? (
                <>
                  <p className="text-sm font-black text-purple-700 mt-1">👨‍🏫 Discipline : {profilSelectionne.matiereEnseignee}</p>
                  <p className="text-[11px] mt-0.5">Grade : <span className="font-bold text-gray-700">{profilSelectionne.grade || 'Non spécifié'}</span></p>
                </>
              ) : (
                <>
                  <p className="text-sm font-black text-emerald-700 mt-1">🧑‍💼 Suivi Général</p>
                  <p className="text-[11px] mt-0.5">Promotion assignée : <span className="font-bold text-gray-700 uppercase">{profilSelectionne.assigned_promotion || 'Toutes'}</span></p>
                </>
              )}
            </div>

            <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-2xs">
              <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Coordonnées de communication</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                📞 {profilSelectionne.role === 'eleve' ? 'Parent : ' : 'Direct : '} 
                {profilSelectionne.telephone || 'Non renseigné'}
              </p>
              <p className="text-[11px] mt-0.5 text-gray-400 truncate">E-mail : {profilSelectionne.email || 'Non configuré'}</p>
            </div>

                        {/* Boîte 3 : Indicateurs Métiers */}
            <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-2xs">
              <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Données Cloud & Activité</p>
              {profilSelectionne.role === 'eleve' ? (
                <>
                  <p className="text-sm font-black mt-1 text-gray-800">
                    Absences : <span className={(profilSelectionne.absences || 0) > 4 ? "text-red-600" : "text-green-600"}>{profilSelectionne.absences || 0} Heures</span>
                  </p>
                  <p className="text-[11px] mt-0.5 text-gray-400">Statut : Scolarité Régulière</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-black mt-1 text-gray-800">Expérience : {profilSelectionne.anneesExperience || 0} ans</p>
                  <p className="text-[11px] mt-0.5 text-gray-400">Créé le : {profilSelectionne.createdAt ? new Date(profilSelectionne.createdAt).toLocaleDateString('fr-FR') : 'N/A'}</p>
                </>
              )}
            </div>
          </div>

          {/* Pied de fiche commun */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs font-medium text-gray-600 border-t border-dashed border-gray-200 pt-4">
            <p>📅 <span className="text-gray-400">Date de Naissance :</span> <span className="text-gray-700 font-bold">{profilSelectionne.dateNaissance || 'Non spécifiée'}</span></p>
            {profilSelectionne.role === 'eleve' ? (
              <>
                <p>🏫 <span className="text-gray-400">Provenance :</span> <span className="text-gray-700 font-bold">{profilSelectionne.ecoleProvenance || 'N/A'}</span></p>
                <p>💳 <span className="text-gray-400">N° Sécurité Sociale (CMU) :</span> <span className="text-gray-700 font-mono font-bold">{profilSelectionne.numSecuriteSociale || 'Non fourni'}</span></p>
              </>
            ) : (
              <>
                <p>🏫 <span className="text-gray-400">Établissement d'Origine :</span> <span className="text-gray-700 font-bold">{profilSelectionne.etablissementProvenance || 'N/A'}</span></p>
                <p>🔑 <span className="text-gray-400">Clé d'Accès Sécurité :</span> <span className="text-gray-700 font-mono font-bold">{profilSelectionne.password || 'password123'}</span></p>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default RechercheEleveAdmin;
