import { useState, useEffect } from 'react';
import { db } from '../services/api';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SuperAdminSaaS = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // --- ÉTATS CLOUD FINANCIERS & IDENTITÉS ---
  const [listeEtablissements, setListeEtablissements] = useState([]);
  const [statsGlobales, setStatsGlobales] = useState({
    totalEcoles: 0,
    totalElevesSaaS: 0,
    chiffreAffairesTotal: 0
  });
  const [loading, setLoading] = useState(true);

  // --- ÉTATS DU FORMULAIRE DE DÉPLOIEMENT INTERNATIONAL ---
  const [nouvelIdEcole, setNouvelIdEcole] = useState('');
  const [nouveauNomEcole, setNouvauNomEcole] = useState('');
  const [responsableNom, setResponsableNom] = useState('');
  const [motDePasseSaisi, setMotDePasseSaisi] = useState('');
  
  // 🌍 CORRECTIF APOSRTOPHES : Utilisation des guillemets doubles pour sécuriser le parsing
  const [paysEtablissement, setPaysEtablissement] = useState("RÉPUBLIQUE DE CÔTE D'IVOIRE");
  const [deviseEtat, setDeviseEtat] = useState("Union - Discipline - Travail");
  const [ministereRattachement, setMinistereRattachement] = useState("MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION");

  const [msgForm, setFormMessage] = useState({ type: '', text: '' });
  const [creating, setCreating] = useState(false);

  // 🔄 ÉCOUTEUR MATRICE DOUBLE FLUX 100% TEMPS RÉEL
  useEffect(() => {
    const unsubscribeSchools = onSnapshot(collection(db, "schools"), (schoolSnapshot) => {
      const ecolesTrouvees = [];
      schoolSnapshot.forEach((docSnap) => {
        ecolesTrouvees.push({ id: docSnap.id, ...docSnap.data() });
      });

      const unsubscribeUsers = onSnapshot(collection(db, "users"), (userSnapshot) => {
        const cartographieEffectifs = {};
        let sommeGlobaleEleves = 0;

        userSnapshot.forEach((userSnap) => {
          const uData = userSnap.data();
          const userId = userSnap.id;
          
          const roleClean = (uData.role || '').trim().toLowerCase();
          const aUnClasseId = !!uData.classeId;
          const commenceParChiffre = /^[0-9]/.test(userId) || /^[0-9]/.test(uData.matricule || '');

          if (roleClean.includes('el') || roleClean.includes('apprenant') || (aUnClasseId && commenceParChiffre)) {
            const rawSchoolId = uData.schoolId || '';
            const eleveSchoolClean = rawSchoolId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const racineEcole = eleveSchoolClean.includes('gagnoa') ? 'lyceemodernegagnoa' : eleveSchoolClean;

            cartographieEffectifs[racineEcole] = (cartographieEffectifs[racineEcole] || 0) + 1;
            sommeGlobaleEleves += 1;
          }
        });

        const ecolesCompilees = ecolesTrouvees.map(ecole => {
          const targetId = ecole.id.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const keyRecherche = targetId.includes('gagnoa') ? 'lyceemodernegagnoa' : targetId;
          const effectifLive = cartographieEffectifs[keyRecherche] || 0;

          return {
            ...ecole,
            totalEleves: effectifLive,
            facturationMensuelle: effectifLive * 350
          };
        });

        setListeEtablissements(ecolesCompilees);
        setStatsGlobales({
          totalEcoles: ecolesCompilees.length,
          totalElevesSaaS: sommeGlobaleEleves,
          chiffreAffairesTotal: sommeGlobaleEleves * 350
        });
        setLoading(false);
      });

      return () => unsubscribeUsers();
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribeSchools();
  }, []);

  // 🚀 ACTION DE LIQUIDATION ET INJECTION MULTI-PAYS
  const handleDeployNewSchool = async (e) => {
    e.preventDefault();
    setFormMessage({ type: '', text: '' });

    if (!nouvelIdEcole.trim() || !nouveauNomEcole.trim() || !responsableNom.trim() || !motDePasseSaisi.trim()) {
      setFormMessage({ type: 'error', text: 'Veuillez remplir tous les critères obligatoires.' });
      return;
    }

    setCreating(true);
    const cleanIdBase = nouvelIdEcole.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const generatedAdminLogin = `ADMIN_${cleanIdBase.toUpperCase()}`;
    const passwordFinal = motDePasseSaisi.trim();

    try {
      await setDoc(doc(db, "schools", cleanIdBase), {
        id: cleanIdBase,
        nom: nouveauNomEcole.trim(),
        premierResponsable: responsableNom.trim(),
        adminLogin: generatedAdminLogin,
        adminPassword: passwordFinal,
        pays: paysEtablissement.trim().toUpperCase(),
        devise: deviseEtat.trim(),
        ministere: ministereRattachement.trim().toUpperCase(),
        statutAbonnement: 'actif',
        createdAt: new Date().toISOString()
      });

      await setDoc(doc(db, "users", generatedAdminLogin), {
        id: generatedAdminLogin,
        matricule: generatedAdminLogin,
        name: responsableNom.trim(),
        nom: responsableNom.trim().split(' ') || 'Proviseur',
        role: 'admin',
        statut: 'actif',
        password: passwordFinal,
        schoolId: cleanIdBase,
        createdAt: new Date().toISOString()
      });

      setFormMessage({ type: 'success', text: `🏛️ Déploiement international réussi pour l'instance : ${nouveauNomEcole.trim()}.` });
      setNouvelIdEcole('');
      setNouvauNomEcole('');
      setResponsableNom('');
      setMotDePasseSaisi('');
    } catch (err) {
      console.error(err);
      setFormMessage({ type: 'error', text: "💥 Échec de déploiement cloud international." });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center font-sans bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-bold uppercase animate-pulse">Initialisation de la matrice transfrontalière...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8 animate-fadeIn text-gray-700">
      
      {/* NAVIGATION PRINCIPALE */}
      <div className="max-w-7xl mx-auto flex justify-between items-center border-b pb-4 mb-8">
        <button 
          type="button" 
          onClick={() => { logout(); navigate('/login'); }} 
          className="bg-black hover:bg-red-700  font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md"
        >
          🚪 Quitter le Noyau
        </button>
      </div>

      {/* STATISTIQUES FINANCIÈRES CENTRALISÉES */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-left">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xs">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Établissements Actifs</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{statsGlobales.totalEcoles}</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-2">● Instances serveurs au vert</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xs">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Volume Global Apprenants</p>
          <p className="text-3xl font-black text-purple-700 mt-1">{statsGlobales.totalElevesSaaS}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-2">Licences d'accès consommées</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-[10px] font-black uppercase text-orange-600 tracking-wider">Chiffre d'Affaires Récurrent Mensuel</p>
          <p className="text-3xl font-black text-gray-900 mt-1">
            {statsGlobales.chiffreAffairesTotal.toLocaleString('fr-FR')} <span className="text-lg font-bold text-gray-500">FCFA</span>
          </p>
          <p className="text-[10px] text-orange-500 font-bold mt-2">Formule de tarification globale unifiée</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        
        {/* FORMULAIRE DE CONFIGURATION INTERNATIONALISÉE */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm h-fit text-left">
          <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider border-b pb-3 mb-4">🏛️ Déployer une Nouvelle École</h3>
          
          {msgForm.text && (
            <div className={`p-3 mb-4 rounded-lg text-xs font-bold ${
              msgForm.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {msgForm.text}
            </div>
          )}

                    <form onSubmit={handleDeployNewSchool} className="space-y-4 text-xs font-bold text-gray-700">
            <div>
              <label className="block text-gray-400 uppercase mb-1">Identifiant Instance (Sans espaces) *</label>
              <input 
                type="text" 
                placeholder="Ex: lycee_gagnoa, lycee_libreville" 
                value={nouvelIdEcole} 
                onChange={(e) => setNouvelIdEcole(e.target.value)} 
                className="w-full bg-gray-50 border rounded-lg p-2.5 font-mono text-gray-800 outline-none focus:ring-2 focus:ring-purple-500" 
                required 
              />
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">Nom Officiel Établissement *</label>
              <input 
                type="text" 
                placeholder="Ex: Lycée Classique d'Abidjan" 
                value={nouveauNomEcole} 
                onChange={(e) => setNouvauNomEcole(e.target.value)} 
                className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-800 outline-none focus:ring-2 focus:ring-purple-500" 
                required 
              />
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">Nom du Premier Responsable / Proviseur *</label>
              <input 
                type="text" 
                placeholder="Ex: M. GOUEDE Eric" 
                value={responsableNom} 
                onChange={(e) => setResponsableNom(e.target.value)} 
                className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-800 outline-none focus:ring-2 focus:ring-purple-500" 
                required 
              />
            </div>

            <div>
              <label className="block text-purple-900 uppercase mb-1">🔑 Mot de passe d'administration attribué *</label>
              <input 
                type="text" 
                placeholder="Ex: Admin2026!" 
                value={motDePasseSaisi} 
                onChange={(e) => setMotDePasseSaisi(e.target.value)} 
                className="w-full bg-purple-50/50 border border-purple-200 rounded-lg p-2.5 text-purple-950 font-black outline-none focus:ring-2 focus:ring-purple-500" 
                required 
              />
            </div>

            {/* 🌍 BLOC DE GEOLOCALISATION INSTITUTIONNELLE DU COMPTE CLIENT */}
            <div className="p-3 bg-amber-50/60 border border-dashed border-amber-200 rounded-xl space-y-3">
              <p className="text-[10px] text-amber-800 font-black uppercase tracking-wider">Bloc d'alignement territorial</p>
              
              <div>
                <label className="block text-amber-700 uppercase text-[9px] mb-1">Désignation du Pays Souverain *</label>
                <input 
                  type="text" 
                  placeholder="Ex: RÉPUBLIQUE DU GABON" 
                  value={paysEtablissement} 
                  onChange={(e) => setPaysEtablissement(e.target.value)} 
                  className="w-full bg-white border rounded-md p-2 text-gray-800 outline-none" 
                  required 
                />
              </div>

              <div>
                <label className="block text-amber-700 uppercase text-[9px] mb-1">Devise / Slogan National *</label>
                <input 
                  type="text" 
                  placeholder="Ex: Union - Travail - Justice" 
                  value={deviseEtat} 
                  onChange={(e) => setDeviseEtat(e.target.value)} 
                  className="w-full bg-white border rounded-md p-2 text-gray-800 outline-none" 
                  required 
                />
              </div>

              <div>
                <label className="block text-amber-700 uppercase text-[9px] mb-1">Ministère de Tutelle de Rattachement *</label>
                <input 
                  type="text" 
                  placeholder="Ex: MINISTÈRE DE L'ÉDUCATION NATIONALE" 
                  value={ministereRattachement} 
                  onChange={(e) => setMinistereRattachement(e.target.value)} 
                  className="w-full bg-white border rounded-md p-2 text-gray-800 outline-none uppercase" 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={creating} 
              className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-3 rounded-xl uppercase tracking-wider transition shadow-xs mt-4 text-center text-xs disabled:bg-gray-200" 
              style={{ cursor: 'pointer' }}
            >
              {creating ? "Configuration du Pays..." : "⚡ Activer l'Établissement Client"}
            </button>
          </form>
        </div>

        {/* ================= REGISTRE DE MONITORING INTERNATIONAL ================= */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6 shadow-sm text-left">
          <div className="flex justify-between items-center border-b pb-4 mb-6 font-bold text-xs uppercase text-gray-400">
            <h3>Registre de Contrôle et Facturation Matrice</h3>
            <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded text-[10px] font-black animate-pulse">● Live Global Tracking</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-gray-700 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100">
                  <th className="p-4">Instance / Pays</th>
                  <th className="p-4">Premier Responsable</th>
                  <th className="p-4">Accès Admin</th>
                  <th className="p-4 text-center">Effectif</th>
                  <th className="p-4 text-right">Redevance</th>
                </tr>
              </thead>
              <tbody>
                {listeEtablissements.map((ecole) => (
                  <tr key={ecole.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition text-[11px]">
                    <td className="p-4">
                      <p className="text-gray-900 font-black uppercase tracking-tight">{ecole.nom || ecole.id.replace(/_/g, ' ')}</p>
                      <span className="bg-orange-50 text-orange-700 text-[9px] px-1.5 py-0.5 rounded font-black uppercase mt-1 inline-block">
                        🌍 {ecole.pays || "CÔTE D'IVOIRE"}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 font-bold uppercase leading-tight">
                      {ecole.premierResponsable || "Non renseigné"}
                      <p className="text-[9px] text-gray-400 font-normal mt-0.5 max-w-[140px] truncate">{ecole.ministere || "Éducation Nationale"}</p>
                    </td>
                    <td className="p-4 font-mono text-[10px] leading-relaxed">
                      <p>👤 <span className="text-purple-700 font-bold">{ecole.adminLogin || `ADMIN_${ecole.id.toUpperCase()}`}</span></p>
                      <p>🔑 <span className="text-gray-600 font-black">{ecole.adminPassword || "password123"}</span></p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full font-mono text-[10px] font-black">
                        {ecole.totalEleves || 0} élèves
                      </span>
                    </td>
                    <td className="p-4 text-right text-xs font-black text-gray-900 font-mono">
                      {(ecole.facturationMensuelle || 0).toLocaleString('fr-FR')} <span className="text-[9px] font-bold text-gray-400">FCFA</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SuperAdminSaaS;
