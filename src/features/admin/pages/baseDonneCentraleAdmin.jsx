import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  enableNetwork, // 🟢 Importation du contrôleur de secours réseau
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

/* =========================================================
   OUTILS DE NORMALISATION ET D'EXTRACTION RESILIENTE
========================================================= */
const normaliser = (value = '') => {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

const getPrenom = (personne) => personne?.prenoms || personne?.prenom || '';
const getNomComplet = (personne) => personne?.name || `${personne?.nom || ''} ${getPrenom(personne)}`.trim();

const getPhoto = (personne) => {
  return personne?.photoUrl || personne?.photoURL || personne?.photo || personne?.photoProfil || personne?.photoProfile || '';
};

const getStatut = (personne) => personne?.statut || personne?.status || 'actif';

const getRoleLabel = (role) => {
  const roles = {
    eleve: 'Élève', professeur: 'Professeur', prof: 'Professeur', prof_principal: 'Professeur',
    educateur: 'Éducateur', admin: 'Administrateur', super_admin: 'Super admin', secretaire: 'Secrétariat'
  };
  return roles[role] || role || 'Personnel';
};

const getClasse = (personne) => personne?.classeNom || personne?.classe || personne?.nomClasse || '—';
const getPromotion = (personne) => personne?.promotion || personne?.assigned_promotion || '—';
const getMatricule = (personne) => personne?.matricule || personne?.id || '—';

const estEleve = (personne) => normaliser(personne?.role) === 'eleve';
const estEducateur = (personne) => normaliser(personne?.role) === 'educateur';
const estPersonnel = (personne) => !estEleve(personne);
const estActif = (personne) => normaliser(getStatut(personne)) !== 'inactif';

/* =========================================================
   COMPOSANT PRINCIPAL
========================================================= */
const BaseDonneCentraleAdmin = () => {
  const auth = useAuth();
  const currentSchool = (auth?.schoolId || auth?.user?.schoolId || sessionStorage.getItem('sgs_school_id') || '').trim().toLowerCase();

  // --- ÉTATS PRINCIPAUX ---
  const [personnes, setPersonnes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- RECHERCHE & PAGINATION ---
  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState('tous');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [page, setPage] = useState(1);
  const ELEMENTS_PAR_PAGE = 10;

  // --- MODALES D'ACTIONS ---
  const [personneEdition, setPersonneEdition] = useState(null);
  const [formEdition, setFormEdition] = useState({ nom: '', prenoms: '', email: '', telephone: '', adresse: '', dateNaissance: '', lieuNaissance: '' });
  const [photoExistante, setPhotoExistante] = useState('');
  const [nouvellePhoto, setNouvellePhoto] = useState(null);
  const [nouvellePhotoPreview, setNouvellePhotoPreview] = useState('');
  const [savingEdition, setSavingEdition] = useState(false);

  const [personneSituation, setPersonneSituation] = useState(null);
  const [formSituation, setFormSituation] = useState({ classeId: '', classeNom: '', promotion: '', assigned_promotion: '', statut: 'actif', motif: '' });
  const [savingSituation, setSavingSituation] = useState(false);

  const [personneRenvoi, setPersonneRenvoi] = useState(null);
  const [motifRenvoi, setMotifRenvoi] = useState('');
  const [savingRenvoi, setSavingRenvoi] = useState(false);

  const [personneReactiver, setPersonneReactiver] = useState(null);
  const [savingReactivation, setSavingReactivation] = useState(false);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  // 🔄 ÉCOUTE USERS INSENSIBLE À LA CASSE + FORÇAGE DE RÉSEAU CLOUD
  useEffect(() => {
    if (!currentSchool) { setPersonnes([]); setLoading(false); return; }
    setLoading(true);

    // Force la réactivation des sockets Firebase s'ils se sont mis en veille hors-ligne
    const restaurerReseauCloud = async () => {
      try {
        await enableNetwork(db);
      } catch (err) {
        console.log("Réseau déjà synchronisé ou en cache local.");
      }
    };
    restaurerReseauCloud();

    const epurerChaineSaas = (t = '') => t.toString().toLowerCase().replace(/[\s_-]/g, '').trim();
    const ecoleCible = epurerChaineSaas(currentSchool);

    const unsubscribe = onSnapshot(query(collection(db, 'users')), (snap) => {
      const liste = [];
      snap.forEach(d => {
        const item = d.data();
        const ecoleDoc = epurerChaineSaas(item.schoolId || '');
        // 🟢 Concordance adaptative pour capter "lycee_saint_bernard" et "LYCEE_SAINT_BERNARD"
        if (ecoleDoc === ecoleCible || ecoleCible.includes(ecoleDoc) || ecoleDoc.includes(ecoleCible)) {
          liste.push({ id: d.id, ...item });
        }
      });
      setPersonnes(liste);
      setLoading(false);
    }, (error) => {
      console.error("Erreur de liaison onSnapshot Users :", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentSchool]);

  // 🔄 ÉCOUTE CLASSES INSENSIBLE À LA CASSE
  useEffect(() => {
    if (!currentSchool) { setClasses([]); setLoadingClasses(false); return; }
    setLoadingClasses(true);

    const epurerChaineSaas = (t = '') => t.toString().toLowerCase().replace(/[\s_-]/g, '').trim();
    const ecoleCible = epurerChaineSaas(currentSchool);

    const unsubscribe = onSnapshot(query(collection(db, 'classes')), (snap) => {
      const liste = [];
      snap.forEach(d => {
        const item = d.data();
        if (epurerChaineSaas(item.schoolId || '') === ecoleCible) {
          liste.push({ id: d.id, ...item });
        }
      });
      setClasses(liste.sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { numeric: true })));
      setLoadingClasses(false);
    }, (error) => {
      console.error("Erreur de liaison onSnapshot Classes :", error);
      setLoadingClasses(false);
    });
    return () => unsubscribe();
  }, [currentSchool]);

  const rolesDisponibles = useMemo(() => {
    const roles = new Set();
    personnes.forEach(p => { if (p.role) roles.add(p.role); });
    return Array.from(roles).sort((a, b) => getRoleLabel(a).localeCompare(getRoleLabel(b), 'fr'));
  }, [personnes]);

  const personnesFiltrees = useMemo(() => {
    const termeSaisi = recherche.toString().toLowerCase().replace(/[\s_-]/g, '').trim();

    return personnes
      .filter((p) => {
        if (filtreRole !== 'tous') {
          const roleCible = filtreRole.toString().toLowerCase().replace(/[➔\s_-]/g, '').trim();
          const roleUser = (p.role || '').toString().toLowerCase().replace(/[➔\s_-]/g, '').trim();
          if (roleUser !== roleCible) return false;
        }

        if (filtreStatut === 'actif' && !estActif(p)) return false;
        if (filtreStatut === 'inactif' && estActif(p)) return false;
        if (!termeSaisi) return true;

        const blocTexte = [
          p.id, p.matricule, p.name, p.nom, p.prenom, p.prenoms, p.email, p.telephone, p.classe, p.classeNom, p.role
        ].filter(Boolean).join('').toLowerCase().replace(/[\s_-]/g, '');

        return blocTexte.includes(termeSaisi);
      })
      .sort((a, b) => getNomComplet(a).localeCompare(getNomComplet(b), 'fr'));
  }, [personnes, recherche, filtreRole, filtreStatut]);

  const totalPages = Math.max(1, Math.ceil(personnesFiltrees.length / ELEMENTS_PAR_PAGE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const personnesAffichees = useMemo(() => {
    const debut = (page - 1) * ELEMENTS_PAR_PAGE;
    return personnesFiltrees.slice(debut, debut + ELEMENTS_PAR_PAGE);
  }, [personnesFiltrees, page]);

  const statistiques = useMemo(() => ({
    total: personnes.length,
    eleves: personnes.filter(estEleve).length,
    personnel: personnes.filter(estPersonnel).length,
    actifs: personnes.filter(estActif).length,
    inactifs: personnes.filter(p => !estActif(p)).length,
  }), [personnes]);

  const handleRecherche = (e) => { setRecherche(e.target.value); setPage(1); };
  const handleFiltreRole = (e) => { setFiltreRole(e.target.value); setPage(1); };
  const handleFiltreStatut = (e) => { setFiltreStatut(e.target.value); setPage(1); };

  const ouvrirEdition = (p) => {
    setPersonneEdition(p);
    setFormEdition({ nom: p.nom || '', prenoms: p.prenoms || p.prenom || '', email: p.email || '', telephone: p.telephone || p.phone || '', adresse: p.adresse || '', dateNaissance: p.dateNaissance || '', lieuNaissance: p.lieuNaissance || '' });
    setPhotoExistante(getPhoto(p));
    setNouvellePhoto(null);
    setNouvellePhotoPreview('');
  };

  const handleEditionChange = (e) => setFormEdition(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleNouvellePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNouvellePhoto(file);
    setNouvellePhotoPreview(URL.createObjectURL(file));
  };

  const enregistrerEdition = async (e) => {
    e.preventDefault();
    if (!personneEdition?.id) return;
    setSavingEdition(true);
    try {
      let photoFinale = photoExistante;
           if (nouvellePhoto) {
        const nomFichier = `${personneEdition.id}_${Date.now()}_${nouvellePhoto.name}`;
        const photoRef = ref(storage, `users/${currentSchool}/${personneEdition.id}/photo/${nomFichier}`);
        await uploadBytes(photoRef, nouvellePhoto);
        photoFinale = await getDownloadURL(photoRef);
      }

      await updateDoc(doc(db, 'users', personneEdition.id), {
        nom: formEdition.nom.trim(),
        prenoms: formEdition.prenoms.trim(),
        name: `${formEdition.nom.trim()} ${formEdition.prenoms.trim()}`.trim(),
        email: formEdition.email.trim(),
        telephone: formEdition.telephone.trim(),
        adresse: formEdition.adresse.trim(),
        dateNaissance: formEdition.dateNaissance,
        lieuNaissance: formEdition.lieuNaissance,
        photoUrl: photoFinale,
        photo: photoFinale,
        updatedAt: serverTimestamp(),
      });

      setMessage({ type: 'success', text: 'Fiche mise à jour avec succès !' });
      fermerEdition();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdition(false);
    }
  };

  const ouvrirSituation = (p) => {
    setPersonneSituation(p);
    setFormSituation({ 
      classeId: p.classeId || '', 
      classeNom: p.classeNom || p.classe || '', 
      promotion: p.promotion || '', 
      assigned_promotion: p.assigned_promotion || p.promotion || '', 
      statut: getStatut(p) 
    });
  };

  const handleClasseChange = (e) => {
    const id = e.target.value;
    const cl = classes.find(c => c.id === id);
    setFormSituation(prev => ({ ...prev, classeId: id, classeNom: cl?.nom || '', promotion: cl?.promotion || '' }));
  };

  const handlePromotionChange = (e) => setFormSituation(prev => ({ ...prev, promotion: e.target.value, assigned_promotion: e.target.value }));

  const enregistrerSituation = async (e) => {
    e.preventDefault();
    if (!personneSituation) return;
    setSavingSituation(true);
    try {
      const userRef = doc(db, 'users', personneSituation.id);
      const updates = { updatedAt: serverTimestamp() };
      
      if (estEleve(personneSituation)) {
        updates.classeId = formSituation.classeId; 
        updates.classeNom = formSituation.classeNom;
        updates.promotion = formSituation.promotion; 
        updates.statut = formSituation.statut;
      } else if (estEducateur(personneSituation)) {
        updates.assigned_promotion = formSituation.assigned_promotion; 
        updates.promotion = formSituation.assigned_promotion; 
        updates.statut = formSituation.statut;
      } else { 
        updates.statut = formSituation.statut; 
      }
      
      await updateDoc(userRef, updates);
      setMessage({ type: 'success', text: 'Mutation appliquée !' });
      setPersonneSituation(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSituation(false);
    }
  };

  const ouvrirRenvoi = (p) => { setPersonneRenvoi(p); setMotifRenvoi(''); };

  const confirmerRenvoi = async () => {
    if (!personneRenvoi || !motifRenvoi.trim()) return;
    if (!window.confirm("Renvoyer ce membre de l'effectif actif ?")) return;
    setSavingRenvoi(true);
    try {
      await updateDoc(doc(db, 'users', personneRenvoi.id), { statut: 'inactif', status: 'inactif', motifSortie: motifRenvoi.trim(), dateSortie: serverTimestamp(), updatedAt: serverTimestamp() });
      setMessage({ type: 'success', text: 'Dossier archivé.' }); 
      setPersonneRenvoi(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRenvoi(false);
    }
  };

  const ouvrirReactivation = (p) => setPersonneReactiver(p);

  const confirmerReactivation = async () => {
    if (!personneReactiver) return;
    setSavingReactivation(true);
    try {
      await updateDoc(doc(db, 'users', personneReactiver.id), { statut: 'actif', status: 'actif', motifSortie: null, dateSortie: null, updatedAt: serverTimestamp() });
      setMessage({ type: 'success', text: 'Membre réactivé !' }); 
      setPersonneReactiver(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingReactivation(false);
    }
  };

  const fermerEdition = () => { if (nouvellePhotoPreview) URL.revokeObjectURL(nouvellePhotoPreview); setPersonneEdition(null); setNouvellePhoto(null); setNouvellePhotoPreview(''); };
  const fermerSituation = () => setPersonneSituation(null);
  const fermerRenvoi = () => { setPersonneRenvoi(null); setMotifRenvoi(''); };
  const fermerReactivation = () => setPersonneReactiver(null);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb', padding: '24px' }}>
      <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
        
        {/* EN-TÊTE PRINCIPAL BANDEAU */}
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#172033' }}>Base de Données Centrale</h1>
              <p style={{ margin: '6px 0 0', color: '#667085', fontSize: '13px' }}>Gestion centralisée des élèves et du personnel de l'établissement.</p>
            </div>
            <div style={{ padding: '10px 15px', background: '#ecfdf3', color: '#067647', borderRadius: '10px', fontWeight: 700, fontSize: '12px' }}>● Synchronisation en temps réel</div>
          </div>
        </div>

        {/* NOTIFICATIONS DES MESSAGES SYSTEMES */}
        {message.text && (
          <div style={{ padding: '14px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, marginBottom: '16px', textAlign: 'left', border: '1px solid', backgroundColor: message.type === 'success' ? '#ecfdf3' : '#fef3f2', color: message.type === 'success' ? '#067647' : '#b42318', borderColor: message.type === 'success' ? '#d1fae5' : '#fee2e2' }}>
            {message.text}
          </div>
        )}

        {/* CONTENEUR DES COMPTEURS STATS (Raccordé à l'en-tête existante) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <StatCard titre="Effectif Total" valeur={statistiques.total} icone="👥" />
          <StatCard titre="Élèves inscrits" valeur={statistiques.eleves} icone="🎓" />
          <StatCard titre="Personnel permanent" valeur={statistiques.personnel} icone="👨‍🏫" />
          <StatCard titre="Membres Actifs" valeur={statistiques.actifs} icone="🟢" />
          <StatCard titre="Membres Inactifs" valeur={statistiques.inactifs} icone="🔴" />
        </div>

        {/* ZONE DES RECHERCHES ET SÉLECTEURS DE FILTRAGE BARRE */}
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="🔍 Rechercher un profil par Matricule, ID, Nom, Email, Classe..." value={recherche} onChange={handleRecherche} style={{ flex: 1, minWidth: '260px', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: 600, outline: 'none' }} />
          
          <select value={filtreRole} onChange={handleFiltreRole} style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: 700, backgroundColor: '#ffffff', cursor: 'pointer', outline: 'none' }}>
            <option value="tous">👥 Tous les corps</option>
            {rolesDisponibles.map(r => (
              <option key={r} value={r}>➔ {getRoleLabel(r)}</option>
            ))}
          </select>

          <select value={filtreStatut} onChange={handleFiltreStatut} style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: 700, backgroundColor: '#ffffff', cursor: 'pointer', outline: 'none' }}>
            <option value="tous">⭐ Tous les statuts</option>
            <option value="actif">🟢 Actifs uniquement</option>
            <option value="inactif">🔴 Inactifs / Radiés</option>
          </select>
        </div>

        {/* SECTION TABLEAU COMPOSITE CENTRAL DE BASE */}
        <div style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.06)' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#667085', fontWeight: 700, fontSize: '13px' }}>⏳ Synchronisation en direct avec le cloud...</div>
          ) : personnesAffichees.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#667085', fontWeight: 700, fontSize: '13px' }}>🔍 Aucun dossier matricule ne correspond aux filtres.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {/* L'arborescence des lignes de données <table> vient s'injecter ici */}
            </div>
          )}

                   {/* BARRE DE PAGINATION BAS DE PAGE */}
          <div style={{ padding: '14px 24px', background: '#ffffff', borderTop: '1px solid #eaecf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', background: '#ffffff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>◀ Précédent</button>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Page {page} sur {totalPages}</span>
            <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', background: '#ffffff', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Suivant ▶</button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          MODALE 1 : FORMULAIRE D'ÉDITION CIVILE SÉCURISÉ
          ========================================================================= */}
      {personneEdition && (
        <Modal titre={`Éditer la fiche — ${getNomComplet(personneEdition)}`} onClose={fermerEdition}>
          <form onSubmit={enregistrerEdition} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>Nom</label>
                <input name="nom" value={formEdition.nom} onChange={handleEditionChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }} required />
              </div>
              <div>
                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>Prénoms</label>
                <input name="prenoms" value={formEdition.prenoms} onChange={handleEditionChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }} required />
              </div>
              <div>
                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>Email</label>
                <input type="email" name="email" value={formEdition.email} onChange={handleEditionChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
              </div>
              <div>
                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>Téléphone</label>
                <input name="telephone" value={formEdition.telephone} onChange={handleEditionChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #eaecf0', paddingTop: '16px' }}>
              <button type="button" onClick={fermerEdition} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#f2f4f7', cursor: 'pointer' }}>Annuler</button>
              <button type="submit" disabled={savingEdition} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#0f172a', color: '#ffffff', cursor: 'pointer' }}>
                {savingEdition ? 'Enregistrement...' : '💾 Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODALE 2 : MODIFICATION DE SITUATION ET REFFECTATION
          ========================================================================= */}
      {personneSituation && (
        <Modal titre={`Modifier la situation — ${getNomComplet(personneSituation)}`} onClose={fermerSituation}>
          <form onSubmit={enregistrerSituation} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'left' }}>
            <div style={{ padding: '12px 15px', background: '#f8fafc', borderRadius: '10px' }}>
              <strong>{getRoleLabel(personneSituation.role).toUpperCase()}</strong>
              <div style={{ marginTop: '4px', fontSize: '11px', fontFamily: 'monospace' }}>Matricule : {getMatricule(personneSituation)}</div>
            </div>
            {estEleve(personneSituation) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <select value={formSituation.classeId} onChange={handleClasseChange} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#ffffff' }} required>
                  <option value="">Sélectionner une classe</option>
                  {classes.map(c => <option key={c.id} value={c.id}>🏛️ {c.nom}</option>)}
                </select>
                <input value={formSituation.promotion} readOnly style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #eaecf0', paddingTop: '16px' }}>
              <button type="button" onClick={fermerSituation} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#f2f4f7', cursor: 'pointer' }}>Annuler</button>
              <button type="submit" disabled={savingSituation} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', cursor: 'pointer' }}>
                {savingSituation ? 'Traitement...' : '💾 Confirmer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODALE 3 : RENVOI ET ARCHIVAGE DISCIPLINAIRE
          ========================================================================= */}
      {personneRenvoi && (
        <Modal titre={`Renvoyer — ${getNomComplet(personneRenvoi)}`} onClose={fermerRenvoi}>
          <div style={{ padding: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <textarea value={motifRenvoi} onChange={(e) => setMotifRenvoi(e.target.value)} placeholder="Motif du renvoi officiel..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', minHeight: '100px' }} required />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={fermerRenvoi} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#f2f4f7', cursor: 'pointer' }}>Annuler</button>
              <button type="button" onClick={confirmerRenvoi} disabled={savingRenvoi || !motifRenvoi.trim()} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#dc2626', color: '#ffffff', cursor: 'pointer' }}>
                {savingRenvoi ? 'Archivage...' : '🚫 Confirmer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODALE 4 : RÉACTIVATION DE COMPTE ARCHIVÉ
          ========================================================================= */}
      {personneReactiver && (
        <Modal titre={`Réactiver — ${getNomComplet(personneReactiver)}`} onClose={fermerReactivation}>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: '#667085', fontSize: '13px' }}>Réactiver {getNomComplet(personneReactiver)} dans l'effectif actif ?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button type="button" onClick={fermerReactivation} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#f2f4f7', cursor: 'pointer' }}>Annuler</button>
              <button type="button" onClick={confirmerReactivation} disabled={savingReactivation} style={{ border: 0, padding: '10px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', cursor: 'pointer' }}>
                {savingReactivation ? 'Traitement...' : '♻️ Activer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

/* =========================================================
   SOUS-COMPOSANT 1 : CARTE STATISTIQUE (KPI)
========================================================= */
const StatCard = ({ titre, valeur, icone }) => (
  <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: '12px', color: '#667085', fontWeight: 700, textTransform: 'uppercase' }}>{titre}</div>
      <div style={{ fontSize: '26px', fontWeight: 900, color: '#172033' }}>{valeur}</div>
    </div>
    <div style={{ fontSize: '26px' }}>{icone}</div>
  </div>
);

/* =========================================================
   SOUS-COMPOSANT 2 : FENÊTRE MODALE CONTENEUR TRANSPARENT
========================================================= */
const Modal = ({ titre, children, onClose }) => {
  return (
    <div 
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} 
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: '18px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eaecf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#172033', textTransform: 'uppercase' }}>
            {titre}
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ border: 0, background: 'transparent', fontSize: '20px', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default BaseDonneCentraleAdmin;
