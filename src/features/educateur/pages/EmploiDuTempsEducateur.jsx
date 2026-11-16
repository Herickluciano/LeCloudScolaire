// src/features/educateur/pages/EmploiDuTempsEducateur.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import html2pdf from 'html2pdf.js';

const EmploiDuTempsEducateur = () => {
  const { schoolId, schoolName, user } = useAuth();

  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_moderne_gagnoa'
  )
    .trim()
    .toLowerCase();

  // 🎯 EXTRACTION DYNAMIQUE DE LA PROMOTION DE L'ÉDUCATEUR DEPUIS FIRESTORE
  const promotionEducateur = useMemo(() => {
    if (!user) return '';
    // Extraction du champ exact détecté dans votre document "assigned_promotion"
    const promo = user.assigned_promotion || user.promotion || user.niveauAffecte || '';
    return String(promo).trim().toLowerCase();
  }, [user]);

  // ============================================================
  // ÉTATS COMPOSANTS
  // ============================================================
  const [classesPromotion, setClassesPromotion] = useState([]);
  const [planningsPromotion, setPlanningsPromotion] = useState([]);
  const [classeFiltre, setClasseFiltre] = useState('');
  const [loading, setLoading] = useState(true);

  // Fiche école pour l'en-tête officiel du PDF
  const [metaSchool, setMetaSchool] = useState({
    pays: '',
    devise: '',
    ministere: '',
    anneeScolaire: '',
    nomEtablissement: ''
  });

  // ============================================================
  // CHARGEMENT SYNCHRONISÉ EN TEMPS RÉEL (FIRESTORE CLOUD)
  // ============================================================
  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    // A. FILTRAGE DES CLASSES APPARTENANT À LA PROMOTION DE L'ÉDUCATEUR
    const qClasses = query(
      collection(db, 'classes'), 
      where('schoolId', '==', currentSchool)
    );
    
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        // Alignement sur votre champ Firestore "promotion" (ex: "6eme", "1ere")
        const classePromo = String(data.promotion || '').toLowerCase().trim();
        const educateurPromo = promotionEducateur.trim();

        // L'éducateur ne voit que les classes de son niveau assigné
        if (!educateurPromo || classePromo === educateurPromo) {
          list.push({ id: d.id, ...data });
        }
      });
      const sorted = list.sort((a, b) => (a.nom || a.name || '').localeCompare(b.nom || b.name || ''));
      setClassesPromotion(sorted);
    });

    // B. CHARGEMENT DES EMPLOIS DU TEMPS DE L'ÉTABLISSEMENT
    const qPlannings = query(
      collection(db, 'emplois_du_temps'), 
      where('schoolId', '==', currentSchool)
    );
    
    const unsubPlannings = onSnapshot(qPlannings, (snap) => {
      const list = [];
      snap.forEach((d) => { list.push({ id: d.id, ...d.data() }); });
      setPlanningsPromotion(list);
      setLoading(false);
    }, (error) => {
      console.error('Erreur écoute des emplois du temps :', error);
      setLoading(false);
    });

    // C. EN-TÊTE INSTITUTIONNEL DYNAMIQUE DE L'ÉCOLE
    const docSchoolRef = doc(db, 'schools', currentSchool);
    const unsubSchool = onSnapshot(docSchoolRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMetaSchool({
          pays: data.pays || '',
          devise: data.devise || '',
          ministere: data.ministere || '',
          anneeScolaire: data.anneeScolaire || data.annee || '',
          nomEtablissement: data.nom || data.name || schoolName || currentSchool.replace(/_/g, ' ')
        });
      }
    });

    return () => { unsubClasses(); unsubPlannings(); unsubSchool(); };
  }, [currentSchool, schoolName, promotionEducateur]);

  // ============================================================
  // COMPILATION FILTRÉE DES ATTRIBUTIONS HORAIRES
  // ============================================================
  const planningsFiltres = useMemo(() => {
    // 1. On isole uniquement les plannings qui concernent les classes de sa promotion
    let planningsNiveau = planningsPromotion.filter((p) => {
      const idClasseDoc = String(p.classeId).toLowerCase().trim();
      return classesPromotion.some((c) => c.id.toLowerCase().trim() === idClasseDoc);
    });

    // 2. Application du menu déroulant si une classe spécifique est sélectionnée
    if (classeFiltre) {
      const cible = String(classeFiltre).trim().toLowerCase();
      planningsNiveau = planningsNiveau.filter((p) => {
        const matchDirect = String(p.classeId).trim().toLowerCase() === cible;
        const matchTableau = p.creneaux && p.creneaux.some((c) => String(c.classeId).trim().toLowerCase() === cible);
        return matchDirect || matchTableau;
      });
    }

    return planningsNiveau;
  }, [planningsPromotion, classesPromotion, classeFiltre]);

  // ============================================================
  // EXPORTATION PDF TRANSPARENTE ET SÉCURISÉE POUR LES FAMILLES
  // ============================================================
  const handleTelechargerPDFClasse = async (planning) => {
    const nomClasseAffiche = planning.classeNom || planning.creneaux?.[0]?.nomClasse || "Division";

    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a; background: #ffffff;">
        
        <!-- EN-TÊTE EXTRAIT DE FIRESTORE CLOUD -->
        <div style="width: 100%; text-align: center; border-top: 4px solid #7c3aed; padding-top: 16px;">
          <h1 style="font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 12px 0 0 0;">
            🏛️ ${String(metaSchool.nomEtablissement).toUpperCase()} 🏛️
          </h1>
          <div style="margin-top: 4px;">
            ${metaSchool.pays ? `<p style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #1f2937; margin: 4px 0 0 0;">${metaSchool.pays}</p>` : ''}
            ${metaSchool.devise ? `<p style="font-size: 10px; color: #9ca3af; font-style: italic; margin: 2px 0 0 0;">${metaSchool.devise}</p>` : ''}
            ${metaSchool.ministere ? `<p style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #7c3aed; max-w: 600px; margin: 8px auto 0 auto; line-height: 1.4;">${metaSchool.ministere}</p>` : ''}
          </div>
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #f3f4f6;">
            <h2 style="font-size: 16px; font-weight: 900; color: #111827; text-transform: uppercase; margin: 0;">
              Emploi du Temps Officiel — ${nomClasseAffiche.toUpperCase()}
            </h2>
            ${metaSchool.anneeScolaire ? `<p style="font-size: 10px; color: #9ca3af; margin: 4px 0 0 0; font-family: monospace;">Session Académique : ${metaSchool.anneeScolaire}</p>` : ''}
          </div>
        </div>

        <!-- GRILLE DE REGIME HORAIRE -->
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; margin-top: 25px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase;">
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Jour</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Horaires</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Discipline / Cours</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Enseignant Mandaté</th>
            </tr>
          </thead>
          <tbody>
            ${planning.creneaux ? planning.creneaux.map((c) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 900; text-transform: uppercase; color: #7c3aed;">${c.jour || 'Lundi'}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #c2410c;">${c.heureDebut} - ${c.heureFin}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">${c.matiere}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; color: #475569;">👨‍🏫 ${c.professeurName || 'Titulaire'}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="padding:10px; text-align:center;">Aucun cours enregistré</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 40px; text-align: right; font-size: 9px; font-style: italic; color: #94a3b8;">
          Document certifié et transmis par le bureau d'encadrement le ${new Date().toLocaleDateString('fr-FR')}.
        </div>
      </div>
    `;

    const options = {
      margin: 10,
      filename: `EDT_OFFICIEL_${nomClasseAffiche.replace(/\s+/g, '_')}.pdf`,
      html2canvas: { scale: 2.5, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(options).from(element).save();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Chargement de l'espace horaire de votre promotion...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen text-gray-700 text-left animate-fadeIn">
      
      {/* BANDEAU SUPÉRIEUR */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Espace Horaires & Emplois du Temps</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Promotion sous votre responsabilité : <span className="text-purple-400 font-black uppercase">{promotionEducateur || 'Non spécifiée'}</span>
          </p>
        </div>
        
        {/* SÉLECTEUR FILTRAGE CLASSE */}
        <select
          value={classeFiltre}
          onChange={(e) => setClasseFiltre(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-orange-400 rounded-xl px-4 py-2.5 text-xs font-black outline-none cursor-pointer"
        >
          <option value="">-- Toutes les classes de votre promotion --</option>
          {classesPromotion.map((cl) => (
            <option key={cl.id} value={cl.id}>
              🏛️ CLASSE : {String(cl.nom || cl.name).toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* COMPOSITE GRILLE DES DOCUMENTS */}
      {planningsFiltres.length === 0 ? (
        <div className="py-20 text-center text-xs font-bold text-gray-400 italic bg-white border rounded-2xl shadow-3xs">
          💡 Aucun emploi du temps officiel n'est actuellement publié sur le serveur Cloud pour votre promotion.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {planningsFiltres.map((planning) => {
            const aDesCreneaux = planning.creneaux && planning.creneaux.length > 0;
            const nomClasseAffichage = planning.classeNom || (aDesCreneaux ? planning.creneaux[0].nomClasse : '') || 'Division';

            return (
              <div key={planning.id} className="border rounded-2xl p-5 bg-white shadow-xs relative font-bold text-xs space-y-4">
                
                {/* BOUTON TÉLÉCHARGEMENT PDF POUR ENVOI AUX PARENTS */}
                <button
                  type="button"
                  onClick={() => handleTelechargerPDFClasse(planning)}
                  className="absolute top-4 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-sm"
                >
                  🖨️ Communiquer (PDF)
                </button>

                <div className="mb-2 border-b pb-2 text-left">
                  <h3 className="text-purple-900 font-black text-sm uppercase">
                    🏛️ Division : {nomClasseAffichage}
                  </h3>
                  <p className="text-[9px] text-gray-400 uppercase font-mono mt-0.5">
                    Certifié Conforme • Session Académique {metaSchool.anneeScolaire || 'En cours'}
                  </p>
                </div>

                {/* TABLEAU DES CRÉNEAUX INTÉGRÉS DANS L'ÉCRAN */}
                <div className="overflow-hidden border border-gray-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                        <th className="p-3">Jour</th>
                        <th className="p-3">Horaires</th>
                        <th className="p-3">Discipline</th>
                        <th className="p-3">Professeur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {planning.creneaux && planning.creneaux.map((cr, i) => (
                        <tr key={i} className="hover:bg-slate-50 font-bold transition">
                          <td className="p-3 text-purple-700 uppercase font-black w-24">
                            [{cr.jour || 'Lundi'}]
                          </td>
                          <td className="p-3 font-mono text-orange-700 bg-gray-50/20 w-36">
                            {cr.heureDebut} - {cr.heureFin}
                          </td>
                          <td className="p-3 text-gray-900 uppercase">
                            📚 {cr.matiere}
                          </td>
                          <td className="p-3 text-gray-400 font-medium uppercase">
                            ({cr.professeurName || 'Titulaire'})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default EmploiDuTempsEducateur;
