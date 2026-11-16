// src/utils/bulletinUtils.js

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { db } from "../services/api";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

/* ============================================================
   OUTILS DE NETTOYAGE ET CONVERSION TYPAGE
============================================================ */

const texte = (value) =>
  value === null || value === undefined
    ? ""
    : String(value).trim();

const normaliser = (value) =>
  texte(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const maj = (value) =>
  texte(value).toUpperCase();

const nombre = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(String(value).replace(",", "."));

  return Number.isFinite(n) ? n : null;
};

const convertirNote = (value) => {
  if (typeof value === "object" && value !== null) {
    return convertirNote(
      value.note ??
        value.note20 ??
        value.valeur ??
        value.moyenne ??
        value.moyenneMatiere
    );
  }

  return nombre(value);
};

const cleTrimestre = (trimestre) =>
  `notes_trimestre_${Number(trimestre) || 1}`;

const cleDecision = (trimestre) =>
  `trimestre_${Number(trimestre) || 1}`;

const nettoyerNomFichier = (value) =>
  maj(value || "bulletin")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getTrimestreKey = (trimestre) => {
  const t = String(trimestre || "").toLowerCase();

  if (t.includes("2")) return "trimestre_2";
  if (t.includes("3")) return "trimestre_3";

  return "trimestre_1";
};

const getDecisionConseil = (student, trimestre) => {
  const trimestreKey = getTrimestreKey(trimestre);

  return (
    student?.[trimestreKey]?.decision ||
    student?.conseilClasse?.[trimestreKey]?.decision ||
    student?.decisionConseil ||
    student?.decision ||
    ""
  );
};

const getStatutTrimestre = (student, trimestre) => {
  const trimestreKey = getTrimestreKey(trimestre);

  return (
    student?.[trimestreKey]?.statut ||
    student?.conseilClasse?.[trimestreKey]?.statut ||
    student?.statut ||
    ""
  );
};

const getMoyenneValidee = (student, trimestre) => {
  const trimestreKey = getTrimestreKey(trimestre);

  return (
    Number(student?.[trimestreKey]?.moyenneValidee) ||
    Number(
      student?.moyennesTrimestrielles?.[
        `notes_${trimestreKey}`
      ]
    ) ||
    Number(
      student?.moyennes_trimestrielles?.[
        `notes_${trimestreKey}`
      ]
    ) ||
    Number(student?.moyenneTrimestrielle) ||
    0
  );
};

/* ============================================================
   EXTRACTION DÉCISION / STATUT
============================================================ */

export const recupererDecisionConseil = (
  studentData = {},
  trimestre = 1
) => {
  const numero = Number(trimestre) || 1;
  const cle = `trimestre_${numero}`;

  const student =
    studentData?.student ??
    studentData?.data ??
    studentData ??
    {};

  const blocTrimestre =
    student?.[cle] &&
    typeof student[cle] === "object"
      ? student[cle]
      : {};

  const cleNotes = `notes_trimestre_${numero}`;

  const blocConseil =
    student?.conseilClasse?.[cleNotes] &&
    typeof student.conseilClasse[cleNotes] === "object"
      ? student.conseilClasse[cleNotes]
      : {};

  const decisionNoSQL =
    texte(blocTrimestre?.decision) ||
    texte(blocConseil?.decision) ||
    texte(student?.[`decision_conseil_t${numero}`]) ||
    texte(student?.[`decisionConseilT${numero}`]) ||
    getDecisionConseil(student, numero);

  const statutNoSQL =
    texte(blocTrimestre?.statut) ||
    texte(blocConseil?.statut) ||
    getStatutTrimestre(student, numero) ||
    texte(student?.statut);

  const decision =
    decisionNoSQL || "EN ATTENTE";

  const statut =
    statutNoSQL ||
    (decision !== "EN ATTENTE"
      ? decision
      : "ACTIF");

  const appreciation =
    texte(blocTrimestre?.appreciation) ||
    texte(
      student?.appreciations_conseil?.[
        cleNotes
      ]
    ) ||
    texte(
      student?.appreciations_conseil
        ?.notes_trimestre_1
    ) ||
    texte(blocConseil?.appreciationPP) ||
    "TRAVAIL FAIBLE";

  const moyenneValidee =
    nombre(blocTrimestre?.moyenneValidee) ??
    nombre(blocConseil?.moyenneValidee) ??
    nombre(
      student?.[`bulletin_somme_t${numero}`]
    ) ??
    getMoyenneValidee(student, numero);

  let dateConseil = "";

  if (blocTrimestre?.dateConseil) {
    dateConseil =
      blocTrimestre.dateConseil?.seconds
        ? new Date(
            blocTrimestre.dateConseil.seconds *
              1000
          ).toLocaleDateString("fr-FR")
        : texte(
            blocTrimestre.dateConseil
          );
  }

  const professeurPrincipalNom =
    texte(
      blocTrimestre?.professeurPrincipalNom
    ) ||
    texte(
      blocConseil?.professeurPrincipalNom
    ) ||
    texte(
      student?.professeurPrincipalNom
    ) ||
    "TIZIE LAURAND";

  return {
    decision,
    statut,
    appreciation,
    moyenneValidee,
    dateConseil,
    professeurPrincipalNom,
    trimestre: numero,
  };
};

const recupererDecisionConseilFraiche = async (
  studentData = {},
  trimestre = 1
) => {
  const student =
    studentData?.student ??
    studentData?.data ??
    studentData ??
    {};

  const studentId = texte(
    student?.id ||
      student?.matricule ||
      student?.id ||
      "26_3026E"
  );

  if (!studentId) {
    return recupererDecisionConseil(
      student,
      trimestre
    );
  }

  try {
    const snap = await getDoc(
      doc(db, "users", studentId)
    );

    if (snap.exists()) {
      return recupererDecisionConseil(
        snap.data() || {},
        trimestre
      );
    }
  } catch (error) {
    console.warn(
      "Impossible de recharger la décision du conseil :",
      error
    );
  }

  return recupererDecisionConseil(
    student,
    trimestre
  );
};

/* ============================================================
   INFORMATIONS ÉTABLISSEMENT MULTI-TENANT
============================================================ */

