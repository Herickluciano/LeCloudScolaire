// src/features/professeur/pages/DashboardProf.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';

import ReceptionProf from './message/ReceptionProf';
import EmploiDuTempsProf from './EmploiDuTempsProf';
import SaisieNotes from './evaluations/SaisieNotes';
import Header from '../../../pages/Header';
import FaireAppel from './assiduite/FaireAppel';
import EmploiDuTempsProfesseur from './EmploiDuTempsProfesseur';

const DashboardProf = () => {
  const {
    user,
    schoolId,
    schoolName,
    logout,
  } = useAuth();

  const navigate = useNavigate();

  // ============================================================
  // IDENTITÉ DYNAMIQUE
  // ============================================================

  const currentSchool = String(
    user?.schoolId ||
      schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
  )
    .trim()
    .toLowerCase();

  const idProf = String(
    user?.matricule ||
      user?.id ||
      user?.uid ||
      ''
  )
    .trim();

  const nomProf =
    user?.name ||
    user?.nomComplet ||
    `${user?.nom || ''} ${user?.prenoms || user?.prenom || ''}`.trim() ||
    'Enseignant';

  const discipline =
    user?.matiereEnseignee ||
    user?.matiere ||
    user?.discipline ||
    'Discipline';

  // ============================================================
  // ÉTATS
  // ============================================================

  const [loading, setLoading] = useState(true);

  const [totalPointages, setTotalPointages] = useState(0);

  // Pointage actuellement ouvert : après l'arrivée, le rappel apparaît automatiquement.
  const [pointageEnCours, setPointageEnCours] = useState(null);

  const [classesEdt, setClassesEdt] = useState([]);

  const [classeSelectionnee, setClasseSelectionnee] = useState('');

  // ============================================================
  // DÉTECTION PROFESSEUR PRINCIPAL
  // ============================================================

  const estProfPrincipal = useMemo(() => {
    const roleClean = String(user?.role || '')
      .trim()
      .toLowerCase();

    return (
      roleClean === 'prof_principal' ||
      roleClean === 'professeur_principal' ||
      !!user?.isProfPrincipal ||
      !!user?.professeurPrincipal
    );
  }, [user]);

  const classeTitulaire = useMemo(() => {
    return String(
      user?.classePrincipaleNom ||
        user?.classeNom ||
        user?.classeId ||
        user?.classe ||
        ''
    )
      .trim()
      .toUpperCase();
  }, [user]);

  // ============================================================
  // SYNCHRONISATION FIRESTORE
  // ============================================================

  useEffect(() => {
    if (!idProf || !currentSchool) {
      setClassesEdt([]);
      setTotalPointages(0);
      setPointageEnCours(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    // ----------------------------------------------------------
    // A. POINTAGES DU PROFESSEUR
    // ----------------------------------------------------------

    const qPointages = query(
      collection(db, 'registre_pointages'),
      where('schoolId', '==', currentSchool),
      where('professeurId', '==', idProf)
    );

    const unsubPointages = onSnapshot(
      qPointages,
      (snapshot) => {
        let totalHeures = 0;
        let pointageOuvert = null;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          totalHeures += Number(
            data?.heuresEffectuees || 0
          );

          // Un pointage est considéré comme ouvert tant que le départ
          // n'est pas enregistré. Firestore met alors à jour ce document
          // en temps réel après l'émargement d'arrivée.
          const statut = String(
            data?.statutValidation || data?.statut || ''
          )
            .trim()
            .toLowerCase();

          const heureDepart =
            data?.heureDepart ||
            data?.departAt ||
            data?.dateHeureDepart ||
            null;

          const estOuvert =
            statut === 'en_cours' ||
            statut === 'present' ||
            statut === 'arrivee' ||
            !heureDepart;

          if (estOuvert) {
            pointageOuvert = {
              id: docSnap.id,
              ...data,
            };
          }
        });

        setPointageEnCours(pointageOuvert);

        setTotalPointages(
          Number(totalHeures.toFixed(2))
        );
      },
      (error) => {
        console.error(
          'Erreur registre_pointages :',
          error
        );

        setTotalPointages(0);
      }
    );

    

    // ----------------------------------------------------------
    // B. EMPLOI DU TEMPS DU PROFESSEUR
    // ----------------------------------------------------------

    const qEdt = query(
      collection(db, 'emplois_du_temps'),
      where('schoolId', '==', currentSchool)
    );

    const unsubEdt = onSnapshot(
      qEdt,
      (snapshot) => {
        const mapClassesUniques = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          if (!Array.isArray(data?.creneaux)) {
            return;
          }

          data.creneaux.forEach((creneau) => {
            const professeurCreneau = String(
              creneau?.professeurId ||
                creneau?.profId ||
                creneau?.enseignantId ||
                ''
            )
              .trim()
              .toLowerCase();

            if (
              professeurCreneau !==
              idProf.toLowerCase()
            ) {
              return;
            }

            const targetClassId =
              creneau?.classeId ||
              data?.classeId ||
              data?.idClasse;

            const targetClassName =
              creneau?.nomClasse ||
              creneau?.classeNom ||
              data?.classeNom ||
              data?.nomClasse ||
              data?.classe ||
              'Division';

            if (!targetClassId) {
              return;
            }

            const matiere =
              creneau?.matiere ||
              creneau?.discipline ||
              data?.matiere ||
              discipline;

            mapClassesUniques[targetClassId] = {
              id: targetClassId,
              nom: targetClassName,
              matiere,
            };
          });
        });

        const listFinal = Object.values(
          mapClassesUniques
        ).sort((a, b) =>
          String(a.nom).localeCompare(
            String(b.nom),
            'fr',
            {
              sensitivity: 'base',
            }
          )
        );

        setClassesEdt(listFinal);

        /*
         * Si la classe actuellement sélectionnée existe encore,
         * on la conserve.
         *
         * Sinon, on prend automatiquement la première.
         */
        setClasseSelectionnee((ancienneClasse) => {
          if (
            ancienneClasse &&
            listFinal.some(
              (classe) =>
                String(classe.id) ===
                String(ancienneClasse)
            )
          ) {
            return ancienneClasse;
          }

          return listFinal[0]?.id || '';
        });

        setLoading(false);
      },
      (error) => {
        console.error(
          'Erreur emplois_du_temps :',
          error
        );

        setClassesEdt([]);
        setClasseSelectionnee('');
        setLoading(false);
      }
    );

    return () => {
      unsubPointages();
      unsubEdt();
    };
  }, [
    idProf,
    currentSchool,
    discipline,
  ]);

  // ============================================================
  // RAPPEL D'ÉMARGEMENT
  // ============================================================

  const pointageClasseNom = useMemo(() => {
    if (!pointageEnCours) return '';

    const nomDepuisPointage =
      pointageEnCours?.classeNom ||
      pointageEnCours?.nomClasse ||
      pointageEnCours?.classe ||
      '';

    if (nomDepuisPointage) return String(nomDepuisPointage);

    const idClassePointage =
      pointageEnCours?.classeId ||
      pointageEnCours?.idClasse ||
      '';

    if (idClassePointage) {
      const classe = classesEdt.find(
        (item) => String(item.id) === String(idClassePointage)
      );

      if (classe?.nom) return String(classe.nom);
    }

    return '';
  }, [pointageEnCours, classesEdt]);

  const heureArriveePointage = useMemo(() => {
    if (!pointageEnCours) return '';

    const valeur =
      pointageEnCours?.heureArrivee ||
      pointageEnCours?.arriveeAt ||
      pointageEnCours?.dateHeureArrivee ||
      pointageEnCours?.createdAt ||
      '';

    if (!valeur) return '';

    try {
      if (typeof valeur?.toDate === 'function') {
        return valeur.toDate().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      const date = new Date(valeur);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch (error) {
      console.warn('Impossible de formater heure arrivée :', error);
    }

    return String(valeur);
  }, [pointageEnCours]);

  // ============================================================
  // CLASSE ACTIVE
  // ============================================================

  const classeActive = useMemo(() => {
    return (
      classesEdt.find(
        (classe) =>
          String(classe.id) ===
          String(classeSelectionnee)
      ) || null
    );
  }, [
    classesEdt,
    classeSelectionnee,
  ]);

  // ============================================================
  // CONSTRUCTION DES URLS
  // ============================================================

  const creerLienModule = (route) => {
    if (!classeSelectionnee) {
      return route;
    }

    return `${route}?classeId=${encodeURIComponent(
      classeSelectionnee
    )}`;
  };

  // ============================================================
  // VÉRIFICATION AVANT ACCÈS
  // ============================================================

  const verifierClasseAvantNavigation = (
    event
  ) => {
    if (!classeSelectionnee) {
      event.preventDefault();

      window.alert(
        '⚠️ Veuillez sélectionner une classe de votre emploi du temps avant de continuer.'
      );
    }
  };

  // ============================================================
  // DÉCONNEXION
  // ============================================================

  const gererDeconnexion = async () => {
    try {
      await logout();

      navigate('/login', {
        replace: true,
      });
    } catch (error) {
      console.error(
        'Erreur déconnexion :',
        error
      );
    }
  };

  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center font-sans">
        <div className="h-8 w-8 animate-spin rounded-full -4 -purple-600 -t-transparent mb-3"></div>

        <p className="text-gray-500 text-xs font-bold uppercase animate-pulse">
          Synchronisation en temps réel...
        </p>
      </div>
    );
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="bg-white min-h-screen  font-sans  sm:p-6 lg:p-8 animate-fadeIn text-gray-700">

      {/* ======================================================
          BARRE SUPÉRIEURE
      ====================================================== */}

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center  pb-4 mb-6 gap-4">
       <Header/>
        <div className="text-left">

          <h2 className="buro text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full w-fit">
            Bureau Pédagogique Enseignant<br/><span className='mr'>Bienvenue, Professeur {nomProf}</span>
          </h2>
          
          <p className="disc-group  text-xs text-gray-400 font-medium mt-0.5">
            <span className="disc font-bold text-gray-600 uppercase">
            Discipline : {' '}
              {discipline}
            </span><br/>

            {' '}

            <span className="eta font-bold text-purple-700 py-3 uppercase">
               Établissement : {' '}
              {schoolName ||
                currentSchool.replace(
                  /_/g,
                  ' '
                )}
            </span>

          </p>
           <button
          type="button"
          onClick={gererDeconnexion}
          className="discbtn bg-gray-100 hover:bg-gray-200  -gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider px-2 py-2.5  transition cursor-pointer"
        >
          Déconnexion
        </button>
        </div>

        {/* ==================================================
            RAPPEL AUTOMATIQUE APRÈS L'ÉMARGEMENT D'ARRIVÉE
        ================================================== */}
        {pointageEnCours && (
          <div className="max-w-6xl mx-auto mt-8 mb-4">
            
               

                <Link
                  to={creerLienModule('/professeur/pointage')}
                  className="bouton-emargement-depart-dash mt-5 flex w-full items-center justify-center  -4 -yellow-500 bg-yellow-400 px-6 py-4 text-lg font-black text-black no-underline shadow-lg hover:bg-yellow-300 focus:outline-none focus:ring-4 focus:ring-yellow-300"
                >
                  ÉMARGER MON DÉPART
                </Link>
              </div>
        )}

      </div>

      {/* ======================================================
          SÉLECTION DE LA CLASSE
      ====================================================== */}

      <div className="selec-class max-w-6xl mx-auto bg-slate-900  p-5 rounded-2xl shadow-md mb-8 flex flex-col sm:flex-row items-center justify-between gap-4  -slate-800 text-left">

        <div>

          <h3 className="actue text-sm font-black  uppercase tracking-tight">
            Classe d'Intervention Actuelle
          </h3>

          <p className="actue-text text-xs text-slate-400 mt-0.5">
            Sélectionnez la division de votre emploi du temps avec laquelle vous travaillez actuellement.
          </p>

          {classeActive && (
            <p className="text-[10px]   text-orange-400 font-black uppercase mt-2">
              Classe active : {classeActive.nom}
            </p>
          )}

        </div>

        <select
          value={classeSelectionnee}
          onChange={(event) =>
            setClasseSelectionnee(
              event.target.value
            )
          }
          className="bg-slate-800   border border-slate-700 rounded-xl text-orange-400 font-black text-xs  px-1 py-1 outline-none cursor-pointer w-full sm:w-80"
        >

          {classesEdt.length === 0 ? (
            <option value="">
              Aucune classe dans votre emploi du temps
            </option>
          ) : (
            classesEdt.map((classe) => (
              <option
                key={classe.id}
                value={classe.id}
              >
                🏛️ CLASSE :{' '}
                {String(
                  classe.nom
                ).toUpperCase()}{' '}
                (
                {String(
                  classe.matiere ||
                    discipline
                ).toUpperCase()}
                )
              </option>
            ))
          )}

        </select>

      </div>

      {/* ======================================================
          COMPTEURS
      ====================================================== */}

      <div className="compteur max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 text-left">

        <div className=" p-5 rounded-2xl  -gray-200 ">

          <p className="text-[10px] font-black uppercase text-gray-400">
            Vos Heures de Vacation Effectuées
          </p>

          <p className="text-danger font-black text-gray-900 mt-1">
            {totalPointages} 
          </p>
           <span className="text-xs font-bold text-gray-400 ml-2">
              Heures Validées Cloud
            </span>

        </div>

        <div className=" p-5 rounded-2xl  -gray-200 ">

          <p className="text-[10px] font-black uppercase text-gray-400">
            Classes Affectées sur votre Emploi du Temps
          </p>

          <p className="text-danger font-black text-purple-700 mt-1">
            {classesEdt.length}
          </p>
           <span className="text-xs font-bold text-gray-400 ml-2">
              Structures Réelles NoSQL
            </span>
        </div>

      </div>

      {/* ======================================================
          TITRE
      ====================================================== */}

      <div className="actipeda max-w-6xl mx-auto text-left mb-6">

        <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">
          Activités Pédagogiques
        </h2>

        <p className="text-xs text-gray-400 mt-0.5 font-medium">
          Sélectionnez une classe active puis ouvrez le registre souhaité.
        </p>

      </div>

      {/* ======================================================
          GRILLE DES ACTIVITÉS
      ====================================================== */}

      <div className=" max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left mb-8">

        {/* ==================================================
            1. REGISTRE D'APPEL
        ================================================== */}
     <div className='link-group'>
        <div className="p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>
            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4 ">
             1.  Registre d'Appel
            </h3>

            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Marquer les élèves présents, absents ou en retard heure par heure avec alerte parentale instantanée.
            </p>

          </div>

          <Link
            to={creerLienModule(
              '/professeur/appel'
            )}
            onClick={
              verifierClasseAvantNavigation
            }
            className={`bgwhbtn border border-slate-700 rounded-xl py-2 p-4 w-full text-center  bg-gray-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline  ${
              !classeSelectionnee
                ? 'opacity-40'
                : ''
            }`}
          >
            Ouvrir le Registre
          </Link>

        </div>

        {/* ==================================================
            2. CAHIER DE TEXTES
        ================================================== */}

        <div className="bg-white p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>
            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4">
             2.  Cahier de Textes Numérique
            </h3>

            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Consigner les résumés de séances de cours et associer les exercices ou devoirs de maison.
            </p>

          </div>

          <Link
            to={creerLienModule(
              '/professeur/cahier-textes'
            )}
            onClick={
              verifierClasseAvantNavigation
            }
            className={`bgwhbtn-2 border border-slate-700 rounded-xl py-2 p-4 w-full text-center bg-gray-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline  ${
              !classeSelectionnee
                ? 'opacity-40'
                : ''
            }`}
          >
           Émarger Cahier Textes
          </Link>

        </div>
        {/* ==================================================
            3. NOTES
        ================================================== */}

        <div className="bg-white p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>
            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4">
              3. Saisir Notes Évaluations
            </h3>

            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Remplir la grille des notes pour les interrogations, devoirs surveillés et devoirs communs du trimestre.
            </p>

          </div>

          <Link
            to={creerLienModule(
              '/professeur/notes'
            )}
            onClick={
              verifierClasseAvantNavigation
            }
            className={`bgwhbtn-3 border border-slate-700 rounded-xl py-2 p-4 w-full text-center bg-gray-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline  ${
              !classeSelectionnee
                ? 'opacity-40'
                : ''
            }`}
          >
          Saisir Notes
          </Link>

        </div>

        {/* ==================================================
            4. ESPACE PROF PRINCIPAL
        ================================================== */}

        {estProfPrincipal && (
          <div className="bg-amber-50/50 p-6 rounded-2xl  -amber-200 flex flex-col justify-between  animate-fadeIn">

            <div>
           <h3 className="bgwh font-black text-amber-900 uppercase tracking-tight mt-4">
               4.  {classeTitulaire
                  ? ` (${classeTitulaire})`
                  : ''}
              </h3>

              <p className="text-xs text-amber-700 mt-1 font-medium leading-relaxed">
                Accéder à l'espace du Professeur Principal et préparer le conseil de classe.
              </p>

            </div>

            <Link
              to="/professeur/principal"
              className="bgwhbtn-4 border border-slate-700 rounded-xl py-2 p-4 w-full text-center bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline "
            >
            Espace Prof Principal
            </Link>

          </div>
        )}

        {/* ==================================================
            5. POINTAGE RH
        ================================================== */}

        <div className="bg-white p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>
            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4">
             5. Émargement Présence RH
            </h3>

            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
              Enregistrer votre feuille de vacation à l'arrivée pour certifier vos heures de cours.
            </p>

          </div>

          <Link
            to={creerLienModule(
              '/professeur/pointage'
            )}
            onClick={
              verifierClasseAvantNavigation
            }
            className={`bgwhbtn-5 border border-slate-700 rounded-xl py-2 p-4 w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700  -gray-200 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline  ${
              !classeSelectionnee
                ? 'opacity-40'
                : ''
            }`}
          >
          Pointer Ma Présence
          </Link>

        </div>
       </div>
      
        {/* ==================================================
            6. MESSAGERIE
        ================================================== */}
        <div className='link-groupe'>
        <div className="correct-3 p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>
            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4">
             6. Centre de Messagerie
            </h3>

            <p className="text-group text-gray-400 mt-1 font-medium leading-relaxed">
              Consulter les circulaires transmises par la direction ou envoyer une alerte aux parents.
            </p>

          </div>

          <Link
            to="/components/communication"
            className="bgwhbtn-6 border border-slate-700 rounded-xl py-2 p-4 w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700  -gray-200 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline "
          >
          Centre de Messagerie
          </Link>
        </div>

         {/* ==================================================
            7. Boite de receptionb
        ================================================== */}

        <div className="correct-2 p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>
            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4">
             7. Mes receptions de message
            </h3>

            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
            Boite de recetion de mes messages
            </p>

          </div>

            <Link
          to="/professeur/ma-boite-reception"
          className="bgwhbtn-7 border border-slate-700 rounded-xl py-2 p-4 w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700  -gray-200 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline "
          >
           Mes messages reçus
          </Link>

        </div>

          {/* ==================================================
            8. Emploie du temp
        ================================================== */}

        <div className="correct-1 p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>

            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4">
             8. Mon Emploi du Temps Individuel
            </h3>

            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
             Ma Grille d'Intervention Hebdomadaire
            </p>

          </div>

            <Link
          to="/professeur/mon-emploie-du-Temps"
          className="bgwhbtn-8 border border-slate-700 rounded-xl py-2 p-4 w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700  -gray-200 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline "
          >
           Mon Emploi du Temps 
          </Link>

        </div>

       {/* ==================================================
            9. Boite de receptionb
        ================================================== */}

        <div className="correct  p-6 rounded-2xl  -gray-200  flex flex-col justify-between">

          <div>
            <h3 className="bgwh font-black text-gray-800 uppercase tracking-tight mt-4">
             9. Historique de Progression de la Classe
            </h3>

            <p className="text-xs text-gray-400 mt-1 font-medium leading-relaxed">
             Mes Classes & Divisions Pédagogiques Autorisées
            </p>

          </div>

            <Link
          to="/professeur/mes-classes"
          className="bgwhbtn-9 border border-slate-700 rounded-xl py-2 p-2 w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700  -gray-200 font-black text-xs uppercase tracking-wider py-2.5  transition mt-5 block no-underline "
          >
           Mes classe d'intervention
          </Link>

        </div>
       
      </div>
       </div>
    </div>
  );
};

export default DashboardProf;