const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());

// Autorisation universelle pour vos requêtes instantanées React
app.use(cors({ origin: "*" }));

// Configuration du transporteur Gmail sécurisé
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'bleguyherickluciano@gmail.com',
    pass: 'sfvtxebrgvnezpep' 
  },
  tls: { rejectUnauthorized: false }
});

// Connexion d'antenne SMTP
transporter.verify((error) => {
  if (error) console.log("❌ Alerte SMTP Google déconnectée :", error.message);
  else console.log("✅ CONFIGURATION VALIDÉE : Canal de messagerie en temps réel actif !");
});

// 🚀 ENDPOINT API ASYNCHRONE EN TEMPS RÉEL
app.post('/api/send-email', (req, res) => {
  const { to_email, to_name, school_name, subject_title, sender_title } = req.body;

  if (!to_email) {
    return res.status(400).json({ success: false, msg: "Destinataire manquant." });
  }

  // 1. Libérer instantanément le navigateur client (React) sans le faire patienter
  res.status(200).json({ success: true, status: "processing", msg: "Notification placée dans la file d'attente asynchrone." });

  // 2. Traitement parrallèle en tâche de fond (Background Execution)
    const mailOptions = {
    // 🟢 CORRECTION DE SÉCURITÉ : Forcer l'en-tête de l'expéditeur pour éviter le blocage Google
    from: `"Direction SGS" <nestelineluciano@gmail.com>`, 
    replyTo: 'nestelineluciano@gmail.com',
    to: to_email.trim(),
    subject: `[${school_name}] Alerte : Nouvelle communication officielle`,
    html: `
      <div style="font-family: sans-serif; padding: 30px; max-width: 550px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; margin: 0 auto;">
        <h2 style="color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-top: 0; font-size: 20px;">🏛️ ${school_name}</h2>
        <p style="font-size: 15px; color: #1e293b; margin-top: 20px;">Bonjour <strong>${to_name}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">Une nouvelle communication officielle vient d'être publiée par la Direction sur votre portail d'établissement.</p>
        
        <div style="background-color: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
          <p style="font-size: 14px; color: #c2410c; font-weight: bold; margin-top: 0; margin-bottom: 15px; line-height: 1.5;">
            ⚠️ "Vous avez reçu un message sur votre espace élève. Veuillez aller le consulter."
          </p>
          <a href="http://localhost:5173/login" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; text-transform: uppercase; padding: 12px 26px; border-radius: 8px;">
            Consulter mon Espace Élève
          </a>
        </div>
        
        <p style="font-size: 13px; color: #475569; margin-bottom: 20px; font-style: italic;">Objet de l'alerte : "${subject_title}"</p>
        <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 20px 0;" />
        <p style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 0;">Notification automatisée — Expéditeur : ${sender_title}</p>
      </div>
    `
  };
  // 🚀 ENPOINT 2 : ALERTES DE DOCUMENTS INDIVIDUELS (BULLETINS / CONVOCATIONS)
app.post('/api/send-document-alert', (req, res) => {
  const { to_email, to_name, school_name, type_document, sender_title } = req.body;

  if (!to_email) {
    return res.status(400).json({ success: false, msg: "Destinataire manquant." });
  }

  // Libère immédiatement l'interface admin React
  res.status(200).json({ success: true, status: "processing" });

  const mailOptions = {
    from: `"Secrétariat Numérique" <nestelineluciano@gmail.com>`,
    to: to_email.trim(),
    subject: `[${school_name}] IMPORTANT : Nouveau document disponible sur votre espace`,
    html: `
      <div style="font-family: sans-serif; padding: 30px; max-width: 550px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <h2 style="color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-top: 0; font-size: 20px;">🏛️ ${school_name}</h2>
        <p style="font-size: 15px; color: #1e293b; margin-top: 20px;">Bonjour <strong>${to_name}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">L'administration de votre établissement vient de déposer un document personnel et confidentiel sur votre portail élève sécurisé.</p>
        
        <!-- Boîte de Notification requise -->
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
          <p style="font-size: 14px; color: #991b1b; font-weight: bold; margin-top: 0; margin-bottom: 15px; line-height: 1.5;">
            ⚠️ "Vous avez reçu un document personnel (${type_document.toUpperCase()}) sur votre espace élève. Veuillez aller le consulter et le télécharger."
          </p>
          
          <a href="http://localhost:5173/login" style="display: inline-block; background-color: #b91c1c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; text-transform: uppercase; padding: 12px 26px; border-radius: 8px;">
            Accéder à mon Armoire Scolaire
          </a>
        </div>
        
        <p style="font-size: 13px; color: #475569; margin-bottom: 20px; font-style: italic;">Type de pièce déposée : "${type_document}"</p>
        <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 20px 0;" />
        <p style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 0;">Notification automatisée — Émis par : ${sender_title}</p>
      </div>
    `
  };

  transporter.sendMail(mailOptions)
    .then(() => console.log(`✉️ Alerte de document confidentiel envoyée à : ${to_email}`))
    .catch((err) => console.error(`❌ Échec d'envoi d'alerte pour ${to_email} :`, err.message));
});



  // Expédition asynchrone non-bloquante
  transporter.sendMail(mailOptions)
    .then(() => console.log(`✉️ Notification en temps réel délivrée à : ${to_email}`))
    .catch((err) => console.error(`❌ Échec d'envoi en arrière-plan pour ${to_email} :`, err.message));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Serveur d'alertes asynchrones connecté sur le port ${PORT}`));
