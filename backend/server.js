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
  host: '://gmail.com',
  port: 465,
  secure: true, // Force le protocole SSL pour éviter le classement en spam
  auth: {
    user: 'bleguyherickluciano@gmail.com',
    pass: 'sfvtxebrgvnezpep' // Votre mot de passe d'application Google valide
  },
  tls: { 
    rejectUnauthorized: false // Empêche le blocage par le pare-feu local
  }
});

// Connexion d'antenne SMTP
transporter.verify((error) => {
  if (error) console.log("❌ Alerte SMTP Google déconnectée :", error.message);
  else console.log("✅ CONFIGURATION VALIDÉE : Canal de messagerie en temps réel actif !");
});

// =========================================================================
// 🚀 ENDPOINT 1 : ALERTES GENERALES ET COMMUNICATIONS DE CLASSE
// =========================================================================
app.post('/api/send-email', (req, res) => {
  const { to_email, to_name, school_name, subject_title, sender_title } = req.body;

  if (!to_email) {
    return res.status(400).json({ success: false, msg: "Destinataire manquant." });
  }

  res.status(200).json({ success: true, status: "processing", msg: "Notification placée dans la file d'attente asynchrone." });

  // 🟢 EN-TÊTES ANTI-SPAM (Headers) ET STRUCTURES DE CONFORMITÉ SÉCURISÉES
  const mailOptions = {
    from: `"Portail Scolaire Numérique" <bleguyherickluciano@gmail.com>`, // Nom propre de confiance
    replyTo: 'bleguyherickluciano@gmail.com',
    to: to_email.trim(),
    subject: `📢 Urgent : [${school_name}] ${subject_title}`, // Sujet structuré sans mots interdits (spam words)
    headers: {
      'X-Priority': '1', // Indique aux serveurs qu'il s'agit d'une notification système prioritaire
      'X-MSMail-Priority': 'High',
      'Importance': 'high',
      'Precedence': 'bulk' // Signale qu'il s'agit d'une notification de plateforme (évite le rejet)
    },
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; margin: 0 auto; color: #1e293b;">
        <div style="background-color: #f8fafc; padding: 15px; border-bottom: 3px solid #ea580c; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #0f172a; margin: 0; font-size: 18px; text-transform: uppercase;">🏛️ ${school_name}</h2>
        </div>
        
        <div style="padding: 20px 10px;">
          <p style="font-size: 15px; color: #0f172a; margin-top: 0;">Bonjour <strong>${to_name}</strong>,</p>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">Une nouvelle communication administrative vient d'être émise en direct sur l'espace numérique sécurisé de votre établissement.</p>
          
          <div style="background-color: #fff7ed; border: 1px solid #ffedd5; padding: 18px; border-radius: 10px; margin: 25px 0; text-align: center;">
            <p style="font-size: 14px; color: #c2410c; font-weight: bold; margin-top: 0; margin-bottom: 15px; line-height: 1.5;">
              ⚠️ "Vous avez reçu un message important de la part de l'équipe pédagogique. Veuillez vous connecter."
            </p>
            <a href="http://localhost:5173/login" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; text-transform: uppercase; padding: 12px 24px; border-radius: 6px; box-shadow: 0 2px 4px rgba(234,88,12,0.2);">
              Ouvrir mon Espace Élève
            </a>
          </div>
          
          <p style="font-size: 13px; color: #64748b; margin-bottom: 5px; font-style: italic; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">
            <strong>Objet officiel :</strong> "${subject_title}"
          </p>
        </div>
        
        <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 20px 0;" />
        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; text-align: center;">
          Plateforme Multi-Écoles SGS — Signataire : ${sender_title}
        </div>
      </div>
    `
  };

  transporter.sendMail(mailOptions)
    .then(() => console.log(`✉️ Mail Principal expédié sans filtre à : ${to_email}`))
    .catch((err) => console.error(`❌ Erreur d'envoi SMTP :`, err.message));
});

// =========================================================================
// 🚀 ENDPOINT 2 : ALERTES DE DOCUMENTS INDIVIDUELS (BULLETINS / CONVOCATIONS)
// =========================================================================
app.post('/api/send-document-alert', (req, res) => {
  const { to_email, to_name, school_name, type_document, sender_title } = req.body;

  if (!to_email) {
    return res.status(400).json({ success: false, msg: "Destinataire manquant." });
  }

  res.status(200).json({ success: true, status: "processing" });

  const mailOptions = {
    from: `"Secrétariat Numérique" <bleguyherickluciano@gmail.com>`,
    replyTo: 'bleguyherickluciano@gmail.com',
    to: to_email.trim(),
    subject: `🚨 IMPORTANT : [${school_name}] Nouveau document disponible`,
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'high',
      'Precedence': 'bulk'
    },
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; margin: 0 auto; color: #1e293b;">
        <div style="background-color: #f8fafc; padding: 15px; border-bottom: 3px solid #b91c1c; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #0f172a; margin: 0; font-size: 18px; text-transform: uppercase;">🏛️ ${school_name}</h2>
        </div>
        
        <div style="padding: 20px 10px;">
          <p style="font-size: 15px; color: #0f172a; margin-top: 0;">Bonjour <strong>${to_name}</strong>,</p>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">L'administration de votre établissement vient de déposer une pièce administrative officielle et confidentielle au sein de votre coffre-fort numérique élève.</p>
          
          <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 18px; border-radius: 10px; margin: 25px 0; text-align: center;">
            <p style="font-size: 14px; color: #991b1b; font-weight: bold; margin-top: 0; margin-bottom: 15px; line-height: 1.5;">
              ⚠️ "Un document officiel de type (${type_document.toUpperCase()}) a été archivé sur votre portail. Veuillez le consulter."
            </p>
            <a href="http://localhost:5173/login" style="display: inline-block; background-color: #b91c1c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; text-transform: uppercase; padding: 12px 24px; border-radius: 6px; box-shadow: 0 2px 4px rgba(185,28,28,0.2);">
              Ouvrir mon Armoire Scolaire
            </a>
          </div>
          
          <p style="font-size: 13px; color: #64748b; margin-bottom: 5px; font-style: italic; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">
            <strong>Type de pièce rattachée :</strong> "${type_document}"
          </p>
        </div>
        
        <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 20px 0;" />
        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; text-align: center;">
          Notification automatisée Secrétariat — Émis par : ${sender_title}
        </div>
      </div>
    `
  };

  transporter.sendMail(mailOptions)
    .then(() => console.log(`✉️ Alerte de document confidentiel envoyée à : ${to_email}`))
    .catch((err) => console.error(`❌ Échec d'envoi d'alerte pour ${to_email} :`, err.message));
});
// 🟢 ROUTE BACKEND : ALERTE PARENT AUTOMATIQUE ABSENCES CUMULÉES
app.post("/api/send-parent-absence-alert", async (req, res) => {
  const { parent_email, student_name, school_name, total_hours } = req.body;

  const mailOptions = {
    from: `"${school_name}" <votre-mail-saas@gmail.com>`,
    to: parent_email,
    subject: `🚨 Alerte d'Absence Répétée — ${student_name}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f1f5f9; border-radius: 12px; max-width: 500px;">
        <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #dc2626;">Expéditeur : École de votre protégé</p>
        <h2 style="font-size: 16px; font-weight: 900; color: #0f172a;">Avis d'Absence Académique</h2>
        <p style="font-size: 13px; color: #334155; line-height: 1.6;">
          M/Mme, votre protégé <strong>${student_name}</strong> a accumulé plusieurs heures d'absences cette semaine (Total actuel : <span style="color: #dc2626; font-weight: bold;">${total_hours} Heures</span>).
        </p>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 20px; border-t: 1px solid #e2e8f0; pt: 10px;">
          Cet e-mail est généré automatiquement par le Secrétariat de la Direction de ${school_name}.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Serveur d'alertes asynchrones connecté sur le port ${PORT}`));
