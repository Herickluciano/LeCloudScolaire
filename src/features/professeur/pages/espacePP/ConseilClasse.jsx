// src/features/professeur/pages/espacePP/ConseilClasse.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Link } from "react-router-dom";

import { useAuth } from "../../../../context/AuthContext";
import { db } from "../../../../services/api";
import Header from "../../../../pages/Header";


// ============================================================
// OUTILS
// ============================================================

const normaliser = (valeur) =>
  String(valeur ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const normaliserClasse = (valeur) => {
  if (!valeur) return "";

  return normaliser(valeur)
    .replace(/^classe_/, "")
    .replace(/^class_/, "");
};

const extraireClasseSimple = (valeur) => {
  if (!valeur) return "";

  const texte = String(valeur)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const match = texte.match(
    /(?:lycee_[^_]+_)?([0-9]+(?:ere|eme|e|er)?[_ -]?[0-9]+)/
  );

  if (match?.[1]) {
    return match[1]
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
  }

  return normaliserClasse(valeur);
};

const classesCorrespondent = (a, b) => {
  if (!a || !b) return false;

  const na = normaliserClasse(a);
  const nb = normaliserClasse(b);

  if (na === nb) return true;

  const sa = extraireClasseSimple(a);
  const sb = extraireClasseSimple(b);

  if (sa && sb && sa === sb) {
    return true;
  }

  if (na.includes(nb) || nb.includes(na)) {
    return true;
  }

  return false;
};

const toNumber = (valeur) => {
  if (
    valeur === null ||
    valeur === undefined ||
    valeur === ""
  ) {
    return null;
  }

  if (typeof valeur === "number") {
    return Number.isFinite(valeur)
      ? valeur
      : null;
  }

  if (typeof valeur === "object") {
    return null;
  }

  const texte = String(valeur)
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!texte) return null;

  const nombre = Number(texte);

  return Number.isFinite(nombre)
    ? nombre
    : null;
};

const formatMoyenne = (valeur) => {
  const nombre = toNumber(valeur);

  if (nombre === null) {
    return "—";
  }

  return `${nombre.toFixed(2)}/20`;
};


// ============================================================
// IDENTIFIANTS POSSIBLES D'UN ELEVE
// ============================================================

const obtenirIdentifiantsEleve = (eleve) => {
  if (!eleve) return [];

  return [
    eleve.id,
    eleve.uid,
    eleve.userId,
    eleve.eleveId,
    eleve.studentId,
    eleve.studentID,
    eleve.idEleve,
    eleve.matricule,
    eleve.numeroMatricule,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());
};


// ============================================================
// VERIFICATION SI UNE MOYENNE APPARTIENT A L'ELEVE
// ============================================================

const moyenneCorrespondEleve = (
  moyenneDoc,
  eleve
) => {
  if (!moyenneDoc || !eleve) {
    return false;
  }

  const identifiantsEleve =
    obtenirIdentifiantsEleve(eleve);

  const identifiantsMoyenne = [
    moyenneDoc.idEleve,
    moyenneDoc.eleveId,
    moyenneDoc.studentId,
    moyenneDoc.studentID,
    moyenneDoc.userId,
    moyenneDoc.uid,
    moyenneDoc.matricule,
    moyenneDoc.numeroMatricule,
    moyenneDoc.idEtudiant,
    moyenneDoc.eleve?.id,
    moyenneDoc.eleve?.uid,
    moyenneDoc.eleve?.matricule,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());

  return identifiantsMoyenne.some((id) =>
    identifiantsEleve.includes(id)
  );
};


// ============================================================
// EXTRACTION D'UNE MOYENNE DEPUIS UN DOCUMENT
// ============================================================

const extraireMoyenneDepuisObjet = (
  objet,
  trimestre
) => {
  if (!objet || typeof objet !== "object") {
    return null;
  }

  const numero =
    trimestre === "trimestre_1"
      ? "1"
      : trimestre === "trimestre_2"
      ? "2"
      : "3";

  const variantes = [
    `moyenne`,
    `moyenneGenerale`,
    `moyenne_generale`,
    `moyenneTrimestrielle`,
    `moyenne_trimestrielle`,
    `moyenneFinale`,
    `moyenne_finale`,
    `note`,
    `valeur`,
    `resultat`,

    `moyenne_${trimestre}`,
    `moyenne_${numero}`,
    `moyenneTrimestre${numero}`,
    `moyenne_trimestre_${numero}`,
    `moyenne_trimestre${numero}`,

    trimestre,
    `t${numero}`,
    `T${numero}`,
  ];

  for (const champ of variantes) {
    if (
      Object.prototype.hasOwnProperty.call(
        objet,
        champ
      )
    ) {
      const valeur = objet[champ];

      const nombre = toNumber(valeur);

      if (nombre !== null) {
        return nombre;
      }

      if (
        valeur &&
        typeof valeur === "object"
      ) {
        const nested =
          extraireMoyenneDepuisObjet(
            valeur,
            trimestre
          );

        if (nested !== null) {
          return nested;
        }
      }
    }
  }

  return null;
};


