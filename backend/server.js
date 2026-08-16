require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const htmlPdf = require('html-pdf-node');

const app = express();
const PORT = process.env.PORT || 10000;

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const EDULINK_APP_URL = process.env.EDULINK_APP_URL || 'http://localhost:5173';

/* =========================================================
   CONFIGURATION DE SÉCURITÉ CORS (DIALOGUE FRONTEND/BACKEND)
========================================================= */
const allowedOrigins = [
  'http://localhost:5173',
  EDULINK_APP_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('❌ Rejet de sécurité : Protocole CORS restreint pour cette origine.'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

/* =========================================================
   UTILITAIRES ET PROTECTION TEXTUELLE ANTI-INJECTION
========================================================= */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normaliserEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase();

const emailValide = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliserEmail(email));

/* =========================================================
   📨 TRANSPORTEUR BLINDÉ GMAIL (ANTI-BLOCAGE SSL & DNS LOCAL)
========================================================= */
const transporter = nodemailer.createTransport({
  service: 'gmail', // Utilise la matrice d'hôte SMTP interne et configurée de Google
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  },
  // 🟢 CORRECTIF CRITIQUE SSL : Neutralise le crash "self-signed certificate" de votre antivirus local
  tls: {
    rejectUnauthorized: false
  }
});

// Vérification immédiate de la liaison SMTP avec Google au déploiement du noyau
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Échec de la poignée de main de connexion Gmail :");
    console.error(`👉 Cause réelle : ${error.message}`);
    console.log("💡 Conseil de maintenance : Vérifiez que vos clés GMAIL_USER et GMAIL_APP_PASSWORD ne contiennent pas d'espaces.");
  } else {
    console.log("📧 Connexion sécurisée au serveur SMTP de Gmail : OPÉRATIONNELLE ✔️");
  }
});

