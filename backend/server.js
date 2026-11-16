require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const app = express();

const PORT = process.env.PORT || 10000;

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

const EDULINK_APP_URL =
  process.env.EDULINK_APP_URL || 'http://localhost:5173';

/* =========================================================
   CORS ACCÈS TOTAL ET SÉCURISÉ
========================================================= */

app.use(
  cors({
    origin: function (origin, callback) {
      // Autorise absolument toutes les origines en développement (localhost:5173, 5174, etc.)
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

/* =========================================================
   BODY
========================================================= */

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* =========================================================
   UTILITAIRES
========================================================= */

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const normaliserEmail = (email) =>
  String(email || '').trim().toLowerCase();

const emailValide = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normaliserEmail(email)
  );

/*
 * Conserve une présentation cohérente :
 * NOM Prénom
 *
 * Si le front fournit déjà name, on le conserve.
 * Si le front fournit nom + prenoms, on construit
 * automatiquement "Nom Prénom".
 */
const construireNomPersonne = (personne = {}) => {
  const nom =
    String(
      personne.nom ||
      personne.lastName ||
      ''
    ).trim();

  const prenoms =
    String(
      personne.prenoms ||
      personne.prenom ||
      personne.firstName ||
      ''
    ).trim();

  const name =
    String(
      personne.name ||
      personne.displayName ||
      personne.nomComplet ||
      ''
    ).trim();

  if (name) {
    return name.replace(/\s+/g, ' ').trim();
  }

  return `${nom} ${prenoms}`
    .replace(/\s+/g, ' ')
    .trim();
};

/*
 * Nom de l'expéditeur.
 *
 * Le frontend doit envoyer senderName sous la forme :
 * "Nom Prénom".
 *
 * On ne remplace pas ce nom par "Utilisateur Edulink".
 */
const construireNomExpediteur = (data = {}) => {
  const nom =
    String(
      data.senderName ||
      data.expediteurNom ||
      data.name ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();

  if (nom) {
    return nom;
  }

  return 'Administration';
};

/* =========================================================
   SMTP
========================================================= */

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error(
      '❌ Connexion SMTP Gmail impossible :',
      error.message
    );
  } else {
    console.log(
      '📧 SMTP Gmail opérationnel ✔️'
    );
  }
});

/* =========================================================
   ROUTE BULLETIN PARENT
   POST /api/envoyer-bulletin-parent
========================================================= */

app.post(
  '/api/envoyer-bulletin-parent',
  async (req, res) => {
    try {
      const {
        to_email,
        parent_name,
        student_name,
        matricule,
        promotion,
        classeId,
        school_name,
        moyenne,
        absences,
        matieres,
        appreciationEducateur,
        appreciationConseil,
        appreciationProfesseurPrincipal,
        appreciationDirection,
        decisionConseil,
        signature_educateur,
        signature_admin,
        attachmentData,
        attachmentName,
        trimestre,
      } = req.body;

      /* -------------------------------------------------------
         VALIDATION
      ------------------------------------------------------- */

      const emailParent = normaliserEmail(to_email);

      if (!emailValide(emailParent)) {
        return res.status(400).json({
          success: false,
          message:
            "L'adresse e-mail du parent est invalide.",
        });
      }

      if (!attachmentData) {
        return res.status(400).json({
          success: false,
          message:
            'Le fichier PDF du bulletin est manquant.',
        });
      }

      /* -------------------------------------------------------
         PDF BASE64
      ------------------------------------------------------- */

      let base64 = String(attachmentData);

      if (base64.includes(',')) {
        base64 =
          base64.substring(
            base64.indexOf(',') + 1
          );
      }

      base64 = base64
        .replace(/\s/g, '')
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const pdfBuffer = Buffer.from(
        base64,
        'base64'
      );

      if (!pdfBuffer.length) {
        return res.status(400).json({
          success: false,
          message:
            'Impossible de décoder le bulletin PDF.',
        });
      }

      /* -------------------------------------------------------
         DONNÉES
      ------------------------------------------------------- */

      const nomEtablissement =
        String(
          school_name ||
          'Établissement scolaire'
        ).trim();

      const nomEleve =
        String(
          student_name ||
          'Élève'
        ).trim();

      const nomParent =
        String(
          parent_name ||
          'Responsable légal'
        ).trim();

      const periode =
        String(
          trimestre ||
          'Trimestre académique'
        ).trim();

      const moyenneFinale =
        Number(moyenne || 0).toFixed(2);

      const listeMatieres =
        Array.isArray(matieres)
          ? matieres
          : [];

      const dateEnvoi =
        new Date().toLocaleString(
          'fr-FR',
          {
            dateStyle: 'full',
            timeStyle: 'short',
          }
        );

      /* -------------------------------------------------------
         TABLEAU DES MATIÈRES
      ------------------------------------------------------- */

const html = `
<!DOCTYPE html>
<html lang="fr">

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${escapeHtml(titreMessage)}
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#111111;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <div
    style="
      width:100%;
      padding:40px 15px;
      box-sizing:border-box;
      background:#111111;
    "
  >

    <!-- =====================================================
         CARTE PRINCIPALE
    ====================================================== -->

    <div
      style="
        max-width:760px;
        margin:0 auto;
        background:#1976a8;
        border:2px solid #155f87;
        border-radius:22px;
        overflow:hidden;
        box-shadow:0 8px 25px rgba(0,0,0,0.30);
      "
    >

      <!-- ===================================================
           LOGO EDULINK
      ==================================================== -->

      <div
        style="
          padding:55px 40px 35px;
          text-align:center;
        "
      >

        <div
          style="
            display:inline-block;
            background:#e8ecff;
            border-radius:20px;
            padding:25px 38px;
            color:#17627d;
            font-size:25px;
            line-height:1.3;
            font-weight:800;
            letter-spacing:4px;
          "
        >
          EDULINK — Le lien éducatif
        </div>

      </div>


      <!-- ===================================================
           DESTINATAIRE
      ==================================================== -->

      <div
        style="
          padding:25px 65px 0;
          color:#ffffff;
        "
      >

        <div
          style="
            font-size:22px;
            line-height:1.5;
            font-weight:700;
          "
        >
          ${escapeHtml(
            destinataire.name
          )}
        </div>

      </div>


      <!-- ===================================================
           OBJET
      ==================================================== -->

      <div
        style="
          padding:55px 65px 25px;
          text-align:center;
          color:#ffffff;
        "
      >

        <div
          style="
            font-size:34px;
            line-height:1.35;
            font-weight:800;
            letter-spacing:2px;
            word-break:break-word;
          "
        >
          ${escapeHtml(
            titreMessage
          )}
        </div>

      </div>


      <!-- ===================================================
           MESSAGE
      ==================================================== -->

      <div
        style="
          padding:35px 65px 20px;
          color:#ffffff;
        "
      >

        <div
          style="
            font-size:22px;
            line-height:1.9;
            white-space:pre-line;
            word-break:break-word;
          "
        >
          ${escapeHtml(
            contenuMessage
          )}
        </div>

      </div>


      <!-- ===================================================
           PIÈCE JOINTE
      ==================================================== -->

      ${
        mailAttachments.length > 0
          ? `
            <div
              style="
                padding:20px 65px;
              "
            >

              <div
                style="
                  background:rgba(255,255,255,0.12);
                  border:1px solid rgba(255,255,255,0.25);
                  border-radius:12px;
                  padding:15px 18px;
                  color:#ffffff;
                  font-size:14px;
                "
              >
                📎 Document joint à ce message
              </div>

            </div>
          `
          : ''
      }


      <!-- ===================================================
           LIEN EDULINK
      ==================================================== -->

      <div
        style="
          padding:30px 65px 45px;
          color:#ffffff;
        "
      >

        <div
          style="
            font-size:21px;
            line-height:1.7;
          "
        >
          Accéder à votre espace Ecole :
        </div>

        <div
          style="
            margin-top:5px;
            font-size:20px;
            line-height:1.6;
            word-break:break-all;
          "
        >

          <a
            href="${escapeHtml(
              EDULINK_APP_URL
            )}/login"
            style="
              color:#8fc8ff;
              text-decoration:underline;
            "
          >
            ${escapeHtml(
              EDULINK_APP_URL
            )}/login
          </a>

        </div>

      </div>


      <!-- ===================================================
           INFORMATIONS BAS DE MESSAGE
      ==================================================== -->

      <div
        style="
          padding:0 65px 55px;
          color:#ffffff;
        "
      >

        <div
          style="
            font-size:20px;
            line-height:1.7;
          "
        >
          ${escapeHtml(
            nomEtablissement
          )}
        </div>

        <div
          style="
            font-size:20px;
            line-height:1.7;
            font-weight:600;
          "
        >
          ${escapeHtml(
            nomExpediteur
          )}
        </div>

      </div>

    </div>

  </div>

</body>
</html>
`;
      /* -------------------------------------------------------
         ENVOI
      ------------------------------------------------------- */

      const info =
        await transporter.sendMail({
          from:
            `"${nomEtablissement}" <${GMAIL_USER}>`,

          to:
            emailParent,

          subject:
            `Bulletin scolaire officiel — ${nomEleve}`,

          html,

          attachments: [
            {
              filename:
                attachmentName ||
                `Bulletin_${nomEleve.replace(
                  /\s+/g,
                  '_'
                )}.pdf`,

              content:
                pdfBuffer,

              contentType:
                'application/pdf',
            },
          ],
        });

      console.log(
        '📨 Bulletin envoyé :',
        info.messageId
      );

      return res.status(200).json({
        success: true,
        message:
          `Bulletin envoyé avec succès à ${emailParent}.`,
        messageId:
          info.messageId,
      });

    } catch (error) {

      console.error(
        '❌ Erreur /api/envoyer-bulletin-parent :',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Erreur lors de l'envoi du bulletin.",
      });
    }
  }
);

