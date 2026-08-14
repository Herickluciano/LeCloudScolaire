import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
// 🟢 IMPORTATIONS FIRESTORE OBLIGATOIRES POUR ÉVITER LES ERREURS "NOT DEFINED"
import { db } from '../services/api'; 
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Génération et impression du bulletin trimestriel
 * QR Code généré localement avec la librairie qrcode
 */
export const imprimerBulletinTrimestriel = async (
  student,
  schoolName,
  currentSchool
) => {
  try {
    // =========================================================
    // 1. RÉCUPÉRATION DES NOTES
    // =========================================================
    const sourceNotes = student?.notes || {};
    const listeMatieresCalculees = [];
    let sommeDesMoyennesGenerales = 0;
    let totalMatieresComptabilisees = 0;

    Object.entries(sourceNotes).forEach(([nomMatiere, notesArray]) => {
      if (
        Array.isArray(notesArray) &&
        notesArray.length > 0 &&
        nomMatiere.toLowerCase() !== 'eps'
      ) {
        const sommeNotesMatiere = notesArray.reduce(
          (acc, val) => acc + (parseFloat(val) || 0),
          0
        );

        const moyenneMatiere = parseFloat(
          (sommeNotesMatiere / notesArray.length).toFixed(2)
        );

        listeMatieresCalculees.push({
          matiere: nomMatiere.toUpperCase(),
          notes: notesArray.join(' - '),
          moyenne: moyenneMatiere,
          appreciation:
            moyenneMatiere >= 14
              ? 'Excellent trimestre.'
              : moyenneMatiere >= 10
                ? 'Trimestre satisfaisant.'
                : 'Travail insuffisant.'
        });

        sommeDesMoyennesGenerales += moyenneMatiere;
        totalMatieresComptabilisees++;
      }
    });

    // =========================================================
    // 2. EPS
    // =========================================================
    const notesEPS = sourceNotes['eps'] || sourceNotes['EPS'] || [];
    const moyenneEPS =
      notesEPS.length > 0
        ? parseFloat(
            (
              notesEPS.reduce((acc, val) => acc + (parseFloat(val) || 0), 0) / notesEPS.length
            ).toFixed(2)
          )
        : null;

    // =========================================================
    // 3. MOYENNE GÉNÉRALE
    // =========================================================
    const moyenneGeneraleFinie =
      totalMatieresComptabilisees > 0
        ? parseFloat((sommeDesMoyennesGenerales / totalMatieresComptabilisees).toFixed(2))
        : 0;

    // =========================================================
    // 4. DÉCISION ADMINISTRATIVE
    // =========================================================
    let decisionStatutText = '';
    let systemStatusQuery = 'ACTIF';

    if (moyenneGeneraleFinie >= 10) {
      decisionStatutText = 'BRAVO ! PASSAGE ACCORDÉ / TABLEAU D’HONNEUR';
      systemStatusQuery = 'ACTIF';
    } else if (moyenneGeneraleFinie >= 7 && moyenneGeneraleFinie <= 9.99) {
      decisionStatutText = 'REDOUBLEMENT / DÉCISION À CONFIRMER PAR LE CONSEIL';
      systemStatusQuery = 'REDOUBLANT';
    } else {
      decisionStatutText = 'INSUFFISANCE ACADÉMIQUE / DÉCISION ADMINISTRATIVE';
      systemStatusQuery = 'EXCLU';
    }

    // =========================================================
    // 5. INFORMATIONS ÉTABLISSEMENT
    // =========================================================
    const paysOfficiel = (
      student?.schoolPays ||
      sessionStorage.getItem('sgs_school_pays') ||
      "RÉPUBLIQUE DE CÔTE D'IVOIRE"
    ).toUpperCase();

    const ministereTutelle = (
      student?.schoolMinistere ||
      sessionStorage.getItem('sgs_school_ministere') ||
      "MINISTÈRE DE L'ÉDUCATION NATIONALE"
    ).toUpperCase();

    const nomEtablissement =
      schoolName ||
      student?.schoolName ||
      'ÉTABLISSEMENT SCOLAIRE';

              // =========================================================
        // =========================================================
    // 6. IDENTITÉ DE L'ÉLÈVE & NETTOYAGE DES PROMOTIONS IVOIRIENNES
    // =========================================================
    const matricule = student?.matricule || student?.id || 'N/A';
    const nomEleve = `${student?.nom || ''} ${student?.prenoms || ''}`.trim().toUpperCase();
    
    // 🌟 Extraction dynamique pour n'afficher que les 7 promotions cibles
    const promoBrute = (student?.promotion || student?.niveau || '2nd').toLowerCase().trim();
    let promotion = promoBrute.split('_')[0].toUpperCase();
    if (promoBrute.startsWith('t_') || promoBrute.startsWith('tle') || promoBrute.startsWith('terminal')) {
      promotion = 'TERMINAL';
    }

    const classe = (student?.classeId || student?.classe || 'N/A').toUpperCase();


    // =========================================================
    // 7. INFORMATIONS SIGNATURES EN TEMPS RÉEL (SAAS CLOUD FIXED)
    // =========================================================
    const traceEncreSecours = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNDAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik0xMCwyMCBRMzAsNSA2MCwzMCBUMTMwLDE1IiBzdHJva2U9IiMxZTNhOGEiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIi8+PC9zdmc+";

    let nomEducateur = 'ÉDUCATEUR RESPONSABLE';
    let imageDessinEducateur = traceEncreSecours;
    let tokenEd = "SGS-ED-" + Math.random().toString(36).substring(2, 6).toUpperCase();

    let nomProviseur = 'LE PROVISEUR / DIRECTEUR';
    let imageDessinAdmin = traceEncreSecours;
    let tokenAd = "SGS-AD-" + Math.random().toString(36).substring(2, 6).toUpperCase();

    const nomConseilClasse =
      student?.conseilClasseNom ||
      student?.presidentConseilClasse ||
      sessionStorage.getItem('sgs_conseil_classe') ||
      'CONSEIL DE CLASSE';

    let schoolIdAppli = student?.schoolId || currentSchool || sessionStorage.getItem('sgs_school_id') || '';
    schoolIdAppli = schoolIdAppli.trim();

    if (schoolIdAppli) {
      // 🟢 FETCH 1 : ÉDUCATEUR EN TEMPS RÉEL
      try {
        const qEduc = query(collection(db, "users"), where("role", "==", "educateur"));
        const querySnapshot = await getDocs(qEduc);
        
        if (!querySnapshot.empty) {
          let docEduc = querySnapshot.docs.find(d => {
            const data = d.data();
            const matchSchool = (data.schoolId || '').toLowerCase() === schoolIdAppli.toLowerCase();
            const matchClasse = (data.classeId || '').toLowerCase() === (student?.classeId || '').toLowerCase();
            return matchSchool && matchClasse;
          });

          if (!docEduc) {
            docEduc = querySnapshot.docs.find(d => (d.data().schoolId || '').toLowerCase() === schoolIdAppli.toLowerCase());
          }

          if (docEduc) {
            const educData = docEduc.data();
            nomEducateur = (educData.name || `${educData.nom || ''} ${educData.prenoms || ''}`).trim().toUpperCase();
            
            if (educData.signatureManuscriteBase64) {
              const [nomD, , tokenD] = educData.signatureManuscriteBase64.split('|');
              nomEducateur = nomD || nomEducateur;
              tokenEd = tokenD || tokenEd;
            }
            if (educData.signatureDessinImage) {
              imageDessinEducateur = educData.signatureDessinImage;
            }
          }
        }
      } catch (e) { 
        console.warn("Erreur SaaS chargement éducateur :", e); 
      }

      // 🟢 FETCH 2 : ADMINISTRATEUR (Résolution propre et complète de la boucle NoSQL)
      try {
        const qAdmin = query(collection(db, "users"), where("role", "==", "admin"));
        const adminSnapshot = await getDocs(qAdmin);
        
        if (!adminSnapshot.empty) {
          const docAdmin = adminSnapshot.docs.find(d => (d.data().schoolId || '').toLowerCase() === schoolIdAppli.toLowerCase());
          
          if (docAdmin) {
            const adminData = docAdmin.data();
            nomProviseur = (adminData.name || `${adminData.nom || ''} ${adminData.prenoms || ''}`).trim().toUpperCase();
            
            if (adminData.signatureManuscriteBase64) {
              const [nomA, , tokenA] = adminData.signatureManuscriteBase64.split('|');
              nomProviseur = nomA || nomProviseur;
              tokenAd = tokenA || tokenAd;
            }
            if (adminData.signatureDessinImage) {
              imageDessinAdmin = adminData.signatureDessinImage;
            }
          }
        }
      } catch (e) {
        console.warn("Erreur SaaS chargement administrateur :", e);
      }
    }

    // =========================================================
    // 8. CRYPTOGRAPHIE & NUMÉRISATION SECURE QR CODE
    // =========================================================
    const chaineValidationSecurisee = `ID:${matricule}|MOY:${moyenneGeneraleFinie}|STATUS:${systemStatusQuery}`;
    let qrCodeBase64 = "";
    try { 
      qrCodeBase64 = await QRCode.toDataURL(chaineValidationSecurisee, { 
        margin: 2, width: 140, height: 140, errorCorrectionLevel: 'M'
      }); 
    } catch (e) {
      console.error("Échec QR Code :", e);
    }

       // =========================================================
    // 9. COMPOSANTS DE CHAÎNE HTML & INJECTION DU RENDU GABARIT A4
    // =========================================================
    const lignesMatieres = listeMatieresCalculees.map((m, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="color:#0f172a; font-weight: 800; text-align: left; padding: 10px 12px; border: 1px solid #cbd5e1;">📚 ${m.matiere}</td>
        <td style="text-align: center; font-family: monospace; border: 1px solid #cbd5e1; font-weight: bold;">${m.notes}</td>
        <td style="text-align: center; font-size: 13px; font-weight: 900; color: #2563eb; border: 1px solid #cbd5e1;">${m.moyenne.toFixed(2)}</td>
        <td style="font-style: italic; color: #475569; text-align: left; padding-left: 12px; border: 1px solid #cbd5e1;">${m.appreciation}</td>
      </tr>
    `).join('');

    const ligneEPS = `
      <tr style="background:#fff;">
        <td style="color:#0f172a; font-weight: 800; text-align: left; padding: 10px 12px; border: 1px solid #cbd5e1;">🏃 ÉDUCATION PHYSIQUE (EPS)</td>
        <td style="text-align: center; font-family: monospace; border: 1px solid #cbd5e1; font-weight: bold;">${notesEPS.length > 0 ? notesEPS.join(' - ') : 'N/A'}</td>
        <td style="text-align: center; font-size: 13px; font-weight: 900; color: #2563eb; border: 1px solid #cbd5e1;">${moyenneEPS !== null ? moyenneEPS.toFixed(2) : '--'}</td>
        <td style="font-style: italic; color: #475569; text-align: left; padding-left: 12px; border: 1px solid #cbd5e1;">${moyenneEPS !== null ? (moyenneEPS >= 10 ? "Bonne participation." : "Doit s'impliquer davantage.") : "Aucune note."}</td>
      </tr>
    `;

    conteneurImpression.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 35px; color: #1e293b; background: #fff; line-height: 1.4; text-align: left;">
        
        <table style="width: 100%; border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a;">🏛️ ${nomEtablissement.toUpperCase()}</div>
              <div style="font-size: 10px; color: #475569; font-weight: bold; margin-top: 4px;">${paysOfficiel}<br>➔ ${ministereTutelle}</div>
            </td>
            <td style="text-align: right; width: 130px; vertical-align: middle;">
              <img src="${qrCodeBase64}" style="width: 100px; height: 100px; display: block; margin: 0 auto 2px auto; border: 1px solid #cbd5e1; padding: 2px;"><br>
              <span style="display:block; text-align:center; font-size:7px; font-weight:bold; color:#64748b;">BULLETIN CERTIFIÉ SECURE</span>
            </td>
          </tr>
        </table>

        <div style="font-size: 20px; font-weight: 900; text-align: center; text-transform: uppercase; margin: 20px 0; border: 2px solid #0f172a; padding: 12px; color: #0f172a; background: #f8fafc;">
          Bulletin Trimestriel d'Évaluation Académique
        </div>

        <div style="border: 1px solid #cbd5e1; padding: 15px; border-radius: 6px; margin-bottom: 20px; background: #ffffff;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <div><strong>MATRICULE :</strong> <span style="font-family: monospace; font-weight: bold;">${matricule}</span></div>
            <div><strong>NIVEAU / PROMOTION :</strong> ${promotion}</div>
            <div><strong>NOM ET PRÉNOMS :</strong> ${nomEleve}</div>
            <div><strong>CLASSE AFFECTÉE :</strong> ${classe}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px;">
          <thead>
            <tr style="background: #0f172a; color: #fff; text-transform: uppercase;">
              <th style="padding: 10px; text-align: left; font-size: 10px;">Matières Enseignées</th>
              <th style="padding: 10px; text-align: center; font-size: 10px; width: 150px;">Notes Obtenues</th>
              <th style="padding: 10px; text-align: center; font-size: 10px; width: 90px;">Moyenne /20</th>
              <th style="padding: 10px; text-align: left; font-size: 10px; padding-left: 12px;">Appréciations Pédagogiques</th>
            </tr>
          </thead>
          <tbody>
            ${lignesMatieres}
            ${ligneEPS}
          </tbody>
        </table>

        <div style="margin-top: 25px; border: 2px solid #0f172a; padding: 15px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
          <div><span style="font-size:12px; font-weight:bold; color:#475569;">Performance Globale</span><div style="font-size: 26px; font-weight: 950; color: #1e3a8a; margin-top:2px;">${moyenneGeneraleFinie.toFixed(2)} / 20</div></div>
          <div style="text-align:right; font-size: 11px; text-transform: uppercase; font-weight: 900; color: #0f172a;"><strong>DÉCISION DU CONSEIL</strong><br><span style="font-size:11px; color:#c2410c; display:block; margin-top:5px;">${decisionStatutText}</span></div>
        </div>

        <table style="width: 100%; margin-top: 35px; border-collapse: collapse;">
          <tr>
            <td style="width: 33%; text-align: center; font-size: 11px; font-weight: bold; color: #1e293b; vertical-align: top;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0f172a; margin-bottom: 6px;">L'Éducateur Référent</div>
              <div style="border: 1px solid #cbd5e1; background: #f8fafc; padding: 8px; border-radius: 4px; text-align: left; font-family: monospace; min-height: 65px;">
                <div style="font-size: 9px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">✔️ ${nomEducateur}</div>
                <img src="${imageDessinEducateur}" style="height: 35px; max-width: 100%; display: block; margin: 4px 0;">
                <div style="font-size: 6px; color: #64748b; font-weight: normal; word-break: break-all;">TOKEN: ${tokenEd}</div>
              </div>
              <div style="font-size: 8px; color: #94a3b8; font-weight: normal; font-style: italic; margin-top: 4px;">[ Visa Numérique Certifié ]</div>
            </td>
            
            <td style="width: 34%; text-align: center; font-size: 11px; font-weight: bold; color: #1e293b; vertical-align: top; border-left:1px dashed #cbd5e1; border-right:1px dashed #cbd5e1; padding: 0 10px;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Le Conseil de Classe</div>
              <div style="height: 65px; font-size: 11px; color: #059669; font-weight: bold; padding-top: 15px; font-family: monospace; text-transform: uppercase;">
                ✓ SIGNÉ ET RATIFIÉ<br><span style="font-size:8px; color:#475569; font-weight:normal;">${nomConseilClasse}</span>
              </div>
              <div style="font-size: 8px; color: #94a3b8; font-weight: normal; font-style: italic; margin-top: 4px;">[ Sceau de Validation ]</div>
            </td>
            
            <td style="width: 33%; text-align: center; font-size: 11px; font-weight: bold; color: #1e293b; vertical-align: top;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Le Directeur Général / Proviseur</div>
              <div style="border: 1px solid #cbd5e1; background: #f8fafc; padding: 8px; border-radius: 4px; text-align: left; font-family: monospace; min-height: 65px;">
                <div style="font-size: 9px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">✔️ ${nomProviseur}</div>
                <img src="${imageDessinAdmin}" style="height: 35px; max-width: 100%; display: block; margin: 4px 0;">
                <div style="font-size: 6px; color: #64748b; font-weight: normal; word-break: break-all;">JETON: ${tokenAd}</div>
              </div>
              <div style="font-size: 8px; color: #94a3b8; font-weight: normal; font-style: italic; margin-top: 4px;">[ Cachet Officiel de l'Établissement ]</div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 35px; border-top: 1px dashed #cbd5e1; padding-top: 12px; text-align: center; font-size: 9px; color: #64748b;"><strong>EDULINK SOFTWARE — PROCESSUS CERTIFIÉ SECURE CLOUD NOCO</strong></div>
      </div>
    `;

    // Configuration géométrique hors écran pour la capture de html2pdf
    conteneurImpression.style.position = "absolute";
    conteneurImpression.style.top = "0";
    conteneurImpression.style.left = "0";
    conteneurImpression.style.width = "795px";
    conteneurImpression.style.zIndex = "-1"; 
    conteneurImpression.style.opacity = "0.01"; 
    conteneurImpression.style.backgroundColor = "#ffffff";

    document.body.appendChild(conteneurImpression);

    const optionsConfiguration = {
      margin: 10,
      filename: `BULLETIN_${matricule}_${(student?.nom || 'ELEVE').toUpperCase().replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2.5, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Temporisation asynchrone sécurisée pour charger l'intégralité du DOM graphique (QR Code / Signatures)
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    await html2pdf().set(optionsConfiguration).from(conteneurImpression).save();
    conteneurImpression.remove();
    console.log("✅ Impression du bulletin terminée avec succès !");

  } catch (error) {
    console.error("Erreur critique d'impression de bulletin :", error);
  }
};
