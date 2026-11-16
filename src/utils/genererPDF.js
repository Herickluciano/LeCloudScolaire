import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/api';

const texte = (value) =>
  value === null || value === undefined
    ? ''
    : String(value).trim();

const recupererEtablissement = async (data = {}) => {
  const schoolId =
    texte(data?.schoolId) ||
    sessionStorage.getItem('sgs_school_id') ||
    '';

  if (!schoolId) {
    throw new Error("Identifiant de l'établissement introuvable.");
  }

  const snap = await getDoc(
    doc(db, 'schools', schoolId)
  );

  if (!snap.exists()) {
    throw new Error("Établissement introuvable.");
  }

  return {
    ...snap.data(),
    id: snap.id
  };
};

export const genererFicheAvecQRCodePDF = async (
  data = {},
  type = 'eleve'
) => {
  try {
    const etablissement =
      await recupererEtablissement(data);

    const nomCivil =
      texte(data?.nom).toUpperCase() ||
      'NON SPÉCIFIÉ';

    const prenomCivil =
      texte(data?.prenoms) ||
      texte(data?.prenom) ||
      'Non spécifié';

    const rolePersonnel =
      texte(data?.role) ||
      texte(data?.typePersonnel);

    const civilDate =
      texte(data?.dateNaissance) ||
      'Non spécifiée';

    const cmuNumber =
      texte(data?.numSecuriteSociale) ||
      'Non spécifié';

    const contactDirect =
      texte(data?.telephone) ||
      'Non renseigné';

    const currentStatus =
      texte(data?.statut) ||
      'actif';

    const nomEtablissement =
      texte(etablissement?.nom) ||
      texte(data?.schoolName) ||
      etablissement?.id ||
      'Établissement';

    const pays =
      texte(etablissement?.pays);

    const devise =
      texte(etablissement?.devise);

    const ministere =
      texte(etablissement?.ministere);

    const premierResponsable =
      texte(etablissement?.premierResponsable);

    const anneeScolaire =
      texte(data?.anneeScolaire) ||
      texte(data?.annee_scolaire);

    const fonctionPersonnel =
      rolePersonnel === 'professeur'
        ? 'Professeur Enseignant'
        : rolePersonnel === 'prof_principal'
          ? 'Professeur Principal'
          : rolePersonnel === 'educateur'
            ? 'Éducateur de Niveau'
            : rolePersonnel
              ? rolePersonnel
              : 'Personnel';

    const situation =
      currentStatus.replace(/_/g, ' ');

    const texteDuQRCode =
      type === 'eleve'
        ? [
            nomEtablissement,
            'ACCÈS ÉLÈVE',
            `Matricule : ${texte(data?.matricule) || 'N/A'}`,
            `Nom : ${nomCivil}`,
            `Prénom : ${prenomCivil}`,
            `Classe : ${texte(data?.classeId) || 'N/A'}`,
            `Situation : ${situation}`
          ].join('\n')
        : [
            nomEtablissement,
            'ACCÈS PERSONNEL',
            `Identifiant : ${texte(data?.matricule) || 'N/A'}`,
            `Nom : ${nomCivil}`,
            `Prénom : ${prenomCivil}`,
            `Fonction : ${fonctionPersonnel}`,
            `Situation : ${situation}`
          ].join('\n');

    const qrColor =
      currentStatus === 'actif'
        ? '#003366'
        : 'rgb(35, 231, 215)';

    const qrCodeDataUrl =
      await QRCode.toDataURL(
        texteDuQRCode,
        {
          margin: 1,
          width: 150,
          color: {
            dark: qrColor,
            light: '#FFFFFF'
          }
        }
      );

    const pdf = new jsPDF();

    pdf.setTextColor(0, 0, 0);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);

    if (pays) {
      pdf.text(
        pays,
        15,
        15
      );
    }

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(8);

    if (devise) {
      pdf.text(
        devise,
        21,
        19
      );
    }

    if (ministere) {
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(
        ministere,
        15,
        27
      );
    }

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);

    pdf.text(
      nomEtablissement,
      140,
      15
    );

    if (anneeScolaire) {
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(
        anneeScolaire,
        140,
        20
      );
    }

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(8);

    pdf.text(
      type === 'eleve'
        ? `MATRICULE : ${texte(data?.matricule) || 'N/A'}`
        : `ID PERSONNEL : ${texte(data?.matricule) || 'N/A'}`,
      140,
      27
    );

    pdf.setDrawColor(
      200,
      200,
      200
    );

    pdf.line(
      15,
      33,
      195,
      33
    );

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(
      15,
      118,
      110
    );

    pdf.text(
      type === 'eleve'
        ? "FICHE D'IDENTIFICATION & BADGE ÉLÈVE"
        : 'DOSSIER RH & BADGE PERSONNEL',
      15,
      42
    );

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(
      15,
      118,
      110
    );

    pdf.text(
      '1. Informations Civiles',
      15,
      52
    );

    const bodyTableauCivil = [
      [
        'Nom de famille :',
        nomCivil
      ],
      [
        'Prénoms :',
        prenomCivil
      ],
      [
        'Date de Naissance :',
        civilDate
      ],
      [
        'N° Sécurité Sociale :',
        cmuNumber
      ],
      [
        type === 'eleve'
          ? 'Contact Parent / Tuteur :'
          : 'Contact Téléphonique :',
        contactDirect
      ]
    ];

    autoTable(pdf, {
      startY: 55,
      margin: {
        left: 15
      },
      styles: {
        fontSize: 9,
        cellPadding: 2
      },
      theme: 'plain',
      body: bodyTableauCivil,
      columnStyles: {
        0: {
          fontStyle: 'bold',
          width: 50
        },
        1: {
          width: 100
        }
      }
    });

    const currentY =
      pdf.lastAutoTable.finalY + 6;

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(
      15,
      118,
      110
    );

    pdf.text(
      type === 'eleve'
        ? '2. Structure & Affectation'
        : '2. Statut Professionnel',
      15,
      currentY
    );

    const bodyTableauStatut =
      type === 'eleve'
        ? [
            [
              'Promotion / Niveau',
              texte(data?.promotion) ||
                'Non spécifié'
            ],
            [
              'Classe Affectée',
              texte(data?.classeId)
                ? texte(data.classeId)
                    .replace(/_/g, ' ')
                    .toUpperCase()
                : 'Non assignée'
            ],
            [
              'Aptitude Éducation Physique',
              data?.dispensePhysique === 'Oui'
                ? 'Dispensé(e)'
                : 'Apte'
            ]
          ]
        : [
            [
              'Fonction occupée',
              fonctionPersonnel
            ],
            [
              'Discipline / Matière',
              texte(data?.matiereEnseignee) ||
                'Administration'
            ],
            [
              'Grade',
              texte(data?.grade) ||
                'Non renseigné'
            ],
            [
              "Années d'expérience",
              `${texte(data?.anneesExperience) || '0'} ans`
            ]
          ];

    autoTable(pdf, {
      startY: currentY + 3,
      margin: {
        left: 15,
        right: 15
      },
      styles: {
        fontSize: 9,
        cellPadding: 2
      },
      theme: 'grid',
      headStyles: {
        fillColor: [
          15,
          118,
          110
        ],
        textColor: [
          255,
          255,
          255
        ]
      },
      head: [
        [
          type === 'eleve'
            ? 'Critère Scolaire'
            : 'Critère RH',
          'Valeur Officielle'
        ]
      ],
      body: bodyTableauStatut
    });

    const badgeStartY =
      pdf.lastAutoTable.finalY + 12;

    pdf.setDrawColor(
      15,
      118,
      110
    );

    pdf.setLineWidth(0.5);

    pdf.setFillColor(
      255,
      255,
      255
    );

    pdf.rect(
      55,
      badgeStartY,
      100,
      125,
      'FD'
    );

    if (
      currentStatus === 'actif'
    ) {
      pdf.setFillColor(
        15,
        118,
        110
      );
    } else if (
      currentStatus ===
      'suspendu_scolarite'
    ) {
      pdf.setFillColor(
        15,
        118,
        110
      );
    } else {
      pdf.setFillColor(
        15,
        118,
        110
      );
    }

    pdf.rect(
      55.25,
      badgeStartY + 0.25,
      99.5,
      12,
      'F'
    );

    pdf.setFont(
      'Helvetica',
      'bold'
    );

    pdf.setFontSize(10);

    pdf.setTextColor(
      255,
      255,
      255
    );

    pdf.text(
      currentStatus === 'actif'
        ? "BADGE D'ACCÈS"
        : 'ACCÈS INTERDIT',
      105,
      badgeStartY + 8,
      {
        align: 'center'
      }
    );

    pdf.setFont(
      'Helvetica',
      'bold'
    );

    pdf.setFontSize(11);

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.text(
      nomCivil,
      105,
      badgeStartY + 22,
      {
        align: 'center'
      }
    );

    pdf.setFont(
      'Helvetica',
      'normal'
    );

    pdf.setFontSize(10);

    pdf.text(
      prenomCivil,
      105,
      badgeStartY + 27,
      {
        align: 'center'
      }
    );

    pdf.setFont(
      'Helvetica',
      'bold'
    );

    pdf.setFontSize(8);

    pdf.setTextColor(
      100,
      116,
      139
    );

    pdf.text(
      type === 'eleve'
        ? `MATRICULE : ${texte(data?.matricule) || 'N/A'}`
        : `FONCTION : ${fonctionPersonnel}`,
      105,
      badgeStartY + 33,
      {
        align: 'center'
      }
    );

    pdf.setFont(
      'Helvetica',
      'normal'
    );

    pdf.setFontSize(8);

    pdf.setTextColor(
      51,
      65,
      85
    );

    if (
      type === 'eleve'
    ) {
      pdf.text(
        `Classe : ${
          texte(data?.classeId)
            ? texte(data.classeId)
                .replace(/_/g, ' ')
                .toUpperCase()
            : 'N/A'
        }`,
        105,
        badgeStartY + 39,
        {
          align: 'center'
        }
      );

      pdf.text(
        `Contact : ${contactDirect}`,
        105,
        badgeStartY + 44,
        {
          align: 'center'
        }
      );
    } else {
      pdf.text(
        `Discipline : ${
          texte(data?.matiereEnseignee) ||
          'Administration'
        }`,
        105,
        badgeStartY + 39,
        {
          align: 'center'
        }
      );

      pdf.text(
        `Contact : ${contactDirect}`,
        105,
        badgeStartY + 44,
        {
          align: 'center'
        }
      );
    }

    pdf.addImage(
      qrCodeDataUrl,
      'PNG',
      85,
      badgeStartY + 50,
      40,
      40
    );

    if (
      currentStatus === 'actif'
    ) {
      pdf.setFillColor(
        15,
        118,
        110
      );

      pdf.setDrawColor(
       15,
        118,
        110
      );
    } else {
      pdf.setFillColor(
        15,
        118,
        110
      );

      pdf.setDrawColor(
        15,
        118,
        110
      );
    }

    pdf.rect(
      60,
      badgeStartY + 96,
      90,
      22,
      'FD'
    );

    pdf.setFont(
      'Helvetica',
      'bold'
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      currentStatus === 'actif'
        ?225
        : 225,
      currentStatus === 'actif'
        ? 225
        : 225,
      currentStatus === 'actif'
        ? 225
        : 225
    );

    pdf.text(
      currentStatus === 'actif'
        ? 'NOTICE DE SÉCURITÉ'
        : 'COMPTE SUSPENDU',
      105,
      badgeStartY + 101,
      {
        align: 'center'
      }
    );

    pdf.setFont(
      'Helvetica',
      'normal'
    );

    pdf.setFontSize(7);

    if (
      premierResponsable
    ) {
      pdf.text(
        `Responsable : ${premierResponsable}`,
        105,
        badgeStartY + 106,
        {
          align: 'center'
        }
      );
    }

    pdf.text(
      `Établissement : ${nomEtablissement}`,
      105,
      badgeStartY + 110,
      {
        align: 'center'
      }
    );

    pdf.text(
      `Situation : ${situation}`,
      105,
      badgeStartY + 114,
      {
        align: 'center'
      }
    );
     pdf.text(
      `EDULINK : v2.0.26 — Cloud Connected`,
      105,
      badgeStartY + 114,
      {
        align: 'center'
      }
    );

    const nomFichier =
      `Fiche_Badge_${type}_${nomCivil
        .replace(/[^\p{L}\p{N}_-]/gu, '_')}.pdf`;

    pdf.save(
      nomFichier
    );

    return {
      success: true,
      fileName: nomFichier,
      schoolId: etablissement.id
    };
  } catch (error) {
    console.error(
      'Erreur génération fiche/badge PDF :',
      error
    );

    throw error;
  }
};