// ============================================================
// EXTRACTION MOYENNE D'UN DOCUMENT FIREBASE
// ============================================================

const extraireMoyenneDocument = (
  moyenneDoc,
  trimestre
) => {
  if (!moyenneDoc) return null;

  const numero =
    trimestre === "trimestre_1"
      ? "1"
      : trimestre === "trimestre_2"
      ? "2"
      : "3";

  // ----------------------------------------------------------
  // Champs directs
  // ----------------------------------------------------------

  const champsDirects = [
    `moyenne_${trimestre}`,
    `moyenne_${numero}`,

    `moyenneTrimestre${numero}`,

    `moyenne_trimestre_${numero}`,
    `moyenne_trimestre${numero}`,

    `moyenneGenerale_${trimestre}`,
    `moyenne_generale_${trimestre}`,

    `moyenneGeneraleT${numero}`,
    `moyenne_generale_t${numero}`,

    `moyenneValidee_${trimestre}`,
    `moyenne_validee_${trimestre}`,

    `moyenneValideeT${numero}`,
    `moyenne_validee_t${numero}`,

    "moyenneGenerale",
    "moyenne_generale",

    "moyenne",
    "valeur",
    "note",
  ];

  for (const champ of champsDirects) {
    if (
      Object.prototype.hasOwnProperty.call(
        moyenneDoc,
        champ
      )
    ) {
      const valeur = toNumber(
        moyenneDoc[champ]
      );

      if (valeur !== null) {
        return valeur;
      }
    }
  }

  // ----------------------------------------------------------
  // Structures imbriquées
  // ----------------------------------------------------------

  const structures = [
    moyenneDoc.moyennes,
    moyenneDoc.moyennesTrimestrielles,
    moyenneDoc.moyennes_trimestrielles,
    moyenneDoc.moyennesTrimestre,
    moyenneDoc.moyennes_trimestre,
    moyenneDoc.trimestres,
    moyenneDoc.resultats,
    moyenneDoc.resultat,
  ];

  for (const structure of structures) {
    if (!structure) continue;

    if (
      typeof structure === "object"
    ) {
      const valeur =
        structure[trimestre] ??
        structure[`t${numero}`] ??
        structure[`T${numero}`] ??
        structure[numero];

      const nombre = toNumber(valeur);

      if (nombre !== null) {
        return nombre;
      }

      if (
        valeur &&
        typeof valeur === "object"
      ) {
        const nested =
          extraireMoyenneDepuisObjet(
            valeur,
            trimestre
          );

        if (nested !== null) {
          return nested;
        }
      }
    }
  }

  // ----------------------------------------------------------
  // Dernier niveau
  // ----------------------------------------------------------

  return extraireMoyenneDepuisObjet(
    moyenneDoc,
    trimestre
  );
};


// ============================================================
// RECUPERATION CLASSE PP
// ============================================================

const obtenirClassePP = (
  user,
  classes
) => {
  if (!user) return null;

  const userId =
    user.uid ||
    user.id ||
    user.userId;

  // ----------------------------------------------------------
  // Recherche dans classes
  // ----------------------------------------------------------

  const classeTrouvee =
    classes.find((classe) => {
      const professeurPrincipalId =
        classe.professeurPrincipalId ||
        classe.profPrincipalId ||
        classe.ppId ||
        classe.professeurPrincipalUid ||
        classe.titulaireId;

      if (
        professeurPrincipalId &&
        userId &&
        String(professeurPrincipalId) ===
          String(userId)
      ) {
        return true;
      }

      const professeurPrincipal =
        classe.professeurPrincipal ||
        classe.profPrincipal ||
        classe.titulaire;

      if (professeurPrincipal) {
        if (
          typeof professeurPrincipal ===
          "string"
        ) {
          return (
            String(professeurPrincipal) ===
            String(userId)
          );
        }

        const nestedId =
          professeurPrincipal.uid ||
          professeurPrincipal.id ||
          professeurPrincipal.userId;

        if (
          nestedId &&
          userId &&
          String(nestedId) ===
            String(userId)
        ) {
          return true;
        }
      }

      return false;
    });

  if (classeTrouvee) {
    return classeTrouvee;
  }

  // ----------------------------------------------------------
  // Fallback compte PP
  // ----------------------------------------------------------

  const classeId =
    user.classeId ||
    user.classe_id ||
    user.idClasse;

  const classeNom =
    user.classeNom ||
    user.nomClasse ||
    user.classe ||
    user.className;

  if (classeId || classeNom) {
    return {
      id:
        classeId ||
        classeNom,

      classeId:
        classeId || "",

      nom:
        classeNom ||
        classeId ||
        "",
    };
  }

  return null;
};


