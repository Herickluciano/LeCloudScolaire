// src/components/EcranEveilSecurite.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

import { db } from '../services/api';
import { useAuth } from '../context/AuthContext';

const DUREE_INACTIVITE = 20 * 60 * 1000;

const CLE_VERROUILLAGE = 'edulink_ecran_verrouille';

const EcranEveilSecurite = ({ children }) => {
  const { user } = useAuth();

  /*
   * IMPORTANT :
   * Le verrouillage est lu depuis sessionStorage.
   * Ainsi, après F5, l'écran reste verrouillé.
   */
  const [verrouille, setVerrouille] = useState(() => {
    try {
      return (
        sessionStorage.getItem(CLE_VERROUILLAGE) === 'true'
      );
    } catch {
      return false;
    }
  });

  const [publicites, setPublicites] = useState([]);
  const [publiciteIndex, setPubliciteIndex] = useState(0);

  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const schoolId =
    user?.schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    null;

  /*
   * =====================================================
   * FONCTION DE VERROUILLAGE
   * =====================================================
   */
  const verrouillerSession = () => {
    try {
      sessionStorage.setItem(
        CLE_VERROUILLAGE,
        'true'
      );
    } catch (error) {
      console.error(
        'Erreur sessionStorage verrouillage :',
        error
      );
    }

    setMotDePasse('');
    setErreur('');
    setVerrouille(true);
  };

  /*
   * =====================================================
   * FONCTION DE DÉVERROUILLAGE
   * =====================================================
   */
  const deverrouillerSession = () => {
    try {
      sessionStorage.removeItem(
        CLE_VERROUILLAGE
      );
    } catch (error) {
      console.error(
        'Erreur sessionStorage déverrouillage :',
        error
      );
    }

    setMotDePasse('');
    setErreur('');
    setVerrouille(false);
  };

  /*
   * =====================================================
   * CHARGEMENT DES PUBLICITÉS EN TEMPS RÉEL
   * =====================================================
   */
  useEffect(() => {
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
              ...docSnap.data(),
            }))
            .filter((pub) => {
              if (
                !pub.dateDebut ||
                !pub.dateFin
              ) {
                return false;
              }

              const debut =
                pub.dateDebut?.toDate
                  ? pub.dateDebut.toDate()
                  : new Date(pub.dateDebut);

              const fin =
                pub.dateFin?.toDate
                  ? pub.dateFin.toDate()
                  : new Date(pub.dateFin);

              if (maintenant < debut) {
                return false;
              }

              if (maintenant > fin) {
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

          setPubliciteIndex((ancienIndex) => {
            if (liste.length === 0) {
              return 0;
            }

            if (ancienIndex >= liste.length) {
              return 0;
            }

            return ancienIndex;
          });
        },
        (error) => {
          console.error(
            'Erreur publicités Firebase :',
            error
          );

          setPublicites([]);
        }
      );
    } catch (error) {
      console.error(
        'Erreur initialisation publicités :',
        error
      );

      setPublicites([]);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [schoolId]);

  /*
   * =====================================================
   * ACTUALISATION DES DATES DES PUBLICITÉS
   * =====================================================
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setPublicites((liste) => {
        const maintenant = new Date();

        return liste.filter((pub) => {
          if (
            !pub.dateDebut ||
            !pub.dateFin
          ) {
            return false;
          }

          const debut =
            pub.dateDebut?.toDate
              ? pub.dateDebut.toDate()
              : new Date(pub.dateDebut);

          const fin =
            pub.dateFin?.toDate
              ? pub.dateFin.toDate()
              : new Date(pub.dateFin);

          return (
            maintenant >= debut &&
            maintenant <= fin
          );
        });
      });
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
   * =====================================================
   * SURVEILLANCE DE L'INACTIVITÉ
   * =====================================================
   */
  useEffect(() => {
    let timer = null;

    const redemarrerTimer = () => {
      if (timer) {
        clearTimeout(timer);
      }

      /*
       * Si déjà verrouillé :
       * aucune activité ne peut supprimer le verrou.
       */
      if (verrouille) {
        return;
      }

      timer = setTimeout(() => {
        verrouillerSession();
      }, DUREE_INACTIVITE);
    };

    const evenements = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    if (!verrouille) {
      evenements.forEach((event) => {
        window.addEventListener(
          event,
          redemarrerTimer
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
  }, [verrouille]);

  /*
   * =====================================================
   * ROTATION DES PUBLICITÉS
   * =====================================================
   */
  useEffect(() => {
    if (
      !verrouille ||
      publicites.length <= 1
    ) {
      return;
    }

    const interval = setInterval(() => {
      setPubliciteIndex(
        (ancienIndex) =>
          (ancienIndex + 1) %
          publicites.length
      );
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [
    verrouille,
    publicites.length,
  ]);

  /*
   * =====================================================
   * PUBLICITÉ COURANTE
   * =====================================================
   */
  const publiciteCourante = useMemo(() => {
    if (publicites.length === 0) {
      return null;
    }

    return (
      publicites[publiciteIndex] ||
      publicites[0]
    );
  }, [
    publicites,
    publiciteIndex,
  ]);

  /*
   * =====================================================
   * DÉVERROUILLAGE
   * =====================================================
   */
  const handleDeverrouillage = async (e) => {
    e.preventDefault();

    setErreur('');

    if (!motDePasse.trim()) {
      setErreur(
        'Veuillez saisir votre mot de passe.'
      );
      return;
    }

    setChargement(true);

    try {
      /*
       * Vérification avec le profil actuellement chargé.
       *
       * Pour une version production :
       * utiliser Firebase Authentication pour
       * vérifier réellement le mot de passe.
       */
      const motDePasseUtilisateur =
        user?.password ||
        user?.motDePasse ||
        user?.cleAcces ||
        null;

      if (
        motDePasseUtilisateur &&
        motDePasse ===
          motDePasseUtilisateur
      ) {
        /*
         * Suppression du verrou persistant.
         */
        deverrouillerSession();
      } else {
        setErreur(
          'Mot de passe incorrect.'
        );
      }
    } catch (error) {
      console.error(
        'Erreur déverrouillage :',
        error
      );

      setErreur(
        'Impossible de déverrouiller la session.'
      );
    } finally {
      setChargement(false);
    }
  };

  /*
   * =====================================================
   * RENDU
   * =====================================================
   */
  return (
    <>
      {/*
       * L'application reste montée derrière
       * l'écran de verrouillage.
       */}
      {children}

      {/*
       * =================================================
       * VERROUILLAGE TOTAL
       *
       * z-[99999] + fixed inset-0 :
       * couvre toute l'application,
       * y compris le footer.
       *
       * Le verrou reste présent après F5 grâce
       * au sessionStorage.
       * =================================================
       */}
      {verrouille && (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex items-center justify-center p-4">
          <div
            className={`w-full ${
              publiciteCourante
                ? 'max-w-6xl lg:grid-cols-2'
                : 'max-w-xl'
            } bg-white rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1`}
          >
            {/*
             * =================================================
             * PUBLICITÉ
             *
             * Affichée uniquement lorsqu'une publicité
             * active existe.
             * =================================================
             */}
            {publiciteCourante && (
              <div className="relative min-h-[420px] bg-slate-900 overflow-hidden flex items-center justify-center">
                {publiciteCourante.imageUrl ? (
                  <img
                    src={
                      publiciteCourante.imageUrl
                    }
                    alt={
                      publiciteCourante.titre ||
                      'Publicité'
                    }
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display =
                        'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-black" />
                )}

                <div className="absolute inset-0 bg-black/50" />

                <div className="relative z-10 text-white p-8 w-full">
                  <span className="inline-flex px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-black uppercase tracking-widest">
                    Publicité
                  </span>

                  {publiciteCourante.titre && (
                    <h2 className="mt-6 text-3xl md:text-4xl font-black uppercase">
                      {
                        publiciteCourante.titre
                      }
                    </h2>
                  )}

                  {publiciteCourante.description && (
                    <p className="mt-4 text-sm text-white/80 max-w-xl">
                      {
                        publiciteCourante.description
                      }
                    </p>
                  )}

                  {publiciteCourante.lienUrl && (
                    <a
                      href={
                        publiciteCourante.lienUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-6 px-5 py-3 rounded-xl bg-white text-slate-950 text-xs font-black uppercase hover:bg-slate-200 transition"
                    >
                      Découvrir
                    </a>
                  )}

                  {publicites.length > 1 && (
                    <div className="flex gap-2 mt-8">
                      {publicites.map(
                        (pub, index) => (
                          <button
                            key={pub.id}
                            type="button"
                            onClick={() =>
                              setPubliciteIndex(
                                index
                              )
                            }
                            aria-label={`Publicité ${
                              index + 1
                            }`}
                            className={
                              index ===
                              publiciteIndex
                                ? 'w-8 h-2 rounded-full bg-white transition-all'
                                : 'w-2 h-2 rounded-full bg-white/40 transition-all'
                            }
                          />
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/*
             * =================================================
             * CONSOLE DE SÉCURITÉ
             * =================================================
             */}
            <div className="bg-white p-8 md:p-12 flex items-center">
              <div className="w-full max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center text-xl mb-6">
                  🔐
                </div>

                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  Session sécurisée
                </p>

                <h1 className="text-3xl font-black text-slate-950 mt-2">
                  Écran verrouillé
                </h1>

                <p className="text-sm text-slate-500 mt-3">
                  Votre session est restée
                  inactive pendant 20 minutes.
                  <br />
                  Actualiser la page ne
                  désactive pas le verrouillage.
                </p>

                <form
                  onSubmit={
                    handleDeverrouillage
                  }
                  className="mt-8 space-y-5"
                >
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                      Mot de passe
                    </label>

                    <input
                      type="password"
                      value={motDePasse}
                      onChange={(e) =>
                        setMotDePasse(
                          e.target.value
                        )
                      }
                      placeholder="Votre mot de passe"
                      autoFocus
                      className="w-full px-4 py-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  {erreur && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold">
                      {erreur}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={chargement}
                    className="w-full py-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-black uppercase disabled:opacity-50 transition"
                  >
                    {chargement
                      ? 'Vérification...'
                      : 'Déverrouiller la session'}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    {sessionStorage.getItem(
                      'sgs_school_name'
                    ) ||
                      'Établissement scolaire'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EcranEveilSecurite;