/* =========================================================
   NOTIFICATIONS GÉNÉRALES
   ADMIN / PROFESSEUR / ÉDUCATEUR / ÉLÈVE / PARENT
========================================================= */

app.post(
  '/api/send-notification-email',
  async (req, res) => {
    try {

      const {
        recipients,
        schoolName,
        title,
        message,
        senderName,
        senderNom,
        senderPrenoms,
        attachmentData,
        attachmentName,
        type,
      } = req.body;

      /* -------------------------------------------------------
         VALIDATION
      ------------------------------------------------------- */

      if (
        !Array.isArray(recipients) ||
        recipients.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Aucun destinataire fourni.',
        });
      }

      /* -------------------------------------------------------
         DESTINATAIRES
      ------------------------------------------------------- */

      const mapRecipients = new Map();

      recipients.forEach((recipient) => {

        const emailCible =
          typeof recipient === 'string'
            ? recipient
            : (
                recipient?.email ||
                recipient?.destinataireEmail
              );

        const email =
          normaliserEmail(emailCible);

        if (!emailValide(email)) {
          return;
        }

        /*
         * IMPORTANT :
         * On récupère le vrai nom du destinataire.
         *
         * Priorité :
         * 1. name
         * 2. nomComplet
         * 3. nom + prenoms
         * 4. displayName
         */

        let nomDestinataire = '';

        if (
          typeof recipient !== 'string'
        ) {
          nomDestinataire =
            construireNomPersonne(
              recipient
            );
        }

        /*
         * Si aucun nom n'a été transmis,
         * on utilise uniquement l'adresse e-mail
         * comme dernier secours.
         *
         * On ne met PAS :
         * "Utilisateur Edulink"
         * "Message de votre établissement"
         */

        if (!nomDestinataire) {
          nomDestinataire = email;
        }

        if (!mapRecipients.has(email)) {

          mapRecipients.set(
            email,
            {
              email,
              name:
                nomDestinataire,
            }
          );

        }

      });

      const destinataires =
        Array.from(
          mapRecipients.values()
        );

      if (
        destinataires.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Aucun e-mail valide.',
        });
      }

      /* -------------------------------------------------------
         DONNÉES DU MESSAGE
      ------------------------------------------------------- */

      const nomEtablissement =
        String(
          schoolName ||
          'Établissement scolaire'
        )
          .replace(/\s+/g, ' ')
          .trim();

      const titreMessage =
        String(
          title ||
          'Notification scolaire'
        )
          .replace(/[\r\n]/g, '')
          .trim();

      const contenuMessage =
        String(
          message ||
          ''
        ).trim();

      /*
       * EXPÉDITEUR
       *
       * On conserve le nom transmis.
       * Le front doit envoyer :
       * Nom Prénom
       */
      const nomExpediteur =
        construireNomExpediteur({
          senderName,
          senderNom,
          senderPrenoms,
        });

      /* -------------------------------------------------------
         PIÈCE JOINTE
      ------------------------------------------------------- */

      const mailAttachments = [];

      if (
        attachmentData &&
        String(attachmentData).trim()
      ) {

        let base64 =
          String(attachmentData);

        if (
          base64.includes(',')
        ) {
          base64 =
            base64.substring(
              base64.indexOf(',') + 1
            );
        }

        base64 =
          base64
            .replace(/\s/g, '')
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const buffer =
          Buffer.from(
            base64,
            'base64'
          );

        if (
          buffer.length > 0
        ) {

          mailAttachments.push({
            filename:
              attachmentName ||
              'document-edulink.pdf',

            content:
              buffer,

            contentType:
              'application/pdf',
          });

        }

      }

      /* -------------------------------------------------------
         ENVOI
      ------------------------------------------------------- */

      await Promise.all(
        destinataires.map(
          async (destinataire) => {

            const html = `
<!DOCTYPE html>
<html lang="fr">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${escapeHtml(titreMessage)}
  </title>

</head>

<body
  style="
    margin:0;
    padding:0;
    background:#eef2f7;
    font-family:Arial,Helvetica,sans-serif;
    color:#172033;
  "
>

  <div
    style="
      width:100%;
      padding:45px 15px;
      box-sizing:border-box;
      background:#eef2f7;
    "
  >

    <div
      style="
        max-width:650px;
        margin:0 auto;
        background:#ffffff;
        border:1px solid #dfe5ec;
        border-radius:18px;
        overflow:hidden;
        box-shadow:0 10px 35px rgba(15,23,42,0.09);
      "
    >

      <!-- =================================================
           EN-TÊTE
      ================================================== -->

      <div
        style="
          background:#0f172a;
          padding:30px 32px;
          color:#ffffff;
        "
      >

        <div
          style="
            color:#fb923c;
            font-size:11px;
            font-weight:800;
            letter-spacing:2.5px;
            text-transform:uppercase;
            line-height:1.5;
          "
        >
          EDULINK — LE LIEN ÉDUCATIF
        </div>

        <div
          style="
            margin-top:10px;
            font-size:24px;
            line-height:1.35;
            font-weight:700;
            color:#ffffff;
            word-break:break-word;
          "
        >
          ${escapeHtml(
            nomEtablissement
          )}
        </div>

        <div
          style="
            margin-top:8px;
            color:#94a3b8;
            font-size:12px;
            line-height:1.6;
          "
        >
          Communication scolaire sécurisée
        </div>

      </div>


      <!-- =================================================
           CONTENU
      ================================================== -->

      <div
        style="
          padding:34px 32px;
        "
      >

        <!-- DESTINATAIRE -->

        <div
          style="
            margin-bottom:25px;
          "
        >

          <div
            style="
              font-size:10px;
              font-weight:800;
              letter-spacing:1.5px;
              text-transform:uppercase;
              color:#94a3b8;
              margin-bottom:7px;
            "
          >
            Destinataire
          </div>

          <div
            style="
              font-size:17px;
              line-height:1.5;
              font-weight:700;
              color:#111827;
            "
          >
            ${escapeHtml(
              destinataire.name
            )}
          </div>

          <div
            style="
              margin-top:4px;
              font-size:12px;
              color:#64748b;
            "
          >
            ${escapeHtml(
              destinataire.email
            )}
          </div>

        </div>


        <!-- OBJET -->

        <div
          style="
            padding-bottom:20px;
            margin-bottom:22px;
            border-bottom:1px solid #e5e7eb;
          "
        >

          <div
            style="
              font-size:10px;
              font-weight:800;
              letter-spacing:1.5px;
              text-transform:uppercase;
              color:#94a3b8;
              margin-bottom:8px;
            "
          >
            Objet du message
          </div>

          <div
            style="
              font-size:22px;
              line-height:1.4;
              font-weight:700;
              color:#111827;
              word-break:break-word;
            "
          >
            ${escapeHtml(
              titreMessage
            )}
          </div>

        </div>


        <!-- MESSAGE -->

        <div
          style="
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:14px;
            padding:22px;
            margin-bottom:24px;
          "
        >

          <div
            style="
              margin-bottom:11px;
              font-size:10px;
              font-weight:800;
              letter-spacing:1.4px;
              text-transform:uppercase;
              color:#94a3b8;
            "
          >
            Message
          </div>

          <div
            style="
              font-size:15px;
              line-height:1.85;
              color:#334155;
              white-space:pre-line;
              word-break:break-word;
            "
          >
            ${escapeHtml(
              contenuMessage
            )}
          </div>

        </div>


        <!-- PIÈCE JOINTE -->

        ${
          mailAttachments.length > 0
            ? `
              <div
                style="
                  background:#eff6ff;
                  border:1px solid #bfdbfe;
                  border-radius:12px;
                  padding:15px 17px;
                  margin-bottom:24px;
                "
              >

                <div
                  style="
                    color:#1d4ed8;
                    font-size:13px;
                    font-weight:800;
                    line-height:1.5;
                  "
                >
                  📎 Document joint
                </div>

                <div
                  style="
                    margin-top:4px;
                    color:#475569;
                    font-size:12px;
                    line-height:1.6;
                  "
                >
                  Un document a été joint à ce message.
                </div>

              </div>
            `
            : ''
        }


        <!-- =================================================
             EXPÉDITEUR
        ================================================== -->

        <div
          style="
            border-top:1px solid #e5e7eb;
            padding-top:20px;
          "
        >

          <div
            style="
              font-size:10px;
              font-weight:800;
              letter-spacing:1.4px;
              text-transform:uppercase;
              color:#94a3b8;
              margin-bottom:7px;
            "
          >
            Envoyé par
          </div>

          <div
            style="
              font-size:15px;
              line-height:1.5;
              font-weight:700;
              color:#111827;
            "
          >
            ${escapeHtml(
              nomExpediteur
            )}
          </div>

          <div
            style="
              margin-top:3px;
              color:#64748b;
              font-size:12px;
              line-height:1.5;
            "
          >
            ${escapeHtml(
              nomEtablissement
            )}
          </div>

        </div>


        <!-- BOUTON EDULINK -->

        <div
          style="
            text-align:center;
            margin-top:30px;
          "
        >

          <a
            href="${escapeHtml(
              EDULINK_APP_URL
            )}/login"
            style="
              display:inline-block;
              background:#0f172a;
              color:#ffffff;
              text-decoration:none;
              padding:14px 28px;
              border-radius:10px;
              font-size:13px;
              font-weight:800;
              letter-spacing:0.2px;
            "
          >
            🔐 Accéder à mon espace Edulink
          </a>

        </div>

      </div>


      <!-- =================================================
           PIED DE PAGE
      ================================================== -->

      <div
        style="
          background:#f8fafc;
          border-top:1px solid #e5e7eb;
          padding:21px 25px;
          text-align:center;
        "
      >

        <div
          style="
            color:#334155;
            font-size:12px;
            line-height:1.5;
            font-weight:800;
          "
        >
          ${escapeHtml(
            nomEtablissement
          )}
        </div>

        <div
          style="
            margin-top:6px;
            color:#94a3b8;
            font-size:10px;
            line-height:1.6;
          "
        >
          Message transmis par Edulink — Le lien éducatif.
        </div>

      </div>

    </div>

  </div>

</body>
</html>
`;

            await transporter.sendMail({
              from:
                `"${nomEtablissement}" <${GMAIL_USER}>`,

              to:
                destinataire.email,

              subject:
                titreMessage,

              html,

              attachments:
                mailAttachments,
            });

          }
        )
      );

      /* -------------------------------------------------------
         RÉPONSE
      ------------------------------------------------------- */

      console.log(
        `📧 Notification Edulink envoyée à ${destinataires.length} destinataire(s).`
      );

      return res.status(200).json({
        success: true,
        sent:
          destinataires.length,
        message:
          'Notifications envoyées avec succès.',
      });

    } catch (error) {

      console.error(
        '❌ Erreur /api/send-notification-email :',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Erreur lors de l'envoi de la notification.",
      });
    }
  }
);

