import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom'; // 🟢 Correction : Importation groupée unique
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const ListePromotion = () => {
  const { niveau } = useParams(); // Récupère la promotion depuis l'URL (ex: 6eme, T_D)
  const { schoolId, schoolName } = useAuth(); // Extrait les verrous multi-écoles SaaS de la session

  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔄 ÉCOUTE DU CLOUD EN TEMPS RÉEL (onSnapshot)
  useEffect(() => {
    setLoading(true);
    const currentSchool = schoolId || 'lycee_classique_abidjan';

    // Règle d'or SaaS : Charger uniquement les élèves du rôle 'eleve' de CETTE école spécifique
    const q = query(
      collection(db, "users"),
      where("role", "==", "eleve"),
      where("schoolId", "==", currentSchool)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filtrage dynamique selon le niveau de la promotion sélectionné
        const matchNiveau = niveau 
          ? data.promotion?.toLowerCase() === niveau.toLowerCase() || data.classeId?.startsWith(niveau)
          : true;

        if (matchNiveau) {
          list.push({ id: doc.id, ...data });
        }
      });
      
      setEleves(list);
      setLoading(false);
    }, (err) => {
      console.error("Erreur d'écoute Cloud de la promotion :", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [niveau, schoolId]);

  // ==========================================
  // GENERATION DE LA FICHE PDF OFFICIELLE MENA
  // ==========================================
  const genererFicheIndividuellePDF = (eleve) => {
    const doc = new jsPDF();

    // Entête Administratif National Ivoirien
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("RÉPUBLIQUE DE CÔTE D'IVOIRE", 15, 15);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text("Union - Discipline - Travail", 22, 19);
    doc.text("-------------", 32, 23);

    doc.setFont('Helvetica', 'bold');
    doc.text("MINISTÈRE DE L'ÉDUCATION NATIONALE", 15, 27);
    doc.text("ET DE L'ALPHABÉTISATION", 25, 31);

    // Métadonnées d'identification à droite
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text("ANNÉE SCOLAIRE : 2025-2026", 135, 15);

    doc.setFont('Helvetica', 'bold');
    doc.text(`MATRICULE : ${eleve.matricule || eleve.id}`, 135, 22);
    doc.text("STATUT : INSCRIT RÉGULIER", 135, 27);

    doc.line(15, 37, 195, 37);

    // Titre de la Fiche Ministérielle
    doc.setFontSize(15);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(211, 84, 0); // Orange National
    doc.text("FICHE INDIVIDUELLE D'IDENTIFICATION ÉLÈVE", 105, 48, { align: 'center' });

    // Cadre de la photo d'identité réglementaire
    doc.setDrawColor(150, 155, 150);
    doc.setFillColor(250, 250, 250);
    doc.rect(155, 55, 35, 35, 'FD');
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text("[ Photo d'Identité ]", 172, 73, { align: 'center' });

    // Section 1 : État Civil
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 51, 102); // Bleu nuit
    doc.text("1. Informations d'État Civil", 15, 60);

    autoTable(doc, {
      startY: 64,
      margin: { left: 15 },
      styles: { fontSize: 10, cellPadding: 2.5 },
      theme: 'plain',
      body: [
        ["Nom de famille :", (eleve.nom || '').toUpperCase()],
        ["Tous les prénoms :", eleve.prenoms || eleve.prenom || 'N/A'],
        ["Date de naissance :", eleve.dateNaissance || "Non spécifiée"],
        ["Établissement de provenance :", eleve.etablissementProvenance || eleve.ecoleProvenance || "N/A"],
        ["N° Immatriculation CMU :", eleve.numSecuriteSociale || "Non spécifié"]
      ],
      columnStyles: { 0: { fontStyle: 'bold', width: 52 } }
    });

    // Section 2 : Affectation Scolaire
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 51, 102);
    doc.text("2. Affectation Académique", 15, y);

    autoTable(doc, {
      startY: y + 4,
      margin: { left: 15, right: 15 },
      styles: { fontSize: 10, cellPadding: 3 },
      theme: 'grid',
      head: [["Paramètre de Scolarité", "Valeur Officielle"]],
      body: [
        ["Structure / École d'Affectation", schoolName || "Établissement rattaché"],
        ["Promotion / Niveau global", eleve.promotion ? eleve.promotion.toUpperCase() : (niveau || "N/A").toUpperCase()],
        ["Classe Physique Affectée", eleve.classeId || eleve.classe || "N/A"],
        ["Total Heures d'Absences", `${eleve.absences || 0} Heures`],
        ["Aptitude Éducation Physique (EPS)", eleve.dispensePhysique === "Oui" ? "Dispensé(e)" : "Apte"]
      ]
    });

    // Signature et Validation de la Direction
    const finalY = doc.lastAutoTable.finalY + 22;
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("Le Chef d'Établissement", 150, finalY, { align: 'center' });
    doc.setFont('Helvetica', 'italic');
    doc.text("(Cachet et Signature)", 150, finalY + 5, { align: 'center' });

    // Téléchargement physique du PDF
    doc.save(`Fiche_Officielle_${eleve.matricule || eleve.id}_${eleve.nom}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center bg-white font-sans rounded-xl p-8 shadow">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-3"></div>
        <p className="text-gray-500 text-xs font-semibold">Synchronisation avec le Cloud Midnight...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-xl shadow-md my-6 font-sans">
      
      <div className="mb-5 flex justify-between items-center">
        <Link
          to="/admin/dashboard"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-xs shadow-xs transition"
        >
          ⬅️ Retour au Dashboard
        </Link>
        <span className="text-[10px] font-mono font-bold bg-orange-50 text-orange-600 px-2.5 py-1 rounded">
          SaaS Client ID : {schoolId}
        </span>
      </div>

      <h1 className="text-2xl font-black text-gray-800 mb-2 tracking-tight">
        📚 Registre Réel de la Promotion {niveau && ` : ${niveau.toUpperCase()}`}
      </h1>
      <p className="text-xs text-gray-400 mb-6 uppercase font-bold tracking-wide">Établissement : {schoolName}</p>

      <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full border-collapse text-sm text-left">
          <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-600 border-b">
            <tr>
              <th className="p-4">Matricule MENA</th>
              <th className="p-4">Nom & Prénoms</th>
              <th className="p-4">Classe</th>
              <th className="p-4 text-center">Impression Officielle</th>
            </tr>
          </thead>
          <tbody className="divide-y text-gray-600">
            {eleves.map((eleve) => (
              <tr key={eleve.id} className="hover:bg-gray-50 transition">
                <td className="p-4 font-mono font-bold text-blue-600">
                  {eleve.matricule || eleve.id}
                </td>
                <td className="p-4 font-bold text-gray-800 uppercase">
                  {eleve.nom} {eleve.prenoms || eleve.prenom}
                </td>
                <td className="p-4 font-semibold uppercase">
                  {eleve.classeId || eleve.classe}
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => genererFicheIndividuellePDF(eleve)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-extrabold shadow-sm transition"
                  >
                    🖨️ Fiche PDF MENA
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {eleves.length === 0 && (
        <div className="p-12 text-center text-gray-400 font-medium border border-dashed rounded-xl mt-4">
          Aucun élève inscrit sur le réseau cloud pour la promotion {niveau?.toUpperCase()} dans votre établissement.
        </div>
      )}

    </div>
  );
};

export default ListePromotion;
