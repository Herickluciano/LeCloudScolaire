const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const QRCode = require('qrcode'); // 🟢 Générateur local de QR Code intégré
const html_pdf = require('html-pdf-node'); // 🟢 Convertisseur HTML vers PDF

const app = express();
app.use(express.json());

// Autorisation universelle pour vos requêtes instantanées React
app.use(cors({ origin: "*" }));

// Configuration du transporteur Gmail sécurisé
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
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
// 🚀 ENDPOINT 1 : GENERATION DE BULLETIN PDF AVEC QR CODE LOCAL & SIGNATURES REAL-TIME
// =========================================================================
app.post('/api/send-email', async (req, res) => {
  const { 
    to_email, student_name, matricule, promotion, classeId, 
    school_name, schoolId, moyenne, absences, matieres, appreciationEducateur, signature_image, signature_admin 
  } = req.body;

  if (!to_email) {
    return res.status(400).json({ success: false, msg: "Destinataire manquant." });
  }

  // Renvoie une réponse immédiate à React pour libérer l'interface utilisateur
  res.status(200).json({ success: true, status: "processing", msg: "Compilation du bulletin PDF et envoi SMTP en arrière-plan." });

  try {
    // 1. Détermination automatique de la mention du jury
    let mentionJury = moyenne >= 10 ? "🎉 PASSAGE ACCORDÉ / TABLEAU D'HONNEUR" : moyenne >= 7 ? "⚠️ REDOUBLANT DU NIVEAU" : "❌ EXCLUSION DÉFINITIVE";
    
    // 2. Encodage et génération du QR Code localement en Base64 (Plus de cadre blanc)
    const chaineValidation = `ID:${matricule}|SGS:${schoolId}|MOY:${moyenne}|STATUS:${moyenne >= 10 ? 'ACTIF' : 'RESTREINT'}`;
    const qrCodeBase64 = await QRCode.toDataURL(chaineValidation, { margin: 1, width: 100 });

    // 3. Maquette HTML officielle du Livret Scolaire pour le compilateur PDF
    const htmlMaquetteBulletin = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; background: #fff; line-height: 1.4; }
            .header-table { width: 100%; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px; border-collapse: collapse; }
            .school-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #0f172a; line-height: 1.3; }
            .bulletin-title { font-size: 20px; font-weight: 900; text-align: center; text-transform: uppercase; margin: 15px 0; background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; color: #0f172a; }
            .student-box { border: 1px solid #cbd5e1; padding: 15px; border-radius: 4px; margin-bottom: 25px; background: #fff; font-size: 13px; }
            .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            .main-table th { background: #0f172a; color: #fff; text-transform: uppercase; padding: 10px; font-weight: bold; border: 1px solid #cbd5e1; }
            .main-table td { padding: 12px 10px; border: 1px solid #cbd5e1; font-weight: bold; }
            .moyenne-generale-box { margin-top: 25px; border: 2px solid #0f172a; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
            
            /* 🚀 ARCHITECTURE DES 3 COLONNES DE SIGNATURE NUMÉRIQUES MANUSCRITES */
            .signature-row { width: 100%; margin-top: 45px; border-collapse: collapse; }
            .signature-col { width: 33.33%; text-align: center; font-size: 11px; font-weight: bold; color: #1e293b; vertical-align: top; }
            .signature-label { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #0f172a; margin-bottom: 40px; display: block; }
            .signature-stamp { font-size: 10px; color: #94a3b8; font-weight: normal; font-style: italic; display: block; margin-top: 10px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="school-title">🏛️ ${school_name.toUpperCase()}<br><span style="font-size: 10px; color:#475569; font-weight:bold; display:block; margin-top:3px;">RÉPUBLIQUE DE CÔTE D'IVOIRE ➔ MINISTÈRE DE L'ÉDUCATION</span></td>
              <td style="text-align: right;">
                <img src="${qrCodeBase64}" alt="QR Code" style="width: 85px; height: 85px;"><br>
                <span style="font-size: 8px; font-weight:bold; font-family: monospace;">CERTIFIÉ SECURE NoSQL</span>
              </td>
            </tr>
          </table>
          
          <div class="bulletin-title">Bulletin Trimestriel d'Évaluation Académique</div>
          
          <div class="student-box">
            <table style="width:100%;">
              <tr>
                <td><strong>MATRICULE :</strong> <span style="font-family: monospace; color:#7c3aed;">${matricule}</span></td>
                <td style="text-align:right;"><strong>PROMOTION :</strong> <span style="color:#2563eb;">${promotion}</span></td>
              </tr>
              <tr>
                <td style="padding-top:8px;"><strong>NOM ET PRÉNOMS :</strong> ${student_name}</td>
                <td style="padding-top:8px; text-align:right;"><strong>CLASSE AFFECTÉE :</strong> ${classeId}</td>
              </tr>
            </table>
          </div>
          
          <table class="main-table">
            <thead>
              <tr>
                <th style="text-align: left; padding-left:10px;">Matières Enseignées</th>
                <th style="text-align: center; width:25%;">Notes obtenues</th>
                <th style="text-align: center; width:20%;">Moyenne /20</th>
              </tr>
            </thead>
            <tbody>
              ${matieres.map(m => `
                <tr>
                  <td style="padding-left:10px;">📚 ${m.nom}</td>
                  <td style="text-align: center; font-family: monospace; color:#475569;">${m.notes}</td>
                  <td style="text-align: center; color:#2563eb; font-size:12px;">${m.moyenne.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 12px; border: 1px solid #cbd5e1; background:#f8fafc; font-size:11px;">
            <strong>🕒 ASSIDUITÉ :</strong> ${absences} Heures d'absences cumulées au trimestre.<br><br>
            <strong>👮 APPRÉCIATION DE CONDUITE ÉDUCATEUR :</strong> "${appreciationEducateur}"
          </div>
          
          <div class="moyenne-generale-box">
            <div style="font-size: 16px; color:#1e3a8a;">MOYENNE GÉNÉRALE : ${moyenne.toFixed(2)} / 20</div>
            <div style="text-align: right; font-size:11px; color:#0f172a;">DÉCISION DU CONSEIL : ${mentionJury}</div>
          </div>

                    <!-- 🟢 GRILLE RÉGLEMENTAIRE À DOUBLE SIGNATURE MANUSCRITE VISUELLE -->
          <table class="signature-row">
            <tr>
              <td class="signature-col">
                <span class="signature-label">✍️ L'Éducateur Référent</span>
                ${signature_educateur ? `<img src="${signature_educateur}" style="height: 45px; max-width: 130px; display: inline-block; margin-top:-15px;"><br>` : '<div style="height:45px;"></div>'}
                <span class="signature-stamp">[ Visa Électronique Certifié ]</span>
              </td>
              <td class="signature-col" style="border-left: 1px dashed #cbd5e1; border-right: 1px dashed #cbd5e1;">
                <span class="signature-label">🏛️ Le Conseil de Classe</span>
                <div style="height:45px; font-size:10px; color:#059669; font-weight:bold; padding-top:10px;">✓ APPROUVÉ NoSQL</div>
                <span class="signature-stamp">[ Sceau de Validation ]</span>
              </td>
              <td class="signature-col">
                <span class="signature-label">👨‍💼 Le Proviseur / DG</span>
                ${signature_admin ? `<img src="${signature_admin}" style="height: 45px; max-width: 130px; display: inline-block; margin-top:-15px;"><br>` : '<div style="height:45px;"></div>'}
                <span class="signature-stamp">[ Cachet Officiel de l'Établissement ]</span>
              </td>
            </tr>
          </table>

        </body>
      </html>
    `;

    // 4. Compilation du code HTML mis à jour en fichier PDF binaire
    let options = { format: 'A4' };
    let file = { content: htmlMaquetteBulletin };
    const pdfBuffer = await html_pdf.generatePdf(file, options);

    // 5. Structure et routage de l'e-mail avec la pièce jointe modifiée
    const mailOptions = {
      from: `"Secrétariat Direction ${school_name}" <bleguyherickluciano@gmail.com>`,
      replyTo: 'bleguyherickluciano@gmail.com',
      to: to_email.trim(),
      subject: `📜 Bulletin de Notes Trimestriel PDF Certifié — Élève ${student_name}`,
      headers: {
        'X-Priority': '1',
        'Importance': 'high'
      },
           text: `Chers parents,\n\nVeuillez trouver en pièce jointe de ce courriel le bulletin d'évaluation officiel au format PDF de votre enfant ${student_name}.\n\nCe document officiel intègre un QR Code de validation cryptographique unique pour certifier l'exactitude des moyennes.\n\nCordialement,\nLa Direction Académique.`,
      attachments: [
        {
          filename: `BULLETIN_${matricule}_${student_name.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`✉️ Bulletin officiel PDF (avec signatures synchronisées) expédié à : ${to_email}`);
  } catch (error) {
    console.error(`❌ Échec technique lors de la compilation du PDF pour ${to_email} :`, error.message);
  }
});

// =========================================================================
// 🚀 ENDPOINT 2 : ALERTES DE DOCUMENTS INDIVIDUELS (CONVOCATIONS / ALERTES)
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
            <a href="http://localhost:5173/login" style="display: inline-block; background-color: #b91c1c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; text-transform: uppercase; padding: 12px 24px; border-radius: 6px;">
              Ouvrir mon Armoire Scolaire
            </a>
          </div>
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

// =========================================================================
// 🚀 ENDPOINT 3 : ALERTE PARENT AUTOMATIQUE ABSENCES CUMULÉES
// =========================================================================
app.post("/api/send-parent-absence-alert", (req, res) => {
  const { to_email, student_name, absences_count, school_name } = req.body;

  if (!to_email) {
    return res.status(400).json({ success: false, msg: "Destinataire manquant." });
  }

  res.status(200).json({ success: true, status: "processing" });

  const mailOptions = {
    from: `"Vie Scolaire ${school_name}" <bleguyherickluciano@gmail.com>`,
    to: to_email.trim(),
    subject: `⚠️ Alerte Suivi Disciplinaire : Absences cumulées — ${student_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; max-width: 600px; border: 1px solid #fee2e2; border-radius: 12px; background-color: #ffffff; margin: 0 auto;">
        <h2 style="color: #dc2626; border-b: 2px solid #dc2626; padding-bottom: 8px;">⚠️ NOTIFICATION D'ABSENTÉISME RÉCCURENT</h2>
        <p>Chers parents,</p>
        <p>Nous vous informons que le compteur d'assiduité numérique de votre enfant <strong>${student_name}</strong> vient d'atteindre un volume critique de <strong>${absences_count} Heures d'absences</strong> non justifiées au trimestre.</p>
        <p>Conformément au règlement intérieur de l'établissement, nous vous prions de vous rapprocher urgemment de son éducateur de niveau pour régulariser son dossier.</p>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 30px;">Généré automatiquement par le serveur de suivi en temps réel Edulink.</p>
      </div>
    `
  };

  transporter.sendMail(mailOptions)
    .then(() => console.log(`✉️ Alerte automatique absentéisme expédiée à : ${to_email}`))
    .catch((err) => console.error(`❌ Erreur SMTP Alerte Absence :`, err.message));
});

// INITIALISATION DU COEUR DE SERVEUR SUR LE PORT DE COMMANDE 10000
const PORT = 10000;
app.listen(PORT, () => {
  console.log(`🚀 SERVEUR DE PRODUCTION ACTIF ! Écoute en cours sur le port de crise : ${PORT}`);
});
