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


const EcranEveilSecurite = ({ children }) => {

  const { user } = useAuth();

  const [verrouille, setVerrouille] =
    useState(false);

  const [publicites, setPublicites] =
    useState([]);

  const [publiciteIndex, setPubliciteIndex] =
    useState(0);

  const [motDePasse, setMotDePasse] =
    useState('');

  const [erreur, setErreur] =
    useState('');

  const [chargement, setChargement] =
    useState(false);


  const schoolId =
    user?.schoolId ||
    sessionStorage.getItem(
      'sgs_school_id'
    ) ||
    null;


  /* =====================================================
     CHARGEMENT DES PUBLICITÉS
  ===================================================== */

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

          const maintenant =
            new Date();


          const liste =
            snapshot.docs

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
                    : new Date(
                        pub.dateDebut
                      );


                const fin =
                  pub.dateFin?.toDate
                    ? pub.dateFin.toDate()
                    : new Date(
                        pub.dateFin
                      );


                // Publicité pas encore commencée
                if (maintenant < debut) {
                  return false;
                }


                // Publicité terminée
                if (maintenant > fin) {
                  return false;
                }


                // Publicité globale
                if (!pub.schoolId) {
                  return true;
                }


                // Publicité de l'établissement
                return (
                  pub.schoolId ===
                  schoolId
                );

              })

              .sort(
                (a, b) =>
                  Number(a.ordre || 0) -
                  Number(b.ordre || 0)
              );


          setPublicites(liste);


          setPubliciteIndex(
            (ancienIndex) => {

              if (
                liste.length === 0
              ) {
                return 0;
              }


              if (
                ancienIndex >=
                liste.length
              ) {
                return 0;
              }


              return ancienIndex;

            }
          );

        },


        (error) => {

          console.error(
            'Erreur publicités Firebase :',
            error
          );

          /*
           * IMPORTANT :
           * Une erreur de publicité ne doit
           * jamais rendre l'application blanche.
           */

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


  /* =====================================================
     ACTUALISATION DES DATES
  ===================================================== */

  useEffect(() => {

    const interval =
      setInterval(() => {

        setPublicites(
          (liste) => {

            const maintenant =
              new Date();


            return liste.filter(
              (pub) => {

                if (
                  !pub.dateDebut ||
                  !pub.dateFin
                ) {
                  return false;
                }


                const debut =
                  pub.dateDebut?.toDate
                    ? pub.dateDebut.toDate()
                    : new Date(
                        pub.dateDebut
                      );


                const fin =
                  pub.dateFin?.toDate
                    ? pub.dateFin.toDate()
                    : new Date(
                        pub.dateFin
                      );


                return (
                  maintenant >= debut &&
                  maintenant <= fin
                );

              }
            );

          }
        );

      }, 30000);


    return () =>
      clearInterval(interval);

  }, []);


  /* =====================================================
     SURVEILLANCE DE L'INACTIVITÉ
  ===================================================== */

  useEffect(() => {

    let timer = null;


    const redemarrerTimer = () => {

      if (timer) {
        clearTimeout(timer);
      }


      if (verrouille) {
        return;
      }


      timer = setTimeout(() => {

        setVerrouille(true);

        setMotDePasse('');

        setErreur('');

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


    evenements.forEach(
      (event) => {

        window.addEventListener(
          event,
          redemarrerTimer
        );

      }
    );


    redemarrerTimer();


    return () => {

      if (timer) {
        clearTimeout(timer);
      }


      evenements.forEach(
        (event) => {

          window.removeEventListener(
            event,
            redemarrerTimer
          );

        }
      );

    };

  }, [verrouille]);


  /* =====================================================
     ROTATION PUBLICITÉS
  ===================================================== */

  useEffect(() => {

    if (
      !verrouille ||
      publicites.length <= 1
    ) {
      return;
    }


    const interval =
      setInterval(() => {

        setPubliciteIndex(
          (ancienIndex) =>
            (
              ancienIndex + 1
            ) %
            publicites.length
        );

      }, 5000);


    return () =>
      clearInterval(interval);

  }, [
    verrouille,
    publicites.length,
  ]);


  /* =====================================================
     PUBLICITÉ COURANTE
  ===================================================== */

  const publiciteCourante =
    useMemo(() => {

      if (
        publicites.length === 0
      ) {
        return null;
      }


      return (
        publicites[
          publiciteIndex
        ] ||
        publicites[0]
      );

    }, [
      publicites,
      publiciteIndex,
    ]);


  /* =====================================================
     DÉVERROUILLAGE
  ===================================================== */

  const handleDeverrouillage =
    async (e) => {

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
         * Cette partie utilise le profil actuel.
         *
         * Pour une version production,
         * il est préférable d'utiliser Firebase Auth.
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

          setVerrouille(false);

          setMotDePasse('');

          setErreur('');

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


  /* =====================================================
     RENDU
  ===================================================== */

  return (
    <>

      {/* =================================================
          APPLICATION NORMALE
      ================================================= */}

      {children}


      {/* =================================================
          ÉCRAN DE VERROUILLAGE
          Il n'existe dans le DOM que si verrouillé.
      ================================================= */}

      {verrouille && (

        <div className="fixed inset-0 z-[99999] bg-slate-950 flex items-center justify-center p-4">

          <div className="w-full max-w-6xl bg-white rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-2">


            {/* ============================================
                ESPACE PUBLICITAIRE
            ============================================ */}

            <div className="relative min-h-[420px] bg-slate-900 overflow-hidden flex items-center justify-center">

              {publiciteCourante?.imageUrl ? (

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

                  Espace publicitaire

                </span>


                {publiciteCourante ? (

                  <>

                    <h2 className="mt-6 text-3xl md:text-4xl font-black uppercase">

                      {
                        publiciteCourante.titre
                      }

                    </h2>


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

                  </>

                ) : (

                  <>

                    <h2 className="mt-6 text-3xl md:text-4xl font-black uppercase">

                      Votre établissement

                    </h2>


                    <p className="mt-4 text-sm text-white/70">

                      Cet espace est réservé
                      aux communications et
                      publicités.

                    </p>

                  </>

                )}

              </div>

            </div>


            {/* ============================================
                CONSOLE DE SÉCURITÉ
            ============================================ */}

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