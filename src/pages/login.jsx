import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/api'; 
import { collection, query, where, getDocs } from 'firebase/firestore';
import logoEdulink from '../assets/logoedulink.png';

const Login = () => {
  const { login, setUser, setSchoolId, setSchoolName } = useAuth();
  const navigate = useNavigate();

  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* =========================================================
     👑 CONNEXION MAÎTRE DIRECTE (BACKDOOR COMPAGNIE)
  ========================================================= */
  const executerConnexionMaitreDirecte = () => {
    const profilMaster = {
      id: 'SUPERADMIN_MASTER',
      matricule: 'ROOT_LUHAMCODE_2024',
      nom: 'TRAORE',
      prenoms: 'Mamadou',
      role: 'super_admin',
      statut: 'actif',
      schoolId: 'lycee_saint_bernard'
    };

    setUser(profilMaster);
    setSchoolId('lycee_saint_bernard');
    setSchoolName('COMPAGNIE MIDNIGHT SAAS');
    
    sessionStorage.setItem("sgs_user", JSON.stringify(profilMaster));
    sessionStorage.setItem("sgs_school_id", "lycee_saint_bernard");
    sessionStorage.setItem("sgs_school_name", "COMPAGNIE MIDNIGHT SAAS");
    sessionStorage.setItem("sgs_user_role", "super_admin");

    navigate('/superadmin/home');
  };

  /* =========================================================
     🔐 TRAITEMENT DU FORMULAIRE ET SYNC FIRESTORE
  ========================================================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const checkMatricule = matricule.trim(); 
    const checkPassword = password.trim();

    if (!checkMatricule || !checkPassword) {
      setError('Veuillez renseigner votre identifiant et votre mot de passe.');
      return;
    }

    if (checkMatricule.toUpperCase() === 'ROOT_LUHAMCODE_2024' && checkPassword === 'HERICK2024') {
      executerConnexionMaitreDirecte();
      return;
    }

    setIsSubmitting(true);
    try {
      sessionStorage.removeItem('sgs_user');
      sessionStorage.removeItem('sgs_user_role');
      
      const result = await login(checkMatricule, checkPassword);

      const savedUserStr = sessionStorage.getItem('sgs_user');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      
      if ((result && result.success) || savedUser) {
        let userConcret = savedUser || result?.user;
        const idNettoye = String(checkMatricule).trim().toUpperCase();
        let roleActif = (result?.role || userConcret?.role || 'professeur').toString().toLowerCase().trim();
        
        // 👑 ALGORITHME INVERSÉ : PRIORITÉ ET ACCÈS PREMIER AU PROFESSEUR PRINCIPAL (PP)
        if (idNettoye.startsWith('PROF_') && userConcret) {
          try {
            const classesRef = collection(db, "classes");
            const qPP = query(
              classesRef, 
              where("schoolId", "==", userConcret.schoolId), 
              where("profPrincipalId", "==", userConcret.id)
            );
            const snapPP = await getDocs(qPP);

            if (!snapPP.empty) {
              const classeDoc = snapPP.docs[0].data();
              // L'enseignant a une classe sous sa charge, il prend le statut PP prioritaire
              userConcret.isProfPrincipal = true;
              userConcret.classePrincipaleId = snapPP.docs[0].id;
              userConcret.classePrincipaleNom = classeDoc.nom;
              
              roleActif = 'prof_principal';
              userConcret.role = 'prof_principal'; 
              console.log(`👑 Priorité accordée : Routage vers l'Espace Prof Principal pour : ${classeDoc.nom}`);
            } else {
              roleActif = 'professeur';
              userConcret.role = 'professeur';
            }
          } catch (fireErr) {
            console.warn("⚠️ Échec détection double casquette :", fireErr.message);
            roleActif = 'professeur';
          }
        }

        // 💾 PERSISTANCE DE LA SESSION
        setUser(userConcret);
        sessionStorage.setItem("sgs_user", JSON.stringify(userConcret));
        sessionStorage.setItem("sgs_user_role", roleActif);

        console.log("🚀 Authentification validée. Trajectoire de session :", roleActif);
        setIsSubmitting(false);

        // 🔀 AIGUILLAGE CHIRURGICAL ET STRUCTURE DES ROUTES (SANS STRINGS EN DUR)
        if (roleActif === 'super_admin') navigate('/superadmin/home');
        else if (roleActif === 'admin') navigate('/admin/home');
        
        // 🎯 L'ÉDUCATEUR S'ORIENTE DÉSORMAIS VERS VOTRE NOUVELLE ROUTE SOUVERAINE 
        else if (roleActif === 'educateur') navigate('/educateur/dashboard'); 
        
        // LE PROFESSEUR PRINCIPAL ACCÈDE EN PREMIER À SON ESPACE PP SOUVERAIN
        else if (roleActif === 'prof_principal') navigate('/professeur/principal');
        
        // LE PROFESSEUR SIMPLE S'ORIENTE VERS SON REGISTRE CLASSIQUE
        else if (roleActif === 'professeur') navigate('/professeur/dashboard');
        else if (roleActif === 'eleve') navigate('/eleve/dashboard');
        else navigate('/login');
        
      } else {
        setError(result?.msg || 'Identifiant ou mot de passe incorrect.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Erreur critique d'authentification :", err);
      setError('Une erreur technique est survenue lors de la connexion avec le cloud.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDownPassword = (e) => {
    const checkMatricule = matricule.trim();
    const checkPassword = password.trim();
    if (e.key === 'Enter' && checkMatricule.toUpperCase() === 'ROOT_LUHAMCODE_2024' && checkPassword === 'HERICK2024') {
      e.preventDefault();
      executerConnexionMaitreDirecte();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 font-sans animate-fadeIn">
      <span className="tete text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
        Assistance Sécurité Authentification
      </span>
      <div className="barre-bi-couleur"></div>
      
      <form onSubmit={handleSubmit} className="form-partie w-full max-w-md bg-white  rounded-xl  border border-gray-100 mt-4">
        <div className="flex items-center gap-2 mb-4">
          {logoEdulink && <img src={logoEdulink} alt="Logo" className="logologin h-6 w-auto" />}
        </div>
        
        <div className="text-center mb-6">
          <div className="flex justify-center space-x-1 mb-3">
            <span className="w-10 h-1.5 bg-orange-500 rounded-full"></span>
            <span className="w-10 h-1.5 bg-gray-200 rounded-full"></span>
            <span className="w-10 h-1.5 bg-green-500 rounded-full"></span>
          </div>
          <h2 className="text-edulink text-2xl font-bold text-gray-800 tracking-tight">
            Edulink — Système International de Gestion Scolaire Intégré
          </h2>
          <p className="portail text-xs text-gray-400 mt-1 font-semibold uppercase tracking-wider">
            Portail Scolaire Numérique
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-medium rounded">
            ⚠️ {error}
          </div>
        )}

        <div className="form-floating mb-3 form-partie ">
          <div className="iden text-left">
            <label className="identifiant  vue block text-gray-600 text-xs font-bold uppercase mb-1">Identifiant</label>
            <input
              type="text"
              required
              placeholder="Ex: 26_3014R..."
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              disabled={isSubmitting}
              className="identifiantinput  w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 transition font-bold"
            />
          </div>

          <div className="iden1 text-left">
            <div className="form-floating mb-3 flex flex-col">
              <label className="clesecurite vue block text-gray-600 text-xs font-bold uppercase mb-1">Mot de passe</label>
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"} 
                  required
                  placeholder="*****************"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDownPassword}
                  disabled={isSubmitting}
                  className="identifiantcle bloc w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 transition"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="yeux  bg-transparent border-0 text-lg cursor-pointer flex items-center justify-center h-5 outline-none" 
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"} 
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bock-oublie space-y-4">
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="btnlogin w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center border-0"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              'Se connecter au portail'
            )}
          </button>

          <div className="flex justify-between items-center pt-2">
            <Link to="/recuperer-cle" className="oublie text-[11px] font-black text-purple-600 hover:text-purple-700 transition uppercase tracking-wider no-underline">
              Mot de passe oublié ?
            </Link>
            <Link to="/recuperer-cle" className="oublie text-[11px] font-black text-purple-600 hover:text-purple-700 transition uppercase tracking-wider no-underline">
              Changer mot de passe
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Login;
