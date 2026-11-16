// src/utils/signaturesPDF.js

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../services/api";

/* ============================================================
   OUTILS
============================================================ */

const texte = (value) =>
  value === null ||
  value === undefined
    ? ""
    : String(value).trim();

const normaliser = (value) =>
  texte(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );

const normaliserImageSignature =
  (signature) => {
    const valeur =
      texte(signature);

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
      valeur.startsWith(
        "iVBOR"
      ) ||
      valeur.startsWith(
        "/9j/"
      ) ||
      valeur.startsWith(
        "PHN2"
      )
    ) {
      return `data:image/png;base64,${valeur}`;
    }

    return valeur;
  };

const nomComplet = (
  data = {}
) =>
  texte(data.name) ||
  `${texte(
    data.prenoms
  )} ${texte(
    data.nom ||
      data.nomFamille
  )}`.trim();

/* ============================================================
   DÉCISION DU CONSEIL
============================================================ */

export const recupererDecisionConseilPDF =
  async (
    student = {},
    trimestre = 1
  ) => {
    const numero =
      Number(trimestre) || 1;

    const cle =
      `trimestre_${numero}`;

    const cleNotes =
      `notes_trimestre_${numero}`;

    let source =
      student || {};

    /*
     * On recharge le document élève afin de récupérer
     * la décision la plus récente du conseil.
     */
    const studentId =
      texte(
        student?.id ||
          student?.matricule
      );

    if (studentId) {
      try {
        const snap =
          await getDoc(
            doc(
              db,
              "users",
              studentId
            )
          );

        if (
          snap.exists()
        ) {
          source =
            snap.data() || {};
        }
      } catch (error) {
        console.warn(
          "Impossible de recharger la décision du conseil :",
          error
        );
      }
    }

    const blocTrimestre =
      source?.[cle] &&
      typeof source[cle] ===
        "object"
        ? source[cle]
        : {};

    const blocConseil =
      source?.conseilClasse?.[
        cleNotes
      ] &&
      typeof source
        .conseilClasse[
          cleNotes
        ] === "object"
        ? source.conseilClasse[
            cleNotes
          ]
        : {};

    const decision =
      texte(
        blocTrimestre?.decision
      ) ||
      texte(
        blocConseil?.decision
      ) ||
      texte(
        source?.[
          `decision_conseil_t${numero}`
        ]
      ) ||
      texte(
        source?.[
          `decisionConseilT${numero}`
        ]
      ) ||
      "";

    const statut =
      texte(
        blocTrimestre?.statut
      ) ||
      texte(
        blocConseil?.statut
      ) ||
      decision ||
      "";

    const appreciation =
      texte(
        blocTrimestre?.appreciation
      ) ||
      texte(
        blocConseil?.appreciation
      ) ||
      texte(
        blocConseil?.appreciationPP
      ) ||
      "";

    const moyenneValidee =
      blocTrimestre
        ?.moyenneValidee ??
      blocConseil
        ?.moyenneValidee ??
      null;

    const dateConseil =
      texte(
        blocTrimestre?.dateConseil
      ) ||
      texte(
        blocConseil?.dateConseil
      );

    const professeurPrincipalNom =
      texte(
        blocTrimestre
          ?.professeurPrincipalNom
      ) ||
      texte(
        blocConseil
          ?.professeurPrincipalNom
      ) ||
      texte(
        source?.professeurPrincipalNom
      );

    return {
      decision,

      statut,

      appreciation,

      moyenneValidee,

      dateConseil,

      professeurPrincipalNom,

      trimestre:
        numero,
    };
  };

/* ============================================================
   ÉDUCATEUR
============================================================ */