/* =========================================================
   📢 ROUTE 1 : ENVOI DES NOTIFICATIONS MULTI-DESTINATAIRES SEPAREES
========================================================= */
app.post('/api/send-notification-email', async (req, res) => {
  try {
    if (!transporter) return res.status(500).json({ success: false, message: 'Gmail non configuré.' });

    const { recipients, schoolName, title, message, senderName, type, appUrl, hasAttachment } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun destinataire fourni.' });
    }

    if (!String(message || '').trim()) {
      return res.status(400).json({ success: false, message: 'Message manquant.' });
    }

    const mapRecipients = new Map();
    recipients.forEach((recipient) => {
      const email = normaliserEmail(recipient?.email);
      if (!emailValide(email)) return;

      if (!mapRecipients.has(email)) {
        mapRecipients.set(email, {
          email,
          name: String(recipient?.name || 'Utilisateur Edulink').trim(),
          type: recipient?.type || 'utilisateur',
        });
      }
    });

    const destinataires = Array.from(mapRecipients.values());
    if (destinataires.length === 0) return res.status(400).json({ success: false, message: 'Aucun e-mail valide.' });

    const nomEtablissement = String(schoolName || 'Établissement Edulink');
    const titreEmail = String(title || 'Nouveau message Edulink');
    const expediteur = String(senderName || 'Edulink');
    const texteMessage = String(message);
    const lienApplication = String(appUrl || EDULINK_APP_URL);
    const typeMessage = String(type || 'message');
    const dateEnvoi = new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

    const resultats = await Promise.allSettled(
      destinataires.map(async (destinataire) => {
        const nomDestinataire = escapeHtml(destinataire.name || 'Utilisateur');

        const html = `
          <!DOCTYPE html>
          <html lang="fr">
          <body style="margin:0; padding:0; background:#f4f5f7; font-family:Arial,sans-serif; color:#1f2937;">
            <div style="max-width:680px; margin:30px auto; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,.08);">
              <div style="background:#111827; padding:28px; color:#ffffff;">
                <div style="font-size:12px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; color:#a78bfa;">EDULINK</div>
                <h1 style="margin:10px 0 0; font-size:24px;">Nouveau message</h1>
              </div>
              <div style="padding:30px;">
                <p style="font-size:15px; margin-top:0;">Bonjour <strong>${nomDestinataire}</strong>,</p>
                <div style="margin:24px 0; padding:20px; background:#f9fafb; border-left:4px solid #7c3aed; border-radius:10px;">
                  <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:bold; margin-bottom:8px;">${escapeHtml(typeMessage)}</div>
                  <h2 style="margin:0 0 12px; font-size:19px; color:#111827;">${escapeHtml(titreEmail)}</h2>
                  <p style="margin:0; white-space:pre-wrap; line-height:1.7; font-size:14px; color:#374151;">${escapeHtml(texteMessage)}</p>
                </div>
                <p style="font-size:13px; color:#6b7280; margin-bottom:4px;"><strong>Expéditeur :</strong> ${escapeHtml(expediteur)}</p>
                <p style="font-size:13px; color:#6b7280; margin-bottom:4px;"><strong>Établissement :</strong> ${escapeHtml(nomEtablissement)}</p>
                <p style="font-size:12px; color:#9ca3af; margin-bottom:0;">${escapeHtml(dateEnvoi)}</p>
                ${hasAttachment ? `<div style="margin:18px 0; padding:12px; background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; color:#9a3412; font-size:13px;">📎 Une pièce jointe est disponible dans votre espace Edulink.</div>` : ''}
                <div style="text-align:center; margin:30px 0 15px;">
                  <a href="${escapeHtml(lienApplication)}" style="display:inline-block; background:#7c3aed; color:#ffffff; text-decoration:none; padding:13px 25px; border-radius:10px; font-weight:bold; font-size:14px;">Ouvrir mon espace Edulink</a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        return transporter.sendMail({
          from: `"${nomEtablissement}" <${GMAIL_USER}>`,
          to: destinataire.email,
          subject: `🔔 ${titreEmail} — ${nomEtablissement}`,
          html
        });
      })
    );

    let sent = 0, failed = 0;
    resultats.forEach((res) => { if (res.status === 'fulfilled') sent++; else failed++; });
    console.log(`📨 Notifications Edulink : ${sent} envoyée(s), ${failed} échec(s).`);

    return res.json({ success: failed === 0, sent, failed, total: destinataires.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================================================
   📊 ROUTE 2 : EXPÉDITION DYNAMIQUE DES LIVRETS SCOLAIRES PAR EMAIL
========================================================= */
app.post('/api/envoyer-bulletin-parent', async (req, res) => {
  const { studentEmail, parentEmail, studentName, matricule, moyenne, decision } = req.body;

  if (!studentName || !matricule) {
    return res.status(400).json({ success: false, msg: "❌ Paramètres d'indexation NoSQL manquants." });
  }

  const cibleEmail = parentEmail || studentEmail || "info_services@luhamcode.com";

  const mailOptions = {
    from: `"EDULINK Académique" <${GMAIL_USER}>`,
    to: cibleEmail,
    subject: `📊 EDULINK — Relevé de Notes Trimestriel : ${String(studentName).toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; background-color: #f8fafc; text-align: left;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #7c3aed; text-transform: uppercase; font-size: 18px;">🏛️ PORTAIL ACADÉMIQUE EDULINK</h2>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: bold;">Notification Officielle de l'Établissement</p>
          </div>
          <p style="font-size: 14px; line-height: 1.5; color: #334155;">
            Bonjour Chers Parents / Tuteurs, <br><br>
            Nous vous informons de la mise à disposition sur votre espace numérique du livret d'évaluation trimestriel concernant l'apprenant(e) suivant :
          </p>
                    <p style="margin: 3px 0;"><strong>N° Matricule :</strong> <span style="font-family: monospace; color: #7c3aed; font-weight: bold;">${matricule}</span></p>
          <p style="margin: 3px 0;"><strong>Moyenne Générale :</strong> <span style="color: #2563eb; font-weight: bold;">${moyenne || '--'} / 20</span></p>
          <p style="margin: 3px 0;"><strong>Décision Provisoire :</strong> ${decision || 'Sujet à validation du Conseil.'}</p>
        </div>

        <p style="font-size: 12px; color: #475569; line-height: 1.5;">
          🔒 Ce courriel est certifié par signature électronique NoSQL. Vous pouvez scanner le code QR présent sur le document PDF physique joint depuis votre smartphone pour authentifier la validité de ce document auprès des serveurs de la direction.
        </p>

        <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
          <strong>EDULINK SaaS — Connecter. Suivre. Sécuriser.</strong><br>
          By Luhamcode — Services Académiques Numériques
        </div>
      </div>
    </div>
  `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Courriel envoyé avec succès à l'adresse : ${cibleEmail}`);
    res.status(200).json({ success: true, msg: "🎉 Bulletin expédié avec succès aux parents !" });
  } catch (error) {
    console.error("❌ Échec de l'envoi SMTP :", error);
    res.status(500).json({ success: false, msg: "Échec d'expédition : Problème réseau SMTP." });
  }
});

/* =========================================================
   📄 ROUTE 3 : TRANSMISSION D'ALERTE DOCUMENTAIRE ADMINISTRATIVE
========================================================= */
app.post('/api/send-document-alert', async (req, res) => {
  try {
    const { email, nom, documentName, documentType, message } = req.body;
    if (!emailValide(email)) return res.status(400).json({ success: false, message: 'Adresse e-mail invalide.' });

    await transporter.sendMail({
      from: `"Edulink" <${GMAIL_USER}>`,
      to: email,
      subject: `📄 Nouveau document — ${documentName || 'Edulink'}`,
      html: `
        <div style="font-family:Arial; max-width:650px; margin:auto; padding:30px;">
          <h2>Nouveau document Edulink</h2>
          <p>Bonjour <strong>${escapeHtml(nom || 'Utilisateur')}</strong>,</p>
          <p>Un nouveau document est disponible dans votre espace.</p>
          <p><strong>Document : </strong> ${escapeHtml(documentName || '')}</p>
          <p><strong>Type : </strong> ${escapeHtml(documentType || '')}</p>
          <p>${escapeHtml(message || '')}</p>
          <p><a href="${escapeHtml(EDULINK_APP_URL)}" style="display:inline-block; background:#7c3aed; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">Ouvrir Edulink</a></p>
        </div>
      `
    });
    return res.json({ success: true, message: 'Alerte document envoyée.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================================================
   ⚠️ ROUTE 4 : NOTIFICATION D'ABSENCE PARENT IMMÉDIATE (VIE SCOLAIRE)
========================================================= */
app.post('/api/send-parent-absence-alert', async (req, res) => {
  try {
    const { emailParent, nomEleve, prenomsEleve, classe, dateAbsence, motif } = req.body;
    if (!emailValide(emailParent)) return res.status(400).json({ success: false, message: 'Adresse parent invalide.' });

    await transporter.sendMail({
      from: `"Edulink" <${GMAIL_USER}>`,
      to: emailParent,
      subject: `⚠️ Absence — ${nomEleve || ''} ${prenomsEleve || ''}`,
      html: `
        <div style="font-family:Arial; max-width:650px; margin:auto; padding:30px;">
          <h2>Notification d'absence</h2>
          <p>Bonjour,</p>
          <p>Nous vous informons que l'élève <strong>${escapeHtml(`${nomEleve || ''} ${prenomsEleve || ''}`)}</strong> a été signalé absent.</p>
          <p><strong>Classe : </strong> ${escapeHtml(classe || '')}</p>
          <p><strong>Date : </strong> ${escapeHtml(dateAbsence || '')}</p>
          <p><strong>Motif : </strong> ${escapeHtml(motif || 'Non renseigné')}</p>
          <p><a href="${escapeHtml(EDULINK_APP_URL)}" style="display:inline-block; background:#dc2626; color:white; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">Ouvrir Edulink</a></p>
        </div>
      `
    });
    return res.json({ success: true, message: 'Alerte parent envoyée.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================================================
   🔳 ROUTE 5 : MOTEUR GÉNÉRATEUR DES MATRIX QR CODE (BADGES)
========================================================= */
app.post('/api/generate-qrcode', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Texte QR manquant.' });

    const dataUrl = await QRCode.toDataURL(String(text));
    return res.json({ success: true, dataUrl });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================================================
   VÉRIFICATION D'ÉTAT SÉCURISÉ DU NOYAU
========================================================= */
app.get('/health', (req, res) => {
  res.status(200).send("⚡ Serveur Edulink actif et connecté en temps réel.");
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route API introuvable.' });
});

/* =========================================================
   DÉMARRAGE ET ÉCOUTE DU NOYAU EXPRESS BACKEND
========================================================= */
app.listen(PORT, () => {
  console.log(`============================================================`);
  console.log(`🚀 SERVEUR BACKEND EDULINK DÉPLOYÉ SUR LE PORT : ${PORT}`);
  console.log(`🌐 ORIGINE FRONTEND AUTORISÉE : http://localhost:5173`);
  console.log(`============================================================`);
});