// ============================================================
// ANNEE SCOLAIRE
// ============================================================

const obtenirAnneeScolaire = (
  user,
  eleve
) => {
  return (
    eleve?.anneeScolaire ||
    eleve?.annee_scolaire ||
    eleve?.anneeArrivee ||
    user?.anneeScolaire ||
    user?.annee_scolaire ||
    sessionStorage.getItem(
      "sgs_annee_scolaire"
    ) ||
    "2026 - 2027"
  );
};


// ============================================================
// COMPOSANT
// ============================================================

export default function ConseilClasse() {
  const { user } = useAuth();

  const [classes, setClasses] =
    useState([]);

  const [eleves, setEleves] =
    useState([]);

  // Documents de la collection
  // moyennes_trimestrielles
  const [
    documentsMoyennes,
    setDocumentsMoyennes,
  ] = useState([]);

  const [
    classeSelectionnee,
    setClasseSelectionnee,
  ] = useState("");

  const [
    eleveSelectionneId,
    setEleveSelectionneId,
  ] = useState("");

  const [
    trimestre,
    setTrimestre,
  ] = useState("trimestre_1");

  const [
    appreciation,
    setAppreciation,
  ] = useState("");

  const [
    decision,
    setDecision,
  ] = useState("");

  const [
    chargement,
    setChargement,
  ] = useState(true);

  const [
    chargementMoyennes,
    setChargementMoyennes,
  ] = useState(true);

  const [
    enregistrement,
    setEnregistrement,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    erreur,
    setErreur,
  ] = useState("");

  // ==========================================================
  // ECOLE
  // ==========================================================

  const schoolId = useMemo(() => {
    return (
      user?.schoolId ||
      user?.schoolID ||
      user?.ecoleId ||
      sessionStorage.getItem(
        "sgs_school_id"
      ) ||
      ""
    );
  }, [user]);

  // ==========================================================
  // CLASSES
  // ==========================================================

  useEffect(() => {
    if (!schoolId) {
      setClasses([]);
      return;
    }

    const requete = query(
      collection(db, "classes"),
      where(
        "schoolId",
        "==",
        schoolId
      )
    );

    const unsubscribe =
      onSnapshot(
        requete,
        (snapshot) => {
          const resultat =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );

          setClasses(resultat);
        },
        (error) => {
          console.error(
            "Erreur classes ConseilClasse :",
            error
          );
        }
      );

    return () => unsubscribe();
  }, [schoolId]);

  // ==========================================================
  // CLASSE DU PP
  // ==========================================================

  const classePP = useMemo(() => {
    return obtenirClassePP(
      user,
      classes
    );
  }, [user, classes]);

  const classePPId = useMemo(() => {
    if (!classePP) return "";

    return (
      classePP.classeId ||
      classePP.id ||
      classePP.idClasse ||
      ""
    );
  }, [classePP]);

  const classePPNom = useMemo(() => {
    if (!classePP) return "";

    return (
      classePP.nom ||
      classePP.classeNom ||
      classePP.nomClasse ||
      classePP.classe ||
      classePP.label ||
      classePPId
    );
  }, [
    classePP,
    classePPId,
  ]);

  // ==========================================================
  // SELECTION CLASSE
  // ==========================================================

  useEffect(() => {
    if (
      classePPId ||
      classePPNom
    ) {
      setClasseSelectionnee(
        classePPId ||
          classePPNom
      );
    }
  }, [
    classePPId,
    classePPNom,
  ]);

  // ==========================================================
  // ELEVES
  // ==========================================================

  useEffect(() => {
    if (!schoolId) {
      setEleves([]);
      setChargement(false);
      return;
    }

    setChargement(true);

    const requete = query(
      collection(db, "users"),
      where(
        "schoolId",
        "==",
        schoolId
      )
    );

    const unsubscribe =
      onSnapshot(
        requete,
        (snapshot) => {
          const utilisateurs =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );

          const resultat =
            utilisateurs
              .filter((personne) => {
                const role =
                  normaliser(
                    personne.role ||
                      personne.typeUtilisateur ||
                      personne.type ||
                      ""
                  );

                return (
                  role === "eleve" ||
                  role === "etudiant" ||
                  role === "student"
                );
              })
              .filter((eleve) => {
                if (
                  !classePPId &&
                  !classePPNom
                ) {
                  return false;
                }

                const valeursClasse = [
                  eleve.classeId,
                  eleve.classe_id,
                  eleve.idClasse,
                  eleve.classeNom,
                  eleve.nomClasse,
                  eleve.classe,
                  eleve.className,
                ].filter(Boolean);

                return valeursClasse.some(
                  (valeur) =>
                    classesCorrespondent(
                      valeur,
                      classePPId
                    ) ||
                    classesCorrespondent(
                      valeur,
                      classePPNom
                    )
                );
              })
              .sort((a, b) => {
                const nomA =
                  `${a.nom || ""} ${
                    a.prenom ||
                    a.prenoms ||
                    ""
                  }`.trim();

                const nomB =
                  `${b.nom || ""} ${
                    b.prenom ||
                    b.prenoms ||
                    ""
                  }`.trim();

                return nomA.localeCompare(
                  nomB,
                  "fr",
                  {
                    sensitivity:
                      "base",
                  }
                );
              });

          console.log(
            "ConseilClasse - élèves :",
            resultat
          );

          setEleves(resultat);

          setEleveSelectionneId(
            (ancienId) => {
              if (
                ancienId &&
                resultat.some(
                  (eleve) =>
                    eleve.id ===
                    ancienId
                )
              ) {
                return ancienId;
              }

              return "";
            }
          );

          setChargement(false);
        },
        (error) => {
          console.error(
            "Erreur élèves ConseilClasse :",
            error
          );

          setErreur(
            "Impossible de récupérer les élèves."
          );

          setChargement(false);
        }
      );

    return () => unsubscribe();
  }, [
    schoolId,
    classePPId,
    classePPNom,
  ]);

  // ==========================================================
  // MOYENNES TRIMESTRIELLES
  //
  // IMPORTANT :
  // ON ECOUTE DIRECTEMENT LA COLLECTION
  // moyennes_trimestrielles
  //
  // DONC :
  // prof saisit / valide
  //       ↓
  // moyennes_trimestrielles
  //       ↓
  // ConseilClasse
  //       ↓
  // affichage immédiat
  // ==========================================================

  useEffect(() => {
    if (!schoolId) {
      setDocumentsMoyennes([]);
      setChargementMoyennes(false);
      return;
    }

    setChargementMoyennes(true);

    const requete = query(
      collection(
        db,
        "moyennes_trimestrielles"
      ),
      where(
        "schoolId",
        "==",
        schoolId
      )
    );

    const unsubscribe =
      onSnapshot(
        requete,
        (snapshot) => {
          const resultat =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );

          console.log(
            "ConseilClasse - moyennes_trimestrielles en temps réel :",
            resultat
          );

          setDocumentsMoyennes(
            resultat
          );

          setChargementMoyennes(
            false
          );
        },
        (error) => {
          console.error(
            "Erreur collection moyennes_trimestrielles :",
            error
          );

          setErreur(
            "Impossible de récupérer les moyennes trimestrielles."
          );

          setChargementMoyennes(
            false
          );
        }
      );

    return () => unsubscribe();
  }, [schoolId]);

  // ==========================================================
  // ELEVE SELECTIONNE
  // ==========================================================

  const eleveSelectionne =
    useMemo(() => {
      return (
        eleves.find(
          (eleve) =>
            eleve.id ===
            eleveSelectionneId
        ) || null
      );
    }, [
      eleves,
      eleveSelectionneId,
    ]);

  // ==========================================================
  // DOCUMENTS DE MOYENNES DE L'ELEVE
  // ==========================================================

  const moyennesEleve =
    useMemo(() => {
      if (!eleveSelectionne) {
        return [];
      }

      return documentsMoyennes.filter(
        (moyenneDoc) =>
          moyenneCorrespondEleve(
            moyenneDoc,
            eleveSelectionne
          )
      );
    }, [
      documentsMoyennes,
      eleveSelectionne,
    ]);

  // ==========================================================
  // MOYENNE D'UN TRIMESTRE
  // ==========================================================

  const trouverMoyenne = (
    eleve,
    trimestreRecherche
  ) => {
    if (!eleve) return null;

    // --------------------------------------------------------
    // 1. COLLECTION moyennes_trimestrielles
    // --------------------------------------------------------

    const docsCorrespondants =
      documentsMoyennes.filter(
        (moyenneDoc) =>
          moyenneCorrespondEleve(
            moyenneDoc,
            eleve
          )
      );

    for (const moyenneDoc of docsCorrespondants) {
      const valeur =
        extraireMoyenneDocument(
          moyenneDoc,
          trimestreRecherche
        );

      if (valeur !== null) {
        return valeur;
      }
    }

    // --------------------------------------------------------
    // 2. SI LE DOCUMENT EST DIRECTEMENT PAR TRIMESTRE
    // --------------------------------------------------------

    const docTrimestre =
      docsCorrespondants.find(
        (moyenneDoc) => {
          const trimestreDoc =
            normaliser(
              moyenneDoc.trimestre ||
                moyenneDoc.periode ||
                moyenneDoc.session ||
                ""
            );

          return (
            trimestreDoc ===
              normaliser(
                trimestreRecherche
              ) ||
            trimestreDoc ===
              normaliser(
                trimestreRecherche.replace(
                  "trimestre_",
                  "t"
                )
              ) ||
            trimestreDoc ===
              `t${
                trimestreRecherche ===
                "trimestre_1"
                  ? "1"
                  : trimestreRecherche ===
                    "trimestre_2"
                  ? "2"
                  : "3"
              }`
          );
        }
      );

    if (docTrimestre) {
      const valeur =
        extraireMoyenneDocument(
          docTrimestre,
          trimestreRecherche
        );

      if (valeur !== null) {
        return valeur;
      }
    }

    // --------------------------------------------------------
    // 3. FALLBACK UNIQUEMENT SUR LES CHAMPS D'ARCHIVE
    // PRESENTS DANS users
    //
    // Ces champs sont déjà présents dans ton document.
    // --------------------------------------------------------

    const numero =
      trimestreRecherche ===
      "trimestre_1"
        ? "1"
        : trimestreRecherche ===
          "trimestre_2"
        ? "2"
        : "3";

    const fallbackFields = [
      `moyenne_archive_t${numero}`,
      `moyenne_archive_t${numero}`,
    ];

    for (const champ of fallbackFields) {
      const valeur =
        toNumber(eleve[champ]);

      if (valeur !== null) {
        return valeur;
      }
    }

    return null;
  };

  // ==========================================================
  // MOYENNES
  // ==========================================================

  const moyenneT1 = useMemo(
    () =>
      trouverMoyenne(
        eleveSelectionne,
        "trimestre_1"
      ),
    [
      eleveSelectionne,
      documentsMoyennes,
    ]
  );

  const moyenneT2 = useMemo(
    () =>
      trouverMoyenne(
        eleveSelectionne,
        "trimestre_2"
      ),
    [
      eleveSelectionne,
      documentsMoyennes,
    ]
  );

  const moyenneT3 = useMemo(
    () =>
      trouverMoyenne(
        eleveSelectionne,
        "trimestre_3"
      ),
    [
      eleveSelectionne,
      documentsMoyennes,
    ]
  );

  // ==========================================================
  // MOYENNE ACTUELLE
  // ==========================================================

  const moyenneActuelle =
    useMemo(() => {
      if (
        trimestre ===
        "trimestre_1"
      ) {
        return moyenneT1;
      }

      if (
        trimestre ===
        "trimestre_2"
      ) {
        return moyenneT2;
      }

      return moyenneT3;
    }, [
      trimestre,
      moyenneT1,
      moyenneT2,
      moyenneT3,
    ]);

  // ==========================================================
  // MOYENNE ANNUELLE
  //
  // UNIQUEMENT AU T3
  //
  // T1 × 1
  // T2 × 2
  // T3 × 2
  // ----------------
  //        5
  // ==========================================================

  const moyenneAnnuelle =
    useMemo(() => {
      if (
        trimestre !==
        "trimestre_3"
      ) {
        return null;
      }

      if (
        moyenneT1 === null ||
        moyenneT2 === null ||
        moyenneT3 === null
      ) {
        return null;
      }

      return (
        moyenneT1 * 1 +
        moyenneT2 * 2 +
        moyenneT3 * 2
      ) / 5;
    }, [
      trimestre,
      moyenneT1,
      moyenneT2,
      moyenneT3,
    ]);

  // ==========================================================
  // SELECTION ELEVE
  // ==========================================================

  const handleSelectionEleve = (
    event
  ) => {
    setEleveSelectionneId(
      event.target.value
    );

    setAppreciation("");
    setDecision("");
    setMessage("");
    setErreur("");
  };

  // ==========================================================
  // SELECTION TRIMESTRE
  // ==========================================================

  const handleSelectionTrimestre = (
    event
  ) => {
    setTrimestre(
      event.target.value
    );

    setAppreciation("");
    setDecision("");
    setMessage("");
    setErreur("");
  };

  // ==========================================================
  // ENREGISTREMENT CONSEIL
  // ==========================================================

  const handleEnregistrerDecision =
    async () => {
      setMessage("");
      setErreur("");

      if (!eleveSelectionne) {
        setErreur(
          "Veuillez sélectionner un élève."
        );
        return;
      }

      if (
        moyenneActuelle ===
        null
      ) {
        setErreur(
          "La moyenne trimestrielle validée n'est pas encore disponible dans Firebase."
        );
        return;
      }

      if (!decision) {
        setErreur(
          "Veuillez sélectionner la décision du conseil."
        );
        return;
      }

      try {
        setEnregistrement(true);

        const userId =
          user?.uid ||
          user?.id ||
          user?.userId ||
          "";

        const nomPP =
          `${user?.prenom || ""} ${
            user?.nom || ""
          }`.trim() ||
          user?.displayName ||
          user?.email ||
          "Professeur principal";

        const anneeScolaire =
          obtenirAnneeScolaire(
            user,
            eleveSelectionne
          );

        const classeId =
          eleveSelectionne.classeId ||
          classePPId ||
          "";

        const classeNom =
          eleveSelectionne.classeNom ||
          eleveSelectionne.nomClasse ||
          eleveSelectionne.classe ||
          classePPNom ||
          "";

        const referenceEleve =
          doc(
            db,
            "users",
            eleveSelectionne.id
          );

        const donneesTrimestre = {
          trimestre,

          // --------------------------------------------------
          // IMPORTANT :
          // C'est la moyenne VALIDEE récupérée de Firebase.
          // Le PP ne la modifie pas.
          // --------------------------------------------------

          moyenneValidee:
            moyenneActuelle,

          appreciation:
            appreciation.trim(),

          decision,

          statut: decision,

          professeurPrincipalId:
            userId,

          professeurPrincipalNom:
            nomPP,

          schoolId,

          classeId,

          classeNom,

          anneeScolaire,

          dateConseil:
            serverTimestamp(),
        };

        // ====================================================
        // T1 / T2
        // ====================================================

        if (
          trimestre ===
            "trimestre_1" ||
          trimestre ===
            "trimestre_2"
        ) {
          await updateDoc(
            referenceEleve,
            {
              [`conseilClasse.${trimestre}`]:
                donneesTrimestre,
            }
          );

          setMessage(
            `Le conseil du ${trimestre.replace(
              "_",
              " "
            )} a été enregistré.`
          );
        }

        // ====================================================
        // T3 = CLOTURE ANNUELLE
        // ====================================================

        if (
          trimestre ===
          "trimestre_3"
        ) {
          if (
            moyenneT1 === null ||
            moyenneT2 === null ||
            moyenneT3 === null
          ) {
            setErreur(
              "Impossible de clôturer l'année : les trois moyennes validées doivent être disponibles."
            );

            setEnregistrement(
              false
            );

            return;
          }

          const moyenneFinale =
            (
              moyenneT1 * 1 +
              moyenneT2 * 2 +
              moyenneT3 * 2
            ) / 5;

          const donneesAnnuelles = {
            trimestre_1: {
              moyenneValidee:
                moyenneT1,
              coefficient: 1,
            },

            trimestre_2: {
              moyenneValidee:
                moyenneT2,
              coefficient: 2,
            },

            trimestre_3: {
              moyenneValidee:
                moyenneT3,
              coefficient: 2,
            },

            moyenneAnnuelle:
              moyenneFinale,

            formule:
              "(T1 × 1 + T2 × 2 + T3 × 2) / 5",

            decisionFinale:
              decision,

            statutFinal:
              decision,

            appreciation:
              appreciation.trim(),

            professeurPrincipalId:
              userId,

            professeurPrincipalNom:
              nomPP,

            schoolId,

            classeId,

            classeNom,

            anneeScolaire,

            dateCloture:
              serverTimestamp(),
          };

          await updateDoc(
            referenceEleve,
            {
              [`conseilClasse.${trimestre}`]:
                donneesTrimestre,

              conseilClasseAnnuel:
                donneesAnnuelles,

              moyenne_generale_annuelle:
                moyenneFinale,

              moyenneAnnuelle:
                moyenneFinale,

              statutConseilClasse:
                decision,

              statutEleve:
                decision,

              appreciationConseil:
                appreciation.trim(),

              anneeScolaireTerminee:
                anneeScolaire,

              dateClotureAnneeScolaire:
                serverTimestamp(),
            }
          );

          setMessage(
            `Conseil de T3 enregistré. Moyenne annuelle : ${moyenneFinale.toFixed(
              2
            )}/20.`
          );
        }
      } catch (error) {
        console.error(
          "Erreur enregistrement conseil :",
          error
        );

        setErreur(
          "Une erreur est survenue pendant l'enregistrement."
        );
      } finally {
        setEnregistrement(
          false
        );
      }
    };

  // ==========================================================
  // NOM ELEVE
  // ==========================================================

  const obtenirNomEleve = (
    eleve
  ) => {
    const nom =
      eleve?.nom || "";

    const prenom =
      eleve?.prenom ||
      eleve?.prenoms ||
      "";

    const resultat =
      `${nom} ${prenom}`.trim();

    return (
      resultat ||
      eleve?.displayName ||
      eleve?.email ||
      "Élève"
    );
  };

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <div className="min-h-screen bg-white md:p-8">
     <Header/>
      {/* ====================================================
          EN-TETE
      ==================================================== */}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Conseil de classe
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Saisie des appréciations du professeur principal
          </p>
        </div>

        <Link
          to="/professeur/dashboard"
          className="rounded-lg bg-slate-800 px-4 py-2 text-center text-sm font-semibold  transition hover:bg-slate-700"
        >
          Retour au tableau de bord
        </Link>

      </div>

      {/* ====================================================
          INFORMATIONS
      ==================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">

          <p className="text-xs font-semibold uppercase text-slate-400">
            Établissement
          </p>

          <p className="mt-1 font-semibold text-slate-800">
            {schoolId || "—"}
          </p>

        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">

          <p className="text-xs font-semibold uppercase text-slate-400">
            Classe du PP
          </p>

          <p className="mt-1 font-semibold text-slate-800">
            {classePPNom ||
              classePPId ||
              "—"}
          </p>

        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">

          <p className="text-xs font-semibold uppercase text-slate-400">
            Élèves
          </p>

          <p className="mt-1 font-semibold text-slate-800">
            {eleves.length}
          </p>

        </div>

      </div>

      {/* ====================================================
          MESSAGES
      ==================================================== */}

      {message && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      {erreur && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {erreur}
        </div>
      )}

      {/* ====================================================
          SELECTION
      ==================================================== */}

      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

        <h2 className="mb-4 text-lg font-bold text-slate-800">
          Sélection
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* ELEVE */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Élève
            </label>

            <select
              value={
                eleveSelectionneId
              }
              onChange={
                handleSelectionEleve
              }
              disabled={
                chargement ||
                eleves.length === 0
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >

              <option value="">
                {chargement
                  ? "Chargement des élèves..."
                  : eleves.length ===
                    0
                  ? "Aucun élève trouvé"
                  : "Sélectionner un élève"}
              </option>

              {eleves.map(
                (eleve) => (
                  <option
                    key={eleve.id}
                    value={eleve.id}
                  >
                    {obtenirNomEleve(
                      eleve
                    )}

                    {eleve.matricule
                      ? ` — ${eleve.matricule}`
                      : ""}
                  </option>
                )
              )}

            </select>

          </div>

          {/* TRIMESTRE */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Conseil
            </label>

            <select
              value={trimestre}
              onChange={
                handleSelectionTrimestre
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >

              <option value="trimestre_1">
                Conseil du 1er trimestre
              </option>

              <option value="trimestre_2">
                Conseil du 2e trimestre
              </option>

              <option value="trimestre_3">
                Conseil du 3e trimestre — clôture annuelle
              </option>

            </select>

          </div>

        </div>

      </div>

      {/* ====================================================
          DOSSIER ELEVE
      ==================================================== */}

      {eleveSelectionne ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ==================================================
              ELEVE
          ================================================== */}

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

            <h2 className="mb-5 text-lg font-bold text-slate-800">
              Dossier de l'élève
            </h2>

            <div className="space-y-4">

              <div>

                <p className="text-xs font-semibold uppercase text-slate-400">
                  Élève
                </p>

                <p className="mt-1 font-semibold text-slate-800">
                  {obtenirNomEleve(
                    eleveSelectionne
                  )}
                </p>

              </div>

              <div>

                <p className="text-xs font-semibold uppercase text-slate-400">
                  Matricule
                </p>

                <p className="mt-1 font-medium text-slate-700">
                  {eleveSelectionne.matricule ||
                    "—"}
                </p>

              </div>

              <div>

                <p className="text-xs font-semibold uppercase text-slate-400">
                  Classe
                </p>

                <p className="mt-1 font-medium text-slate-700">
                  {eleveSelectionne.classeNom ||
                    eleveSelectionne.nomClasse ||
                    eleveSelectionne.classe ||
                    classePPNom ||
                    "—"}
                </p>

              </div>

              <div>

                <p className="text-xs font-semibold uppercase text-slate-400">
                  Année scolaire
                </p>

                <p className="mt-1 font-medium text-slate-700">
                  {obtenirAnneeScolaire(
                    user,
                    eleveSelectionne
                  )}
                </p>

              </div>

            </div>

          </div>

          {/* ==================================================
              MOYENNES
          ================================================== */}

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">

            <div className="mb-5 flex items-center justify-between">

              <div>

                <h2 className="text-lg font-bold text-slate-800">
                  Moyennes trimestrielles validées
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Données Firebase en temps réel
                </p>

              </div>

              {chargementMoyennes && (
                <span className="text-xs font-medium text-blue-600">
                  Synchronisation...
                </span>
              )}

              {!chargementMoyennes && (
                <span className="text-xs font-medium text-green-600">
                  ● Temps réel
                </span>
              )}

            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

              {/* T1 */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                <p className="text-xs font-semibold uppercase text-slate-400">
                  1er trimestre
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {formatMoyenne(
                    moyenneT1
                  )}
                </p>

              </div>

              {/* T2 */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                <p className="text-xs font-semibold uppercase text-slate-400">
                  2e trimestre
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {formatMoyenne(
                    moyenneT2
                  )}
                </p>

              </div>

              {/* T3 */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                <p className="text-xs font-semibold uppercase text-slate-400">
                  3e trimestre
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {formatMoyenne(
                    moyenneT3
                  )}
                </p>

              </div>

            </div>

            {/* =================================================
                MOYENNE ANNUELLE
            ================================================= */}

            {trimestre ===
              "trimestre_3" && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">

                <p className="text-xs font-semibold uppercase text-blue-600">
                  Moyenne générale annuelle
                </p>

                <p className="mt-2 text-3xl font-bold text-blue-900">
                  {moyenneAnnuelle !==
                  null
                    ? `${moyenneAnnuelle.toFixed(
                        2
                      )}/20`
                    : "—"}
                </p>

                {moyenneAnnuelle ===
                  null && (
                  <p className="mt-2 text-sm text-blue-700">
                    Les trois moyennes
                    trimestrielles
                    validées doivent
                    être disponibles.
                  </p>
                )}

              </div>
            )}

          </div>

          {/* ==================================================
              CONSEIL
          ================================================== */}

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-3">

            <h2 className="mb-5 text-lg font-bold text-slate-800">
              Décision du conseil de classe
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              {/* DECISION */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Statut / décision
                </label>

                <select
                  value={decision}
                  onChange={(event) =>
                    setDecision(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >

                  <option value="">
                    Sélectionner une décision
                  </option>

                  <option value="Admis">
                    Admis
                  </option>

                  <option value="Admis avec encouragements">
                    Admis avec encouragements
                  </option>

                  <option value="Admis avec avertissement">
                    Admis avec avertissement
                  </option>

                  <option value="À surveiller">
                    À surveiller
                  </option>

                  <option value="Orientation">
                   Renvoyer
                  </option>

                  <option value="Redoublement">
                    Redoublement
                  </option>

                </select>

              </div>

              {/* MOYENNE */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Moyenne validée
                </label>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-800">
                  {formatMoyenne(
                    moyenneActuelle
                  )}
                </div>

              </div>

            </div>

            {/* APPRECIATION */}

            <div className="mt-5">

              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Appréciation du conseil
              </label>

              <textarea
                value={
                  appreciation
                }
                onChange={(event) =>
                  setAppreciation(
                    event.target
                      .value
                  )
                }
                rows={5}
                placeholder="Saisir l'appréciation du conseil de classe..."
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

            </div>

            {/* BOUTON */}

            <div className="mt-6 flex justify-end">

              <button
                type="button"
                onClick={
                  handleEnregistrerDecision
                }
                disabled={
                  enregistrement ||
                  !eleveSelectionne ||
                  moyenneActuelle ===
                    null ||
                  !decision
                }
                className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold  transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {enregistrement
                  ? "Enregistrement..."
                  : trimestre ===
                    "trimestre_3"
                  ? "Clôturer le conseil et l'année"
                  : "Enregistrer le conseil"}

              </button>

            </div>

          </div>

        </div>
      ) : (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
            👤
          </div>

          <h2 className="text-lg font-bold text-slate-800">
            Sélectionnez un élève
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Choisissez un élève dans la
            liste ci-dessus.
          </p>

          {!chargement &&
            eleves.length ===
              0 && (
              <p className="mt-4 text-sm font-medium text-red-600">
                Aucun élève correspondant à
                la classe du professeur
                principal.
              </p>
            )}

        </div>
      )}
  
    </div>
  );
}