export const recupererEducateurPourBulletin =
  async (
    student = {}
  ) => {
    try {
      const schoolId =
        texte(
          student?.schoolId
        ) ||
        sessionStorage.getItem(
          "sgs_school_id"
        ) ||
        "";

      if (!schoolId) {
        return null;
      }

      const classeId =
        normaliser(
          student?.classeId
        );

      const classeNom =
        normaliser(
          student?.classeNom ||
            student?.classe
        );

      const promotion =
        normaliser(
          student?.promotion
        );

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
              "educateur"
            )
          )
        );

      for (
        const docSnap of
          snap.docs
      ) {
        const data =
          docSnap.data() ||
          {};

        const classes =
          Array.isArray(
            data.classes
          )
            ? data.classes
            : [
                data.classeId,
                data.classe,
                data.classeNom,
                data.assignedClassId,
              ].filter(Boolean);

        const promotions =
          Array.isArray(
            data.promotions
          )
            ? data.promotions
            : [
                data.assigned_promotion,
                data.assignedPromotion,
                data.promotion,
              ].filter(Boolean);

        const classeCorrespond =
          classes.some(
            (value) => {
              const v =
                normaliser(
                  value
                );

              return (
                v === classeId ||
                v === classeNom
              );
            }
          );

        const promotionCorrespond =
          promotions.some(
            (value) =>
              normaliser(
                value
              ) === promotion
          );

        if (
          !classeCorrespond &&
          !promotionCorrespond
        ) {
          continue;
        }

        return construireEducateur(
          docSnap.id,
          data
        );
      }

      return null;
    } catch (error) {
      console.error(
        "Erreur récupération éducateur :",
        error
      );

      return null;
    }
  };

const construireEducateur =
  (
    id,
    data = {}
  ) => ({
    id,

    ...data,

    nomComplet:
      nomComplet(data),

    signatureDessinImage:
      normaliserImageSignature(
        data.signatureDessinImage ||
          data.signatureEducateur ||
          data.signature_educateur ||
          data.signatureEducateurBase64 ||
          data.signature_educateur_base64 ||
          data.signatureDessinEducateur ||
          data.signatureImage ||
          ""
      ),

    signatureManuscriteBase64:
      texte(
        data.signatureManuscriteBase64 ||
          data.signatureEducateurTexte ||
          data.signature_educateur_texte
      ),
  });

/* ============================================================
   ADMINISTRATION
============================================================ */

export const recupererAdministrateurPourBulletin =
  async (
    student = {}
  ) => {
    try {
      const schoolId =
        texte(
          student?.schoolId
        ) ||
        sessionStorage.getItem(
          "sgs_school_id"
        ) ||
        "";

      if (!schoolId) {
        return null;
      }

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

      const docSnap =
        snap.docs[0];

      if (!docSnap) {
        return null;
      }

      return construireAdministrateur(
        docSnap.id,
        docSnap.data() || {}
      );
    } catch (error) {
      console.error(
        "Erreur récupération administration :",
        error
      );

      return null;
    }
  };

const construireAdministrateur =
  (
    id,
    data = {}
  ) => ({
    id,

    ...data,

    nomComplet:
      nomComplet(data),

    signatureDessinImage:
      normaliserImageSignature(
        data.signatureDessinImage ||
          data.signatureAdmin ||
          data.signature_admin ||
          data.signatureAdministration ||
          data.signatureDirection ||
          data.signatureDessinAdmin ||
          ""
      ),

    signatureManuscriteBase64:
      texte(
        data.signatureManuscriteBase64 ||
          data.signatureAdminTexte ||
          data.signature_admin_texte
      ),
  });

/* ============================================================
   RÉCUPÉRER LES SIGNATURES
============================================================ */

