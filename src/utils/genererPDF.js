import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import QRCode from 'qrcode';

/**
 * 🇨🇮 GÉNÉRATEUR CLOUD : Fiche d'identification + Badge d'accès dynamique temps réel
 */
export const genererFicheAvecQRCodePDF = async (data, type = 'eleve') => {
  const doc = new jsPDF();

  const nomCivil = data.nom ? data.nom.toUpperCase() : 'NON SPÉCIFIÉ';
  const prenomCivil = data.prenom || 'Non spécifié';
  const civilDate = data.dateNaissance || 'Non spécifiée';
  const cmuNumber = data.numSecuriteSociale || 'Non spécifié';
  const contactDirect = data.telephone || 'Non renseigné'; 

   // 🟢 Lecture dynamique du statut Cloud de l'utilisateur ('actif' par défaut)
  const currentStatus = data.statut || 'actif';
  const etatScolaireTexte = currentStatus.toUpperCase().replace(/_/g, ' ');

  // Récupération et formatage propre du nom de l'école pour le QR Code
  // Si le document ne contient pas le nom complet, on utilise le code schoolId nettoyé
  const nomEtablissementOfficiel = data.schoolName || (data.schoolId ? data.schoolId.replace(/_/g, ' ').toUpperCase() : 'ÉTABLISSEMENT SAAS');

  // Encodage dynamique sécurisé dans la puce du QR Code (Avec Nom de l'École)
  let texteDuQRCode = "";
  if (type === 'eleve') {
    texteDuQRCode = `🏛️ ÉCOLE : ${nomEtablissementOfficiel}\n` + // 🟢 AJOUT : Le nom de l'école figure au sommet
      `PORTAIL SCOLAIRE - ACCÈS ÉLÈVE\n` +
      `Matricule: ${data.matricule || 'N/A'}\n` +
      `Nom: ${nomCivil}\n` +
      `Prénom: ${prenomCivil}\n` +
      `Classe: ${data.classeId || 'N/A'}\n` +
      `SITUATION : ${etatScolaireTexte}`;
  } else {
    texteDuQRCode = `🏛️ Établissement : ${nomEtablissementOfficiel}\n` + // 🟢 AJOUT : Le nom de l'école figure au sommet
      `PORTAIL SCOLAIRE - ACCÈS PERSONNEL\n` +
      `Type: ${data.typePersonnel ? data.typePersonnel.toUpperCase() : 'N/A'}\n` +
      `Nom: ${nomCivil}\n` +
      `Prénom: ${prenomCivil}\n` +
      `Grade: ${data.grade || 'N/A'}\n` +
      `SITUATION : ${etatScolaireTexte}`;
  }


  try {
    // Changement de couleur de la puce QR selon la gravité du statut
    const qrColor = currentStatus === 'actif' ? '#003366' : '#990000';

    const qrCodeDataUrl = await QRCode.toDataURL(texteDuQRCode, {
      margin: 1,
      width: 150,
      color: {
        dark: qrColor,
        light: '#FFFFFF'
      }
    });

    // =========================================================================
    // PARTIE 1 : LA FICHE ADMINISTRATIVE NUMÉRIQUE (HAUT DE PAGE)
    // =========================================================================
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text("RÉPUBLIQUE DE CÔTE D'IVOIRE", 15, 15);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text("Union - Discipline - Travail", 21, 19);
    doc.text("-------------", 32, 23);
    doc.setFont('Helvetica', 'bold');
    doc.text("MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION", 15, 27);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`ANNÉE SCOLAIRE : 2025-2026`, 140, 15);
    doc.setFont('Helvetica', 'bold');
    doc.text(type === 'eleve' ? `MATRICULE : ${data.matricule || 'N/A'}` : `ID PERSONNEL : ${data.matricule || 'N/A'}`, 140, 22);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 33, 195, 33);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(211, 84, 0); 
    doc.text(type === 'eleve' ? "FICHE D'IDENTIFICATION & BADGE ÉLÈVE" : "DOSSIER RH & ENREGISTREMENT PERSONNEL", 15, 42);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 51, 102);
    doc.text("1. Informations Civiles", 15, 52);

    const bodyTableauCivil = [
      ['Nom de famille :', nomCivil],
      ['Prénoms :', prenomCivil],
      ['Date de Naissance :', civilDate],
      ['N° Sécurité Sociale (CMU) :', cmuNumber],
      [type === 'eleve' ? 'Contact Parent / Tuteur :' : 'Contact Téléphonique :', contactDirect]
    ];

    autoTable(doc, {
      startY: 55,
      margin: { left: 15 },
      styles: { fontSize: 9, cellPadding: 2 },
      theme: 'plain',
      body: bodyTableauCivil,
      columnStyles: { 0: { fontStyle: 'bold', width: 45 }, 1: { width: 90 } }
    });

    const currentY = doc.lastAutoTable.finalY + 6;
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(type === 'eleve' ? "2. Structure & Affectation" : "2. Statut Professionnel", 15, currentY);

    const bodyTableauStatut = type === 'eleve' ? [
      ['Promotion / Niveau', data.promotion ? data.promotion.toUpperCase() : 'NON SPÉCIFIÉ'],
      ['Classe Affectée', data.classeId ? data.classeId.replace(/_/g, ' ').toUpperCase() : 'Non assignée'],
      ['Aptitude Éducation Physique', data.dispensePhysique === 'Oui' ? 'Dispensé(e)' : 'Apte']
    ] : [
      ['Fonction occupée', data.typePersonnel === 'professeur' ? 'Professeur Enseignant' : 'Éducateur de Niveau'],
      ['Discipline / Matière', data.matiereEnseignee || 'Gestion administrative'],
      ['Grade Fonction Publique', data.grade || 'N/A'],
      ['Années d\'expérience', `${data.anneesExperience || 0} ans`]
    ];

    autoTable(doc, {
      startY: currentY + 3,
      margin: { left: 15, right: 15 },
      styles: { fontSize: 9, cellPadding: 2 },
      theme: 'grid',
      // 🟢 CORRECTION : Couleurs RVB d'en-tête de tableau rétablies (Orange National)
      headStyles: { fillColor: [211, 84, 0], textColor: [255, 255, 255] },
      head: [[type === 'eleve' ? 'Critère Scolaire' : 'Critère RH', 'Valeur Officielle']],
      body: bodyTableauStatut,
      columnStyles: { 0: { fontStyle: 'bold', width: 55 }, 1: { width: 110 } }
    });

    // =========================================================================
    // PARTIE 2 : LE CADRE BADGE REEL SÉCURISÉ (BAS DE PAGE)
    // =========================================================================
    const badgeStartY = doc.lastAutoTable.finalY + 12;

    doc.setDrawColor(15, 23, 42); 
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(55, badgeStartY, 100, 125, 'FD'); 

    // Alerte visuelle de couleur sur l'en-tête du badge selon le statut
    if (currentStatus === 'actif') {
      doc.setFillColor(211, 84, 0); 
    } else if (currentStatus === 'suspendu_scolarite') {
      doc.setFillColor(219, 140, 0); 
    } else {
      doc.setFillColor(180, 0, 0); 
    }
    doc.rect(55.25, badgeStartY + 0.25, 99.5, 12, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(currentStatus === 'actif' ? "BADGE D'ACCÈS SCOLAIRE" : `ACCÈS INTERDIT`, 105, badgeStartY + 8, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${nomCivil}`, 105, badgeStartY + 22, { align: 'center' });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${prenomCivil}`, 105, badgeStartY + 27, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(type === 'eleve' ? `MATRICULE : ${data.matricule || 'N/A'}` : `FONCTION : ${data.typePersonnel?.toUpperCase() || 'N/A'}`, 105, badgeStartY + 33, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    if (type === 'eleve') {
      doc.text(`Classe : ${data.classeId ? data.classeId.replace(/_/g, ' ').toUpperCase() : 'N/A'}`, 105, badgeStartY + 39, { align: 'center' });
      doc.text(`Urgence Parent : ${contactDirect}`, 105, badgeStartY + 44, { align: 'center' }); 
    } else {
      doc.text(`Discipline : ${data.matiereEnseignee || 'Administration'}`, 105, badgeStartY + 39, { align: 'center' });
      doc.text(`Contact : ${contactDirect}`, 105, badgeStartY + 44, { align: 'center' });
    }

    doc.addImage(qrCodeDataUrl, 'PNG', 85, badgeStartY + 50, 40, 40);

    if (currentStatus === 'actif') {
      doc.setFillColor(254, 249, 195); 
      doc.setDrawColor(254, 240, 138);
    } else {
      doc.setFillColor(254, 226, 226); 
      doc.setDrawColor(254, 202, 202);
    }
    doc.rect(60, badgeStartY + 96, 90, 22, 'FD');

    // 🟢 CORRECTION : Remplacement des arguments vides par des couleurs RVB valides solides
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    if (currentStatus === 'actif') {
      doc.setTextColor(146, 64, 14); // Marron pour notice normale
    } else {
      doc.setTextColor(153, 27, 27); // Rouge foncé pour alerte suspension
    }
    doc.text(currentStatus === 'actif' ? "NOTICE DE SÉCURITÉ OBLIGATOIRE" : "SIGNALEMENT : COMPTE SUSPENDU", 105, badgeStartY + 101, { align: 'center' });
    
    doc.setFont('Helvetica', 'normal');
    if (currentStatus === 'actif') {
      doc.text("Ce badge est strictement personnel. Le titulaire", 105, badgeStartY + 106, { align: 'center' });
      doc.text("doit présenter ce QR Code aux portiques de contrôle", 105, badgeStartY + 110, { align: 'center' });
      doc.text("sous peine de refus d'accès immédiat.", 105, badgeStartY + 114, { align: 'center' });
    } else {
      doc.text("L'accès à cet établissement est refusé en direct.", 105, badgeStartY + 106, { align: 'center' });
      doc.text(`Motif : ${etatScolaireTexte}.`, 105, badgeStartY + 110, { align: 'center' });
      doc.text("Veuillez vous diriger vers le secrétariat.", 105, badgeStartY + 114, { align: 'center' });
    }

    doc.save(`Fiche_Badge_${type}_${nomCivil}.pdf`);

  } catch (err) {
    console.error("Erreur de compilation du document PDF :", err);
  }
};