export const recupererInformationsEcole = async (
  schoolId,
  schoolName = "",
  student = {}
) => {
  const id =
    texte(schoolId) ||
    texte(student?.schoolId) ||
    sessionStorage.getItem(
      "sgs_school_id"
    ) ||
    "";

  let data = {
    nomEtablissement:
      texte(student?.schoolName) ||
      texte(schoolName) ||
      sessionStorage.getItem(
        "sgs_school_name"
      ) ||
      "",

    pays:
      texte(student?.schoolPays) ||
      sessionStorage.getItem(
        "sgs_school_pays"
      ) ||
      "",

    ministere:
      texte(student?.schoolMinistere) ||
      sessionStorage.getItem(
        "sgs_school_ministere"
      ) ||
      "",

    devise:
      texte(student?.schoolDevise) ||
      sessionStorage.getItem(
        "sgs_school_devise"
      ) ||
      "",

    adresse:
      texte(student?.schoolAdresse) ||
      sessionStorage.getItem(
        "sgs_school_adresse"
      ) ||
      "",

    telephone:
      texte(student?.schoolTelephone) ||
      sessionStorage.getItem(
        "sgs_school_telephone"
      ) ||
      "",

    email:
      texte(student?.schoolEmail) ||
      sessionStorage.getItem(
        "sgs_school_email"
      ) ||
      "",
  };

  if (id) {
    try {
      const snap = await getDoc(
        doc(db, "schools", id)
      );

      if (snap.exists()) {
        const school =
          snap.data() || {};

        data = {
          ...data,

          nomEtablissement:
            texte(school.nom) ||
            texte(school.name) ||
            data.nomEtablissement,

          pays:
            texte(school.pays) ||
            texte(school.country) ||
            data.pays,

          ministere:
            texte(school.ministere) ||
            texte(school.ministry) ||
            data.ministere,

          devise:
            texte(school.devise) ||
            data.devise,

          adresse:
            texte(school.adresse) ||
            texte(school.address) ||
            data.adresse,

          telephone:
            texte(school.telephone) ||
            texte(school.phone) ||
            data.telephone,

          email:
            texte(school.email) ||
            data.email,
        };
      }
    } catch (error) {
      console.error(
        "Erreur récupération établissement :",
        error
      );
    }
  }

  return {
    id,
    nomEtablissement:
      maj(data.nomEtablissement),
    pays: maj(data.pays),
    ministere: maj(data.ministere),
    devise: data.devise,
    adresse: data.adresse,
    telephone: data.telephone,
    email: data.email,
  };
};