export const recupererSignaturesBulletin =
  async (
    student = {}
  ) => {
    let sessionUser =
      {};

    try {
      sessionUser =
        JSON.parse(
          sessionStorage.getItem(
            "sgs_user"
          ) || "{}"
        );
    } catch {
      sessionUser = {};
    }

    const [
      educateur,
      administrateur,
    ] =
      await Promise.all([
        recupererEducateurPourBulletin(
          student
        ),

        recupererAdministrateurPourBulletin(
          student
        ),
      ]);

    const signatureEducateurSession =
      sessionStorage.getItem(
        "sgs_educ_canvas_img"
      ) || "";

    const signatureAdminSession =
      sessionStorage.getItem(
        "sgs_admin_canvas_img"
      ) || "";

    const signatureEducateur =
      normaliserImageSignature(
        educateur?.signatureDessinImage ||
          signatureEducateurSession
      );

    const signatureAdmin =
      normaliserImageSignature(
        administrateur?.signatureDessinImage ||
          signatureAdminSession
      );

    return {
      educateur,

      administrateur,

      signatureEducateur,

      signatureAdmin,

      nomEducateur:
        texte(
          educateur?.nomComplet
        ),

      nomAdministrateur:
        texte(
          administrateur?.nomComplet
        ),

      signatureEducateurTexte:
        texte(
          educateur?.signatureManuscriteBase64
        ),

      signatureAdminTexte:
        texte(
          administrateur?.signatureManuscriteBase64
        ),

      utilisateurConnecte:
        nomComplet(
          sessionUser
        ),
    };
  };

/* ============================================================
   AJOUTER UNE SIGNATURE
============================================================ */

export const ajouterSignaturePDF =
  (
    pdf,
    signature,
    x,
    y,
    largeur = 55,
    hauteur = 22
  ) => {
    const image =
      normaliserImageSignature(
        signature
      );

    if (!image) {
      return false;
    }

    try {
      pdf.addImage(
        image,
        "PNG",
        x,
        y,
        largeur,
        hauteur,
        undefined,
        "FAST"
      );

      return true;
    } catch (error) {
      console.error(
        "Impossible d'ajouter la signature au PDF :",
        error
      );

      return false;
    }
  };

/* ============================================================
   AJOUTER LES SIGNATURES AU BULLETIN
============================================================ */

