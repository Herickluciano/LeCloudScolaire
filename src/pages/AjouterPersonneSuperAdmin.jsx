// src/pages/AjouterPersonneSuperAdmin.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const AjouterPersonneSuperAdmin = () => {
  // --- ÉTATS DU FORMULAIRE DE L'AGENCE INFORMATIQUE ---
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [poste, setPoste] = useState("CHEF D'AGENCE");
  const [matriculeTemp, setMatriculeTemp] = useState('');
  
  const [pays, setPays] = useState('');
  const [ministere, setMinistere] = useState('');
  const [devise, setDevise] = useState('');
  const [etablissement, setEtablissement] = useState('');

  const [badgePret, setBadgePret] = useState(null);

  // 🚀 INTERCEPTEUR DE GÉNÉRATION SANS AUCUN SCRIPT EXTERNE CDN
  const handleGenererBadgeUnique = (e) => {
    e.preventDefault();

    if (!nom.trim() || !prenoms.trim() || !pays.trim() || !etablissement.trim()) {
      alert("⚠️ Veuillez remplir tous les champs obligatoires (*).");
      return;
    }

    const matrixVirtuel = matriculeTemp.trim() || `MIDNIGHT_${poste.substring(0,3)}_${Math.floor(1000 + Math.random() * 9000)}`;

    const donneesBadge = {
      pays: pays.toUpperCase(),
      devise: devise.trim() || '—',
      ministere: ministere.trim().toUpperCase() || '—',
      etablissement: etablissement.toUpperCase(),
      nom: nom.toUpperCase(),
      prenoms: prenoms.toUpperCase(),
      poste: poste.toUpperCase(),
      matricule: matrixVirtuel,
      dateEmission: new Date().toLocaleDateString('fr-FR')
    };

    // Injection instantanée dans l'aperçu graphique
    setBadgePret(donneesBadge);
    
    // 🟢 DÉCLENCHEMENT DE L'IMPRESSION SYSTÈME LOCALE
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen text-gray-700 animate-fadeIn text-left">
      
      {/* RÈGLES DE STYLE CSS INJECTÉES POUR STRUCTURER L'IMPRESSION DU BADGE SUR FEUILLE A4 */}
      <style>{`
        @media print {
          /* 1. On masque absolument tout le site (Formulaire, fonds, boutons, en-têtes) */
          body, html, .print\\:hidden, button, select, input, form, a, .bg-gray-50 {
            background: #ffffff !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* 2. Cache tous les éléments de mise en page sauf la carte d'identité */
          .grid, .bg-white, .shadow-sm {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          .print\\:hidden { display: none !important; }
          
          /* 3. On isole et centre le badge de sécurité au milieu de la feuille PDF */
          #zone-badge-agence-saas {
            position: absolute !important;
            left: 50% !important;
            top: 10% !important;
            transform: translateX(-50%) !important;
            border: 2px solid #000000 !important;
            border-radius: 16px !important;
            width: 320px !important;
            padding: 24px !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* RETOUR CONSOLE */}
      <div className="mb-4 text-left print:hidden">
        <Link to="/superadmin/dashboard" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Retour Console Matrix
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COMPARTIMENT DE SAISIE MANUELLE BRUTE */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm h-fit text-left print:hidden">
          <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
            Générateur Volatile Tech Corp
          </span>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2 mt-2 mb-4">
            Badge Personnel de l'Agence
          </h3>
          
          <form onSubmit={handleGenererBadgeUnique} className="space-y-4 text-xs font-bold text-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 uppercase mb-1">Nom Employé *</label>
                <input type="text" placeholder="Ex: TRAORE" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 uppercase" required />
              </div>
              <div>
                <label className="block text-gray-400 uppercase mb-1">Prénoms *</label>
                <input type="text" placeholder="Ex: Mamadou" value={prenoms} onChange={(e) => setPrenoms(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 uppercase" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 uppercase mb-1">Poste dans l'Agence</label>
                <select value={poste} onChange={(e) => setPoste(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-800 outline-none cursor-pointer bg-white">
                  <option value="FONDATEUR / CEO">FOUNDER / CEO</option>
                  <option value="DIRECTEUR GÉNÉRAL">DIRECTEUR GÉNÉRAL</option>
                  <option value="DIRECTEUR DES OPÉRATIONS">DIRECTEUR</option>
                  <option value="CHEF D'AGENCE">CHEF D'AGENCE</option>
                  <option value="SECRÉTAIRE DE DIRECTION">SECRÉTAIRE DE DIRECTION</option>
                  <option value="INGÉNIEUR FULL-STACK">INGÉNIEUR FULL-STACK</option>
                  <option value="UI/UX DESIGNER">UI/UX DESIGNER</option>
                  <option value="ADMINISTRATEUR SYSTÈMES & CLOUD">ADMINISTRATEUR CLOUD</option>
                  <option value="PROJECT MANAGER / SCRUM MASTER">PROJECT MANAGER</option>
                  <option value="RESPONSABLE COMPTABILITÉ">COMPTABLE</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 uppercase mb-1">ID Personnel</label>
                <input type="text" placeholder="Généré auto si vide" value={matriculeTemp} onChange={(e) => setMatriculeTemp(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-800 font-mono tracking-wide uppercase" />
              </div>
            </div>

            {/* SAISIE INTERNATIONALE MANUELLE EN CLAVIER LIBRE */}
            <div className="border-t border-dashed pt-3 space-y-3">
              <p className="text-[10px] text-purple-700 uppercase font-black">Champs Institutionnels Multi-Pays</p>
              
              <div>
                <label className="block text-gray-600 uppercase text-[9px] mb-0.5">Désignation Pays *</label>
                <input type="text" placeholder="Ex: RÉPUBLIQUE DU GABON" value={pays} onChange={(e) => setPays(e.target.value)} className="w-full bg-gray-50 border rounded-md p-2 text-gray-800 font-black uppercase outline-none focus:ring-2 focus:ring-purple-500" required />
              </div>

              <div>
                <label className="block text-gray-400 uppercase text-[9px] mb-0.5">Devise / Slogan National</label>
                <input type="text" placeholder="Ex: Union - Travail - Justice" value={devise} onChange={(e) => setDevise(e.target.value)} className="w-full bg-gray-50 border rounded-md p-2 text-gray-800 outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-gray-400 uppercase text-[9px] mb-0.5">Direction / Groupe / Ministère</label>
                <input type="text" placeholder="Ex: AN INFRASTRUCTURES NUMÉRIQUES" value={ministere} onChange={(e) => setMinistere(e.target.value)} className="w-full bg-gray-50 border rounded-md p-2 text-gray-800 uppercase outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-gray-600 uppercase text-[9px] mb-0.5">Nom de l'Agence / Filiale *</label>
                <input type="text" placeholder="Ex: MIDNIGHT TECH LIBREVILLE" value={etablissement} onChange={(e) => setEtablissement(e.target.value)} className="w-full bg-gray-50 border rounded-md p-2 text-gray-800 uppercase font-black outline-none focus:ring-2 focus:ring-purple-500" required />
              </div>
            </div>

            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-slate-100 font-black py-3 rounded-xl uppercase tracking-wider transition shadow-xs mt-4 cursor-pointer text-center text-xs">
              💾 Enregistrer & Imprimer le Badge PDF
            </button>
          </form>
        </div>

        {/* AFFICHAGE GRAPHIQUE COMPACT SANS PLANTAGE SCRIPT */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-8 shadow-sm flex flex-col items-center justify-center min-h-[450px] print:p-0 print:border-none">
          {badgePret ? (
            <div id="zone-badge-agence-saas" className="w-[340px] border-2 border-slate-900 rounded-2xl p-6 bg-white text-center font-sans shadow-md relative overflow-hidden animate-fadeIn print:shadow-none">
              
                            <div className="border-b border-gray-200 pb-3 mb-4">
                <p className="text-[10px] font-black uppercase text-gray-800 tracking-wide leading-tight">{badgePret.pays}</p>
                <p className="text-[8px] font-medium text-gray-400 italic lowercase first-letter:uppercase leading-tight mt-0.5">{badgePret.devise}</p>
                <p className="text-[9px] font-bold text-gray-700 mt-1 uppercase max-w-[280px] mx-auto leading-tight">{badgePret.ministere}</p>
                <p className="text-xs font-black text-purple-700 mt-2 tracking-wide uppercase">{badgePret.etablissement}</p>
              </div>

              <div className="py-2 flex flex-col items-center justify-center">
                <div className="h-24 w-20 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-300 text-xs font-black uppercase mb-3 font-mono tracking-wider">
                  Photo Tech
                </div>

                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Identité Collaborateur</p>
                <h4 className="text-base font-black uppercase tracking-tight leading-tight mt-0.5 text-gray-900">{badgePret.nom}</h4>
                <p className="text-sm font-bold uppercase tracking-wide mt-0.5 text-gray-800">{badgePret.prenoms}</p>
                
                <div className="mt-4 bg-purple-700 px-4 py-1 rounded-full text-slate-100 font-black text-[9px] tracking-wider uppercase shadow-xs leading-none h-6 flex items-center justify-center">
                  💻 {badgePret.poste}
                </div>
              </div>

              <div className="mt-6 border-t pt-3 flex justify-between items-center text-[9px] font-mono font-bold uppercase text-gray-400">
                <div className="text-left">
                  <p>UID: <span className="text-gray-700">{badgePret.matricule}</span></p>
                  <p className="mt-0.5">Délivré : {badgePret.dateEmission}</p>
                </div>
                <div className="bg-slate-900 p-1.5 rounded border text-orange-400 font-mono text-[8px] font-black tracking-widest">
                  MIDNIGHT TECH
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center text-gray-400 font-medium max-w-xs leading-relaxed py-12 print:hidden">
              <span className="text-3xl block mb-2">🪪</span>
              Saisissez les informations, renseignez le pays et l'agence de votre choix, puis validez. La boîte d'enregistrement PDF locale se déclenchera instantanément.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AjouterPersonneSuperAdmin;