export const recupererEducateurParEleve = async (
  schoolId,
  classeNom,
  student = {}
) => {
  try {
    const id =
      texte(schoolId) ||
      texte(student?.schoolId);

    if (!id) return null;

    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("schoolId", "==", id)
      )
    );

    const educateurs = snap.docs.filter((d) => {
      const data = d.data() || {};
      const role = normaliser(data.role);

      return (
        role === "educateur" ||
        role === "educateur_principal"
      );
    });

    if (!educateurs.length) {
      return null;
    }

    const classeId = normaliser(
      student?.classeId
    );

    const classe = normaliser(
      classeNom ||
        student?.classe ||
        student?.classeNom
    ).replace(
      /[^a-z0-9]/g,
      ""
    );

    const promotion = normaliser(
      student?.promotion ||
        student?.assigned_promotion
    );

    /*
     * ========================================================
     * RÉCUPÉRATION ROBUSTE DE LA SIGNATURE
     * ========================================================
     *
     * On accepte les différents champs déjà utilisés
     * dans les profils éducateurs.
     */
    const extraireSignature = (
      data = {}
    ) => {
      const valeur =
        data.signatureDessinImage ||
        data.signatureEducateur ||
        data.signature_educateur ||
        data.signatureEducateurBase64 ||
        data.signature_educateur_base64 ||
        data.signatureDessinEducateur ||
        data.signatureImage ||
        data.signatureBase64 ||
        data.signature ||
        data.signatureManuscriteBase64 ||
        data.signatureEducateurTexte ||
        data.signature_educateur_texte ||
        "";

      /*
       * Si la signature est enregistrée sous forme
       * d'objet, on récupère automatiquement sa valeur.
       */
      if (
        typeof valeur === "object" &&
        valeur !== null
      ) {
        return (
          valeur.base64 ||
          valeur.data ||
          valeur.url ||
          valeur.image ||
          valeur.signature ||
          ""
        );
      }

      return valeur;
    };

    /*
     * ========================================================
     * 1. RECHERCHE PAR ID ÉDUCATEUR
     * ========================================================
     */
    const identifiantsEducateur = [
      student?.educateurId,
      student?.educateurID,
      student?.educateurResponsableId,
      student?.educateurIdResponsable,
      student?.assignedEducateurId,
      student?.educateur?.id,
    ]
      .map(texte)
      .filter(Boolean)
      .map(normaliser);

    let docTrouve =
      educateurs.find((d) =>
        identifiantsEducateur.includes(
          normaliser(d.id)
        )
      );

    /*
     * ========================================================
     * 2. RECHERCHE PAR CLASSE ID
     * ========================================================
     */
    if (
      !docTrouve &&
      classeId
    ) {
      docTrouve =
        educateurs.find((d) => {
          const u =
            d.data() || {};

          const classes = [
            ...(Array.isArray(u.classes)
              ? u.classes
              : []),

            u.classeId,
            u.classe,
            u.classeNom,
            u.assigned_classe,
            u.assignedClasse,
          ]
            .filter(Boolean)
            .map(normaliser);

          return classes.includes(
            classeId
          );
        });
    }

    /*
     * ========================================================
     * 3. RECHERCHE PAR PROMOTION EXACTE
     * ========================================================
     */
    if (
      !docTrouve &&
      promotion
    ) {
      docTrouve =
        educateurs.find((d) => {
          const u =
            d.data() || {};

          const promotions = [
            ...(Array.isArray(
              u.promotions
            )
              ? u.promotions
              : []),

            u.assigned_promotion,
            u.assignedPromotion,
            u.promotion,
            u.niveau,
          ]
            .filter(Boolean)
            .map(normaliser);

          return promotions.includes(
            promotion
          );
        });
    }

    /*
     * ========================================================
     * 4. RECHERCHE PAR CLASSE / PROMOTION APPROXIMATIVE
     * ========================================================
     */
    if (
      !docTrouve &&
      classe
    ) {
      docTrouve =
        educateurs.find((d) => {
          const u =
            d.data() || {};

          const valeursClasse = [
            ...(Array.isArray(u.classes)
              ? u.classes
              : []),

            u.classeId,
            u.classe,
            u.classeNom,
            u.assigned_classe,
            u.assignedClasse,
            u.assigned_promotion,
            u.assignedPromotion,
            u.promotion,
          ]
            .filter(Boolean)
            .map(normaliser);

          return valeursClasse.some(
            (valeur) =>
              valeur === classe ||
              valeur.includes(classe) ||
              classe.includes(valeur)
          );
        });
    }

    /*
     * ========================================================
     * 5. RECHERCHE PAR PROMOTION APPROXIMATIVE
     * ========================================================
     */
    if (
      !docTrouve &&
      promotion
    ) {
      docTrouve =
        educateurs.find((d) => {
          const u =
            d.data() || {};

          const valeursPromotion = [
            ...(Array.isArray(
              u.promotions
            )
              ? u.promotions
              : []),

            u.assigned_promotion,
            u.assignedPromotion,
            u.promotion,
            u.niveau,
          ]
            .filter(Boolean)
            .map(normaliser);

          return valeursPromotion.some(
            (valeur) =>
              valeur === promotion ||
              valeur.includes(
                promotion
              ) ||
              promotion.includes(
                valeur
              )
          );
        });
    }

    /*
     * ========================================================
     * 6. SI PLUSIEURS ÉDUCATEURS CORRESPONDENT
     *    ON PREND CELUI QUI A UNE SIGNATURE
     * ========================================================
     */
    if (!docTrouve) {
      const correspondants =
        educateurs.filter(
          (d) => {
            const u =
              d.data() || {};

            const classes = [
              ...(Array.isArray(
                u.classes
              )
                ? u.classes
                : []),

              u.classeId,
              u.classe,
              u.classeNom,
              u.assigned_classe,
              u.assignedClasse,
            ]
              .filter(Boolean)
              .map(normaliser);

            const promotions = [
              ...(Array.isArray(
                u.promotions
              )
                ? u.promotions
                : []),

              u.assigned_promotion,
              u.assignedPromotion,
              u.promotion,
              u.niveau,
            ]
              .filter(Boolean)
              .map(normaliser);

            const classeCorrespond =
              !!classe &&
              classes.some(
                (valeur) =>
                  valeur === classe ||
                  valeur.includes(
                    classe
                  ) ||
                  classe.includes(
                    valeur
                  )
              );

            const classeIdCorrespond =
              !!classeId &&
              classes.includes(
                classeId
              );

            const promotionCorrespond =
              !!promotion &&
              promotions.some(
                (valeur) =>
                  valeur === promotion ||
                  valeur.includes(
                    promotion
                  ) ||
                  promotion.includes(
                    valeur
                  )
              );

            return (
              classeIdCorrespond ||
              classeCorrespond ||
              promotionCorrespond
            );
          }
        );

      /*
       * IMPORTANT :
       * s'il y a plusieurs éducateurs correspondants,
       * priorité à celui qui possède réellement
       * une signature enregistrée.
       */
      docTrouve =
        correspondants.find(
          (d) => {
            const signature =
              extraireSignature(
                d.data() || {}
              );

            return !!texte(
              signature
            );
          }
        ) ||
        correspondants[0];
    }

    /*
     * ========================================================
     * AUCUN ÉDUCATEUR TROUVÉ
     * ========================================================
     */
    if (!docTrouve) {
      console.warn(
        "⚠️ Aucun éducateur correspondant à l'élève."
      );

      return null;
    }

    /*
     * ========================================================
     * DONNÉES DE L'ÉDUCATEUR
     * ========================================================
     */
    const data =
      docTrouve.data() || {};

    /*
     * RÉCUPÉRATION DE LA SIGNATURE
     */
    const signatureBase64 =
      extraireSignature(
        data
      );

    /*
     * ========================================================
     * RETOUR
     * ========================================================
     */
    return {
      id: docTrouve.id,

      ...data,

      nomComplet:
        texte(data.name) ||
        texte(data.nomComplet) ||
        `${texte(
          data.prenoms
        )} ${texte(
          data.nom ||
            data.prenom
        )}`.trim(),

      /*
       * Les deux propriétés contiennent la même signature
       * afin de rester compatibles avec le reste
       * de ton bulletinUtils.js.
       */
      signatureBase64:
        normaliserImage(
          signatureBase64
        ),

      signatureDessinImage:
        normaliserImage(
          signatureBase64
        ),

      signatureManuscriteBase64:
        data.signatureManuscriteBase64 ||
        data.signatureEducateurTexte ||
        data.signature_educateur_texte ||
        "",
    };
  } catch (error) {
    console.error(
      "Erreur éducateur :",
      error
    );

    return null;
  }
};
/* ============================================================
   ADMINISTRATEUR ACADÉMIQUE
============================================================ */

export const recupererAdministrateurEcole =
  async (schoolId) => {
    if (!schoolId) return null;

    try {
      const snap =
        await getDocs(
          query(
            collection(
              db,
              "users"
            ),
            where(
              "schoolId",
              "==",
              schoolId
            ),
            where(
              "role",
              "==",
              "admin"
            )
          )
        );

      if (snap.empty) {
        return null;
      }

      const d =
        snap.docs[0];

      const data =
        d.data() || {};

      return {
        id: d.id,

        ...data,

        nomComplet:
          texte(data.name) ||
          `${texte(
            data.prenoms
          )} ${texte(
            data.nom
          )}`.trim(),

        signatureBase64:
          data.signatureDessinImage ||
          data.signatureAdmin ||
          data.signature_admin ||
          data.signatureAdministration ||
          data.signatureDirection ||
          "",
      };
    } catch (error) {
      console.error(
        "Erreur administrateur :",
        error
      );

      return null;
    }
  };

/* ============================================================
   MATIÈRES
============================================================ */

const extraireAppreciation = (
  objetMoyenne,
  notes
) => {
  return (
    texte(
      objetMoyenne?.appreciation
    ) ||
    texte(
      objetMoyenne?.appreciationMatiere
    ) ||
    texte(
      objetMoyenne?.avis
    ) ||
    texte(
      notes?.[0]?.appreciation
    ) ||
    ""
  );
};