export const ajouterSignaturesBulletinPDF =
  async (
    pdf,
    {
      student = {},
      pageWidth = 210,
      pageHeight = 297,
      y =
        pageHeight - 55,
    } = {}
  ) => {
    const signatures =
      await recupererSignaturesBulletin(
        student
      );

    const marge = 15;

    const largeurBloc =
      75;

    const largeurSignature =
      55;

    const hauteurSignature =
      22;

    const xEducateur =
      marge;

    const xAdmin =
      pageWidth -
      marge -
      largeurBloc;

    pdf.setTextColor(
      0,
      0,
      0
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(8);

    pdf.text(
      "VISA DE L'ÉDUCATEUR",
      xEducateur,
      y
    );

    const signatureEducateurAjoutee =
      ajouterSignaturePDF(
        pdf,
        signatures.signatureEducateur,
        xEducateur,
        y + 4,
        largeurSignature,
        hauteurSignature
      );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(7);

    pdf.text(
      signatures.nomEducateur,
      xEducateur,
      y + 31
    );

    if (
      !signatureEducateurAjoutee
    ) {
      pdf.setTextColor(
        120,
        120,
        120
      );

      pdf.text(
        "Signature non enregistrée",
        xEducateur,
        y + 15
      );

      pdf.setTextColor(
        0,
        0,
        0
      );
    }

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(8);

    pdf.text(
      "VISA ADMINISTRATION",
      xAdmin,
      y
    );

    const signatureAdminAjoutee =
      ajouterSignaturePDF(
        pdf,
        signatures.signatureAdmin,
        xAdmin,
        y + 4,
        largeurSignature,
        hauteurSignature
      );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(7);

    pdf.text(
      signatures.nomAdministrateur,
      xAdmin,
      y + 31
    );

    if (
      !signatureAdminAjoutee
    ) {
      pdf.setTextColor(
        120,
        120,
        120
      );

      pdf.text(
        "Signature non enregistrée",
        xAdmin,
        y + 15
      );

      pdf.setTextColor(
        0,
        0,
        0
      );
    }

    return {
      signatureEducateurAjoutee,

      signatureAdminAjoutee,

      signatureEducateur:
        signatures.signatureEducateur,

      signatureAdmin:
        signatures.signatureAdmin,

      nomEducateur:
        signatures.nomEducateur,

      nomAdministrateur:
        signatures.nomAdministrateur,
    };
  };

/* ============================================================
   PRÉPARER LES DONNÉES DE SIGNATURE
============================================================ */

export const preparerDonneesSignaturePDF =
  async (
    student = {},
    trimestre = 1
  ) => {
    const [
      signatures,
      decisionConseil,
    ] =
      await Promise.all([
        recupererSignaturesBulletin(
          student
        ),

        recupererDecisionConseilPDF(
          student,
          trimestre
        ),
      ]);

    return {
      ...student,

      /* SIGNATURE ÉDUCATEUR */

      signatureEducateur:
        signatures.signatureEducateur,

      signature_educateur:
        signatures.signatureEducateur,

      signatureDessinEducateur:
        signatures.signatureEducateur,

      signatureEducateurBase64:
        signatures.signatureEducateur,

      /* SIGNATURE ADMIN */

      signatureAdmin:
        signatures.signatureAdmin,

      signature_admin:
        signatures.signatureAdmin,

      signatureDessinAdmin:
        signatures.signatureAdmin,

      signatureAdminBase64:
        signatures.signatureAdmin,

      /* NOMS */

      nomEducateur:
        signatures.nomEducateur,

      nomAdministrateur:
        signatures.nomAdministrateur,

      /* SIGNATURES TEXTE */

      signatureEducateurTexte:
        signatures.signatureEducateurTexte,

      signature_educateur_texte:
        signatures.signatureEducateurTexte,

      signatureAdminTexte:
        signatures.signatureAdminTexte,

      signature_admin_texte:
        signatures.signatureAdminTexte,

      /* ======================================================
         DÉCISION DU CONSEIL
      ====================================================== */

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

      trimestreConseil:
        decisionConseil.trimestre,
    };
  };

/* ============================================================
   PRÉPARER BULLETIN
============================================================ */

export const preparerBulletinPDF =
  async (
    student = {},
    options = {}
  ) => {
    const trimestre =
      Number(
        options?.trimestre ||
          student?.trimestre ||
          1
      ) || 1;

    const donnees =
      await preparerDonneesSignaturePDF(
        student,
        trimestre
      );

    return {
      ...options,

      student:
        donnees,

      signatureEducateur:
        donnees.signatureEducateur,

      signature_educateur:
        donnees.signature_educateur,

      signatureAdmin:
        donnees.signatureAdmin,

      signature_admin:
        donnees.signature_admin,

      /* DÉCISION */

      decisionConseil:
        donnees.decisionConseil,

      statutConseil:
        donnees.statutConseil,

      appreciationConseil:
        donnees.appreciationConseil,

      moyenneValideeConseil:
        donnees.moyenneValideeConseil,

      dateConseil:
        donnees.dateConseil,

      professeurPrincipalConseil:
        donnees.professeurPrincipalConseil,
    };
  };

/* ============================================================
   COMPATIBILITÉ
============================================================ */

export const genererFicheAvecQRCodePDF =
  async (
    student = {}
  ) => {
    const donnees =
      await preparerDonneesSignaturePDF(
        student,
        student?.trimestre || 1
      );

    return {
      success: true,

      student:
        donnees,

      signatureEducateur:
        donnees.signatureEducateur,

      signatureAdmin:
        donnees.signatureAdmin,

      /* DÉCISION DU CONSEIL */

      decisionConseil:
        donnees.decisionConseil,

      statutConseil:
        donnees.statutConseil,

      appreciationConseil:
        donnees.appreciationConseil,

      moyenneValideeConseil:
        donnees.moyenneValideeConseil,

      dateConseil:
        donnees.dateConseil,

      professeurPrincipalConseil:
        donnees.professeurPrincipalConseil,
    };
  };