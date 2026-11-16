// src/features/professeur/pages/EmploiDuTempsProf.jsx
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
import Header from '../../../pages/Header';

const EmploiDuTempsProf = () => {
  const { schoolId, schoolName, user } = useAuth();

  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_moderne_gagnoa'
  )
    .trim()
    .toLowerCase();

  const LES_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

   // ============================================================
  // NOM ÉTABLISSEMENT
  // ============================================================

  const nomEtablissement =
    schoolName ||
    sessionStorage.getItem('sgs_school_name') ||
    currentSchool
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (lettre) =>
        lettre.toUpperCase()
      ) ||
    'Établissement';

  // ============================================================
  // ÉTATS COMPOSANTS
  // ============================================================
  const [planningsGlobaux, setPlanningsGlobaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jourFiltre, setJourFiltre] = useState('');

  // Fiche école pour l'en-tête officiel du PDF personnel
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

    // A. CHARGEMENT DE TOUS LES EMPLOIS DU TEMPS DE L'ÉTABLISSEMENT
    const qPlannings = query(
      collection(db, 'emplois_du_temps'), 
      where('schoolId', '==', currentSchool)
    );
    
    const unsubPlannings = onSnapshot(qPlannings, (snap) => {
      const list = [];
      snap.forEach((d) => { list.push({ id: d.id, ...d.data() }); });
      setPlanningsGlobaux(list);
      setLoading(false);
    }, (error) => {
      console.error('Erreur écoute des emplois du temps :', error);
      setLoading(false);
    });

    // B. EN-TÊTE INSTITUTIONNEL DYNAMIQUE DE L'ÉCOLE
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

    return () => { unsubPlannings(); unsubSchool(); };
  }, [currentSchool, schoolName]);

  // ============================================================
  // EXTRACTION ET TRI DES CRÉNEAUX SPECIFIQUES AU PROFESSEUR
  // ============================================================
  const monPlanningPersonnel = useMemo(() => {
    if (!user) return [];
    
    // Identifiant unique du prof connecté (ex: PROF_GUESSAN_218)
    const monIdProf = String(user.id || user.matricule || '').trim().toLowerCase();
    const extractionCreneaux = [];

    // On parcourt les documents de toutes les classes
    planningsGlobaux.forEach((planning) => {
      if (Array.isArray(planning.creneaux)) {
        planning.creneaux.forEach((c) => {
          const targetProfId = String(c.professeurId || '').trim().toLowerCase();
          
          // Si le créneau appartient au professeur connecté, on l'extrait
          if (targetProfId === monIdProf) {
            extractionCreneaux.push({
              idDocParent: planning.id,
              jour: c.jour || 'Lundi',
              heureDebut: c.heureDebut,
              heureFin: c.heureFin,
              matiere: c.matiere,
              nomClasse: c.nomClasse || planning.classeNom || 'Classe'
            });
          }
        });
      }
    });

    // Tri chronologique : par Jour (Lundi -> Samedi) puis par Heure de début
    const triChronologique = (a, b) => {
      const idxA = LES_JOURS.indexOf(a.jour);
      const idxB = LES_JOURS.indexOf(b.jour);
      if (idxA !== idxB) return idxA - idxB;
      return a.heureDebut.localeCompare(b.heureDebut);
    };

    let resultats = extractionCreneaux.sort(triChronologique);

    // Application du filtre de jour si sélectionné
    if (jourFiltre) {
      resultats = resultats.filter((c) => c.jour === jourFiltre);
    }

    return resultats;
  }, [planningsGlobaux, user, jourFiltre]);

  // Nom complet à afficher pour le professeur
  const monNomAffiche = useMemo(() => {
    if (!user) return 'Enseignant';
    return user.name || `${user.nom || ''} ${user.prenoms || user.prenom || ''}`.trim() || user.id;
  }, [user]);

  // ============================================================
  // EXPORTATION PDF DE LA FEUILLE DE ROUTE PERSONNELLE
  // ============================================================
  const handleTelechargerPDFPersonnel = async () => {
    if (monPlanningPersonnel.length === 0) return;

    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a; background: #ffffff;">
        
        <!-- EN-TÊTE INSTITUTIONNEL DYNAMIQUE FIRESTORE -->
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
              Feuille de Route Individuelle Enseignant
            </h2>
            <p style="font-size: 13px; font-weight: bold; color: #7c3aed; margin: 6px 0 0 0; uppercase;">
              MANDATAIRE : M/MME ${monNomAffiche.toUpperCase()}
            </p>
            ${metaSchool.anneeScolaire ? `<p style="font-size: 10px; color: #9ca3af; margin: 4px 0 0 0; font-family: monospace;">Année Académique : ${metaSchool.anneeScolaire}</p>` : ''}
          </div>
        </div>

        <!-- TABLEAU INDIVIDUEL -->
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; margin-top: 25px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase;">
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Jour</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Plage Horaire</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Structure Pédagogique (Classe)</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Discipline</th>
            </tr>
          </thead>
          <tbody>
            ${monPlanningPersonnel.map((c) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 900; text-transform: uppercase; color: #7c3aed;">${c.jour}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #c2410c;">${c.heureDebut} - ${c.heureFin}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">🏛️ ${c.nomClasse}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #475569; text-transform: uppercase;">📚 ${c.matiere}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 40px; text-align: right; font-size: 9px; font-style: italic; color: #94a3b8;">
          Document généré personnellement par l'enseignant le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}.
        </div>
      </div>
    `;

    const options = {
      margin: 10,
      filename: `EDT_PERSO_${monNomAffiche.replace(/\s+/g, '_')}.pdf`,
      html2canvas: { scale: 2.5, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await html2pdf().set(options).from(element).save();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Calcul de votre emploi du temps individuel NoSQL...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-0 sm:p-6 font-sans bg-white min-h-screen text-gray-700 text-left animate-fadeIn">
      <Header/>
      {/* BANDEAU EN-TÊTE PROFESSEUR */}
      <div className="bg-slate-900 p-6 rounded-2xl shadow-md mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="textx font-black uppercase tracking-tight">Mon Emploi du Temps Individuel</h2>
          <p className="enseig text-xs text-slate-400 mt-0.5">
            Enseignant : <span className="text-orange-400 font-black uppercase">{monNomAffiche}</span>
          </p>
           <p className='enseig-1'>
              {' '}
              <strong>
                Établissement :
              </strong>{' '}
              <span className="uppercase text-purple-700">
                {nomEtablissement}
              </span>
            </p>

        </div>

        <div className="flex gap-3">
                   {/* FILTRE PAR JOUR */}
          <select 
            value={jourFiltre} 
            onChange={(e) => setJourFiltre(e.target.value)} 
            className="bglate border border-slate-700 text-orange-400 rounded-xl px-7 py-3 text-xs font-black outline-none cursor-pointer"
          >
            <option value="">-- Filtrer par jour --</option>
            {LES_JOURS.map((j) => (
              <option key={j} value={j}>{j.toUpperCase()}</option>
            ))}
          </select>

          {/* BOUTON PDF */}
          {monPlanningPersonnel.length > 0 && (
            <button
              type="button"
              onClick={handleTelechargerPDFPersonnel}
              className="bglate-2 hover:bg-purple-700 px-5 py-3  rounded-xl text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-sm"
            >
              🖨️ Télécharger Ma Fiche (PDF)
            </button>
          )}
        </div>
      </div>

      {/* COMPOSITE RENDU DES CRÉNEAUX EXTRACTS */}
      {monPlanningPersonnel.length === 0 ? (
        <div className="py-20 text-center text-xs font-bold text-gray-400 italic ">
          💡 Aucun créneau horaire n'est actuellement affecté à votre matricule pour cette période dans l'établissement.
        </div>
      ) : (
        <div className=" p-5 shadow-xs">
          <div className="mb-4 border-b pb-2">
            <h3 className="magri text-xs font-black uppercase text-slate-400 tracking-wider">
              Ma Grille d'Intervention Hebdomadaire
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="taber-1 w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900  uppercase font-black text-[10px] tracking-wider">
                  <th className="p-3">Jour</th>
                  <th className="p-3">Régime Horaire</th>
                  <th className="p-3">Structure Cible (Classe)</th>
                  <th className="p-3">Discipline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white font-bold">
                {monPlanningPersonnel.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-purple-700 uppercase font-black w-36">
                      📅 {c.jour}
                    </td>
                    <td className="p-3 font-mono text-orange-700 bg-gray-50/20 w-44">
                      ⏰ {c.heureDebut} — {c.heureFin}
                    </td>
                    <td className="p-3 text-blue-900 uppercase">
                      🏛️ {c.nomClasse}
                    </td>
                    <td className="p-3 text-gray-600 font-medium uppercase">
                      📚 {c.matiere}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default EmploiDuTempsProf;
