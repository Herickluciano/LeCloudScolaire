import React, { useState } from 'react';
import { db } from '../services/api';
import { doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import logoEdulink from '../assets/logoedulink.png';

const RecupererCleAcces = () => {
  const [matriculeSaisi, setMatriculeSaisi] = useState('');
  const [cleRetrouvee, setCleRetrouvee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  // 🚀 ACTIONNEUR DE SECOURS : Interception et extraction de la clé d'accès
  const handleExtraireCleUrgence = async (e) => {
    e.preventDefault();
    setErreur('');
    setCleRetrouvee(null);
    
    const matriculePropre = matriculeSaisi.trim();
    if (!matriculePropre) return;

    setLoading(true);

    try {
      // Requête directe par ID de document sur la collection centrale 'users'
      const userRef = doc(db, "users", matriculePropre);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        // Vérification du verrou de sécurité de la cellule de crise de l'Admin
        if (data.statut === 'suspendu') {
          setErreur("🛑 Cet identifiant a été suspendu par la cellule de crise administrative. Veuillez contacter la direction.");
          setLoading(false);
          return;
        }

        // Extraction de la clé NoSQL calculée lors du recrutement ou de l'inscription
        setCleRetrouvee({
          matricule: data.matricule || data.id,
          nomComplet: data.name || `${data.nom} ${data.prenoms || ''}`,
          role: data.role,
          motDePasseSecret: data.password || "Aucune clé trouvée. Contactez l'admin."
        });

      } else {
        setErreur("❌ Aucun matricule correspondant détecté sur le serveur Cloud. Vérifiez la casse (Majuscules/Minuscules).");
      }
    } catch (err) {
      console.error(err);
      setErreur("💥 Erreur de liaison cloud. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=" min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4 font-sans text-left text-gray-700 select-none">
      <span className="tete text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
            Assistance Sécurité Authentification
          </span>
       <div className="barre-bi-couleur"></div>
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-2xl animate-fadeIn">
        
        {/* EN-TÊTE DE LA MARQUE */}
        <div className="text-center mb-6">
          
           <div className="flex items-center gap-2 mb-4 justify-center">
                    {logoEdulink && <img src={logoEdulink} alt="Logo Edulink" className="logologin h-8 w-auto object-contain" />}
                  </div>
          <h2 className="recup text-xl font-black text-gray-900 uppercase mt-3">Entrez votre matricule de connexion *</h2>
        </div>

        {erreur && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl leading-relaxed">
            {erreur}
          </div>
        )}

        {/* ⚙️ PANNEAU DE RENDU DE LA CLÉ RETROUVÉE */}
        {cleRetrouvee && (
          <div className="mb-6 p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 animate-pulse text-xs font-bold space-y-3">
            <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
              <span className="text-[9px] uppercase font-black text-orange-400 tracking-wider">🔑 Clé décryptée avec succès</span>
              <span className="bg-purple-900 font-mono text-[8px] px-2 py-0.5 rounded uppercase">{cleRetrouvee.role}</span>
            </div>
            <p>● <span className="text-slate-400">Titulaire :</span> <span className="uppercase  font-black">{cleRetrouvee.nomComplet}</span></p>
            <p>● <span className="text-slate-400">Identifiant :</span> <span className="font-mono text-purple-400">{cleRetrouvee.matricule}</span></p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 mt-2">
              <span className="text-slate-500 uppercase block font-black text-[8px] tracking-wide mb-1">Mot de Passe Secret Actif </span>
              <span className="font-mono text-sm font-black text-orange-400 tracking-tight select-all select-text selection:bg-orange-500 selection:text-white">
                {cleRetrouvee.motDePasseSecret}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium italic text-center pt-1">💡 Vous pouvez copier ce mot de passe pour vous connecter.</p>
          </div>
        )}

        {/* FORMULAIRE DE REQUÊTE DE SÉCURITÉ */}
        <form onSubmit={handleExtraireCleUrgence} className="form-recup space-y-4 text-xs font-bold">
          <div>
            <input 
              type="text" 
              placeholder="Ex: PROF_XXXX_978, 26_3159M..." 
              value={matriculeSaisi}
              onChange={(e) => setMatriculeSaisi(e.target.value)}
              className="identifiantinpu w-full bg-gray-50 border p-3 rounded-xl outline-none text-xs font-bold text-gray-900 uppercase font-mono tracking-wide focus:ring-2 focus:ring-purple-600 bg-white"
              disabled={loading}
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !matriculeSaisi.trim()} 
            className="btn-recup w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs transition cursor-pointer disabled:bg-gray-100 shadow-md"
          >
            {loading ? "Recherche cloud..." : "⚡ Récupérer password"}
          </button>
        </form>

        {/* LIEN LIEN RETOUR LOGIN */}
        <div className="mt-6 pt-4 border-t text-center">
          <Link to="/login" className="retour text-xs font-black text-purple-600 hover:text-purple-700 transition uppercase tracking-wider">
            ⬅️ Retour à l'écran de connexion
          </Link>
        </div>

      </div>
    </div>
  );
};

export default RecupererCleAcces;