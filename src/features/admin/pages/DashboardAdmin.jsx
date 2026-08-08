import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';
import GestionStatut from './GestionStatut';
import EnvoiDocumentAdmin from './EnvoiDocumentAdmin';
import EmploiDuTempsAdmin from './EmploiDuTempsAdmin';
import ReceptionAdmin from './messages/ReceptionAdmin';

const DashboardAdmin = () => {
  const { user, schoolId, schoolName } = useAuth();

  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_moderne_gagnoa').trim().toLowerCase();

  // --- ÉTATS NUAGIQUES RÉACTIFS (TEMPS RÉEL) ---
  const [tousUtilisateurs, setTousUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ÉTATS NAVIGATION ET CRISES ---
  const [subTab, setSubTab] = useState('eleves'); // 'eleves' ou 'personnel'
  const [termeRecherche, setTermeRecherche] = useState('');
  
  // État de modification d'urgence (Fiche sélectionnée)
  const [editingUser, setEditingUser] = useState(null);
  const [editNom, setEditNom] = useState('');
  const [editPrenoms, setEditPrenoms] = useState('');
  const [saving, setSaving] = useState(false);

  // --- HORLOGE INTERNE ---
  const heureActuelle = new Date().getHours();
  const coursTermines = heureActuelle >= 18;

  // 🔄 FLUX INTERCEPTEUR LIVE 100% TEMPS RÉEL (onSnapshot)
  useEffect(() => {
    if (!currentSchool) return;

    const qUsers = query(collection(db, "users"));
    const unsubscribe = onSnapshot(qUsers, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        const schoolClean = (data.schoolId || '').trim().toLowerCase();
        if (schoolClean === currentSchool) {
          list.push({ id: d.id, ...data });
        }
      });
      setTousUtilisateurs(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur Cellule de crise :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentSchool]);

  // 🚀 ACTION DE CRISE 1 : Rectification d'Urgence des Noms/Prénoms
  const handleRectifierIdentite = async (e) => {
    e.preventDefault();
    if (!editingUser || !editNom.trim() || !editPrenoms.trim()) return;

    setSaving(true);
    try {
      const userRef = doc(db, "users", editingUser.id);
      const cleanNom = editNom.trim().toUpperCase();
      const cleanPrenoms = editPrenoms.trim();

      await updateDoc(userRef, {
        nom: cleanNom,
        prenoms: cleanPrenoms,
        name: `${cleanNom} ${cleanPrenoms}`,
        updatedAt: new Date().toISOString()
      });

      alert("✨ Rectification d'identité Cloud validée avec succès !");
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("💥 Échec de communication avec la matrice Firestore.");
    } finally {
      setSaving(false);
    }
  };

  // 🚀 ACTION DE CRISE 2 : Commutation Immédiate du Statut du Badge
  const handleBasculerStatutBadge = async (userId, statutActuel) => {
    const nouveauStatut = statutActuel === 'actif' ? 'suspendu' : 'actif';
    const icone = nouveauStatut === 'suspendu' ? '🛑' : '🟢';
    
    if (!window.confirm(`${icone} Confirmez-vous la modification immédiate des accès pour cet utilisateur ?`)) return;

    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        statut: nouveauStatut,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      alert("💥 Impossible de basculer le verrou de sécurité.");
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-red-500 animate-pulse uppercase">Ouverture de la cellule de gestion de crise RH...</div>;

  // --- FILTRAGE DE CRISE DES COMPTES ---
  const fichesFiltrees = tousUtilisateurs.filter(u => {
    const estPersonnel = u.role === 'professeur' || u.role === 'prof_principal' || u.role === 'educateur';
    const matcheType = subTab === 'eleves' ? u.role === 'eleve' : estPersonnel;

    const chaineRecherche = termeRecherche.toLowerCase().trim();
    const nomComplet = `${u.nom || ''} ${u.prenoms || ''} ${u.matricule || u.id || ''}`.toLowerCase();
    
    return matcheType && nomComplet.includes(chaineRecherche);
  });

  // Statistiques d'urgence
  const totalEleves = tousUtilisateurs.filter(u => u.role === 'eleve').length;
  const totalPersonnel = tousUtilisateurs.filter(u => u.role !== 'eleve' && u.role !== 'admin' && u.role !== 'super_admin').length;
  const totalBadgesSuspendus = tousUtilisateurs.filter(u => u.statut === 'suspendu').length;

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-700 text-left animate-fadeIn">
      
      {/* 🇨🇮 BANDEAU DE NAVIGATION UNIQUE & EN-TÊTE ÉTABLISSEMENT */}
      <div className="mb-6 border-b pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">
            🏛️ {schoolName || "Espace Administration"}
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-0.5">
            Premier responsable : <span className="text-orange-600 font-bold uppercase">{user?.name || user?.nom || "Administrateur"}</span> — Code Instance : <span className="font-mono text-gray-400 font-bold uppercase">{schoolId}</span>
          </p>
        </div>
        
        {/* 🚀 Menu d'accès rapides exclusifs de la direction de l'établissement */}
        <div className="flex flex-wrap items-center gap-3">
          <Link 
            to="/admin/home" 
            className="bg-gray-100 hover:bg-gray-200 border text-gray-700 text-xs font-bold px-4 py-2.5 rounded-lg shadow-2xs transition cursor-pointer"
          >
            🏠 Accueil Principal
          </Link>
          <Link 
            to="/admin/AjouterEleve" 
            className="bg-blue-600 hover:bg-blue-700 text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
          >
            👤 Inscrire un Élève
          </Link>
          <Link 
            to="/admin/recrutement-personnel" 
            className="bg-slate-700 hover:bg-slate-800 text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
          >
            💼 Recruter du Personnel
          </Link>
          <Link 
            to="/notifications" 
            className="bg-purple-600 hover:bg-purple-700 text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
          >
            📢 Diffuser un message
          </Link>
        </div>
      </div>

      {/* 📊 COMPTEURS DE VIGILANCE CRITIQUE */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-left">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <p className="text-[10px] font-black uppercase text-gray-400">Effectif Global Apprenants</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalEleves} <span className="text-xs font-bold text-gray-400">Élèves enregistrés</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <p className="text-[10px] font-black uppercase text-gray-400">Volume Corps Pédagogique & Vie Scolaire</p>
          <p className="text-2xl font-black text-purple-700 mt-1">{totalPersonnel} <span className="text-xs font-bold text-gray-400">Membres RH</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-red-200 bg-red-50/20 shadow-2xs">
          <p className="text-[10px] font-black uppercase text-red-600">Badges et Accès Cloud Bloqués</p>
          <p className="text-2xl font-black text-red-700 mt-1">{totalBadgesSuspendus} <span className="text-xs font-bold text-gray-400">Fiches suspendues</span></p>
        </div>
      </div>

      {/* RECHERCHE ET COMMUTATEURS DE TRI */}
      <div className="max-w-7xl mx-auto bg-white p-4 rounded-2xl border shadow-2xs mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-left">
        <div className="flex bg-gray-100 p-1 rounded-xl border text-xs font-bold uppercase w-full sm:w-auto">
          <button type="button" onClick={() => { setSubTab('eleves'); setEditingUser(null); }} className={`px-4 py-2 rounded-lg transition cursor-pointer w-1/2 sm:w-auto ${subTab === 'eleves' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>👤 Registre Élèves</button>
          <button type="button" onClick={() => { setSubTab('personnel'); setEditingUser(null); }} className={`px-4 py-2 rounded-lg transition cursor-pointer w-1/2 sm:w-auto ${subTab === 'personnel' ? 'bg-slate-900 text-orange-400' : 'text-gray-400 hover:text-gray-600'}`}>💼 Personnels & RH</button>
        </div>

        <input 
          type="text" 
          placeholder="Rechercher par nom, prénom ou matricule d'accès..." 
          value={termeRecherche}
          onChange={(e) => setTermeRecherche(e.target.value)}
          className="w-full sm:max-w-md bg-gray-50 border p-2.5 rounded-xl outline-none text-xs font-bold focus:ring-2 focus:ring-red-500 font-medium text-gray-800"
        />
      </div>

      {/* GRILLE OPÉRATIONNELLE DE GESTION DE CRISE */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start text-left">
        
        {/* TABLEAU PRINCIPAL DE GESTION */}
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
                    <td colSpan="5" className="p-12 text-center text-gray-400 italic">
                      Aucun profil ne correspond à vos critères de recherche d'urgence.
                    </td>
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
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${estActif ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'}`}>
                            {estActif ? '🟢 Actif' : '🛑 Suspendu'}
                          </span>
                        </td>

                        <td className="p-3 text-right space-x-2 whitespace-nowrap">
                          <button 
                            type="button"
                            onClick={() => { setEditingUser(u); setEditNom(u.nom || ''); setEditPrenoms(u.prenoms || u.prenom || ''); }}
                            className="bg-gray-100 hover:bg-gray-200 border text-gray-700 px-2.5 py-1 rounded-lg text-[10px] uppercase font-black tracking-wide transition cursor-pointer"
                          >
                            ✏️ Rectifier
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleBasculerStatutBadge(u.id, u.statut)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-black tracking-wide transition cursor-pointer border ${estActif ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-100' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100'}`}
                          >
                            {estActif ? '🛑 Bloquer' : '🟢 Activer'}
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

        {/* PANNEAU LATÉRAL DE RECTIFICATION D'IDENTITÉ */}
        <div className="bg-white rounded-2xl border p-5 shadow-md text-left">
          <h3 className="text-xs font-black text-red-600 uppercase tracking-wider border-b pb-3 mb-4">🛠️ Panneau de Rectification</h3>
          
          {editingUser ? (
            <form onSubmit={handleRectifierIdentite} className="space-y-4 text-xs font-bold text-gray-700">
              <div className="bg-gray-50 p-3 rounded-xl border border-dashed text-[11px]">
                <p className="text-gray-400">ID d'accès en modification :</p>
                <p className="font-mono font-black text-purple-700 uppercase mt-0.5">{editingUser.id}</p>
                <p className="text-gray-400 mt-2">Rôle détecté : <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded uppercase text-[9px] font-black">{editingUser.role}</span></p>
              </div>

              <div>
                <label className="block text-gray-400 uppercase mb-1">Nom de Famille (Saisie d'Urgence) *</label>
                <input 
                  type="text" 
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none uppercase font-mono text-gray-900 font-bold focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 uppercase mb-1">Prénoms (Saisie d'Urgence) *</label>
                <input 
                  type="text" 
                  value={editPrenoms}
                  onChange={(e) => setEditPrenoms(e.target.value)}
                  className="w-full bg-gray-50 border p-2.5 rounded-lg outline-none text-gray-900 font-bold focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)}
                  className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black py-2.5 rounded-xl uppercase tracking-wider transition text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="w-2/3 bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-2.5 rounded-xl uppercase tracking-wider transition text-center cursor-pointer disabled:bg-gray-200"
                >
                  {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center text-gray-400 py-12 font-medium">
              <span className="text-2xl block mb-2">👋</span>
              Cliquez sur le bouton <strong>« ✏️ Rectifier »</strong> d'une ligne du tableau pour corriger instantanément une erreur d'orthographe sur un élève ou un enseignant en direct.
            </div>
          )}
           <div>
            <GestionStatut/>
           </div>
           <div>
            <EnvoiDocumentAdmin/>
           </div>
           <div>
            <EmploiDuTempsAdmin/>
           </div>
           
        </div>
      </div>
       <div className="mb-4 text-left">
        <Link to="/admin/home" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Retour au Secrétariat
        </Link>
      </div>

    </div>
  );
};

export default DashboardAdmin;
