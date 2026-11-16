// src/features/educateur/pages/ListePromotion.jsx
import { useSearchParams, Link } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../pages/Header';

const ListePromotion = () => {
  const { user, schoolId } = useAuth();

  // ============================================================
  // IDENTIFICATION DE L'ETABLISSEMENT
  // ============================================================

  const currentSchool = String(
    schoolId ||
      user?.schoolId ||
      sessionStorage.getItem('sgs_school_id') ||
      'lycee_saint_bernard'
  )
    .trim()
    .toLowerCase();

  // ============================================================
  // ROLE
  // ============================================================

  const roleUtilisateur = String(user?.role || '')
    .trim()
    .toLowerCase();

  const estAdmin =
    roleUtilisateur === 'admin' ||
    roleUtilisateur === 'super_admin' ||
    roleUtilisateur === 'superadmin';

  // ============================================================
  // PROMOTION DE L'EDUCATEUR
  // ============================================================

  const promotionEducateur = String(
    user?.assigned_promotion ||
      user?.assignedPromotion ||
      user?.promotion ||
      user?.niveau ||
      ''
  )
    .trim()
    .toLowerCase();

  // ============================================================
  // ETATS
  // ============================================================

  const [eleves, setEleves] = useState([]);
  const [dictionnaireClasses, setDictionnaireClasses] = useState({});
  const [loading, setLoading] = useState(true);

  const [trimestreFiltre, setTrimestreFiltre] = useState('1');

  const [promotionSelectionneeAdmin, setPromotionSelectionneeAdmin] =
    useState(promotionEducateur || '6eme');

  const [termeRecherche, setTermeRecherche] = useState('');

  const [classeFiltre, setClasseFiltre] = useState('all');

  const [eleveBulletin, setEleveBulletin] = useState(null);

  const [bulletinOuvert, setBulletinOuvert] = useState(false);

  // ============================================================
  // OUTILS DE NORMALISATION
  // ============================================================

  const normaliser = (valeur) => {
    return String(valeur || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ème/g, 'eme')
      .replace(/éme/g, 'eme')
      .replace(/\s+/g, '');
  };

  const obtenirPromotion = (eleve) => {
    return normaliser(
      eleve?.promotion ||
        eleve?.assigned_promotion ||
        eleve?.assignedPromotion ||
        eleve?.niveau ||
        ''
    );
  };

  const obtenirClasseId = (eleve) => {
    return normaliser(
      eleve?.classeId ||
        eleve?.classeID ||
        eleve?.classId ||
        ''
    );
  };

  const obtenirClasseNom = (eleve) => {
    return normaliser(
      eleve?.classeNom ||
        eleve?.classe ||
        eleve?.nomClasse ||
        eleve?.className ||
        ''
    );
  };

  // ============================================================
  // PROMOTION ACTIVE
  // ============================================================

  const promotionActive = estAdmin
    ? normaliser(promotionSelectionneeAdmin)
    : normaliser(promotionEducateur);

  // ============================================================
  // 1. SYNCHRONISATION DES CLASSES
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      setDictionnaireClasses({});
      return undefined;
    }

    const qClasses = query(
      collection(db, 'classes'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribeClasses = onSnapshot(
      qClasses,
      (snapshot) => {
        const dictionnaire = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};

          const idDocument = normaliser(docSnap.id);

          const idBrute = normaliser(
            data.idBrute ||
              data.classeId ||
              data.id ||
              ''
          );

          const nom = String(
            data.nom ||
              data.name ||
              data.classeNom ||
              data.libelle ||
              data.label ||
              data.idBrute ||
              docSnap.id
          ).trim();

          const nomNormalise = normaliser(nom);

          // --------------------------------------------------------
          // PROMOTION DE LA CLASSE
          // --------------------------------------------------------

          const promotionClasse = normaliser(
            data.promotion ||
              data.niveau ||
              data.level ||
              data.section ||
              ''
          );

          // --------------------------------------------------------
          // POUR UN EDUCATEUR :
          // ON GARDE UNIQUEMENT SA PROMOTION
          // --------------------------------------------------------

          if (!estAdmin && promotionEducateur) {
            const promoRecherchee = normaliser(promotionEducateur);

            const classeCorrespond =
              promotionClasse === promoRecherchee ||
              idDocument.includes(promoRecherchee) ||
              idBrute.includes(promoRecherchee) ||
              nomNormalise.includes(promoRecherchee);

            if (!classeCorrespond) {
              return;
            }
          }

          // --------------------------------------------------------
          // DIFFERENTES FORMES D'IDENTIFIANT
          // --------------------------------------------------------

          if (idDocument) {
            dictionnaire[idDocument] = nom;
          }

          if (idBrute) {
            dictionnaire[idBrute] = nom;
          }

          if (nomNormalise) {
            dictionnaire[nomNormalise] = nom;
          }

          const prefixe = normaliser(`${currentSchool}_`);

          if (idDocument.startsWith(prefixe)) {
            const idSansPrefixe = idDocument.substring(prefixe.length);

            if (idSansPrefixe) {
              dictionnaire[idSansPrefixe] = nom;
            }
          }
        });

        setDictionnaireClasses(dictionnaire);
      },
      (error) => {
        console.error(
          'Erreur synchronisation classes :',
          error
        );

        setDictionnaireClasses({});
      }
    );

    return () => unsubscribeClasses();
  }, [
    currentSchool,
    estAdmin,
    promotionEducateur
  ]);

  // ============================================================
  // 2. SYNCHRONISATION DES ELEVES
  // ============================================================
  //
  // IMPORTANT :
  // On récupère tous les élèves de l'établissement.
  // La promotion est filtrée ensuite localement.
  //
  // Cela évite le problème :
  // promotion = "6eme"
  // VS
  // promotion = "6ème"
  // VS
  // promotion = "6EME"
  //
  // et évite de perdre des élèves à cause d'une différence
  // d'écriture dans Firestore.
  // ============================================================

  useEffect(() => {
    if (!currentSchool) {
      setEleves([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const qEleves = query(
      collection(db, 'users'),
      where('schoolId', '==', currentSchool),
      where('role', '==', 'eleve')
    );

    const unsubscribeEleves = onSnapshot(
      qEleves,
      (snapshot) => {
        const liste = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};

          liste.push({
            id: docSnap.id,
            ...data
          });
        });

        setEleves(liste);
        setLoading(false);
      },
      (error) => {
        console.error(
          'Erreur synchronisation élèves :',
          error
        );

        setEleves([]);
        setLoading(false);
      }
    );

    return () => unsubscribeEleves();
  }, [currentSchool]);

  // ============================================================
  // 3. PROMOTIONS DISPONIBLES POUR ADMIN
  // ============================================================

  const listeToutesPromotionsAdmin = useMemo(() => {
    if (!estAdmin) {
      return [];
    }

    const promotions = new Set();

    eleves.forEach((eleve) => {
      const promotion = obtenirPromotion(eleve);

      if (promotion) {
        promotions.add(promotion);
      }
    });

    const resultat = Array.from(promotions).sort();

    return resultat.length > 0
      ? resultat
      : ['6eme'];
  }, [eleves, estAdmin]);

  // ============================================================
  // 4. ELEVES AFFICHES
  // ============================================================

  const elevesAffichesTransformes = useMemo(() => {
    const recherche = normaliser(termeRecherche);

    const classeRecherchee = normaliser(classeFiltre);

    return eleves
      .filter((eleve) => {
        // --------------------------------------------------------
        // FILTRE PROMOTION
        // --------------------------------------------------------

        const promotionEleve = obtenirPromotion(eleve);

        if (promotionActive) {
          const promotionCompatible =
            promotionEleve === promotionActive ||
            promotionEleve.includes(promotionActive) ||
            promotionActive.includes(promotionEleve);

          if (!promotionCompatible) {
            return false;
          }
        }

        // --------------------------------------------------------
        // RECHERCHE
        // --------------------------------------------------------

        const nomComplet = normaliser(
          `${eleve?.nom || ''} ${
            eleve?.prenoms ||
            eleve?.prenom ||
            ''
          } ${
            eleve?.matricule ||
            ''
          }`
        );

        const matchRecherche =
          !recherche ||
          nomComplet.includes(recherche);

        if (!matchRecherche) {
          return false;
        }

        // --------------------------------------------------------
        // FILTRE CLASSE
        // --------------------------------------------------------

        if (
          classeRecherchee &&
          classeRecherchee !== 'all'
        ) {
          const classeId = obtenirClasseId(eleve);
          const classeNom = obtenirClasseNom(eleve);

          const matchClasse =
            classeId === classeRecherchee ||
            classeNom === classeRecherchee ||
            classeId.includes(classeRecherchee) ||
            classeRecherchee.includes(classeId) ||
            classeNom.includes(classeRecherchee) ||
            classeRecherchee.includes(classeNom);

          if (!matchClasse) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) =>
        String(a?.nom || '').localeCompare(
          String(b?.nom || ''),
          'fr',
          {
            sensitivity: 'base'
          }
        )
      );
  }, [
    eleves,
    promotionActive,
    termeRecherche,
    classeFiltre
  ]);

  // ============================================================
  // 5. EXTRACTION DES MOYENNES DE MATIERE
  // ============================================================
  //
  // SOURCE PRINCIPALE :
  //
  // users/{eleveId}
  //
  // moyennes_matiere
  //   notes_trimestre_1
  //      Anglais
  //         note
  //         coefficientMatiere
  //         moyennePonderee
  //         appreciation
  //         professeurName
  //         signet
  //
  // On NE RECALCULE PAS la moyenne de matière à partir
  // des devoirs lorsque la moyenne validée existe.
  //
  // Les notes intermédiaires servent uniquement d'affichage
  // complémentaire.
  // ============================================================

  const matieresCalculeesLivret = useMemo(() => {
    if (!eleveBulletin) {
      return [];
    }

    const cleTrimestre =
      `notes_trimestre_${trimestreFiltre}`;

    // ----------------------------------------------------------
    // SOURCE PRINCIPALE : MOYENNES VALIDEES
    // ----------------------------------------------------------

    const moyennesMatiere =
      eleveBulletin?.moyennes_matiere?.[
        cleTrimestre
      ] || {};

    // ----------------------------------------------------------
    // SOURCE SECONDAIRE : NOTES INTERMEDIAIRES
    // ----------------------------------------------------------

    const notesTrimestre =
      eleveBulletin?.notes?.[
        cleTrimestre
      ] || {};

    // ----------------------------------------------------------
    // ANCIEN FORMAT EVENTUEL
    // ----------------------------------------------------------

    const anciennesNotes =
      eleveBulletin?.[
        cleTrimestre
      ] || {};

    const nomsMatieres = new Set([
      ...Object.keys(
        moyennesMatiere || {}
      ),
      ...Object.keys(
        notesTrimestre || {}
      ),
      ...Object.keys(
        anciennesNotes || {}
      )
    ]);

    const listeDisciplines = [];

    nomsMatieres.forEach((nomMatiere) => {
      const objetMoyenne =
        moyennesMatiere?.[nomMatiere];

      const notesIntermediairesSource =
        notesTrimestre?.[nomMatiere];

      const anciennesNotesSource =
        anciennesNotes?.[nomMatiere];

      // --------------------------------------------------------
      // MOYENNE DE MATIERE
      // --------------------------------------------------------

      let moyenneMatiere = null;

      if (
        objetMoyenne &&
        typeof objetMoyenne === 'object' &&
        !Array.isArray(objetMoyenne)
      ) {
        if (
          objetMoyenne.note !== undefined &&
          objetMoyenne.note !== null &&
          objetMoyenne.note !== ''
        ) {
          const valeur = Number(
            objetMoyenne.note
          );

          if (Number.isFinite(valeur)) {
            moyenneMatiere = valeur;
          }
        }
      }

      // --------------------------------------------------------
      // FALLBACK ANCIEN FORMAT
      // --------------------------------------------------------

      if (
        moyenneMatiere === null &&
        typeof anciennesNotesSource === 'number'
      ) {
        moyenneMatiere =
          Number(anciennesNotesSource);
      }

      // --------------------------------------------------------
      // COEFFICIENT DE MATIERE
      // --------------------------------------------------------

      let coefficientMatiere = null;

      if (
        objetMoyenne &&
        typeof objetMoyenne === 'object'
      ) {
        const coefficient =
          objetMoyenne.coefficientMatiere ??
          objetMoyenne.coefficient ??
          objetMoyenne.coefMatiere ??
          objetMoyenne.coef;

        if (
          coefficient !== undefined &&
          coefficient !== null &&
          coefficient !== ''
        ) {
          const valeurCoefficient =
            Number(coefficient);

          if (
            Number.isFinite(
              valeurCoefficient
            )
          ) {
            coefficientMatiere =
              valeurCoefficient;
          }
        }
      }

      // --------------------------------------------------------
      // MOYENNE PONDEREE
      // --------------------------------------------------------

      let moyennePonderee = null;

      if (
        objetMoyenne &&
        typeof objetMoyenne === 'object'
      ) {
        const valeurPonderee =
          objetMoyenne.moyennePonderee ??
          objetMoyenne.moyenneMatierePonderee ??
          objetMoyenne.moyenneTrimestriellePonderee ??
          objetMoyenne.moyennePondere;

        if (
          valeurPonderee !== undefined &&
          valeurPonderee !== null &&
          valeurPonderee !== ''
        ) {
          const nombrePondere =
            Number(valeurPonderee);

          if (
            Number.isFinite(
              nombrePondere
            )
          ) {
            moyennePonderee =
              nombrePondere;
          }
        }
      }

      // --------------------------------------------------------
      // SI LA MOYENNE PONDEREE N'EST PAS STOCKEE MAIS QUE
      // MOYENNE + COEFFICIENT EXISTENT, ON PEUT L'AFFICHER
      // --------------------------------------------------------

      if (
        moyennePonderee === null &&
        moyenneMatiere !== null &&
        coefficientMatiere !== null
      ) {
        moyennePonderee =
          moyenneMatiere *
          coefficientMatiere;
      }

      // --------------------------------------------------------
      // APPRECIATION
      // --------------------------------------------------------

      let appreciation =
        objetMoyenne?.appreciation ||
        objetMoyenne?.appreciationProfesseur ||
        objetMoyenne?.appreciationTeacher ||
        '';

      // --------------------------------------------------------
      // PROFESSEUR
      // --------------------------------------------------------

      const professeurName =
        objetMoyenne?.professeurName ||
        objetMoyenne?.professeurNom ||
        objetMoyenne?.profName ||
        '';

      // --------------------------------------------------------
      // NOTES INTERMEDIAIRES
      // --------------------------------------------------------

      const notesIntermediaires = [];

      const sourceNotes =
        Array.isArray(
          notesIntermediairesSource
        )
          ? notesIntermediairesSource
          : Array.isArray(
              anciennesNotesSource
            )
          ? anciennesNotesSource
          : [];

      sourceNotes.forEach((noteObjet) => {
        if (
          noteObjet &&
          typeof noteObjet === 'object'
        ) {
          if (
            noteObjet.note !== undefined &&
            noteObjet.note !== null
          ) {
            notesIntermediaires.push(
              Number(noteObjet.note)
            );
          }
        } else if (
          noteObjet !== undefined &&
          noteObjet !== null &&
          noteObjet !== ''
        ) {
          const valeur =
            Number(noteObjet);

          if (Number.isFinite(valeur)) {
            notesIntermediaires.push(
              valeur
            );
          }
        }
      });

      // --------------------------------------------------------
      // ON N'AFFICHE PAS UNE MATIERE VIDE
      // --------------------------------------------------------

      const possedeUneMoyenne =
        moyenneMatiere !== null;

      const possedeDesNotes =
        notesIntermediaires.length > 0;

      const possedeUnObjetMoyenne =
        objetMoyenne &&
        typeof objetMoyenne === 'object';

      if (
        !possedeUneMoyenne &&
        !possedeDesNotes &&
        !possedeUnObjetMoyenne
      ) {
        return;
      }

      listeDisciplines.push({
        intitule: nomMatiere,

        notesIntermediaires:
          notesIntermediaires.length > 0
            ? notesIntermediaires
                .map((note) =>
                  Number(note).toFixed(2)
                )
                .join(' | ')
            : '—',

        moyenneMatiere,

        coefficientMatiere,

        moyennePonderee,

        appreciation:
          appreciation ||
          '—',

        professeurName:
          professeurName ||
          '—',

        signet:
          objetMoyenne?.signet ||
          objetMoyenne?.signatureProfesseur ||
          objetMoyenne?.signature ||
          ''
      });
    });

    return listeDisciplines.sort(
      (a, b) =>
        String(a.intitule || '').localeCompare(
          String(b.intitule || ''),
          'fr',
          {
            sensitivity: 'base'
          }
        )
    );
  }, [
    eleveBulletin,
    trimestreFiltre
  ]);

  // ============================================================
  // 6. CALCUL DES POINTS TOTAUX
  // ============================================================
  //
  // Les points correspondent aux moyennes pondérées.
  //
  // Exemple :
  //
  // Mathématiques : 14 × coef 3 = 42 points
  // Français       : 12 × coef 2 = 24 points
  //
  // Total = 66 points
  // ============================================================

  const totalPointsLivret = useMemo(() => {
    if (
      matieresCalculeesLivret.length === 0
    ) {
      return null;
    }

    let total = 0;

    let aAuMoinsUneValeur = false;

    matieresCalculeesLivret.forEach(
      (matiere) => {
        if (
          matiere.moyennePonderee !== null &&
          Number.isFinite(
            Number(
              matiere.moyennePonderee
            )
          )
        ) {
          total += Number(
            matiere.moyennePonderee
          );

          aAuMoinsUneValeur = true;

          return;
        }

        if (
          matiere.moyenneMatiere !== null &&
          matiere.coefficientMatiere !== null
        ) {
          total +=
            Number(
              matiere.moyenneMatiere
            ) *
            Number(
              matiere.coefficientMatiere
            );

          aAuMoinsUneValeur = true;
        }
      }
    );

    return aAuMoinsUneValeur
      ? Number(total.toFixed(2))
      : null;
  }, [
    matieresCalculeesLivret
  ]);

  // ============================================================
  // 7. MOYENNE GENERALE PONDEREE
  // ============================================================
  //
  // moyenne générale =
  // total des moyennes pondérées
  // ----------------------------
  // total des coefficients
  // ============================================================

  const moyenneGeneraleGlobaleLivret =
    useMemo(() => {
      if (
        matieresCalculeesLivret.length === 0
      ) {
        return null;
      }

      let totalPoints = 0;

      let totalCoefficients = 0;

      let nombreMoyennesSansCoefficient = 0;

      let totalMoyennesSansCoefficient = 0;

      matieresCalculeesLivret.forEach(
        (matiere) => {
          const moyenne =
            Number(
              matiere.moyenneMatiere
            );

          const coefficient =
            Number(
              matiere.coefficientMatiere
            );

          if (
            Number.isFinite(moyenne) &&
            Number.isFinite(coefficient) &&
            coefficient > 0
          ) {
            const points =
              Number.isFinite(
                Number(
                  matiere.moyennePonderee
                )
              )
                ? Number(
                    matiere.moyennePonderee
                  )
                : moyenne *
                  coefficient;

            totalPoints += points;

            totalCoefficients +=
              coefficient;
          } else if (
            Number.isFinite(moyenne)
          ) {
            totalMoyennesSansCoefficient +=
              moyenne;

            nombreMoyennesSansCoefficient++;
          }
        }
      );

      // --------------------------------------------------------
      // CAS NORMAL : COEFFICIENTS DISPONIBLES
      // --------------------------------------------------------

      if (totalCoefficients > 0) {
        return Number(
          (
            totalPoints /
            totalCoefficients
          ).toFixed(2)
        );
      }

      // --------------------------------------------------------
      // FALLBACK : AUCUN COEFFICIENT
      // --------------------------------------------------------

      if (
        nombreMoyennesSansCoefficient > 0
      ) {
        return Number(
          (
            totalMoyennesSansCoefficient /
            nombreMoyennesSansCoefficient
          ).toFixed(2)
        );
      }

      return null;
    }, [
      matieresCalculeesLivret
    ]);

  // ============================================================
  // 8. FERMETURE DE LA MODALE
  // ============================================================

  const fermerBulletin = () => {
    setBulletinOuvert(false);
    setEleveBulletin(null);
  };

  // ============================================================
  // CHARGEMENT
  // ============================================================

  if (
    loading &&
    eleves.length === 0
  ) {
    return (
      <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">
        Ouverture de la console des promotions...
      </div>
    );
  }

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="w-full bg-white p-2 text-left animate-fadeIn">
    <Header/>
      {/* ======================================================
          MENU ADMINISTRATION
      ======================================================= */}
       <div className="mb-4">
              <Link
                to="/educateur/dashboard"
                className="signretour  py-1 rounded-xl border no-underline"
              >
                ⬅Retour Console Éducateur
              </Link>
            </div>
      

      {estAdmin && (
        <div className="bg-gray-50 border rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-gray-200 shadow-3xs">

          <div className="text-left">
            <span className="bg-purple-100 text-purple-700 text-[9px] font-black uppercase px-2 py-0.5 rounded">
              Gestion Direction
            </span>

            <h4 className="text-sm font-black text-slate-900 mt-0.5 uppercase">
              Aperçu des Promotions de l'Établissement
            </h4>
          </div>

          <div className="w-full sm:w-64 text-left">

            <select
              value={
                promotionSelectionneeAdmin
              }
              onChange={(e) =>
                setPromotionSelectionneeAdmin(
                  e.target.value
                )
              }
              className="w-full bg-white border border-gray-200 p-2.5 rounded-xl cursor-pointer outline-none font-black text-xs text-slate-800 shadow-2xs"
            >
              {listeToutesPromotionsAdmin.map(
                (promo) => (
                  <option
                    key={promo}
                    value={promo}
                  >
                    🏛️ NIVEAU :{' '}
                    {String(
                      promo
                    ).toUpperCase()}
                  </option>
                )
              )}
            </select>

          </div>
        </div>
      )}

      {/* ======================================================
          TITRE
      ======================================================= */}

      <div className="border-b border-gray-100 pb-2 mb-4 flex justify-between items-center flex-wrap gap-2">

        <h3 className="registrecivil text-xs font-black text-gray-400 uppercase tracking-wider">
          Registre Civil — Niveau de la promotion en charge :{' '}
          {promotionActive
            ? promotionActive.toUpperCase()
            : 'TOUS'}
        </h3>

        <div className="flex items-center gap-4">

          <div className="actif flex items-center gap-1 text-[11px] font-bold">

            <span className="text-gray-400 uppercase">
              Trimestre actif : 
            </span>

            <select
              value={trimestreFiltre}
              onChange={(e) =>
                setTrimestreFiltre(
                  e.target.value
                )
              }
              className="bg-gray-50 border p-1 rounded-md text-danger font-black cursor-pointer outline-none bg-white"
            >
              <option value="1">
                Trimestre 1
              </option>

              <option value="2">
                Trimestre 2
              </option>

              <option value="3">
                Trimestre 3
              </option>
            </select>

          </div>

          <span className="effet text-[10px] font-black bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-md">
            EFFECTIVE TOTAL INSCRIT DE LA PROMOTION :  {elevesAffichesTransformes.length}{' '} ELEVES 
          </span>

        </div>
      </div>

      {/* ======================================================
          RECHERCHE
      ======================================================= */}

      <div className="reh mb-4 max-w-md">

        <input
          type="text"
          placeholder="Retrouver un élève de ce niveau..."
          value={termeRecherche}
          onChange={(e) =>
            setTermeRecherche(
              e.target.value
            )
          }
          className="rehinput border border-danger w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900"
        />

      </div>

      {/* ======================================================
          TABLEAU ELEVES
      ======================================================= */}

      <div className="toutable overflow-x-auto rounded-xl border border-gray-200">

        <table className="tablepromo w-full text-left text-xs font-bold text-gray-700 border-collapse">

          <thead>

            <tr className="bg-gray-50 text-gray-400 uppercase border-b border-gray-100 text-[9px] tracking-wider">

              <th className="p-3 w-12">
                Photo
              </th>

              <th className="p-3">
                Matricule
              </th>

              <th className="p-3">
                Classe Effective
              </th>

              <th className="p-3">
                Nom & Prénoms de l'Élève
              </th>

              <th className="p-3 text-center">
                Genre
              </th>

              <th className="p-3 text-center">
                Livret Scolaire
              </th>

              <th className="p-3 text-center">
                Fiche Statut
              </th>

            </tr>

          </thead>

          <tbody className="divide-y divide-gray-100 bg-white font-medium text-[11px]">

            {elevesAffichesTransformes.length ===
            0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="p-12 text-center text-gray-400 italic font-medium bg-white"
                >
                  Aucun élève répertorié dans ce
                  niveau d'étude actuellement.
                </td>
              </tr>
            ) : (
              elevesAffichesTransformes.map(
                (student) => {
                  const estActif =
                    String(
                      student?.statut ||
                        student?.statutCompte ||
                        student?.statutAcces ||
                        'actif'
                    )
                      .trim()
                      .toLowerCase() ===
                      'actif';

                  const sourceImageIdentite =
                    student?.photoUrl ||
                    student?.photoBase64 ||
                    student?.photo ||
                    '';

                  const classeId =
                    normaliser(
                      student?.classeId
                    );

                  const classeNom =
                    normaliser(
                      student?.classeNom ||
                        student?.classe
                    );

                  const classeAffichee =
                    dictionnaireClasses[
                      classeId
                    ] ||
                    dictionnaireClasses[
                      classeNom
                    ] ||
                    student?.classeNom ||
                    student?.classe ||
                    'Classe non renseignée';

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/40 transition font-bold"
                    >

                      {/* PHOTO */}

                      <td className="p-3">

                        {sourceImageIdentite ? (
                          <img
                            src={
                              sourceImageIdentite
                            }
                            alt="Portrait"
                            className="photoeleve w-8 h-8 rounded-full object-cover border border-gray-200 bg-slate-50 shadow-3xs"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black">
                            🧑‍🎓
                          </div>
                        )}

                      </td>

                      {/* MATRICULE */}

                      <td className="p-3 font-mono text-gray-500 uppercase">
                        {student?.matricule ||
                          student.id.slice(
                            0,
                            8
                          )}
                      </td>

                      {/* CLASSE */}

                      <td className="p-3 text-purple-700 font-mono font-black uppercase">
                        🏛️{' '}
                        {classeAffichee}
                      </td>

                      {/* NOM */}

                      <td className="p-3 text-slate-900 uppercase font-black">
                        🎓{' '}
                        {student?.nom ||
                          ''}
                        {' '}
                        {student?.prenoms ||
                          student?.prenom ||
                          ''}
                      </td>

                      {/* GENRE */}

                      <td className="p-3 text-center text-gray-500">
                        {student?.genre ||
                          '—'}
                      </td>

                      {/* LIVRET */}

                      <td className="p-3 text-center">

                        <button
                          type="button"
                          onClick={() => {
                            setEleveBulletin(
                              student
                            );
                            setBulletinOuvert(
                              true
                            );
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-orange-400 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg cursor-pointer border-0 shadow-2xs transition"
                        >
                          👁️ Consulter
                        </button>

                      </td>

                      {/* STATUT */}

                      <td className="p-3 text-center">

                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            estActif
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {student?.statut ||
                            student?.statutCompte ||
                            student?.statutAcces ||
                            'actif'}
                        </span>

                      </td>

                    </tr>
                  );
                }
              )
            )}

          </tbody>
        </table>
      </div>

      {/* ======================================================
          MODALE LIVRET
      ======================================================= */}

      {bulletinOuvert &&
        eleveBulletin && (
          <div className="monte fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xl max-w-4xl w-full space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto scrollbar-none">

              {/* EN-TETE */}

              <div className="border-b border-gray-100 pb-2 flex justify-between items-center">

                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  📖 Livret Scolaire Cloud —
                  Trimestre{' '}
                  {trimestreFiltre}
                </h3>

                <button
                  type="button"
                  onClick={
                    fermerBulletin
                  }
                  className="text-gray-400 hover:text-gray-900 border-0 bg-transparent text-base font-black cursor-pointer"
                >
                  ✕
                </button>

              </div>

              {/* IDENTITE */}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-gray-100 text-left font-bold text-gray-700 items-center">

                <div className="flex justify-center sm:justify-start">

                  {(
                    eleveBulletin?.photoUrl ||
                    eleveBulletin?.photoBase64 ||
                    eleveBulletin?.photo
                  ) ? (
                    <img
                      src={
                        eleveBulletin.photoUrl ||
                        eleveBulletin.photoBase64 ||
                        eleveBulletin.photo
                      }
                      alt="Identité Élève"
                      className="photoeleve w-14 h-16 rounded-xl object-cover border-2 border-white shadow-md bg-white"
                    />
                  ) : (
                    <div className="w-14 h-16 rounded-xl bg-purple-200 text-purple-800 flex items-center justify-center text-xl shadow-inner font-black">
                      🧑‍🎓
                    </div>
                  )}

                </div>

                <div className="sm:col-span-2">

                  <p className="text-[10px] text-gray-400 uppercase">
                    Fiche Civile Enregistrée
                  </p>

                  <p className="text-sm font-black text-slate-900 uppercase mt-0.5">
                    🎓{' '}
                    {eleveBulletin?.nom ||
                      ''}
                    {' '}
                    {eleveBulletin?.prenoms ||
                      eleveBulletin?.prenom ||
                      ''}
                  </p>

                  <p className="font-mono text-gray-500 mt-0.5">
                    Matricule d'accès :{' '}
                    {eleveBulletin?.matricule ||
                      eleveBulletin?.id}
                  </p>

                  <p className="text-purple-700 font-black uppercase mt-1">
                    🏛️{' '}
                    {dictionnaireClasses[
                      normaliser(
                        eleveBulletin?.classeId
                      )
                    ] ||
                      dictionnaireClasses[
                        normaliser(
                          eleveBulletin?.classeNom
                        )
                      ] ||
                      eleveBulletin?.classeNom ||
                      eleveBulletin?.classe ||
                      'Classe non renseignée'}
                  </p>

                </div>

              </div>

              {/* =================================================
                  TABLEAU DES MATIERES
              ================================================== */}

              <div className="overflow-x-auto rounded-xl border border-gray-100 mt-2">

                <table className="table-2 w-full text-left text-xs font-bold text-gray-700 border-collapse">

                  <thead>

                    <tr className="bg-gray-100 text-gray-400 uppercase border-b border-gray-200 text-[9px] tracking-wider">

                      <th className="p-3">
                        Matière
                      </th>

                      <th className="p-3">
                        Notes Intermédiaires
                      </th>

                      <th className="p-3 text-center">
                        Moyenne
                      </th>

                      <th className="p-3 text-center">
                        Coef.
                      </th>

                      <th className="p-3 text-center">
                        Moyenne pondérée
                      </th>

                      <th className="p-3">
                        Appréciation
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white font-medium text-[11px]">

                    {matieresCalculeesLivret.length ===
                    0 ? (
                      <tr>

                        <td
                          colSpan="6"
                          className="p-8 text-center text-gray-400 italic bg-white"
                        >
                          ⚠️ Aucune moyenne de
                          matière enregistrée sur le
                          cloud pour cet élève au
                          Trimestre{' '}
                          {trimestreFiltre}.
                        </td>

                      </tr>
                    ) : (
                      matieresCalculeesLivret.map(
                        (mat, index) => (
                          <tr
                            key={`${mat.intitule}-${index}`}
                            className="hover:bg-slate-50/40 transition font-bold"
                          >

                            {/* MATIERE */}

                            <td className="p-3 text-slate-900 font-black uppercase">
                              📚{' '}
                              {mat.intitule}
                            </td>

                            {/* NOTES INTERMEDIAIRES */}

                            <td className="p-3 font-mono text-gray-500">
                              {
                                mat.notesIntermediaires
                              }
                            </td>

                            {/* MOYENNE */}

                            <td className="p-3 text-center">

                              {mat.moyenneMatiere !==
                              null ? (
                                <span
                                  className={`px-2 py-0.5 rounded-md font-mono font-black ${
                                    mat.moyenneMatiere >=
                                    10
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-rose-50 text-red-600 border border-rose-100'
                                  }`}
                                >
                                  {Number(
                                    mat.moyenneMatiere
                                  ).toFixed(
                                    2
                                  )}{' '}
                                  / 20
                                </span>
                              ) : (
                                '—'
                              )}

                            </td>

                            {/* COEFFICIENT */}

                            <td className="p-3 text-center">

                              {mat.coefficientMatiere !==
                              null ? (
                                <span className="inline-flex px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 font-mono font-black">
                                  ×{' '}
                                  {Number(
                                    mat.coefficientMatiere
                                  ).toFixed(
                                    2
                                  )}
                                </span>
                              ) : (
                                '—'
                              )}

                            </td>

                            {/* MOYENNE PONDEREE */}

                            <td className="p-3 text-center">

                              {mat.moyennePonderee !==
                              null ? (
                                <span className="inline-flex px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-100 font-mono font-black">
                                  {Number(
                                    mat.moyennePonderee
                                  ).toFixed(
                                    2
                                  )}
                                </span>
                              ) : (
                                '—'
                              )}

                            </td>

                            {/* APPRECIATION */}

                            <td className="p-3 text-gray-500 italic font-normal">

                              <div>
                                {mat.appreciation}
                              </div>

                              {mat.professeurName &&
                                mat.professeurName !==
                                  '—' && (
                                  <div className="text-[9px] text-gray-400 not-italic uppercase mt-1">
                                    Prof. :{' '}
                                    {
                                      mat.professeurName
                                    }
                                  </div>
                                )}

                            </td>

                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

              {/* =================================================
                  RESUME DES POINTS
              ================================================== */}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">

                {/* MOYENNE GENERALE */}

                <div className="p-4 bg-slate-900  rounded-xl flex justify-between items-center shadow-sm text-left">

                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Moyenne générale 
                  </span>

                  <strong className="text-base font-mono text-orange-400 font-black">
                    {moyenneGeneraleGlobaleLivret !==
                    null
                      ? `${moyenneGeneraleGlobaleLivret.toFixed(
                          2
                        )} / 20`
                      : '— / 20'}
                  </strong>

                </div>

                {/* TOTAL POINTS */}

                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex justify-between items-center text-left">

                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-500">
                    Total points
                  </span>

                  <strong className="text-base font-mono text-purple-700 font-black">
                     {totalPointsLivret !==
                    null
                      ? totalPointsLivret.toFixed(
                          2
                        )
                      : '—'}
                  </strong>

                </div>

                {/* STATUT */}

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center text-xs font-bold text-gray-700 text-left">

                  <div>

                    <span className="text-[9px] text-gray-400 uppercase block">
                      Statut d'inscription
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded font-black text-[9px] uppercase mt-0.5 inline-block ${
                        String(
                          eleveBulletin?.statut ||
                            eleveBulletin?.statutCompte ||
                            eleveBulletin?.statutAcces ||
                            'actif'
                        )
                          .trim()
                          .toLowerCase() ===
                        'actif'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {eleveBulletin?.statut ||
                        eleveBulletin?.statutCompte ||
                        eleveBulletin?.statutAcces ||
                        'actif'}
                    </span>

                  </div>

                </div>

              </div>

              {/* =================================================
                  RAPPEL DES DONNEES UTILISEES
              ================================================== */}

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <div>

                    <p className="text-[9px] uppercase font-black text-gray-400">
                      Données pédagogiques
                    </p>

                    <p className="text-[10px] text-gray-500 font-medium mt-1">
                      Les moyennes affichées
                      correspondent aux moyennes de
                      matière transmises et enregistrées
                      par les professeurs.
                    </p>

                  </div>

                  <span className="text-danger uppercase font-black bg-white border border-gray-200 text-gray-500 px-2 py-1 rounded-lg">
                    Trimestre {trimestreFiltre}
                  </span>

                </div>

              </div>

            </div>
          </div>
        )}

    </div>
  );
};

export default ListePromotion;