/* =========================================================
   ABSENCE PARENT
========================================================= */

app.post(
  '/api/send-parent-absence-alert',
  async (req, res) => {
    try {

      const {
        emailParent,
        nomEleve,
        prenomsEleve,
        classe,
        dateAbsence,
        motif,
      } = req.body;

      if (!emailValide(emailParent)) {
        return res.status(400).json({
          success: false,
          message:
            'Adresse parent invalide.',
        });
      }

      const nomCompletEleve =
        `${String(nomEleve || '').trim()} ${String(
          prenomsEleve || ''
        ).trim()}`
          .replace(/\s+/g, ' ')
          .trim();

      await transporter.sendMail({

        from:
          `"Edulink — Le lien scolaire" <${GMAIL_USER}>`,

        to:
          normaliserEmail(emailParent),

        subject:
          `Notification d'absence — ${String(
            nomEleve || ''
          ).toUpperCase()}`,

        html: `
<!DOCTYPE html>

<html lang="fr">

<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#eef2f7;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <div
    style="
      max-width:650px;
      margin:40px auto;
      background:#ffffff;
      border-radius:16px;
      overflow:hidden;
      border:1px solid #e5e7eb;
    "
  >

    <div
      style="
        background:#0f172a;
        padding:28px;
        color:#ffffff;
      "
    >

      <div
        style="
          color:#fb923c;
          font-size:11px;
          font-weight:800;
          letter-spacing:2px;
        "
      >
        EDULINK
      </div>

      <h2
        style="
          margin:10px 0 0;
          font-size:24px;
        "
      >
        Notification d'absence
      </h2>

    </div>

    <div
      style="
        padding:30px;
        color:#334155;
      "
    >

      <p>
        Bonjour,
      </p>

      <p>
        L'élève
        <strong>
          ${escapeHtml(
            nomCompletEleve
          )}
        </strong>
        a été signalé absent.
      </p>

      <div
        style="
          padding:18px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
          border-radius:12px;
        "
      >

        <p>
          <strong>Classe :</strong>
          ${escapeHtml(classe || '')}
        </p>

        <p>
          <strong>Date :</strong>
          ${escapeHtml(dateAbsence || '')}
        </p>

        <p>
          <strong>Motif :</strong>
          ${escapeHtml(
            motif || 'Non renseigné'
          )}
        </p>

      </div>

      <p style="margin-top:25px;">

        <a
          href="${escapeHtml(
            EDULINK_APP_URL
          )}"
          style="
            display:inline-block;
            background:#dc2626;
            color:white;
            padding:12px 20px;
            border-radius:8px;
            text-decoration:none;
            font-weight:bold;
          "
        >
          Ouvrir Edulink
        </a>

      </p>

    </div>

  </div>

</body>
</html>
`,
      });

      return res.json({
        success: true,
        message:
          'Alerte parent envoyée avec succès.',
      });

    } catch (error) {

      console.error(
        "❌ Erreur d'envoi absence :",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Erreur d'envoi.",
      });
    }
  }
);

