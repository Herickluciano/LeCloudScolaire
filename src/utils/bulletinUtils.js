// =========================================================================
// 📄 MOTEUR QUANTIQUE : GÉNÉRATEUR ET CERTIFICATEUR DE BULLETINS SCOLAIRES
// =========================================================================
export const imprimerBulletinTrimestriel = (student, schoolName, currentSchool) => {
  const fenetreBulletin = window.open('', '_blank');
  
  // 1. Extraction et calcul dynamique des moyennes par matière NoSQL
  const sourceNotes = student.notes || {};
  const listeMatieresCalculees = [];
  let sommeDesMoyennesGenerales = 0;
  let totalMatieresComptabilisees = 0;

  Object.entries(sourceNotes).forEach(([nomMatiere, notesArray]) => {
    if (Array.isArray(notesArray) && notesArray.length > 0) {
      // On met de côté l'EPS du calcul de la moyenne générale
      if (nomMatiere.toLowerCase() !== 'eps') {
        const sommeNotesMatiere = notesArray.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        const moyenneMatiere = parseFloat((sommeNotesMatiere / notesArray.length).toFixed(2));
        
        listeMatieresCalculees.push({
          matiere: nomMatiere.toUpperCase(),
          notes: notesArray.join(' - '),
          moyenne: moyenneMatiere,
          appreciation: moyenneMatiere >= 14 ? "Excellent trimestre." : moyenneMatiere >= 10 ? "Trimestre satisfaisant." : "Travail insuffisant."
        });

        sommeDesMoyennesGenerales += moyenneMatiere;
        totalMatieresComptabilisees++;
      }
    }
  });

  // 2. Traitement spécifique du Professeur d'EPS
  const notesEPS = sourceNotes['eps'] || sourceNotes['EPS'] || [];
  const moyenneEPS = notesEPS.length > 0 
    ? parseFloat((notesEPS.reduce((acc, val) => acc + (parseFloat(val) || 0), 0) / notesEPS.length).toFixed(2)) 
    : null;

  // 3. Calcul de la Moyenne Générale Trimestrielle
  const moyenneGeneraleFinie = totalMatieresComptabilisees > 0 
    ? parseFloat((sommeDesMoyennesGenerales / totalMatieresComptabilisees).toFixed(2)) 
    : 0;

  // 4. Algorithme des Décisions Jury & Statut (0 à 6: exclus, 7 à 9: redoublant, 10+: bravo)
  let decisionStatutText = "";
  let badgeStyleColor = "";
  let systemStatusQuery = "ACTIF";

  if (moyenneGeneraleFinie >= 10) {
    decisionStatutText = "🎉 BRAVO ! PASSAGE ACCORDÉ / TABLEAU D'HONNEUR";
    badgeStyleColor = "#059669"; // Vert
  } else if (moyenneGeneraleFinie >= 7 && moyenneGeneraleFinie <= 9.99) {
    decisionStatutText = "⚠️ REDOUBLANT AUTOMATIQUE DU NIVEAU";
    badgeStyleColor = "#d97706"; // Ambre
    systemStatusQuery = "REDOUBLANT";
  } else {
    decisionStatutText = "❌ EXCLU DE L'ÉTABLISSEMENT POUR INSUFFISANCE ACADÉMIQUE";
    badgeStyleColor = "#dc2626"; // Rouge
    systemStatusQuery = "EXCLU";
  }

  // 5. 🟢 RECTIFICATION : Réparation de la ligne du QR Code certifié qui était coupée
  const chaineValidationSecurisee = `ID:${student.matricule || student.id || 'N/A'}|SGS:${currentSchool}|MOY:${moyenneGeneraleFinie}|STATUS:${systemStatusQuery}`;
  const urlQrCodeCertifie = `https://qrserver.com{encodeURIComponent(chaineValidationSecurisee)}`;

  // 6. Injection de la matrice HTML d'impression
  fenetreBulletin.document.write(`
    <html>
      <head>
        <title>BULLETIN TRIMESTRIEL OFFICIEL — ${student.nom?.toUpperCase()}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; background: #fff; line-height: 1.4; }
          .header-table { width: 100%; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px; }
          .school-title { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #1e3a8a; }
          .bulletin-title { font-size: 20px; font-weight: 900; text-align: center; text-transform: uppercase; margin: 15px 0; letter-spacing: 1px; background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; }
          .student-box { border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; background: #fafafa; }
          .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          .main-table th { background: #0f172a; color: #fff; text-transform: uppercase; padding: 10px; font-weight: bold; border: 1px solid #475569; }
          .main-table td { padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; }
          .row-even { background: #f8fafc; }
          .moyenne-generale-box { margin-top: 20px; border: 2px solid #0f172a; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; items-center; font-weight: bold; }
          .decision-badge { padding: 6px 12px; border-radius: 6px; color: #fff; font-size: 11px; text-transform: uppercase; font-weight: 900; display: inline-block; }
          .section-appreciation { margin-top: 15px; background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 11px; }
          .footer-signatures { margin-top: 40px; width: 100%; text-align: center; font-size: 11px; font-weight: bold; }
          .qr-zone { text-align: center; font-size: 9px; font-weight: bold; color: #64748b; font-family: monospace; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        
        <table class="header-table">
          <tr>
            <td style="width: 50%;" class="school-title">
              🏛️ ${schoolName.toUpperCase()}<br>
              <span style="font-size: 10px; color:#64748b; font-weight:bold;">RÉPUBLIQUE DE CÔTE D'IVOIRE ➔ MINISTÈRE DE L'ÉDUCATION NATIONALE</span>
            </td>
            <td style="width: 50%; text-align: right;" class="qr-zone">
              <img src="${urlQrCodeCertifie}" alt="QR Validation" style="border: 1px solid #cbd5e1; padding: 2px; background:#fff;"><br>
              <span>BULLETIN CERTIFIÉ SECURE NoSQL</span>
            </td>
          </tr>
        </table>

        <div class="bulletin-title">Bulletin Trimestriel d'Évaluation Académique</div>

        <div class="student-box">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="width: 50%;">
                <strong>MATRICULE CODE :</strong> <span style="font-family: monospace; font-size:13px; color:#7c3aed;">${student.matricule || student.id}</span><br><br>
                <strong>NOM & PRÉNOMS :</strong> <span style="font-size:13px; text-transform: uppercase;">${student.nom} ${student.prenoms || ''}</span>
              </td>
              <td style="width: 50%; text-align: right;">
                <strong>PROMOTION / NIVEAU :</strong> <span style="text-transform: uppercase; font-size:13px; color:#2563eb;">${(student.promotion || '5EME').toUpperCase()}</span><br><br>
                <strong>CLASSE REPRODUITE :</strong> <span style="text-transform: uppercase; font-size:13px;">${(student.classeId || 'N/A').toUpperCase()}</span>
              </td>
            </tr>
          </table>
        </div>

        <table class="main-table">
          <thead>
            <tr>
              <th style="text-align: left; padding-left:12px;">Matières Enseignées</th>
              <th style="text-align: center;">Notes du Trimestre</th>
              <th style="text-align: center; width: 100px;">Moyenne /20</th>
              <th style="text-align: left; padding-left:12px;">Appréciations des Enseignants</th>
            </tr>
          </thead>
          <tbody>
            ${listeMatieresCalculees.map((m, idx) => `
              <tr class="${idx % 2 === 0 ? 'row-even' : ''}">
                <td style="padding-left:12px; font-weight:900; color:#0f172a;">📚 ${m.matiere}</td>
                <td style="text-align: center; font-family: monospace; font-weight:bold; color:#475569;">${m.notes}</td>
                <td style="text-align: center; font-size:13px; font-weight:900; color:#1e3a8a;">${m.moyenne.toFixed(2)}</td>
                <td style="padding-left:12px; font-style: italic; color:#334155;">${m.appreciation}</td>
              </tr>
            `).join('')}
            
            <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1;">
              <td style="padding-left:12px; font-weight:900; color:#0f172a;">🏃 ÉDUCATION PHYSIQUE (EPS)</td>
              <td style="text-align: center; font-weight:bold; color:#475569;">${notesEPS.length > 0 ? notesEPS.join(' - ') : 'N/A'}</td>
              <td style="text-align: center; font-size:13px; font-weight:900; color:#1e3a8a;">${moyenneEPS !== null ? moyenneEPS.toFixed(2) : '--'}</td>
              <td style="padding-left:12px; font-style: italic; color:#334155;">${moyenneEPS !== null ? (moyenneEPS >= 10 ? "Bonne participation." : "Doit s'impliquer davantage.") : "Aucune note."}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-appreciation">
          <table style="width: 100%;">
            <tr>
              <td style="width: 33%; border-right: 1px dashed #cbd5e1; padding-right:10px;">
                <strong>🕒 ASSIDUITÉ VIE SCOLAIRE :</strong><br>
                <span style="font-size:13px; font-weight:900; color:#dc2626; margin-top:5px; display:block;">${student.absences || 0} Heures d'absences</span>
              </td>
              <td style="width: 33%; border-right: 1px dashed #cbd5e1; padding-left:15px; padding-right:10px;">
                <strong>👮 APPRÉCIATION ÉDUCATEUR :</strong><br>
                <p style="font-style: italic; color:#475569; margin-top:5px;">"${student.appreciationConduiteEducateur || 'Élève suivi régulièrement par la vie scolaire.'}"</p>
              </td>
                            <td style="width: 33%; padding-left:15px;">
                <strong>💬 AVIS DU CONSEIL DE CLASSE :</strong><br>
                <p style="font-style: italic; color:#475569; margin-top:5px;">"${student.appreciationConseilJury || (moyenneGeneraleFinie >= 10 ? 'Trimestre satisfaisant, encouragements du conseil.' : 'Trimestre insuffisant, doit redoubler d\'efforts.')}"</p>
              </td>
            </tr>
          </table>
        </div>

        <div class="moyenne-generale-box">
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:#64748b; display:block;">Performance Trimestrielle Générale</span>
            <div style="font-size:22px; font-weight:900; color:#1e3a8a; margin-top:4px;">MOYENNE GÉNÉRALE : ${moyenneGeneraleFinie.toFixed(2)} / 20</div>
          </div>
          <div style="text-align: right;">
            <span style="font-size:11px; text-transform:uppercase; color:#64748b; display:block; margin-bottom:5px;">Décision Finale Administrative</span>
            <div class="decision-badge" style="background-color: ${badgeStyleColor};">${decisionStatutText}</div>
          </div>
        </div>

        <table class="footer-signatures">
          <tr>
            <td style="width: 50%; padding-top:40px;">
              Le Chef de Niveau / Éducateur Général<br>
              <span style="font-size:10px; color:#94a3b8; display:block; margin-top:35px;">[ Signature Électronique Enregistrée ]</span>
            </td>
            <td style="width: 50%; padding-top:40px;">
              Le Directeur Général de l'Établissement<br>
              <span style="font-size:10px; color:#94a3b8; display:block; margin-top:35px;">[ Sceau et Cachet de la Direction ]</span>
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `);
  fenetreBulletin.document.close();
};