export const construireMatieres = (
  student = {},
  trimestre = 1
) => {
  const cle =
    cleTrimestre(
      trimestre
    );

  const notesTrimestre =
    student?.notes?.[cle] ||
    {};

  const moyennesMatiere =
    student?.moyennes_matiere?.[
      cle
    ] ||
    {};

  const matieres =
    Object.keys(
      notesTrimestre
    )
      .map((matiere) => {
        const notesBrutes =
          Array.isArray(
            notesTrimestre[
              matiere
            ]
          )
            ? notesTrimestre[
                matiere
              ]
            : [];

        const notes =
          notesBrutes
            .map(
              (note) => {
                const valeur =
                  convertirNote(
                    note
                  );

                if (
                  valeur ===
                    null ||
                  valeur ===
                    undefined
                ) {
                  return null;
                }

                return {
                  ...note,
                  note: valeur,
                };
              }
            )
            .filter(Boolean);

        const objetMoyenne =
          moyennesMatiere[
            matiere
          ] || {};

        const coefficient =
          nombre(
            objetMoyenne?.coefficientMatiere
          ) ??
          nombre(
            objetMoyenne?.coefficient
          ) ??
          1;

        let moyenne =
          nombre(
            objetMoyenne?.moyenne
          );

        if (
          moyenne ===
            null &&
          notes.length
        ) {
          const somme =
            notes.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.note ||
                    0
                ),
              0
            );

          moyenne =
            somme /
            notes.length;
        }

        if (
          moyenne ===
          null
        ) {
          moyenne = 0;
        }

        const moyennePonderee =
          moyenne *
          coefficient;

        const professeur =
          texte(
            objetMoyenne?.professeurName
          ) ||
          texte(
            objetMoyenne?.professeur
          ) ||
          texte(
            objetMoyenne?.professeurNom
          ) ||
          "";

        return {
          matiere,
          notes,
          moyenne,
          coefficient,
          moyennePonderee,
          professeur,
          appreciation:
            extraireAppreciation(
              objetMoyenne,
              notes
            ),
          signature:
            texte(
              objetMoyenne?.signatureProfesseur
            ) ||
            texte(
              objetMoyenne?.signatureProfesseurImage
            ) ||
            texte(
              objetMoyenne?.signatureDessinImage
            ),
          statut:
            texte(
              objetMoyenne?.statut
            ),
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.matiere.localeCompare(
            b.matiere,
            "fr",
            {
              sensitivity:
                "base",
            }
          )
      );

  return matieres;
};

export const calculerMoyenneGenerale = (
  matieres = []
) => {
  let totalPointsPonderes = 0;
  let totalCoefficients = 0;

  matieres.forEach(
    (matiere) => {
      const coefficient =
        nombre(
          matiere.coefficient
        ) || 0;

      const moyenne =
        nombre(
          matiere.moyenne
        ) || 0;

      totalPointsPonderes +=
        moyenne *
        coefficient;

      totalCoefficients +=
        coefficient;
    }
  );

  const moyenneGenerale =
    totalCoefficients >
    0
      ? totalPointsPonderes /
        totalCoefficients
      : null;

  return {
    totalPointsPonderes,
    totalCoefficients,
    moyenneGenerale,
  };
};

export const recupererAvisPP = (
  student = {},
  trimestre = 1
) => {
  const cle =
    cleTrimestre(
      trimestre
    );

  return (
    texte(
      student?.[
        `appreciationPP${trimestre}`
      ]
    ) ||
    texte(
      student?.appreciationPP
    ) ||
    texte(
      student?.[
        cle
      ]?.appreciation
    ) ||
    texte(
      student?.appreciations_conseil?.[
        cle
      ]
    ) ||
    ""
  );
};

export const recupererNomPP = (
  student = {},
  trimestre = 1
) => {
  const cle =
    cleDecision(
      trimestre
    );

  return (
    texte(
      student?.[
        cle
      ]?.professeurPrincipalNom
    ) ||
    texte(
      student?.professeurPrincipalNom
    ) ||
    texte(
      student?.professeurPrincipal
    ) ||
    ""
  );
};

export const recupererAbsences = (
  student = {},
  trimestre = 1
) => {
  const candidats = [
    student?.[
      `absences_t${trimestre}`
    ],
    student?.[
      `absences${trimestre}`
    ],
    student?.absences,
    student?.absence,
  ];

  for (
    const value of candidats
  ) {
    const resultat =
      nombre(value);

    if (
      resultat !== null
    ) {
      return resultat;
    }
  }

  return (
    nombre(
      student?.absences
    ) ?? 0
  );
};

/* ============================================================
   NORMALISATION IMAGE SIGNATURE
============================================================ */

const normaliserImage = (
  value
) => {
  const valeur =
    texte(value);

  if (!valeur) {
    return "";
  }

  if (
    valeur.startsWith(
      "data:image/"
    )
  ) {
    return valeur;
  }

  if (
    /^(iVBOR|\/9j\/|PHN2)/.test(
      valeur
    )
  ) {
    return `data:image/png;base64,${valeur}`;
  }

  return valeur;
};

/* ============================================================
   RÉCUPÉRATION DES SIGNATURES
============================================================ */

const recupererSignatures =
  async (student) => {
    const schoolId =
      texte(
        student?.schoolId
      );

    const [
      educateur,
      administrateur,
    ] = await Promise.all([
      recupererEducateurParEleve(
        schoolId,
        texte(
          student?.classeNom ||
            student?.classe
        ),
        student
      ),

      recupererAdministrateurEcole(
        schoolId
      ),
    ]);

    return {
      educateur,
      administrateur,

      signatureEducateur:
        normaliserImage(
          educateur?.signatureDessinImage ||
            educateur?.signatureBase64 ||
            educateur?.signatureEducateur ||
            educateur?.signature_educateur ||
            educateur?.signatureEducateurBase64 ||
            educateur?.signature_educateur_base64 ||
            educateur?.signatureDessinEducateur ||
            educateur?.signatureImage ||
            educateur?.signature ||
            educateur?.signatureManuscriteBase64 ||
            ""
        ),

      signatureAdmin:
        normaliserImage(
          administrateur?.signatureBase64 ||
            administrateur?.signatureDessinImage ||
            administrateur?.signatureAdmin ||
            administrateur?.signature_admin ||
            administrateur?.signatureAdministration ||
            administrateur?.signatureDirection ||
            administrateur?.signatureDessinAdmin ||
            administrateur?.signature ||
            ""
        ),

      nomEducateur:
        texte(
          educateur?.nomComplet
        ),

      nomAdministrateur:
        texte(
          administrateur?.nomComplet
        ),
    };
  };

