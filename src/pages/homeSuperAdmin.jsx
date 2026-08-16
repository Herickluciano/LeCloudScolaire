import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '../services/api';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const HomeSuperAdmin = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [autorise, setAutorise] = useState(false);
  
  // États du Registre Matriciel Central
  const [etablissements, setEtablissements] = useState([]);
  const [chargementEcoles, setChargementEcoles] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // États du Formulaire de Déploiement Cloud Automatique
  const [instanceId, setInstanceId] = useState('');
  const [nomEcole, setNomEcole] = useState('');
  const [proviseur, setProviseur] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [pays, setPays] = useState('RÉPUBLIQUE DE CÔTE D\'IVOIRE');
  const [devise, setDevise] = useState('Union - Discipline - Travail');
  const [tutelle, setTutelle] = useState('MINISTÈRE DE L\'ÉDUCATION NATIONALE ET DE L\'ALPHABÉTISATION');

  // 🔒 SÉCURISATION DU RÔLE MAÎTRE DE L'INFRASTRUCTURE
  useEffect(() => {
    const roleActif = user?.role || sessionStorage.getItem('sgs_user_role');
    if (roleActif === 'super_admin') {
      setAutorise(true);
    } else {
      alert("🛑 ACCÈS RESTREINT : Réservé exclusivement à l'administration centrale SaaS.");
      navigate('/login');
    }
  }, [user, navigate]);

  // 📡 ÉCOUTEUR LIVE FIRESTORE : Grand livre des écoles partenaires et abonnements
  useEffect(() => {
    if (!autorise) return;

    const unsubscribe = onSnapshot(collection(db, "schools"), (snapshot) => {
      const listeEcoles = [];
      snapshot.forEach(docSnap => {
        listeEcoles.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEtablissements(listeEcoles);
      setChargementEcoles(false);
    }, (err) => {
      console.error("Erreur de synchronisation du registre des écoles :", err);
      setChargementEcoles(false);
    });

    return () => unsubscribe();
  }, [autorise]);

  // ⚡ ACTION 1 : CRÉATION ET PROVISIONNEMENT AUTOMATIQUE DANS CLOUD FIRESTORE
  const handleDeployerEcole = async (e) => {
    e.preventDefault();
    const cleanId = instanceId.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (!cleanId || !nomEcole || !proviseur || !adminPassword) {
      setActionMsg('⚠️ Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setActionMsg(`⏳ Déploiement de l'instance cloud [${cleanId}]...`);
    try {
      // Insertion de la fiche de l'école dans la collection NoSQL 'schools'
      await setDoc(doc(db, "schools", cleanId), {
        id: cleanId,
        name: nomEcole.trim(),
        nom: nomEcole.trim(),
        proviseur: proviseur.trim(),
        pays: pays.trim(),
        devise: devise.trim(),
        tutelle: tutelle.trim(),
        licenceType: "Premium unifié",
        formuleSaaS: "Premium unifié",
        statut: "actif",
        effectif: "14 élèves",
        redevance: "4 900 FCFA",
        createdAt: new Date()
      });

      // Création immédiate et croisée du compte Administrateur local associé dans 'users'
      const adminId = `ADMIN_${cleanId.toUpperCase()}`;
      await setDoc(doc(db, "users", adminId), {
        id: adminId,
        matricule: adminId,
        nom: ["M,", proviseur.trim()], // Aligné sur le format de votre table Firebase
        name: proviseur.trim(),
        password: adminPassword.trim(),
        role: "admin",
        statut: "actif",
        schoolId: cleanId,
        etablissementActuel: nomEcole.trim(),
        createdAt: new Date()
      });

      setActionMsg(`🎉 Instance ${nomEcole} déployée ! Compte admin créé : ${adminId}`);
      setInstanceId(''); setNomEcole(''); setProviseur(''); setAdminPassword('');
      setTimeout(() => setActionMsg(''), 6000);
    } catch (err) {
      console.error(err);
      setActionMsg('❌ Erreur technique lors du provisionnement Cloud.');
    }
  };

  // 🔒 ACTION 2 : SUSPENDRE LE CONTRAT (BLOCAGE ET COUPURE SUR IMPAYÉ)
  const handleBloquerEcole = async (schoolId, name) => {
    if (!window.confirm(`⚠️ Couper l'infrastructure et suspendre les accès de : ${name} ?`)) return;
    setActionMsg(`⏳ Suspension de l'instance de ${name}...`);
    try {
      await updateDoc(doc(db, "schools", schoolId), { statut: "suspendu_impaye" });
      setActionMsg(`🔒 Établissement ${name} suspendu avec succès.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) { setActionMsg('❌ Échec de suspension.'); }
  };

  // 🔓 ACTION 3 : RÉACTIVATION DE LICENCE RECONDUITE
  const handleDebloquerEcole = async (schoolId, name) => {
    setActionMsg(`⏳ Restauration de l'instance de ${name}...`);
    try {
      await updateDoc(doc(db, "schools", schoolId), { statut: "actif" });
      setActionMsg(`🔓 Licence cloud réactivée avec succès pour ${name}.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) { setActionMsg('❌ Échec de réactivation.'); }
  };

  // 🗑️ ACTION 4 : RÉSILIATION ET SUPPRESSION DÉFINITIVE DE LA MATRICE
  const handleSupprimerEcole = async (schoolId, name) => {
    if (!window.confirm(`🚨 DANGER CRITIQUE : Dissoudre définitivement le partenariat avec ${name} ? Toutes ses données seront effacées.`)) return;
    setActionMsg(`⏳ Suppression définitive de ${name}...`);
    try {
      await deleteDoc(doc(db, "schools", schoolId));
      setActionMsg(`🗑️ Établissement ${name} retiré du réseau central SaaS.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) { setActionMsg('❌ Échec de suppression.'); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!autorise) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs text-gray-500 font-bold uppercase tracking-widest">Vérification de sécurité...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn">
      
      {/* 👑 BANDEAU PROFIL MAÎTRE SUPERADMIN */}
      <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">👑 M. LUCIANO <span className="font-normal text-slate-400 font-sans lowercase first-letter:uppercase">HAMILTOM</span></h1>
          <p className="text-[11px] text-slate-400 mt-1 font-bold uppercase tracking-wide">🔓 LeCloudScolaire Informatisé et Centralisé</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer">🚪 Quitter le Noyau</button>
        </div>
      </div>

      {/* 🟢 BARRE DE NAVIGATION ET DE PUBLICITÉ CENTRALISÉE EN HAUT (MENU SCELLÉ) */}
      <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md">
        <div className="flex flex-wrap gap-2">
          <Link to="/superadmin/saas" className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-orange-400 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition">🏢 Config SaaS</Link>
          <Link to="/superadmin/ajouter" className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-purple-400 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition">➕ Ajouter Personnel</Link>
          <Link to="/superadmin/configure-terminal" className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-blue-400 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition">🔐 Scellage Matériel</Link>

        </div>
        <div className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 font-black px-3 py-1.5 rounded-lg uppercase tracking-wide">
          ● Instances serveurs au vert
        </div>
      </div>

      {/* 📢 BARRE DES ALERTE DES ACTIONS CLOUD */}
      {actionMsg && (
        <div className="max-w-7xl mx-auto mb-6 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-xl border-l-4 border-orange-500 animate-pulse">
          {actionMsg}
        </div>
      )}

      {/* 📦 ZONE DOUBLE ECOSYSTEME : DÉPLOIEMENT À GAUCHE & MATRICE À DROITE */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* FORMULAIRE : PROVISIONNING DE NOUVEL ÉTABLISSEMENT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-sm font-black text-white uppercase border-b border-slate-800 pb-2 mb-4">🏛️ Déployer une Nouvelle École</h2>
          <form onSubmit={handleDeployerEcole} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Identifiant Instance (Sans espaces) *</label>
              <input type="text" placeholder="Ex: lycee_saint_bernard" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono uppercase focus:outline-none focus:border-orange-500" required />
            </div>
                       <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Nom Officiel Établissement *</label>
              <input type="text" placeholder="Ex: Lycée Saint Bernard" value={nomEcole} onChange={(e) => setNomEcole(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-orange-500" required />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Responsable / Proviseur *</label>
              <input type="text" placeholder="Ex: M. FRANÇOIS" value={proviseur} onChange={(e) => setProviseur(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-orange-500" required />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">🔑 Mot de passe Admin initial *</label>
              <input type="text" placeholder="Ex: password123" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-orange-500" required />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Désignation du Pays Souverain</label>
              <input type="text" value={pays} onChange={(e) => setPays(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Ministère de Tutelle</label>
              <input type="text" value={tutelle} onChange={(e) => setTutelle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none" />
            </div>
            <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl uppercase tracking-wider transition cursor-pointer mt-2">
              ⚡ Activer l'Établissement Client
            </button>
          </form>
        </div>

        {/* 📋 LE REGISTRE DE CONTRÔLE ET FACTURATION MATRICE AVEC SES 5 COLONNES COMPLÈTES */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-sm font-black text-white uppercase border-b border-slate-800 pb-2 mb-4">
            📋 Registre de Contrôle & Facturation Matrice
          </h2>
          
          {chargementEcoles ? (
            <div className="text-center py-10 text-xs font-bold text-slate-500 uppercase tracking-widest">
              Extraction des licences cloud...
            </div>
          ) : etablissements.length === 0 ? (
            <div className="text-center py-10 text-xs font-bold text-red-400 uppercase bg-slate-950 rounded-xl border border-slate-800">
              ⚠️ Aucun établissement enregistré. Déployez une école depuis le panneau de gauche pour peupler l'infrastructure.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[9px] tracking-wider font-black">
                    <th className="py-2.5 px-3">Instance / Pays</th>
                    <th className="py-2.5 px-3">Premier Responsable</th>
                    <th className="py-2.5 px-3">Accès Admin</th>
                    <th className="py-2.5 px-3">Effectif & Redevance</th>
                    <th className="py-2.5 px-3 text-right">Actions Restreintes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {etablissements.map((ecole) => {
                    const estBloque = ecole.statut === "suspendu_impaye" || ecole.statut === "inactif";
                    
                    // Algorithm adaptatif d'extraction du Responsable
                    let proviseurAffiche = "N/A";
                    if (ecole.nom && Array.isArray(ecole.nom)) {
                      proviseurAffiche = ecole.nom.filter(Boolean).join(' ');
                    } else if (ecole.name && Array.isArray(ecole.name)) {
                      proviseurAffiche = ecole.name.filter(Boolean).join(' ');
                    } else {
                      proviseurAffiche = ecole.proviseur || ecole.name || ecole.nom || "M. François";
                    }

                    return (
                      <tr key={ecole.id} className="hover:bg-slate-950/30 transition text-[11px]">
                        <td className="py-3 px-3">
                          <p className="font-bold text-white uppercase">{ecole.etablissementActuel || ecole.name || ecole.nom || 'École Edulink'}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">🌍 {ecole.id} — {ecole.pays || "REPUBLIQUE d'HAITI"}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-200 uppercase">{proviseurAffiche}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{ecole.tutelle || 'Éducation Nationale'}</p>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <p className="text-slate-300">👤 ADMIN_{String(ecole.id).toUpperCase()}</p>
                          <p className="text-[10px] text-slate-500">🔑 {ecole.password || 'password123'}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-black text-blue-400">{ecole.effectif || "14 élèves"}</p>
                          <p className="font-bold text-orange-400 mt-0.5">{ecole.redevance || "4 900 FCFA"}</p>
                        </td>
                        <td className="py-3 px-3 text-right flex justify-end gap-1.5 mt-2">
                          {estBloque ? (
                            <button onClick={() => handleDebloquerEcole(ecole.id, ecole.name || ecole.nom)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer">🔓 Débloquer</button>
                          ) : (
                            <button onClick={() => handleBloquerEcole(ecole.id, ecole.name || ecole.nom)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer">🔒 Bloquer</button>
                          )}
                          <button onClick={() => handleSupprimerEcole(ecole.id, ecole.name || ecole.nom)} className="bg-red-600/20 hover:bg-red-600 hover:text-white text-red-400 border border-red-900/40 font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg transition cursor-pointer">🗑️ Supprimer</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
        <span>Version LeCloudScolaire : <strong className="text-slate-400">v1.2.0 — Live Core </strong></span>
        <span>Statut de l'appareil : <strong className="text-emerald-400">Poste d'administration d'origine certifié</strong></span>
      </div>
    </div>
  );
};

export default HomeSuperAdmin;
