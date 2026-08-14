// src/features/admin/pages/DashboardAdmin.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { db } from '../../../services/api';
import { collection, query, onSnapshot, doc, updateDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import SignaturePadModal from '../../../components/SignaturePadModal';

// IMPORTATION DES DIFFÉRENTS ONGLETS INTERNES DE GESTION
import GestionStatut from './GestionStatut';
import EnvoiDocumentAdmin from './EnvoiDocumentAdmin';
import EmploiDuTempsAdmin from './EmploiDuTempsAdmin';
import ReceptionAdmin from './messages/ReceptionAdmin';

// IMPORTATION DU REGISTRE DE PROMOTION
import ListePromotion from '../../educateur/pages/ListePromotion'; 

const DashboardAdmin = () => {
  const { user, schoolId, schoolName } = useAuth();
  const [searchParams] = useSearchParams();

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

  // --- ÉTATS NUAGIQUES RÉACTIFS ---
  const [tousUtilisateurs, setTousUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // --- NAVIGATION INTERNE ---
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'vue_globale');
  const [subTab, setSubTab] = useState('eleves'); // 'eleves' | 'personnel' | 'promotions'
  const [termeRecherche, setTermeRecherche] = useState('');
  
  const [editingUser, setEditingUser] = useState(null);
  const [editNom, setEditNom] = useState('');
  const [editPrenoms, setEditPrenoms] = useState('');
  const [saving, setSaving] = useState(false);

  const [classeErronee, setClasseErronee] = useState('');
  const [classeCorrigee, setClasseCorrigee] = useState('');
  const [isFixing, setIsFixing] = useState(false);

  const activeSessionData = sessionStorage.getItem('sgs_user');
  const isSuperAdminLuhamcode = activeSessionData && JSON.parse(activeSessionData).id ? true : false;

  const [statistiques, setStatistiques] = useState({ apprenants: 0, personnels: 0, suspendus: 0 });

  // 🟢 CHARGEMENT DES DONNÉES EN TEMPS RÉEL
  useEffect(() => {
    if (!currentSchool) return;

    const usersRef = collection(db, "users");
    const qSchool = query(usersRef, where("schoolId", "==", currentSchool));

    const unsubscribe = onSnapshot(qSchool, (snapshot) => {
      const list = [];
      let totalEleves = 0;
      let totalRH = 0;
      let totalSuspendus = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data });

        if (data.role === 'eleve') {
          totalEleves++;
        } else if (data.role === 'educateur' || data.role === 'professeur' || data.role === 'prof_principal') {
          totalRH++;
        }
        if (data.statut && data.statut !== 'actif') {
          totalSuspendus++;
        }
      });

      setTousUtilisateurs(list);
      setStatistiques({
        apprenants: totalEleves,
        personnels: totalRH,
        suspendus: totalSuspendus
      });
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  const handleRectifierIdentite = async (e) => {
    e.preventDefault();
    if (!editingUser || !editNom.trim() || !editPrenoms.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        nom: editNom.trim().toUpperCase(),
        prenoms: editPrenoms.trim(),
        name: `${editNom.trim().toUpperCase()} ${editPrenoms.trim()}`,
        updatedAt: new Date().toISOString()
      });
      alert("✨ Rectification d'identité enregistrée !");
      setEditingUser(null);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const handleBasculerStatutBadge = async (userId, statutActuel) => {
    const nouveauStatut = statutActuel === 'actif' ? 'suspendu' : 'actif';
    if (!window.confirm("Confirmez-vous le basculement des accès pour ce badge ?")) return;
    try {
      await updateDoc(doc(db, "users", userId), { statut: nouveauStatut, updatedAt: new Date().toISOString() });
    } catch (err) { console.error(err); }
  };

  const handleLancerMaintenanceClassesAdmin = async (e) => {
    e.preventDefault();
    if (!classeErronee.trim() || !classeCorrigee.trim()) return;
    setIsFixing(true);
    try {
      const q = query(collection(db, "users"), where("schoolId", "==", currentSchool), where("role", "==", "eleve"), where("classeId", "==", classeErronee.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) { alert("Aucun élève trouvé."); setIsFixing(false); return; }
      const batch = writeBatch(db);
      snap.forEach(d => batch.update(doc(db, "users", d.id), { classeId: classeCorrigee.trim().toLowerCase() }));
      await batch.commit();
      alert("⚡ Correction effectuée !"); setClasseErronee(''); setClasseCorrigee('');
    } catch (err) { console.error(err); } finally { setIsFixing(false); }
  };

  const fichesFiltrees = tousUtilisateurs.filter(u => {
    const estPersonnel = u.role === 'professeur' || u.role === 'prof_principal' || u.role === 'educateur';
    const matcheType = subTab === 'eleves' ? u.role === 'eleve' : estPersonnel;
    const nomComplet = `${u.nom || ''} ${u.prenoms || ''} ${u.matricule || u.id || ''}`.toLowerCase();
    return matcheType && nomComplet.includes(termeRecherche.toLowerCase().trim());
  });

  const totalEleves = statistiques.apprenants;
  const totalPersonnel = statistiques.personnels;
  const totalBadgesSuspendus = statistiques.suspendus;

  if (loading) return <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">Ouverture de la console...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-700 text-left animate-fadeIn">
      
      {/* BANDEAU DE NAVIGATION */}
      <div className="mb-6 border-b pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight uppercase">🏛️ Espace Administration : {schoolName}</h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Manager Général : <span className="text-orange-600 font-bold uppercase">{user?.name || user?.nom}</span> — Code Instance : <span className="font-mono text-purple-700 font-bold uppercase">{schoolId}</span></p>
        </div>

        <div className="flex flex-wrap bg-white p-1 rounded-xl border text-xs font-black uppercase shadow-2xs">
          <button type="button" onClick={() => setActiveTab('vue_globale')} className={`px-3 py-2 rounded-lg cursor-pointer ${activeTab === 'vue_globale' ? 'bg-slate-900 text-orange-400 shadow-sm' : 'text-gray-400'}`}>📊 Vue Globale & Registres</button>
          <button type="button" onClick={() => setActiveTab('bulletins_statuts')} className={`px-3 py-2 rounded-lg cursor-pointer ${activeTab === 'bulletins_statuts' ? 'bg-slate-900 text-orange-400 shadow-sm' : 'text-gray-400'}`}>📜 Bulletins & Statuts</button>
          <button type="button" onClick={() => setActiveTab('diffusion')} className={`px-3 py-2 rounded-lg cursor-pointer ${activeTab === 'diffusion' ? 'bg-slate-900 text-orange-400 shadow-sm' : 'text-gray-400'}`}>📢 Diffusion & SOS</button>
          <Link to="/admin/home" className="px-3 py-2 text-red-600 hover:text-red-700 rounded-lg no-underline whitespace-nowrap self-center">🏠 Quitter le Bureau</Link>
        </div>
      </div>

      {activeTab === 'bulletins_statuts' && <div className="animate-fadeIn"><GestionStatut /></div>}
      {activeTab === 'diffusion' && <div className="animate-fadeIn"><EnvoiDocumentAdmin /></div>}

      {activeTab === 'vue_globale' && (
        <div className="space-y-6 animate-fadeIn">
          {/* COMPTEURS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border shadow-2xs">
              <p className="text-[10px] font-black uppercase text-gray-400">Effectif Global Apprenants</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{totalEleves} <span className="text-xs font-bold text-gray-400">Élèves</span></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-2xs">
              <p className="text-[10px] font-black uppercase text-gray-400">Corps Pédagogique & Vie Scolaire</p>
              <p className="text-2xl font-black text-purple-700 mt-1">{totalPersonnel} <span className="text-xs font-bold text-gray-400">Membres RH</span></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-red-200 bg-red-50/10 shadow-2xs">
              <p className="text-[10px] font-black uppercase text-red-600">Badges et Accès Cloud Bloqués</p>
              <p className="text-2xl font-black text-red-700 mt-1">{totalBadgesSuspendus} <span className="text-xs font-bold text-gray-400">Fiches suspendues</span></p>
            </div>
          </div>

                   {/* BARRE DE FILTRAGE AVEC VOTRE NOUVEAU BOUTON ALIGNÉ */}
          <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-xl border text-xs font-bold uppercase w-full sm:w-auto gap-1">
              
              {/* 🟢 LE BOUTON DEMANDÉ ALIGNÉ AVEC SÉCURITÉ */}
              <button 
                type="button" 
                onClick={() => { setSubTab('promotions'); setEditingUser(null); }} 
                className={`px-4 py-2 rounded-lg transition cursor-pointer w-full sm:w-auto ${subTab === 'promotions' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}
              >
                👤 listes des promotion
              </button>

              <button 
                type="button" 
                onClick={() => { setSubTab('eleves'); setEditingUser(null); }} 
                className={`px-4 py-2 rounded-lg transition cursor-pointer w-full sm:w-auto ${subTab === 'eleves' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}
              >
                🎓 Fiches Globales
              </button>

              <button 
                type="button" 
                onClick={() => { setSubTab('personnel'); setEditingUser(null); }} 
                className={`px-4 py-2 rounded-lg transition cursor-pointer w-full sm:w-auto ${subTab === 'personnel' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}
              >
                💼 Personnels & RH
              </button>

              {isSuperAdminLuhamcode && (
                <button 
                  type="button" 
                  onClick={() => { setSubTab('luhamcode_admin_fix'); setEditingUser(null); }} 
                  className={`px-4 py-2 rounded-lg cursor-pointer font-black w-full sm:w-auto ${subTab === 'luhamcode_admin_fix' ? 'bg-orange-600 text-white animate-pulse shadow-sm' : 'text-orange-500 bg-orange-50'}`}
                >
                  🛠️ Maintenance Luhamcode
                </button>
              )}
            </div>
            
            {subTab !== 'luhamcode_admin_fix' && subTab !== 'promotions' && (
              <input 
                type="text" 
                placeholder="Rechercher par nom, prénom ou matricule d'accès..." 
                value={termeRecherche} 
                onChange={(e) => setTermeRecherche(e.target.value)} 
                className="w-full sm:max-w-md bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 bg-white" 
              />
            )}
          </div>

                   {/* ================= RENDER CONDITIONNEL DES VUES INTERNES ================= */}
          {subTab === 'promotions' ? (
            /* 🟢 RECTIFICATION MAÎTRESSE : Utilisation du bon composant importé en haut */
            <div className="bg-white rounded-2xl border shadow-sm p-2 animate-fadeIn">
              <ListePromotion />
            </div>
          ) : subTab === 'luhamcode_admin_fix' && isSuperAdminLuhamcode ? (
            /* PANNEAU DE MAINTENANCE CORE ENGINE */
            <div className="bg-white rounded-2xl border border-orange-200 p-6 shadow-sm space-y-4 animate-fadeIn">
              <div className="border-b border-orange-100 pb-3">
                <span className="text-[10px] font-black uppercase bg-orange-600 text-white px-2 py-0.5 rounded font-mono">Luhamcode Administration Engine</span>
                <h3 className="text-base font-black text-slate-900 uppercase mt-2">🛠️ Outil d'Équilibrage & Correction Atomique des Classes</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Console de secours maître. En cas de mauvaise saisie d'une classe par un secrétaire, cet outil corrige et migre instantanément toutes fiches d'élèves affectées.</p>
              </div>
              <form onSubmit={handleLancerMaintenanceClassesAdmin} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end text-xs font-bold text-gray-700">
                <div>
                  <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">Identifiant Erroné (Ex: 5eme1) *</label>
                  <input type="text" placeholder="Ex: 5eme1" value={classeErronee} onChange={(e) => setClasseErronee(e.target.value)} className="w-full bg-gray-50 border border-red-200 p-3 rounded-xl outline-none font-mono text-red-700 bg-white" required />
                </div>
                <div>
                  <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">Identifiant Corrigé (Ex: 5eme_1) *</label>
                  <input type="text" placeholder="Ex: 5eme_1" value={classeCorrigee} onChange={(e) => setClasseCorrigee(e.target.value)} className="w-full bg-gray-50 border border-green-200 p-3 rounded-xl outline-none font-mono text-green-700 bg-white" required />
                </div>
                <div>
                  <button type="submit" disabled={isFixing} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3.5 rounded-xl uppercase tracking-wider transition cursor-pointer border-0 shadow-sm disabled:bg-gray-200">
                    {isFixing ? "Migration Firestore..." : "⚡ Exécuter la Correction Générale"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* GRILLE TRADITIONNELLE DES REGISTRES GENERAUX ET RECTIFICATION CIVILE */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">
              <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                        <th className="p-3">Matricule / ID</th>
                        {subTab === 'eleves' && <th className="p-3">Division</th>}
                        {subTab === 'personnel' && <th className="p-3">Spécialité</th>}
                        <th className="p-3">Nom Complet Renseigné</th>
                        <th className="p-3 text-center">Statut Accès</th>
                        <th className="p-3 text-right">Actions de Crise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fichesFiltrees.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-gray-400 italic font-medium">Aucun profil ne correspond à vos critères de recherche d'urgence.</td>
                        </tr>
                      ) : (
                        fichesFiltrees.map((u) => {
                          const estActif = u.statut === 'actif';
                          return (
                            <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                              <td className="p-3 font-mono text-gray-400 text-[11px]">{u.matricule || u.id}</td>
                              {subTab === 'eleves' && <td className="p-3 font-mono text-purple-700 uppercase">{u.classeId || 'N/A'}</td>}
                              {subTab === 'personnel' && <td className="p-3 text-gray-500 uppercase text-[10px]">{u.matiereEnseignee || u.role || 'Général'}</td>}
                              <td className="p-3 text-gray-900 uppercase font-black">{u.nom} {u.prenoms || u.prenom || ''}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${estActif ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                  {u.statut || 'actif'}
                                </span>
                              </td>
                              <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                                <button type="button" onClick={() => { setEditingUser(u); setEditNom(u.nom || ''); setEditPrenoms(u.prenoms || ''); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded font-black text-[10px] uppercase cursor-pointer border-0">✏️ Éditer</button>
                                <button type="button" onClick={() => handleBasculerStatutBadge(u.id, u.statut || 'actif')} className={`px-2.5 py-1 rounded font-black text-[10px] uppercase cursor-pointer border-0 text-white ${estActif ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                  {estActif ? "🔒 Suspendre" : "🔓 Activer"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PANNEAU DE RECTIFICATION DU PROFIL COLLABORATEUR */}
              <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">Panneau de Rectification</h3>
                {editingUser ? (
                                    <form onSubmit={handleRectifierIdentite} className="space-y-4 text-xs font-bold text-gray-700">
                    <p className="text-[10px] text-purple-600 font-mono">Fiche cible : {editingUser.id}</p>
                    <div>
                      <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">Nom de famille *</label>
                      <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-xl outline-none uppercase font-black bg-white" required />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-[10px] uppercase font-black mb-1">Prénoms *</label>
                      <input type="text" value={editPrenoms} onChange={(e) => setEditPrenoms(e.target.value)} className="w-full bg-gray-50 border p-2.5 rounded-xl outline-none font-bold bg-white" required />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-gray-100 border py-2 rounded-xl text-[10px] cursor-pointer">Annuler</button>
                      <button type="submit" disabled={saving} className="flex-1 bg-purple-600 text-white py-2 rounded-xl text-[10px] border-0 cursor-pointer disabled:bg-gray-200">
                        {saving ? "Sauvegarde..." : "Sauvegardez"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-center py-12 text-gray-400 italic text-[11px] bg-gray-50/50 border border-dashed rounded-xl">Sélectionnez un profil dans le registre pour modifier son identité officielle ou son nom civil.</p>
                )}

                {/* MODULE DE CAPTURE DE SIGNATURE NUMÉRIQUE AUTONOME */}
                <div className="pt-2 border-t text-center">
                  <button 
                    type="button" 
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="w-full text-[10px] font-black text-purple-700 uppercase bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-xl border border-purple-200 cursor-pointer transition shadow-2xs"
                  >
                    ✍️ Enregistrer ma Signature
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
      
      <ReceptionAdmin />
      <SignaturePadModal isOpen={isSignatureModalOpen} onClose={() => setIsSignatureModalOpen(false)} />
    </div>
  );
};

export default DashboardAdmin;