/* =========================================================
   QR CODE
========================================================= */

app.post(
  '/api/generate-qrcode',
  async (req, res) => {
    try {

      const { text } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message:
            'Texte QR manquant.',
        });
      }

      const dataUrl =
        await QRCode.toDataURL(
          String(text)
        );

      return res.json({
        success: true,
        dataUrl,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          'Erreur QR code.',
      });
    }
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get('/health', (req, res) => {

  res.status(200).json({
    success: true,
    message:
      '⚡ Serveur Edulink actif et connecté en temps réel.',
  });

});

/* =========================================================
   404
========================================================= */

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message:
      `Route API introuvable : ${req.method} ${req.originalUrl}`,
  });

});

/* =========================================================
   ERREUR EXPRESS
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      '❌ Erreur Express :',
      error
    );

    res.status(500).json({
      success: false,
      message:
        error?.message ||
        'Erreur interne du serveur.',
    });

  }
);

/* =========================================================
   DÉMARRAGE
========================================================= */

app.listen(PORT, () => {

  console.log(
    '============================================================'
  );

  console.log(
    `🚀 SERVEUR BACKEND EDULINK DÉPLOYÉ SUR LE PORT : ${PORT}`
  );

  console.log(
    `🌐 ORIGINE FRONTEND AUTORISÉE : ${EDULINK_APP_URL}`
  );

  console.log(
    '============================================================'
  );

});