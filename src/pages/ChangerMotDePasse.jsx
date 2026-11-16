import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/api';
import { doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const ChangerMotDePasse = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleUpdatePasswordRealtime = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }

    setLoading(true);

    try {
      // Écriture instantanée dans le nœud Firestore de l'utilisateur
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        password: newPassword.trim()
      });

      setMessage({ type: 'success', text: '🎯 Mot de passe synchronisé sur Cloud Midnight avec succès !' });
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        if (user.role === 'admin') navigate('/admin/dashboard');
        else if (user.role === 'eleve') navigate('/eleve/dashboard');
        else if (user.role === 'professeur') navigate('/prof/saisie-notes');
        else navigate('/educateur/promotion');
      }, 1500);

    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erreur de liaison réactive avec Firebase.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md my-12 font-sans ">
      <h2 className="changerMotDePasse text-xl font-black text-gray-800 border-b pb-3 mb-4">Sécurité en Temps Réel : Changer de passe</h2>
      <p className="changerMotDePass text-xs text-gray-400 mb-4 font-bold uppercase tracking-wide">ID Document : {user?.id} ({user?.role})</p>

      {message.text && (
        <div className={`p-3 mb-4 rounded-lg text-xs font-bold border ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleUpdatePasswordRealtime} className="space-y-4">
       <div className="nomfamille21 form-floating mb-3">
          <label  htmlFor="telephone"
                className="block text-gray-400 uppercase p-0 px-4 mb-1 mt-3">Nouveau mot de passe</label>
            <input 
              id="telephone"
              name="telephone"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              className="form-control w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold pr-10"
            />
            
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="nomfamille22 absolute right-8 text-gray-400 text-xs font-bold focus:outline-none uppercase tracking-tighter">
              {showPassword ? "Masquer" : "👁️"}
            </button>
          </div>
       <div className="nomfamille23 form-floating mb-3">
          <label htmlFor="telephone"
                className="block text-gray-400 uppercase p-0 px-4 mb-1 mt-3">Confirmer la saisie</label>
          <input 
            id="telephone"
            name="telephone"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer"
            className="form-control w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-ad w-1/2 border px-4 py-2 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={loading} className="btn-adl w-1/2 bg-orange-500  font-extrabold py-2 rounded-lg text-xs hover:bg-orange-600 transition shadow-sm flex justify-center items-center">
            {loading ? <div className=" h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : "💾 Synchroniser"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangerMotDePasse;
