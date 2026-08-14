import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

// ============================================================
// RÉCEPTION DES INSTRUCTIONS ADMIN
// ============================================================
const ReceptionInstructionsAdmin = ({ currentSchool, idEducateurLogge }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool || !idEducateurLogge) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          const destinataire = d.destinataireId || d.educateurId || '';

          if (
            destinataire === idEducateurLogge ||
            d.audience === 'all' ||
            d.audience === 'educateur'
          ) {
            list.push({
              id: snap.id,
              ...d
            });
          }
        });

        list.sort(
          (a, b) =>
            new Date(b.createdAt || b.date || 0) -
            new Date(a.createdAt || a.date || 0)
        );

        setMessages(list);
        setLoading(false);
      },
      (error) => {
        console.error('Erreur notifications éducateur:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchool, idEducateurLogge]);

  if (loading) {
    return (
      <div className="p-4 text-center text-xs font-bold text-gray-400 animate-pulse">
        Chargement des directives...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-xs text-center text-gray-400 py-8 border border-dashed rounded-xl">
          📥 Aucun ordre reçu.
        </p>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="bg-white p-4 rounded-xl border text-xs space-y-2">
            <div className="flex justify-between border-b pb-1">
              <span className="text-red-600 font-black">🏛️ DIRECTION CENTRALE</span>
              <span>{m.date || 'Récemment'}</span>
            </div>
            <p className="text-gray-800 font-bold">{m.message || m.corps}</p>
          </div>
        ))
      )}
    </div>
  );
};

