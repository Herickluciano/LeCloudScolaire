// src/components/EcranEveilSecurite.jsx

import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  collection,
  onSnapshot,
  query,
  where,
  doc
} from 'firebase/firestore';

import { useLocation, Link } from 'react-router-dom';

import { db } from '../services/api';
import { useAuth } from '../context/AuthContext';

const DUREE_INACTIVITE = 20 * 60 * 1000;
const CLE_VERROUILLAGE = 'edulink_ecran_verrouille';

const EcranEveilSecurite = ({ children }) => {

  const { user } = useAuth();

  const location = useLocation();

  /*
   * =====================================================
   * PAGES PUBLIQUES
   * =====================================================
   *
   * Sur ces pages :
   * - aucun verrouillage
   * - aucun timer d'inactivité
   * - aucun écran noir
   * - suppression du verrou éventuellement présent
   *   dans sessionStorage
   */

  const estPagePublique =
    location.pathname === '/login' ||
    location.pathname === '/recuperer-cle';

  const [verrouille, setVerrouille] = useState(() => {
    try {
      /*
       * Si on est déjà sur une page publique au premier rendu,
       * on ne restaure surtout pas le verrou.
       */
      if (
        window.location.pathname === '/login' ||
        window.location.pathname === '/recuperer-cle'
      ) {
        return false;
      }

      return sessionStorage.getItem(CLE_VERROUILLAGE) === 'true';

    } catch {
      return false;
    }
  });

  const [publicites, setPublicites] = useState([]);

  const [motDePasse, setMotDePasse] = useState('');

  const [erreur, setErreur] = useState('');

  const [chargement, setChargement] = useState(false);

  // 🟢 ETAT CRITIQUE :
  // Contient les données de l'utilisateur lues sur le Cloud en direct
  const [userDataCloud, setUserDataCloud] = useState(null);

  const schoolId =
    user?.schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    null;

  const schoolNameDisplay =
    user?.schoolName ||
    sessionStorage.getItem('sgs_school_name') ||
    '';

  // =====================================================
  // VERROUILLER LA SESSION
  // =====================================================

  const verrouillerSession = () => {

    /*
     * Sécurité supplémentaire :
     * impossible de verrouiller /login ou /recuperer-cle.
     */
    if (estPagePublique) {
      return;
    }

    try {
      sessionStorage.setItem(
        CLE_VERROUILLAGE,
        'true'
      );
    } catch (err) {
      console.error(err);
    }

    setMotDePasse('');
    setErreur('');
    setVerrouille(true);
  };

  // =====================================================
  // DÉVERROUILLER LA SESSION
  // =====================================================

  const deverrouillerSession = () => {

    try {
      sessionStorage.removeItem(
        CLE_VERROUILLAGE
      );
    } catch (err) {
      console.error(err);
    }

    setMotDePasse('');
    setErreur('');
    setVerrouille(false);
  };

  // =====================================================
  // SI PAGE PUBLIQUE :
  // FORCER LE DÉVERROUILLAGE
  // =====================================================

  useEffect(() => {

    if (!estPagePublique) {
      return;
    }

    /*
     * On retire immédiatement le verrou local.
     */
    try {
      sessionStorage.removeItem(
        CLE_VERROUILLAGE
      );
    } catch (err) {
      console.error(err);
    }

    /*
     * On force l'état React à false.
     */
    setVerrouille(false);
    setMotDePasse('');
    setErreur('');
    setChargement(false);

  }, [estPagePublique]);

  // =====================================================
  // FLUX 1 :
  // ÉCOUTEUR CLOUD EN TEMPS RÉEL
  // DE LA FICHE UTILISATEUR
  // =====================================================

  useEffect(() => {

    /*
     * Sur les pages publiques, il n'est pas nécessaire
     * d'écouter la fiche utilisateur.
     */
    if (estPagePublique) {
      setUserDataCloud(null);
      return;
    }

    const userSessionRaw =
      sessionStorage.getItem('sgs_user');

    let sessionUser = null;

    try {
      sessionUser = userSessionRaw
        ? JSON.parse(userSessionRaw)
        : null;
    } catch {
      sessionUser = null;
    }

    const targetUserId =
      user?.matricule ||
      user?.id ||
      sessionUser?.matricule ||
      sessionUser?.id;

    if (!targetUserId) {
      setUserDataCloud(null);
      return;
    }

    /*
     * Écoute permanente onSnapshot
     * sur le document utilisateur actif.
     */
    const docUserRef = doc(
      db,
      'users',
      targetUserId.trim()
    );

    const unsubscribeUser = onSnapshot(
      docUserRef,
      (docSnap) => {

        if (docSnap.exists()) {
          setUserDataCloud(
            docSnap.data()
          );
        } else {
          setUserDataCloud(null);
        }

      },
      (err) => {

        console.error(
          'Erreur d’écoute de la fiche utilisateur live :',
          err
        );

      }
    );

    return () => {
      unsubscribeUser();
    };

  }, [user, estPagePublique]);

  // =====================================================
  // FLUX 2 :
  // ÉCOUTEUR CLOUD EN TEMPS RÉEL
  // DE LA RÉGIE PUBLICITAIRE
  // =====================================================

  useEffect(() => {

    /*
     * Les publicités de l'écran de veille ne sont pas
     * nécessaires sur les pages publiques.
     */
    if (estPagePublique) {
      setPublicites([]);
      return;
    }

    let unsubscribe = null;

    try {

      const q = query(
        collection(db, 'publicites'),
        where('actif', '==', true)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {

          const maintenant = new Date();

          const liste = snapshot.docs
            .map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data()
            }))
            .filter((pub) => {

              if (
                !pub.dateDebut ||
                !pub.dateFin
              ) {
                return false;
              }

              const debut =
                convertirDate(pub.dateDebut);

              const fin =
                convertirDate(pub.dateFin);

              if (
                maintenant < debut ||
                maintenant > fin
              ) {
                return false;
              }

              if (!pub.schoolId) {
                return true;
              }

              return pub.schoolId === schoolId;

            })
            .sort(
              (a, b) =>
                Number(a.ordre || 0) -
                Number(b.ordre || 0)
            );

          setPublicites(liste);

        },
        (error) => {

          console.error(
            'Erreur Firebase publicites :',
            error
          );

          setPublicites([]);

        }
      );

    } catch (error) {

      console.error(error);

      setPublicites([]);

    }

    return () => {

      if (unsubscribe) {
        unsubscribe();
      }

    };

  }, [schoolId, estPagePublique]);

  // =====================================================
  // SURVEILLANCE DE L'INACTIVITÉ
  // =====================================================

  useEffect(() => {

    let timer = null;

    const redemarrerTimer = () => {

      /*
       * Aucune surveillance sur les pages publiques.
       */
      if (estPagePublique) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
      }

      if (verrouille) {
        return;
      }

      timer = setTimeout(() => {

        /*
         * Double protection avant verrouillage.
         */
        if (!estPagePublique) {
          verrouillerSession();
        }

      }, DUREE_INACTIVITE);

    };

    const evenements = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click'
    ];

    /*
     * On installe les écouteurs uniquement si :
     * - ce n'est pas une page publique
     * - la session n'est pas déjà verrouillée
     */
    if (
      !verrouille &&
      !estPagePublique
    ) {

      evenements.forEach((event) => {

        window.addEventListener(
          event,
          redemarrerTimer,
          {
            passive: true
          }
        );

      });

      redemarrerTimer();
    }

    return () => {

      if (timer) {
        clearTimeout(timer);
      }

      evenements.forEach((event) => {

        window.removeEventListener(
          event,
          redemarrerTimer
        );

      });

    };

  }, [verrouille, estPagePublique]);

  // =====================================================
  // DÉVERROUILLAGE
  // =====================================================

  const handleDeverrouillage = async (e) => {

    e.preventDefault();

    setErreur('');

    const cleanPass =
      motDePasse.trim();

    if (!cleanPass) {

      return setErreur(
        'Veuillez saisir votre mot de passe.'
      );

    }

    setChargement(true);

    // =================================================
    // CLÉ D'ACCÈS MAÎTRE
    // =================================================

    if (cleanPass === 'HERICK2024') {

      deverrouillerSession();

      setChargement(false);

      return;
    }

    // =================================================
    // MOT DE PASSE FIREBASE EN TEMPS RÉEL
    // =================================================

    const cloudPassword =
      userDataCloud?.password ||
      userDataCloud?.motDePasse;

    // =================================================
    // SESSION LOCALE DE SECOURS
    // =================================================

    const userSessionRaw =
      sessionStorage.getItem('sgs_user');

    let sessionUser = null;

    try {

      sessionUser =
        userSessionRaw
          ? JSON.parse(userSessionRaw)
          : null;

    } catch {

      sessionUser = null;

    }

    const localPassword =
      user?.password ||
      user?.motDePasse ||
      user?.cleAcces ||
      sessionUser?.password;

    const motDePasseAttendu =
      cloudPassword ||
      localPassword;

    // =================================================
    // COMPARAISON
    // =================================================

    if (
      motDePasseAttendu &&
      cleanPass === motDePasseAttendu
    ) {

      deverrouillerSession();

    } else {

      setErreur(
        'Mot de passe incorrect. Session maintenue sous scellés.'
      );

    }

    setChargement(false);
  };

  // =====================================================
  // RÉPÉTITION POUR SLIDER HORIZONTAL INFINI
  // =====================================================

  const listePublicitesBandeau = useMemo(() => {

    if (publicites.length === 0) {
      return [];
    }

    if (publicites.length === 1) {

      return [
        publicites[0],
        publicites[0],
        publicites[0],
        publicites[0],
        publicites[0],
        publicites[0]
      ];

    }

    return [
      ...publicites,
      ...publicites,
      ...publicites
    ];

  }, [publicites]);

  // =====================================================
  // AFFICHAGE
  // =====================================================

  return (
    <>

      <style>{`

        @keyframes decollementHorizontal {

          0% {
            transform: translateX(0);
          }

          100% {
            transform: translateX(-50%);
          }

        }

        .animate-ticker-slider-infinit {

          display: flex;
          width: max-content;
          animation:
            decollementHorizontal
            20s linear infinite;

        }

        .animate-ticker-slider-infinit:hover {

          animation-play-state: paused;

        }

      `}</style>

      {/* =================================================
          L'APPLICATION S'EXÉCUTE NORMALEMENT
      ================================================= */}

      {children}

      {/* =================================================
          BLINDAGE TOTAL ET APPARITION OPAQUE EN NOIR PUR

          IMPORTANT :
          !estPagePublique

          empêche totalement l'écran de veille
          d'apparaître sur /login et /recuperer-cle.
      ================================================= */}

      {verrouille && !estPagePublique && (

        <div
          className="fixed inset-0 w-screen h-screen flex flex-col justify-between p-4 sm:p-8 font-sans select-none"
          style={{
            zIndex: 999999,
            position: 'fixed',
            backgroundColor: '#000000',
            color: '#ffffff',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        >

          {/* =================================================
              CASIER CENTRAL DE RECONNEXION SOMBRE
          ================================================= */}

          <div className="formeveil w-full max-w-md mx-auto bg-slate-950  rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-900 flex flex-col items-center my-auto">

            <div className="w-12 h-14 rounded-2xl bg-slate-900  flex items-center justify-center text-xl mb-4 border border-slate-800">
              🔐
              <h2 className="text-lg font-black uppercase tracking-tight  mb-1">
                Écran verrouillé
              </h2>

              <p className="text-[11px] text-slate-400 text-center mb-2 ">
                Votre session est restée inactive pendant 20 minutes.
              </p>

            </div>

            {erreur && (

              <div className="incorrect w-full mt-2 p-0 bg-red-950/50 border border-red-900/30 text-red-400  text-xs font-bold rounded-xl text-center animate-pulse">
                ⚠️ {erreur}

              </div>

            )}

            <form
              onSubmit={handleDeverrouillage}
              className="w-full mt-4 space-y-4"
            >

              <div className="eveil form-floating mb-3 text-left">

                <label
                  htmlFor="floatingInput"
                  className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider"
                >
                  Mot de passe d'accès *
                </label>

                <input
                  id="floatingInput"
                  type="password"
                  value={motDePasse}
                  onChange={(e) =>
                    setMotDePasse(e.target.value)
                  }
                  placeholder="Saisissez votre mot de passe..."
                  autoFocus
                  className="form-control w-full px-4 py-3.5 rounded-xl border border-slate-800  text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-orange-500 text-center tracking-widest transition-all"
                  required
                />

              </div>

              <button
                type="submit"
                disabled={chargement}
                className="btn-eveil"
              >

                {chargement
                  ? 'Vérification NoSQL...'
                  : '🔓 Déverrouiller la session'}

              </button>
               <Link to="/recuperer-cle" className="oublieeveil text-[11px] font-black  hover:text-purple-700 transition uppercase tracking-wider">
                   Mot de passe oublié ?
                </Link>

            </form>

          </div>

          {/* =================================================
              BARRE EN-TÊTE SÉCURISÉE INFÉRIEURE
          ================================================= */}

          <div className="w-full max-w-7xl mx-auto flex justify-between items-center border-b border-slate-900 pb-2 mb-2">

            <div className="flex items-center gap-2">

              <div className="text-left">

                <p className="etabli text-[10px] text-slate-500 font-mono ">

                  Établissement :{' '}

                  {schoolNameDisplay ||
                    user?.schoolName ||
                    sessionStorage.getItem(
                      'sgs_school_name'
                    )}

                </p>

              </div>

            </div>

            <span className="text-[9px] font-black uppercase tracking-widest bg-red-950 text-red-400 px-2.5 py-1 rounded-md animate-pulse">

              Poste Suspendu

            </span>

          </div>

          {/* =================================================
              SLIDER HORIZONTAL EN BOUCLE INFINIE
          ================================================= */}

          <div className="barre w-full max-w-7xl mx-auto border-t border-slate-900 pt-4 overflow-hidden relative">

            {listePublicitesBandeau.length > 0 ? (

              <div className="w-full overflow-hidden">

                <div className="animate-ticker-slider-infinit gap-4 sm:gap-6 items-center">

                  {listePublicitesBandeau.map(
                    (pub, idx) => (

                      <div
                        key={`${pub.id}-${idx}`}
                        className=""
                      >

                        {pub.imageUrl ? (

                          <img
                            src={pub.imageUrl}
                            alt="annonce"
                            className="imgeveil  w-8 h-8 rounded-lg object-cover border border-slate-800"
                            onError={(e) => {
                              e.currentTarget.style.display =
                                'none';
                            }}
                          />

                        ) : (

                          <span className="text-base">
                            📢
                          </span>

                        )}

                        <div className="truncate">

                          <p className="annonce1 text-[11px] font-black  uppercase tracking-tight truncate">

                            {pub.titre ||
                              pub.nomAnnonceur ||
                              'Annonce Établissement'}

                          </p>

                          <p className="annonce2  text-[10px] text-slate-400 font-medium truncate mt-0.5">

                            {pub.description ||
                              pub.textePub ||
                              pub.message}

                          </p>

                        </div>

                      </div>

                    )
                  )}

                </div>

              </div>

            ) : (

              <div className="annonce3 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest py-2 ">

                EDULINK hORS CONNEXION — Sécurisé par <a href="https://luhamcode.com">Luhamcode S.R.L</a> | Italy

              </div>

            )}

          </div>

        </div>

      )}

    </>
  );
};

// =====================================================
// UTILITAIRE DE CONVERSION DE DATES
// =====================================================

const convertirDate = (valeur) => {

  if (!valeur) {
    return new Date(0);
  }

  if (valeur?.toDate) {
    return valeur.toDate();
  }

  return new Date(valeur);
};

export default EcranEveilSecurite;