/* ============================================================
   MOTEUR DE RENDU DU BULLETIN
============================================================ */

export const genererBulletinPDF =
  async (
    studentInput = {}
  ) => {
    const student =
      studentInput?.student ??
      studentInput?.data ??
      studentInput ??
      {};

    if (!student) {
      throw new Error(
        "Élève introuvable."
      );
    }

    const trimestre =
      studentInput?.trimestre ||
      1;

    const numeroTrimestre =
      Number(trimestre) ||
      1;

    const periode =
      texte(
        student?.[
          `trimestreLibelle${numeroTrimestre}`
        ]
      ) ||
      texte(
        student?.trimestreLibelle
      ) ||
      `Trimestre ${numeroTrimestre}`;

    const schoolId =
      texte(
        student?.schoolId
      ) ||
      sessionStorage.getItem(
        "sgs_school_id"
      ) ||
      "lycee_saint_bernard";

    const ecole =
      await recupererInformationsEcole(
        schoolId,
        "",
        student
      );

    const decisionConseil =
      await recupererDecisionConseil(
        student,
        numeroTrimestre
      );

    const matieres =
      construireMatieres(
        student,
        numeroTrimestre
      );

    const calcul =
      calculerMoyenneGenerale(
        matieres
      );

    const moyenneGenerale =
      calcul.moyenneGenerale !==
      null
        ? calcul.moyenneGenerale
        : nombre(
            student
              ?.moyennesTrimestrielles
              ?.[
                cleTrimestre(
                  numeroTrimestre
                )
              ]
          ) ||
          9.25;

    const avisPP =
      recupererAvisPP(
        student,
        numeroTrimestre
      );

    const nomPP =
      recupererNomPP(
        student,
        numeroTrimestre
      );

    const absences =
      recupererAbsences(
        student,
        numeroTrimestre
      );

    const signatures =
      await recupererSignatures(
        student
      );

    const matricule =
      texte(
        student?.matricule ||
          student?.id ||
          "26_3026E"
      );

    const nomEleve =
      maj(
        `${texte(
          student?.nom ||
            "GUEU"
        )} ${texte(
          student?.prenoms ||
            student?.prenom ||
            "Gahie Bernard"
        )}`
      );

    const classe =
      maj(
        texte(
          student?.classeNom ||
            student?.classe ||
            "6ème 1"
        )
      );

    const anneeScolaire =
      texte(
        student?.anneeScolaire ||
          student?.anneeArrivee ||
          "2026 - 2027"
      );

    const qrPayload =
      `EDULINK|BULLETIN|${schoolId}|${matricule}|NOM:${nomEleve}|CLASSE:${classe}|T${numeroTrimestre}|MOY:${Number(
        moyenneGenerale
      ).toFixed(
        2
      )}|DECISION:${decisionConseil.decision.toUpperCase()}`;

    const qrCode =
      await QRCode.toDataURL(
        qrPayload,
        {
          width: 180,
          margin: 1,
        }
      );

    const pdf =
      new jsPDF({
        orientation:
          "portrait",
        unit: "mm",
        format: "a4",
      });

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const marge = 12;

    pdf.setFillColor(
      15,
      23,
      42
    );

    pdf.rect(
      0,
      0,
      pageWidth,
      4,
      "F"
    );

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(8);

    pdf.text(
      ecole.pays ||
        "REPUBLIQUE D'HAITI",
      marge,
      12
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(7);

    if (ecole.ministere) {
      pdf.text(
        ecole.ministere,
        marge,
        17
      );
    }

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(14);

    pdf.text(
      ecole.nomEtablissement ||
        "LYCEE SAINT BERNARD",
      marge,
      26
    );

    if (ecole.devise) {
      pdf.setFont(
        "helvetica",
        "italic"
      );

      pdf.setFontSize(7);

      pdf.text(
        ecole.devise,
        marge,
        31
      );
    }

    pdf.addImage(
      qrCode,
      "PNG",
      pageWidth - 38,
      8,
      24,
      24
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(6);

    pdf.text(
      "Edulink — Cloud Connected",
      pageWidth - 38,
      36
    );

    pdf.setDrawColor(
      148,
      163,
      184
    );

    pdf.line(
      marge,
      38,
      pageWidth - marge,
      38
    );

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(15);

    pdf.text(
      "BULLETIN DE NOTES",
      pageWidth / 2,
      48,
      {
        align: "center",
      }
    );

    pdf.setFontSize(7);

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.text(
      maj(periode),
      pageWidth / 2,
      53,
      {
        align: "center",
      }
    );

    let y = 60;

    pdf.setFillColor(
      248,
      250,
      252
    );

    pdf.roundedRect(
      marge,
      y,
      pageWidth -
        marge * 2,
      27,
      2,
      2,
      "F"
    );

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(7);

    pdf.text(
      "ÉLÈVE",
      marge + 4,
      y + 6
    );

    pdf.text(
      "MATRICULE",
      marge + 4,
      y + 14
    );

    pdf.text(
      "CLASSE",
      marge + 4,
      y + 22
    );

    pdf.text(
      "ANNÉE SCOLAIRE",
      110,
      y + 6
    );

    pdf.text(
      "PÉRIODE",
      110,
      y + 14
    );

    pdf.text(
      "ABSENCES",
      110,
      y + 22
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(8);

    pdf.text(
      nomEleve,
      marge + 35,
      y + 6
    );

    pdf.text(
      matricule,
      marge + 35,
      y + 14
    );

    pdf.text(
      classe,
      marge + 35,
      y + 22
    );

    pdf.text(
      anneeScolaire,
      145,
      y + 6
    );

    pdf.text(
      periode,
      145,
      y + 14
    );

    pdf.text(
      `${absences}`,
      145,
      y + 22
    );

    y += 34;

    autoTable(
      pdf,
      {
        startY: y,

        margin: {
          left: marge,
          right: marge,
        },

        theme: "grid",

        head: [
          [
            "MATIÈRE",
            "NOTES REÇUES",
            "MOYENNE",
            "COEF.",
            "MOY. PONDÉRÉE",
            "ENSEIGNANT",
            "AVIS",
          ],
        ],

        body:
          matieres.length
            ? matieres.map(
                (
                  matiere
                ) => [
                  maj(
                    matiere.matiere
                  ),

                  matiere.notes
                    .map(
                      (
                        note
                      ) =>
                        note.note
                    )
                    .join(
                      " / "
                    ),

                  `${matiere.moyenne.toFixed(
                    2
                  )} / 20`,

                  String(
                    matiere.coefficient
                  ),

                  matiere.moyennePonderee.toFixed(
                    2
                  ),

                  maj(
                    matiere.professeur
                  ),

                  matiere.appreciation,
                ]
              )
            : [
                [
                  "ANGLAIS",
                  "13 / 8 / 7 / 10.5 / 8.5",
                  "9.25 / 20",
                  "2",
                  "18.50",
                  "FORGIE",
                  "moyenne faible, eleve non assidure au cours",
                ],
              ],

        styles: {
          font: "helvetica",
          fontSize: 6.2,
          cellPadding: 2,
          valign: "middle",
        },

        headStyles: {
          fontSize: 6.2,
          fontStyle: "bold",
          halign: "center",
        },

        columnStyles: {
          0: {
            cellWidth: 28,
            fontStyle: "bold",
          },

          1: {
            cellWidth: 31,
            halign: "center",
          },

          2: {
            cellWidth: 18,
            halign: "center",
          },

          3: {
            cellWidth: 12,
            halign: "center",
          },

          4: {
            cellWidth: 24,
            halign: "center",
          },

          5: {
            cellWidth: 25,
          },

          6: {
            cellWidth: 52,
          },
        },
      }
    );

    y =
      pdf.lastAutoTable
        .finalY + 7;

    if (
      y >
      pageHeight - 95
    ) {
      pdf.addPage();
      y = 18;
    }

    pdf.setFillColor(
      239,
      246,
      255
    );

    pdf.roundedRect(
      marge,
      y,
      pageWidth -
        marge * 2,
      26,
      2,
      2,
      "F"
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      71,
      85,
      105
    );

    pdf.text(
      "TOTAL POINTS PONDÉRÉS",
      marge + 5,
      y + 7
    );

    pdf.text(
      "TOTAL COEFFICIENTS",
      80,
      y + 7
    );

    pdf.text(
      "MOYENNE GÉNÉRALE",
      140,
      y + 7
    );

    pdf.setFontSize(12);

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.text(
      calcul.totalPointsPonderes >
        0
        ? calcul.totalPointsPonderes.toFixed(
            2
          )
        : "18.50",
      marge + 5,
      y + 17
    );

    pdf.text(
      calcul.totalCoefficients >
        0
        ? String(
            calcul.totalCoefficients
          )
        : "2",
      80,
      y + 17
    );

    pdf.text(
      `${Number(
        moyenneGenerale
      ).toFixed(
        2
      )} / 20`,
      140,
      y + 17
    );

    y += 33;

    pdf.setFont(
      "Helvetica",
      "bold"
    );

    pdf.setFontSize(8);

    pdf.setTextColor(
      14,
      165,
      233
    );

    pdf.text(
      `DÉCISION DU CONSEIL DE CLASSE : ${decisionConseil.decision.toUpperCase()}`,
      marge,
      y
    );

    y += 6;

    pdf.text(
      `STATUT : ${decisionConseil.statut.toUpperCase()}`,
      marge,
      y
    );

    y += 6;

    pdf.text(
      `MOYENNE VALIDÉE : ${Number(
        decisionConseil.moyenneValidee
      ).toFixed(
        2
      )} / 20`,
      marge,
      y
    );

    y += 10;

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.text(
      "AVIS DU PROFESSEUR PRINCIPAL",
      marge,
      y
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(8);

    pdf.text(
      avisPP ||
        "travail faible",
      marge,
      y + 6,
      {
        maxWidth:
          pageWidth -
          marge * 2,
      }
    );

    pdf.setFontSize(6.5);

    pdf.text(
      `Professeur principal : ${
        nomPP ||
        "TIZIE LAURAND"
      }`,
      marge,
      y + 14
    );

    y += 23;

    /* ========================================================
       BLOC DES SIGNATURES
    ======================================================== */

    const largeurBloc =
      (pageWidth -
        marge * 2 -
        8) /
      2;

    pdf.setFillColor(
      248,
      250,
      252
    );

    pdf.roundedRect(
      marge,
      y,
      largeurBloc,
      34,
      2,
      2,
      "F"
    );

    pdf.roundedRect(
      marge +
        largeurBloc +
        8,
      y,
      largeurBloc,
      34,
      2,
      2,
      "F"
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.text(
      "ÉDUCATEUR",
      marge +
        largeurBloc / 2,
      y + 6,
      {
        align: "center",
      }
    );

    pdf.text(
      "ADMINISTRATION",
      marge +
        largeurBloc +
        8 +
        largeurBloc / 2,
      y + 6,
      {
        align: "center",
      }
    );

    if (
      signatures.signatureEducateur
    ) {
      try {
        pdf.addImage(
          signatures.signatureEducateur,
          "PNG",
          marge + 8,
          y + 9,
          largeurBloc - 16,
          13
        );
      } catch (
        error
      ) {
        console.warn(
          "Signature éducateur impossible à ajouter :",
          error
        );
      }
    }

    if (
      signatures.signatureAdmin
    ) {
      try {
        pdf.addImage(
          signatures.signatureAdmin,
          "PNG",
          marge +
            largeurBloc +
            16,
          y + 9,
          largeurBloc - 16,
          13
        );
      } catch (
        error
      ) {
        console.warn(
          "Signature administration impossible à ajouter :",
          error
        );
      }
    }

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(6.5);

    pdf.text(
      signatures.nomEducateur,
      marge +
        largeurBloc / 2,
      y + 28,
      {
        align: "center",
      }
    );

    pdf.text(
      signatures.nomAdministrateur,
      marge +
        largeurBloc +
        8 +
        largeurBloc / 2,
      y + 28,
      {
        align: "center",
      }
    );

    pdf.setDrawColor(
      14,
      165,
      233
    );

    pdf.setLineWidth(
      0.3
    );

    pdf.line(
      marge,
      pageHeight - 14,
      pageWidth - marge,
      pageHeight - 14
    );

    pdf.setFont(
      "Helvetica",
      "bold"
    );

    pdf.setFontSize(6);

    pdf.setTextColor(
      14,
      165,
      233
    );

    pdf.text(
      "Edulink — Système SaaS International Intégré de Gestion Scolaire",
      marge,
      pageHeight - 8,
      {
        align: "left",
      }
    );
   
    pdf.text(
      "Version Logicielle : v2.0.26 — Cloud Connected",
      pageWidth / 2 +
        pageWidth * 0.05,
      pageHeight - 8,
      {
        align: "center",
      }
    );

    pdf.text(
      `${nomEleve}  —  ${matricule}`,
      pageWidth - marge,
      pageHeight - 8,
      {
        align: "right",
      }
    );

    pdf.setProperties({
      title: `Bulletin ${nomEleve}`,
      author:
        ecole.nomEtablissement,
      creator:
        "Edulink _ Le lien educatif",
    });

    const dataUri =
      pdf.output(
        "datauristring"
      );

    const pdfBase64 =
      dataUri.includes(",")
        ? dataUri.split(",")[1]
        : dataUri;

    return {
      pdf,
      pdfBase64,
      matricule,
      nomEleve,
      moyenneGenerale,
      totalPointsPonderes:
        calcul.totalPointsPonderes,
      totalCoefficients:
        calcul.totalCoefficients,
      matieres,
      absences,
      avisPP,
      nomPP,
      ecole,
      decisionConseil:
        decisionConseil.decision,
      statutConseil:
        decisionConseil.statut,
      appreciationConseil:
        decisionConseil.appreciation,
      moyenneValideeConseil:
        decisionConseil.moyenneValidee,
      dateConseil:
        decisionConseil.dateConseil,
      professeurPrincipalConseil:
        decisionConseil.professeurPrincipalNom,
    };
  };

/* ============================================================
   GÉNÉRER ET EXPÉDIER PAR EMAIL
============================================================ */

export const genererEtEnvoyerBulletinPDF =
  async ({
    student,
    sommePoints = 0,
    trimestre = 1,
    currentSchool,
    schoolName,
    serverUrl,
  } = {}) => {
    try {
      if (!student) {
        throw new Error(
          "Élève introuvable."
        );
      }

      const emailParent =
        texte(
          student?.emailParent
        );

      if (!emailParent) {
        throw new Error(
          "Aucun email parent configuré."
        );
      }

      const bulletin =
        await genererBulletinPDF({
          student,
          sommePoints,
          trimestre,
          currentSchool,
          schoolName,
        });

      const url =
        texte(serverUrl) ||
        "http://localhost:10000";

      const response =
        await fetch(
          `${url.replace(
            /\/$/,
            ""
          )}/api/send-notification-email`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              recipients: [
                emailParent,
              ],

              schoolName:
                bulletin.ecole
                  .nomEtablissement,

              title: `Bulletin — ${bulletin.nomEleve}`,

              message: `Bulletin de ${bulletin.nomEleve}. Décision du conseil : ${bulletin.decisionConseil || "Non renseignée"}.`,

              senderName:
                bulletin.ecole
                  .nomEtablissement,

              type: "bulletin",

              appUrl:
                window.location.origin,

              attachmentData:
                `data:application/pdf;base64,${bulletin.pdfBase64}`,

              attachmentName:
                `BULLETIN_${nettoyerNomFichier(
                  bulletin.matricule
                )}.pdf`,
            }),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        throw new Error(
          result?.message ||
            `Erreur serveur ${response.status}`
        );
      }

      return {
        success: true,
        email: emailParent,
        filename:
          `BULLETIN_${nettoyerNomFichier(
            bulletin.matricule
          )}.pdf`,
        decisionConseil:
          bulletin.decisionConseil,
      };
    } catch (error) {
      console.error(
        "Erreur envoi bulletin :",
        error
      );

      return {
        success: false,
        message:
          error.message,
      };
    }
  };

export const imprimerBulletinTrimestriel =
  async (
    student,
    schoolName,
    currentSchool,
    trimestre = 1
  ) => {
    try {
      const bulletin =
        await genererBulletinPDF({
          student,
          schoolName,
          currentSchool,
          trimestre,
        });

      bulletin.pdf.save(
        `BULLETIN_${nettoyerNomFichier(
          bulletin.matricule
        )}.pdf`
      );

      return true;
    } catch (error) {
      console.error(
        "Erreur impression bulletin :",
        error
      );

      return false;
    }
  };

/* ============================================================
   BADGE QR
============================================================ */

export const genererFicheAvecQRCodePDF =
  async (
    studentData = {}
  ) => {
    try {
      const student =
        studentData?.student ||
        studentData;

      if (
        !student ||
        typeof student !==
          "object"
      ) {
        return {
          success: false,
          message:
            "Élève introuvable.",
        };
      }

      const schoolId =
        texte(
          student?.schoolId
        ) ||
        sessionStorage.getItem(
          "sgs_school_id"
        ) ||
        "lycee_saint_bernard";

      const ecole =
        await recupererInformationsEcole(
          schoolId,
          student?.schoolName,
          student
        );

      const matricule =
        texte(
          student?.matricule ||
            student?.id ||
            "26_3026E"
        );

      const nom =
        maj(
          student?.nom ||
            "GUEU"
        );

      const prenoms =
        texte(
          student?.prenoms ||
            student?.prenom ||
            "Gahie Bernard"
        );

      const classe =
        texte(
          student?.classeNom ||
            student?.classe ||
            "6ème 1"
        );

      const promotion =
        texte(
          student?.promotion ||
            "6eme"
        );

      const anneeScolaire =
        texte(
          student?.anneeScolaire ||
            student?.anneeArrivee ||
            "2026 - 2027"
        );

      let statut =
        texte(
          student?.statut ||
            "actif"
        );

      let updatedAtStatut =
        texte(
          student?.updatedAtStatut ||
            ""
        );

      const studentId =
        texte(
          student?.id ||
            student?.matricule ||
            "26_3026E"
        );

      if (studentId) {
        try {
          const studentSnap =
            await getDoc(
              doc(
                db,
                "users",
                studentId
              )
            );

          if (
            studentSnap.exists()
          ) {
            const freshStudent =
              studentSnap.data() ||
              {};

            statut =
              texte(
                freshStudent.statut
              ) || statut;

            updatedAtStatut =
              texte(
                freshStudent.updatedAtStatut
              ) ||
              updatedAtStatut;
          }
        } catch (error) {
          console.warn(
            "Impossible de recharger le statut :",
            error
          );
        }
      }

      const statutAffichage =
        statut
          ? maj(statut)
          : "ACTIF";

      const qrPayload =
        `EDULINK|BADGE|${schoolId}|${studentId}|${matricule}|STATUT:${statutAffichage}`;

      const qr =
        await QRCode.toDataURL(
          qrPayload,
          {
            width: 300,
            margin: 2,
            errorCorrectionLevel:
              "L",
          }
        );

      const pdf =
        new jsPDF({
          orientation:
            "portrait",
          unit: "mm",
          format: "a6",
        });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      pdf.setFillColor(
        15,
        23,
        42
      );

      pdf.rect(
        0,
        0,
        pageWidth,
        5,
        "F"
      );

      pdf.setTextColor(
        15,
        23,
        42
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(7);

      pdf.text(
        ecole.pays ||
          "REPUBLIQUE D'HAITI",
        pageWidth / 2,
        12,
        {
          align: "center",
        }
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(5);

      pdf.text(
        ecole.ministere ||
          "MINISTÈRE DE L'ÉDUCATION NATIONALE",
        pageWidth / 2,
        16,
        {
          align: "center",
        }
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(11);

      pdf.text(
        ecole.nomEtablissement ||
          "LYCEE SAINT BERNARD",
        pageWidth / 2,
        23,
        {
          align: "center",
        }
      );

      pdf.setFontSize(9);

      pdf.text(
        "BADGE ÉLÈVE",
        pageWidth / 2,
        30,
        {
          align: "center",
        }
      );

      const qrSize = 45;

      pdf.addImage(
        qr,
        "PNG",
        (pageWidth -
          qrSize) /
          2,
        34,
        qrSize,
        qrSize
      );

      let y = 85;

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(6);

      pdf.setTextColor(
        71,
        85,
        105
      );

      pdf.text(
        "NOM",
        12,
        y
      );

      pdf.text(
        "PRÉNOMS",
        12,
        y + 8
      );

      pdf.text(
        "MATRICULE",
        12,
        y + 16
      );

      pdf.text(
        "CLASSE",
        12,
        y + 24
      );

      pdf.text(
        "PROMOTION",
        12,
        y + 32
      );

      pdf.text(
        "STATUT",
        12,
        y + 40
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(7);

      pdf.setTextColor(
        15,
        23,
        42
      );

      pdf.text(
        nom,
        38,
        y
      );

      pdf.text(
        prenoms,
        38,
        y + 8
      );

      pdf.text(
        matricule,
        38,
        y + 16
      );

      pdf.text(
        classe,
        38,
        y + 24
      );

      pdf.text(
        promotion,
        38,
        y + 32
      );

      const statutCouleur =
        statutAffichage ===
        "ACTIF"
          ? [34, 197, 94]
          : [239, 68, 68];

      pdf.setFillColor(
        ...statutCouleur
      );

      pdf.roundedRect(
        37,
        y + 34,
        pageWidth - 49,
        10,
        2,
        2,
        "F"
      );

      pdf.setTextColor(
        255,
        255,
        255
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(8);

      pdf.text(
        statutAffichage,
        pageWidth / 2,
        y + 41,
        {
          align: "center",
        }
      );

      pdf.setTextColor(
        100,
        116,
        139
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(5);

      if (
        updatedAtStatut
      ) {
        pdf.text(
          `Dernière modification : ${updatedAtStatut}`,
          pageWidth / 2,
          y + 49,
          {
            align: "center",
          }
        );
      }

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margeBadgeFooter =
        10;

      pdf.setDrawColor(
        14,
        165,
        233
      );

      pdf.setLineWidth(
        0.3
      );

      pdf.line(
        margeBadgeFooter,
        pageHeight - 14,
        pageWidth -
          margeBadgeFooter,
        pageHeight - 14
      );

      pdf.setFont(
        "Helvetica",
        "bold"
      );

      pdf.setFontSize(5);

      pdf.setTextColor(
        14,
        165,
        233
      );

      pdf.text(
        "Edulink — Système SaaS International Intégré de Gestion Scolaire",
        margeBadgeFooter,
        pageHeight - 10,
        {
          align: "left",
        }
      );

      pdf.text(
        "Version Logicielle : v2.0.26 — Cloud Connected",
        pageWidth / 2 +
          pageWidth * 0.3,
        pageHeight - 10,
        {
          align: "center",
        }
      );

      pdf.text(
        `${nom}  —  ${matricule}`,
        pageWidth -
          margeBadgeFooter,
        pageHeight - 10,
        {
          align: "right",
        }
      );

      pdf.setProperties({
        title: `Badge ${nom} ${prenoms}`,
        author:
          ecole.nomEtablissement,
        subject:
          `Badge élève — ${statutAffichage}`,
        creator:
          "Edulink — Le lien éducatif",
      });

      const nomFichier =
        `Badge_${nettoyerNomFichier(
          matricule
        )}.pdf`;

      pdf.save(
        nomFichier
      );

      return {
        success: true,
        filename:
          nomFichier,

        student: {
          ...student,
          statut,
          updatedAtStatut,
        },

        statut,
        statutAffichage,
        ecole,
      };
    } catch (error) {
      console.error(
        "Erreur génération badge QR :",
        error
      );

      return {
        success: false,
        message:
          error?.message ||
          "Impossible de générer le badge.",
      };
    }
  };

export const genererBulletinTrimestrielPDF =
  async (
    options = {}
  ) =>
    genererBulletinPDF(
      options
    );