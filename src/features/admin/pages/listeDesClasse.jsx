// src/features/admin/pages/listeDesClasse.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../../services/api';
import {
  collection,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../pages/Header';

const normalizeGenre = (genre) => {
  const value = String(genre ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['f', 'feminin', 'femme', 'female'].includes(value)) {
    return 'feminin';
  }

  if (['m', 'masculin', 'homme', 'male'].includes(value)) {
    return 'masculin';
  }

  return '';
};

const ListeDesClasse = () => {
  const auth = useAuth() || {};

  const {
    schoolId: authSchoolId,
    schoolName,
    role: authRole,
    assigned_promotion: authAssignedPromotion,
    assignedPromotion: authAssignedPromotionCamel
  } = auth;

  const [classes, setClasses] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rechercheClasse, setRechercheClasse] = useState('');

  const currentSchool = useMemo(() => {
    return String(
      authSchoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      ''
    ).trim().toLowerCase();
  }, [authSchoolId]);

  const currentRole = useMemo(() => {
    return String(
      authRole ||
      sessionStorage.getItem('sgs_role') ||
      ''
    ).trim().toLowerCase();
  }, [authRole]);

  const currentPromotion = useMemo(() => {
    return String(
      authAssignedPromotion ||
      authAssignedPromotionCamel ||
      sessionStorage.getItem('sgs_assigned_promotion') ||
      sessionStorage.getItem('assigned_promotion') ||
      ''
    ).trim().toLowerCase();
  }, [
    authAssignedPromotion,
    authAssignedPromotionCamel
  ]);

  useEffect(() => {
    if (!currentSchool) {
      setClasses([]);
      setEleves([]);
      setLoading(false);
      return undefined;
    }

    const classesRef = collection(db, 'classes');
    const usersRef = collection(db, 'users');

    const constraints = [
      where('schoolId', '==', currentSchool)
    ];

    if (
      currentRole === 'educateur' &&
      currentPromotion
    ) {
      constraints.push(
        where('promotion', '==', currentPromotion)
      );
    }

    const classesQuery = query(
      classesRef,
      ...constraints
    );

    const usersQuery = query(
      usersRef,
      where('schoolId', '==', currentSchool),
      where('role', '==', 'eleve')
    );

    setLoading(true);

    let classesReady = false;
    let usersReady = false;

    const updateLoading = () => {
      if (classesReady && usersReady) {
        setLoading(false);
      }
    };

    const unsubscribeClasses = onSnapshot(
      classesQuery,
      (snapshot) => {
        const classesList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            ...data
          };
        });

        classesList.sort((a, b) => {
          const nomA = String(
            a.nom ||
            a.classeNom ||
            a.name ||
            ''
          );

          const nomB = String(
            b.nom ||
            b.classeNom ||
            b.name ||
            ''
          );

          return nomA.localeCompare(
            nomB,
            undefined,
            {
              numeric: true,
              sensitivity: 'base'
            }
          );
        });

        setClasses(classesList);
        classesReady = true;
        updateLoading();
      },
      (error) => {
        console.error(
          'Erreur de synchronisation des classes :',
          error
        );

        setClasses([]);
        classesReady = true;
        updateLoading();
      }
    );

    const unsubscribeUsers = onSnapshot(
      usersQuery,
      (snapshot) => {
        const usersList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        setEleves(usersList);
        usersReady = true;
        updateLoading();
      },
      (error) => {
        console.error(
          'Erreur de synchronisation des élèves :',
          error
        );

        setEleves([]);
        usersReady = true;
        updateLoading();
      }
    );

    return () => {
      unsubscribeClasses();
      unsubscribeUsers();
    };
  }, [
    currentSchool,
    currentRole,
    currentPromotion
  ]);

  const classesAvecStatistiques = useMemo(() => {
    return classes.map((classe) => {
      const classeId = classe.id;

      const elevesClasse = eleves.filter((eleve) => {
        const eleveClasseId = String(
          eleve.classeId ??
          eleve.classId ??
          ''
        ).trim();

        return eleveClasseId === String(classeId).trim();
      });

      const totalFemmes = elevesClasse.filter(
        (eleve) =>
          normalizeGenre(
            eleve.genre ?? eleve.sexe
          ) === 'feminin'
      ).length;

      const totalHommes = elevesClasse.filter(
        (eleve) =>
          normalizeGenre(
            eleve.genre ?? eleve.sexe
          ) === 'masculin'
      ).length;

      const totalEleves = elevesClasse.length;

      return {
        ...classe,
        totalEleves,
        totalFemmes,
        totalHommes
      };
    });
  }, [classes, eleves]);

  const classesFiltrees = useMemo(() => {
    const recherche = rechercheClasse
      .toLowerCase()
      .trim();

    if (!recherche) {
      return [];
    }

    return classesAvecStatistiques.filter((classe) => {
      const texte = [
        classe.nom,
        classe.name,
        classe.classeNom,
        classe.idBrute,
        classe.promotion,
        classe.division
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return texte.includes(recherche);
    });
  }, [
    classesAvecStatistiques,
    rechercheClasse
  ]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 font-sans bg-white rounded-xl">
        <div className="h-6 w-6 animate-spin rounded-full-2-orange-500-t-transparent mr-2" />

        <p className="text-xs text-gray-400 font-bold  tracking-wider">
          Chargement des classes...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white   animate-fadeIn">
       <Header />
      <div className="border-b pb-4 mb-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="Registredesclasses text-sm font-black text-gray-700  tracking-wider">
            Registre de toutes les {classes.length} classes de votre établissement scolaire
          </h3>
          <p className="etablissement  mt-0.5  tracking-wide">
            Établissement : {' '}
            <span className="text-slate-700">
              {schoolName || currentSchool}
            </span>
          </p>

          {currentRole === 'educateur' && currentPromotion && (
            <p className="text-[11px] text-purple-600 font-black mt-1  tracking-wide">
              Promotion : {currentPromotion}
            </p>
          )}
        </div>

        <div className="synchronisation flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">

          <span className="  text-[10px] font-mono bg-emerald-50 text-emerald-600-emerald-200 px-2.5 py-1 rounded font-bold  tracking-wide">
            <span className='text-success'> ● </span>Synchronisation temps réel
          </span>

          <Link
            to="/admin/dashboard"
            className="inline-flex items-center text-xs font-black bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition no-underline shadow-2xs"
          >
            Retour au tableau
          </Link>
        </div>
      </div>

      <div  className="nomfamilleA form-floating mb-3">
        <label htmlFor="rechercherapideInput" className="text-xs  font-bold text-center  tracking-wider">
          Filtre de recherche rapide d'une classe :
        </label>

        <input
          type="text"
          id="rechercherapideInput"
          placeholder="Rechercher une classe..."
          value={rechercheClasse}
          onChange={(e) => setRechercheClasse(e.target.value)}
          className="form-control w-full sm:max-w-md bg-info p-2.5 rounded-xl border outline-none text-black font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 shadow-2xs"
        />
      </div>

      {!rechercheClasse.trim() ? (

        <div className="etablissement text-center text-success text-gray-400 font-bold  tracking-wider-dashed rounded-xl bg-gray-50/50">
          Effectuez une recherche rapide pour afficher les classes.
        </div>

      ) : classesFiltrees.length === 0 ? (

        <div className=" text-center text-xs text-gray-400 font-bold  tracking-wider-dashed rounded-xl bg-gray-50/50">
          Aucune classe disponible.
        </div>

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {classesFiltrees.map((classe) => {

            const currentCount = Number(
              classe.totalEleves ??
              classe.elevesCount ??
              0
            );

            const maxCapacity = Number(
              classe.maxEleves || 50
            );

            const remplissagePercent =
              maxCapacity > 0
                ? (currentCount / maxCapacity) * 100
                : 0;

            const nomClasse =
              classe.nom ||
              classe.classeNom ||
              classe.name ||
              classe.id;

            const delegueName =
              classe.delegueName ||
              classe.delegueNom ||
              classe.delegue?.name ||
              classe.delegue?.nom ||
              classe.delegue?.displayName ||
              '';

            const delegueId =
              classe.delegueId ||
              classe.delegue?.id ||
              '';

            const educateurName =
              classe.educateurName ||
              classe.educateur?.name ||
              classe.educateur?.nom ||
              '';

            const profPrincipalName =
              classe.profPrincipalName ||
              classe.profPrincipal?.name ||
              classe.profPrincipal?.nom ||
              '';

            return (
              <div
                key={classe.id}
                className="  rounded-2xl-gray-100 bg-gray-50/40 hover:bg-white hover:shadow-lg transition duration-200 flex flex-col justify-between"
              >

                <div className="toutClasse flex flex-col justify-between">

                  <div className="flex justify-between items-start mb-3">

                    <div>
                      <h4 className="nomClasse font-black text-gray-900 text-base tracking-tight ">
                        Classe :  {nomClasse}
                      </h4>

                      {classe.idBrute && (
                        <p className="code text-[9px] font-mono font-bold text-gray-400 mt-0.5">
                          Code : <br/>{classe.idBrute}
                        </p>
                      )}
                    </div>

                    {classe.promotion && (
                      <span className="codepromo text-purple-700-purple-100  tracking-wider">
                        Promotion : {String(classe.promotion).replace(
                          /_/g,
                          ' '
                        )}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 mb-5 font-bold">

                    <p className="codeeducateur flex items-center gap-1.5">
                      <span className=" text-gray-400  text-[10px]">
                        Éducateur <br/>
                      </span>

                      <span className="text-slate-800  font-black truncate max-w-[180px]">
                        {educateurName || 'Non assigné'}
                      </span>
                    </p>

                    <p className="codeProf flex items-center gap-1.5">
                      <span className="text-gray-400  text-[10px]">
                        Prof. Principal <br/>
                      </span>

                      <span className="text-purple-700  font-black truncate max-w-[160px]">
                        {profPrincipalName || 'Non assigné'}
                      </span>
                    </p>

                    <p className="codeDélégué flex items-center gap-1.5-t pt-1.5 mt-1.5 text-[11px]">
                      <span className="text-gray-400  text-[10px]">
                        Délégué <br/>
                      </span>

                      <span className="text-orange-600 font-black  truncate">
                        {delegueName || 'Non désigné'}
                      </span>
                    </p>

                    {delegueId && (
                      <p className="codeDélég text-[9px] font-mono text-gray-400 ml-5">
                        {delegueId}
                      </p>
                    )}

                  </div>

                  <div className="codeTotal grid grid-cols-3 gap-2 mb-5">

                    <div className="rounded-xl-gray-100 bg-white px-2 py-3 text-center">
                      <div className="text-[9px] font-black  tracking-wider text-gray-400">
                        Total
                      </div>

                      <div className="text-lg font-black text-slate-800">
                        {classe.totalEleves}
                      </div>
                    </div>

                    <div className="rounded-xl-pink-100 bg-pink-50 px-2 py-3 text-center">
                      <div className="text-[9px] font-black  tracking-wider text-pink-400">
                        Féminins
                      </div>

                      <div className="text-lg font-black text-pink-600">
                        {classe.totalFemmes}
                      </div>
                    </div>

                    <div className="rounded-xl-blue-100 bg-blue-50 px-2 py-3 text-center">
                      <div className="text-[9px] font-black  tracking-wider text-blue-400">
                        Hommes
                      </div>

                      <div className="text-lg font-black text-blue-600">
                        {classe.totalHommes}
                      </div>
                    </div>

                  </div>

                </div>

                <div className="space-y-1.5">

                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        currentCount >= maxCapacity
                          ? 'bg-red-600'
                          : currentCount >= maxCapacity * 0.84
                            ? 'bg-yellow-500'
                            : 'bg-purple-600'
                      }`}
                      style={{
                        width: `${Math.min(
                          remplissagePercent,
                          100
                        )}%`
                      }}
                    />
                  </div>

                  <div className="codeeffect  flex justify-between items-center text-[11px] font-black text-gray-400">

                    <span>
                      Effectif <br/>{' '}
                      <span className="text-gray-900 font-black">
                        {currentCount}
                      </span>{' '}
                      / {maxCapacity}
                    </span>

                    {currentCount >= maxCapacity && (
                      <span className="text-red-600 text-[9px] font-black  bg-red-50-red-200 px-1.5 py-0.5 rounded animate-pulse">
                        Saturée
                      </span>
                    )}

                  </div>
                </div>

              </div>
            );
          })}
        <hr  />
        </div>
      )}

    </div>
  );
};

export default ListeDesClasse;