// ============================================================
// DASHBOARD ÉDUCATEUR
// ============================================================
const DashboardEducateur = () => {
  const { user, schoolId, schoolName, logout } = useAuth();
  const navigate = useNavigate();

  // ==========================================================
  // IDENTITÉ ÉDUCATEUR
  // ==========================================================
  const idEducateur = useMemo(() => {
    return (
      user?.id ||
      user?.matricule ||
      user?.uid ||
      sessionStorage.getItem('sgs_user_id') ||
      ''
    ).trim();
  }, [user]);

  const currentSchool = useMemo(() => {
    return (
      schoolId ||
      user?.schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
    ).trim();
  }, [schoolId, user]);

    
    // ==========================================================
  // ÉTATS GLOBAUX (Placés obligatoirement en premier)
  // ==========================================================
  const [activeTab, setActiveTab] = useState('dashboard_global');
  const [classeEducateur, setClasseEducateur] = useState(null); // 🏢 Déclaré ici !
  const [elevesPromo, setElevesPromo] = useState([]);
  const [pointagesRaw, setPointagesRaw] = useState([]);
  const [fichesAppels, setFichesAppels] = useState([]);
  const [loadingClasse, setLoadingClasse] = useState(true);
  const [loadingEleves, setLoadingEleves] = useState(true);

  const [eleveSelectionneConseil, setEleveSelectionneConseil] = useState(null);
  const [avisConduiteConseil, setAvisConduiteConseil] = useState('');

  const [sujetCirculaire, setSujetCirculaire] = useState('');
  const [corpsCirculaire, setCorpsCirculaire] = useState('');
  const [sending, setSending] = useState(false);
  const [msgStatus, setMsgStatus] = useState({ type: '', text: '' });


  // ==========================================================
  // 🟢 CALCUL DE LA PROMOTION (Placé APRÈS les useState)
  // ==========================================================
  const assignedPromotion = useMemo(() => {
    const brute = 
      user?.assigned_promotion || 
      user?.assignedPromotion || 
      classeEducateur?.promotion || 
      classeEducateur?.nom || 
      classeEducateur?.id || 
      '';
      
    if (!brute) return 'Tle';

    const premierTerme = brute.toString().trim().split(' ')[0].split('_')[0];
    const format = premierTerme.toLowerCase();

    if (format.startsWith('tle') || format === 't' || format === 'terminale') return 'Tle';
    if (format === '1ere') return '1ère';
    if (format === '2nd' || format === '2nde') return '2nd';
    if (format.endsWith('eme')) return format.replace('eme', 'ème');

    return premierTerme.toUpperCase();
  }, [user, classeEducateur]); // 🌟 classeEducateur est maintenant bien initialisé !


  // ==========================================================
  // 1. RECHERCHE EN TEMPS RÉEL DE LA CLASSE ASSIGNÉE
  // ==========================================================
  useEffect(() => {
    if (!idEducateur || !currentSchool) {
      setLoadingClasse(false);
      return;
    }

    const q = query(
      collection(db, 'classes'),
      where('schoolId', '==', currentSchool),
      where('educateurId', '==', idEducateur)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const classes = [];
        snapshot.forEach((snap) => {
          classes.push({
            id: snap.id,
            ...snap.data()
          });
        });

        let classeTrouvee = null;

        if (assignedPromotion) {
          const normalise = (value) => (value || '').toLowerCase().replace(/[\s_-]/g, '');
          const cible = normalise(assignedPromotion);

          classeTrouvee = classes.find((classe) => {
            return (
              normalise(classe.id) === cible ||
              normalise(classe.nom) === cible ||
              normalise(classe.promotion) === cible
            );
          });
        }

        if (!classeTrouvee && classes.length === 1) {
          classeTrouvee = classes[0];
        }

        setClasseEducateur(classeTrouvee || null);
        setLoadingClasse(false);
      },
      (error) => {
        console.error('❌ Erreur récupération classe éducateur:', error);
        setClasseEducateur(null);
        setLoadingClasse(false);
      }
    );

    return () => unsubscribe();
  }, [idEducateur, currentSchool, assignedPromotion]);

  // ==========================================================
  // 2. 🟢 LIAISON REACTIVE DES ELEVES (CORRECTION DU FILTRAGE NOSQL)
  // ==========================================================
  useEffect(() => {
    if (!classeEducateur || !currentSchool) {
      setElevesPromo([]);
      setLoadingEleves(false);
      return;
    }

    setLoadingEleves(true);

    const classIdSysteme = (classeEducateur.id || '').toString().toLowerCase().trim();
    const idBruteSysteme = (classeEducateur.idBrute || '').toString().toLowerCase().trim();
    const nomSysteme = (classeEducateur.nom || '').toString().toLowerCase().trim().replace(/\s+/g, '_');

    // Requête globale sur l'établissement pour intercepter tous les formats NoSQL de classeId
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'eleve'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          const eleveClasseId = (d.classeId || '').toString().toLowerCase().trim();

          // Validation NoSQL croisée étanche
          if (
            eleveClasseId === classIdSysteme ||
            eleveClasseId === idBruteSysteme ||
            eleveClasseId === nomSysteme ||
            classIdSysteme.includes(eleveClasseId)
          ) {
            let totalPointsCumules = 0;
            const notes = d.notes || {};

            Object.values(notes).forEach((notesArray) => {
              if (Array.isArray(notesArray)) {
                notesArray.forEach((val) => {
                  totalPointsCumules += parseFloat(val) || 0;
                });
              }
            });

            list.push({
              id: snap.id,
              totalPointsCumules,
              ...d
            });
          }
        });

        setElevesPromo(list);
        setLoadingEleves(false);
      },
      (error) => {
        console.error('❌ Erreur écoute élèves:', error);
        setElevesPromo([]);
        setLoadingEleves(false);
      }
    );

    return () => unsubscribe();
  }, [classeEducateur, currentSchool]);

  // ==========================================================
  // 3. POINTAGES PROFESSEURS DE L'ÉTABLISSEMENT
  // ==========================================================
  useEffect(() => {
    if (!currentSchool) return;

    const q = query(
      collection(db, 'pointages_professeurs'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          if (d.statut !== 'transmis') {
            list.push({
              id: snap.id,
              ...d
            });
          }
        });
        setPointagesRaw(list);
           },
      (error) => {
        console.error('Erreur pointages:', error);
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // ==========================================================
  // 4. MAIN COURANTE
  // ==========================================================
  useEffect(() => {
    if (!currentSchool || !classeEducateur) return;

    const classeId = classeEducateur.id;

    const q = query(
      collection(db, 'registre_appels'),
      where('schoolId', '==', currentSchool),
      where('classeId', '==', classeId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((snap) => {
          list.push({
            id: snap.id,
            ...snap.data()
          });
        });

        list.sort(
          (a, b) =>
            new Date(b.createdAt || b.date || 0) -
            new Date(a.createdAt || a.date || 0)
        );

        setFichesAppels(list);
      },
      (error) => {
        console.error('Erreur registre appels:', error);
      }
    );

    return () => unsubscribe();
  }, [currentSchool, classeEducateur]);

  // Memoization du classement basé sur les points
  const classement = useMemo(() => {
    return [...elevesPromo].sort(
      (a, b) => b.totalPointsCumules - a.totalPointsCumules
    );
  }, [elevesPromo]);

  // ==========================================================
  // LOGIQUES D'APPRÉCIATIONS ET CIRCULAIRES
  // ==========================================================
  const handleEnregistrerAppreciationConseil = async (e) => {
    e.preventDefault();
    if (!eleveSelectionneConseil || !avisConduiteConseil.trim()) return;

    try {
      const appartient = elevesPromo.some(
        (eleve) => eleve.id === eleveSelectionneConseil.id
      );

      if (!appartient) {
        alert('❌ Cet élève n’appartient pas à votre classe.');
        return;
      }

      await updateDoc(doc(db, 'users', eleveSelectionneConseil.id), {
        appreciationConduiteEducateur: avisConduiteConseil.trim(),
        appreciationConduiteEducateurUpdatedAt: new Date().toISOString(),
        appreciationConduiteEducateurId: idEducateur
      });

      setEleveSelectionneConseil(null);
      setAvisConduiteConseil('');
      alert('✅ Appréciation enregistrée !');
    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      alert("❌ Impossible d'enregistrer l'appréciation.");
    }
  };

  const handleDiffuserCirculaireMails = async (e) => {
    e.preventDefault();
    if (!sujetCirculaire.trim() || !corpsCirculaire.trim()) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'mails_direction'), {
        sujet: sujetCirculaire.trim(),
        message: corpsCirculaire.trim(),
        schoolId: currentSchool,
        role: 'parents',
        promotion: classeEducateur?.promotion || '',
        classeId: classeEducateur?.id || '',
        educateurId: idEducateur,
        createdAt: new Date().toISOString()
      });

      setMsgStatus({ type: 'success', text: '🚀 Circulaire diffusée avec succès.' });
      setSujetCirculaire('');
      setCorpsCirculaire('');
    } catch (error) {
      console.error(error);
      setMsgStatus({ type: 'error', text: '❌ Échec de diffusion.' });
    } finally {
      setSending(false);
    }
  };

  const handleSessionLogout = async () => {
    if (!window.confirm('🚪 Souhaitez-vous fermer votre session ?')) return;
    try {
      if (logout) await logout();
      sessionStorage.clear();
      localStorage.removeItem('sgs_owner_root_key');
      navigate('/');
    } catch (error) {
      console.error(error);
      navigate('/');
    }
  };

  // ==========================================================
  // ÉTATS DE CHARGEMENT ET PROTECTION RENDER
  // ==========================================================
  if (loadingClasse || loadingEleves) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-3xl mb-3">👮</div>
          <p className="text-xs font-black uppercase text-gray-400 animate-pulse">
            Connexion au bureau éducateur...
          </p>
        </div>
      </div>
    );
  }

  if (!classeEducateur) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-xl mx-auto bg-white border rounded-2xl p-8 text-center">
          <h2 className="text-sm font-black text-orange-500 uppercase tracking-wide mb-2">
            👮 Promotion {assignedPromotion || 'NON RENSEIGNÉE'}
          </h2>
          <h1 className="text-lg font-black uppercase text-gray-900">Promotion non affectée</h1>
          <p className="text-sm text-gray-500 mt-3">Votre compte éducateur ne possède aucune classe affectée.</p>
          <div className="{assignedPromotion || 'NON RENSEIGNÉE'}">
            <p><strong>Éducateur :</strong> {user?.name || `${user?.nom || ''} ${user?.prenoms || ''}`}</p>
            <p><strong>ID :</strong> {idEducateur || 'INCONNU'}</p>
            <p><strong>Établissement :</strong> {schoolName || currentSchool}</p>
            <p><strong>Promotion affectée :</strong> {assignedPromotion || 'NON RENSEIGNÉE'}</p>
          </div>
          <button type="button" onClick={handleSessionLogout} className="mt-6 bg-red-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase">
            🚪 Déconnexion
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================
  // RENDU INTERFACE GRAPHIQUE (JSX)
  // ==========================================================
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* EN-TÊTE D'IDENTIFICATION PROFILE */}
        <div className="bg-white rounded-2xl border p-5 mb-6">
          <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-xl mx-auto bg-white border rounded-2xl p-8 text-center">
          <h1 className="text-sm font-black text-orange-500 uppercase tracking-wide mb-2">
            👮 Bureau Educateur de la Promotion {assignedPromotion || 'NON RENSEIGNÉE'}
          </h1>
          
          <div className="{assignedPromotion || 'NON RENSEIGNÉE'}">
            <p><strong>Éducateur :</strong> {user?.name || `${user?.nom || ''} ${user?.prenoms || ''}`}</p>
            <p><strong>ID :</strong> {idEducateur || 'INCONNU'}</p>
            <p><strong>Établissement :</strong> {schoolName || currentSchool}</p>
            <p><strong>Promotion affectée :</strong> {assignedPromotion || 'NON RENSEIGNÉE'}</p>
          </div>
          <button type="button" onClick={handleSessionLogout} className="mt-6 bg-red-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase">
            🚪 Déconnexion
          </button>
        </div>
      </div>

          {/* MENU DES NAVIGATIONS ONGLET */}
          <div className="flex flex-wrap gap-1 bg-gray-50 p-1 rounded-xl mt-5">
            <button type="button" onClick={() => setActiveTab('dashboard_global')} className={`px-3 py-2 rounded-lg text-xs font-black ${activeTab === 'dashboard_global' ? 'bg-slate-900 text-orange-400' : 'text-gray-400'}`}>📊 Vue Globale</button>
            <button type="button" onClick={() => setActiveTab('pointages_rh')} className={`px-3 py-2 rounded-lg text-xs font-black ${activeTab === 'pointages_rh' ? 'bg-slate-900 text-orange-400' : 'text-gray-400'}`}>🕒 Suivi Heures</button>
            <button type="button" onClick={() => setActiveTab('assiduite_classes')} className={`px-3 py-2 rounded-lg text-xs font-black ${activeTab === 'assiduite_classes' ? 'bg-slate-900 text-orange-400' : 'text-gray-400'}`}>📝 Main-Courante</button>
            <button type="button" onClick={() => setActiveTab('excellence_promo')} className={`px-3 py-2 rounded-lg text-xs font-black ${activeTab === 'excellence_promo' ? 'bg-slate-900 text-orange-400' : 'text-gray-400'}`}>🏆 Excellence</button>
            <button type="button" onClick={() => setActiveTab('messages_sos')} className={`px-3 py-2 rounded-lg text-xs font-black ${activeTab === 'messages_sos' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>📬 Circulaires & SOS</button>
          </div>
        </div>

        {/* COMPTEURS SYNTHÈSES DE L'ONGLET PRINCIPAL */}
        {activeTab === 'dashboard_global' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl border p-5">
                <p className="text-[10px] font-black uppercase text-gray-400">Effectif de ma classe</p>
                <p className="text-3xl font-black text-gray-900 mt-2">{elevesPromo.length}</p>
              </div>
              <div className="bg-white rounded-2xl border p-5">
                <p className="text-[10px] font-black uppercase text-red-500">Absences</p>
                <p className="text-3xl font-black text-red-600 mt-2">
                  {elevesPromo.reduce((total, eleve) => total + (Number(eleve.absences) || 0), 0)} H
                </p>
              </div>
              <div className="bg-white rounded-2xl border p-5">
                <p className="text-[10px] font-black uppercase text-purple-600">Classe affectée</p>
                <p className="text-xl font-black text-purple-900 mt-2">{classeEducateur.nom}</p>
              </div>
            </div>

            {/* TABLEAU DES ÉLÈVES DE LA VUE GLOBALE */}
            <div className="bg-white rounded-2xl border p-6">
              <h3 className="text-xs font-black uppercase text-gray-700 mb-4">📋 Registre Alphabétique de la Classe</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                    <tr className="bg-gray-100 text-gray-700 uppercase font-bold border-b">
                      <th className="p-3">Matricule</th>
                      <th className="p-3">Nom & Prénoms</th>
                      <th className="p-3 text-center">Genre</th>
                      <th className="p-3 text-center">Absences</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {elevesPromo.map((el) => (
                      <tr key={el.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-gray-600">{el.matricule || el.id}</td>
                        <td className="p-3 font-bold text-gray-900 uppercase">{el.nom} {el.prenoms || el.prenom}</td>
                        <td className="p-3 text-center font-semibold text-gray-500">{el.genre || 'M'}</td>
                        <td className="p-3 text-center font-black text-red-600">{el.absences || 0} H</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            EXCELLENCE / CLASSEMENT
        ===================================================== */}
        {activeTab === 'excellence_promo' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border p-6">
              <div className="border-b pb-4 mb-4">
                <h2 className="text-sm font-black uppercase text-gray-900">🏆 Classement général de la promotion</h2>
                <p className="text-xs text-gray-400 mt-1">Classe : {classeEducateur.nom}</p>
              </div>

              {classement.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">Aucun élève dans cette classe.</div>
              ) : (
                <div className="space-y-2">
                  {classement.map((eleve, index) => (
                    <button key={eleve.id} type="button" onClick={() => { setEleveSelectionneConseil(eleve); setAvisConduiteConseil(eleve.appreciationConduiteEducateur || ''); }} className="w-full text-left bg-gray-50 hover:bg-purple-50 border rounded-xl p-4 transition flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-orange-400 flex items-center justify-center font-black text-xs shrink-0">{index + 1}</div>
                      <div className="flex-1">
                        <p className="text-sm font-black uppercase text-gray-900">{eleve.nom} {eleve.prenoms || ''}</p>
                        <p className="text-[10px] font-bold text-purple-600 uppercase">{eleve.classeId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-gray-900">{Number(eleve.totalPointsCumules).toFixed(2)}</p>
                        <p className="text-[9px] uppercase text-gray-400 font-bold">points cumulés</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* APPRÉCIATION FORMULAIRE */}
            <div className="bg-white rounded-2xl border p-5 h-fit">
              <h3 className="text-xs font-black uppercase text-purple-700 border-b pb-3 mb-4">💬 Appréciation de conduite</h3>
              {!eleveSelectionneConseil ? (
                <p className="text-center text-xs text-gray-400 py-12 italic">Sélectionnez un élève pour renseigner son appréciation.</p>
              ) : (
                <form onSubmit={handleEnregistrerAppreciationConseil} className="space-y-4">
                  <div className="bg-purple-50 rounded-xl p-4">
                    <p className="text-sm font-black uppercase text-purple-950">{eleveSelectionneConseil.nom} {eleveSelectionneConseil.prenoms || ''}</p>
                    <p className="text-[10px] font-bold text-purple-600 mt-1">{eleveSelectionneConseil.classeId}</p>
                  </div>
                  <textarea rows="5" value={avisConduiteConseil} onChange={(e) => setAvisConduiteConseil(e.target.value)} placeholder="Ex : Élève discipliné..." className="w-full border rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-purple-500" required />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setEleveSelectionneConseil(null); setAvisConduiteConseil(''); }} className="flex-1 bg-gray-100 py-3 rounded-xl text-[10px] font-black uppercase">Annuler</button>
                    <button type="submit" className="flex-1 bg-purple-600 text-white py-3 rounded-xl text-[10px] font-black uppercase">Enregistrer</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* =====================================================
            MAIN COURANTE
        ===================================================== */}
        {activeTab === 'assiduite_classes' && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-sm font-black uppercase border-b pb-3">📝 Main-Courante — {classeEducateur.nom}</h2>
            <p className="text-xs text-gray-400 mt-3">{fichesAppels.length} enregistrement(s) pour votre classe.</p>
            <div className="mt-4 space-y-2">
              {fichesAppels.map(f => (
                <div key={f.id} className="p-3 bg-gray-50 border rounded-xl text-xs flex justify-between">
                  <div><strong>Plage horaire :</strong> {f.periode || 'N/A'} | <strong>Matière :</strong> {f.matiere || 'N/A'}</div>
                  <div className="text-gray-400 font-mono">{f.date || 'Récemment'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =====================================================
            POINTAGES RH
        ===================================================== */}
        {activeTab === 'pointages_rh' && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-sm font-black uppercase border-b pb-3">🕒 Suivi des Heures Enseignants</h2>
            <p className="text-xs text-gray-400 mt-3">{pointagesRaw.length} session(s) enregistrée(s).</p>
            <div className="mt-4 space-y-2">
              {pointagesRaw.map(p => (
                <div key={p.id} className="p-3 bg-gray-50 border rounded-xl text-xs flex justify-between">
                  <div>👤 <strong>{p.professeurName}</strong> — Émersion horaire : <span className="font-bold text-orange-600">{p.heuresEffectuees || 2}H</span></div>
                  <div className="font-mono text-gray-400">{p.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =====================================================
            CIRCULAIRES & MESSAGERIE
        ===================================================== */}
        {activeTab === 'messages_sos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="text-xs font-black uppercase border-b pb-3 mb-4">✉️ Circulaire de promotion</h3>
              {msgStatus.text && (
                <div className={`border rounded-xl p-3 text-xs mb-4 ${msgStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {msgStatus.text}
                </div>
              )}
              <form onSubmit={handleDiffuserCirculaireMails} className="space-y-3">
                <input value={sujetCirculaire} onChange={(e) => setSujetCirculaire(e.target.value)} placeholder="Sujet" className="w-full border rounded-xl p-3 text-xs outline-none" required />
                <textarea rows="6" value={corpsCirculaire} onChange={(e) => setCorpsCirculaire(e.target.value)} placeholder="Message..." className="w-full border rounded-xl p-3 text-xs outline-none" required />
                <button type="submit" disabled={sending} className="w-full bg-purple-600 text-white py-3 rounded-xl text-xs font-black uppercase disabled:opacity-50 transition">
                  {sending ? 'Envoi en cours...' : '✉️ Diffuser aux parents'}
                </button>
              </form>
            </div>
            <div className="lg:col-span-2 bg-white rounded-2xl border p-5">
              <h3 className="text-xs font-black uppercase border-b pb-3 mb-4">📥 Instructions de la direction</h3>
              <ReceptionInstructionsAdmin currentSchool={currentSchool} idEducateurLogge={idEducateur} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DashboardEducateur; 
