// src/components/FormulaireClasse.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../../services/api'; 
import { doc, setDoc, updateDoc, arrayUnion, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import Header from '../../../pages/Header';

const FormulaireClasse = ({ onClose, currentSchool }) => {
  const [saving, setSaving] = useState(false);
  const idEcole = currentSchool || sessionStorage.getItem('sgs_school_id') || "lycee_saint_bernard";
  
  // --- ÉTATS POUR LES SELECTIONS DE ROLES FIRESTORE ---
  const [listeProfesseurs, setListeProfesseurs] = useState([]);
  const [listeEducateurs, setListeEducateurs] = useState([]);
  const [profSelectionne, setProfSelectionne] = useState('');
  const [educSelectionne, setEducSelectionne] = useState('');

  // --- ÉTATS DE CONFIGURATION DE LA CLASSE ---
  const [niveauPromotion, setNiveauPromotion] = useState('');
  const [serieSelectionnee, setSerieSelectionnee] = useState('');
  const [numeroDivision, setNumeroDivision] = useState('1');
  const [nomClassePremierCycle, setNomClassePremierCycle] = useState('');
  const [capaciteMaximale, setCapaciteMaximale] = useState('50');

  // 🔄 ÉCOUTE EN TEMPS RÉEL DU CORPS ENSEIGNANT ET VIE SCOLAIRE (Prend en compte les deux rôles)
  useEffect(() => {
    if (!idEcole) return;

    const usersRef = collection(db, "users");
    const qStaff = query(usersRef, where("schoolId", "==", idEcole));

    const unsubscribe = onSnapshot(qStaff, (snapshot) => {
      const profs = [];
      const educs = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const nomComplet = data.name || `${data.nom || ''} ${data.prenoms || ''}`.trim();
        const corpsRh = {
          id: docSnap.id,
          nomComplet: nomComplet.toUpperCase()
        };

        const roleNettoye = String(data.role || '').toLowerCase().trim();

        // 👨‍🏫 CAPTURE RECYPROQUE : un prof reste sélectionnable qu'il soit principal ou normal
        if (roleNettoye === 'professeur' || roleNettoye === 'prof_principal') {
          profs.push(corpsRh);
        } else if (roleNettoye === 'educateur') {
          educs.push(corpsRh);
        }
      });

      profs.sort((a, b) => a.nomComplet.localeCompare(b.nomComplet));
      educs.sort((a, b) => a.nomComplet.localeCompare(b.nomComplet));

      setListeProfesseurs(profs);
      setListeEducateurs(educs);
    }, (error) => {
      console.error("Erreur de chargement du personnel RH :", error);
    });

    return () => unsubscribe();
  }, [idEcole]);

  const handleNiveauChange = (e) => {
    setNiveauPromotion(e.target.value);
    setSerieSelectionnee('');
  };

  const estSecondCycle = ['2nd', '1ere', 'terminal'].includes(niveauPromotion);

  // 🟢 ALGORITHME DE MUTATION ATOMIQUE COMPLÈTE (Double Casquette)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!niveauPromotion) {
      alert("❌ Veuillez sélectionner un niveau de promotion.");
      return;
    }

    setSaving(true);
    try {
      let nomClasseFinal = "";
      let idClasseDocument = "";

      if (estSecondCycle) {
        if (!serieSelectionnee || !numeroDivision.trim()) {
          alert("❌ Veuillez renseigner la série et le numéro pour le Lycée.");
          setSaving(false);
          return;
        }
        let prefixeNiveau = niveauPromotion === '2nd' ? '2nd' : (niveauPromotion === '1ere' ? '1ere' : 'Tle');
        nomClasseFinal = `${prefixeNiveau} ${serieSelectionnee} ${numeroDivision.trim()}`;
        idClasseDocument = `${niveauPromotion}_${serieSelectionnee.toLowerCase()}_${numeroDivision.trim()}`;
      } else {
        if (!nomClassePremierCycle.trim()) {
          alert("❌ Veuillez spécifier le nom de la division pour le Collège.");
          setSaving(false);
          return;
        }
        let prefixePremier = niveauPromotion === '6eme' ? '6ème' : (niveauPromotion === '5eme' ? '5ème' : (niveauPromotion === '4eme' ? '4ème' : '3ème'));
        nomClasseFinal = `${prefixePremier} ${nomClassePremierCycle.trim().toUpperCase()}`;
        idClasseDocument = `${niveauPromotion}_${nomClassePremierCycle.trim().toLowerCase()}`;
      }

      const uniqueClassKey = `${idEcole.toLowerCase()}_${idClasseDocument.replace(/\s+/g, '_')}`;

      const profTrouve = listeProfesseurs.find(p => p.id === profSelectionne);
      const educTrouve = listeEducateurs.find(e => e.id === educSelectionne);

      // 1️⃣ MISE À JOUR DOCUMENT CLASSE (Scelle les accès de KOUASSI Armand)
      await setDoc(doc(db, "classes", uniqueClassKey), {
        id: uniqueClassKey,
        idBrute: idClasseDocument.replace(/\s+/g, '_').toUpperCase(),
        schoolId: idEcole,
        name: nomClasseFinal,
        nom: nomClasseFinal,
        promotion: niveauPromotion.toLowerCase().trim(), 
        serie: estSecondCycle ? serieSelectionnee : "GENERAL",
        division: estSecondCycle ? numeroDivision.trim() : nomClassePremierCycle.trim().toUpperCase(),
        elevesCount: 0,
        maxEleves: parseInt(capaciteMaximale) || 50,
        delegueId: null,
        delegueName: "Non désigné",
        
        profPrincipalId: profSelectionne || "NON_ASSIGNE",
        profPrincipalName: profTrouve ? profTrouve.nomComplet : "Non désigné",
        educateurId: educSelectionne || "NON_ASSIGNE",
        educateurName: educTrouve ? educTrouve.nomComplet : "Non désigné",
        
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2️⃣ MISE À JOUR SÉCURISÉE ENSEIGNANT : Rôle "prof_principal" gravé + liaison de classe
      if (profSelectionne && profSelectionne !== "NON_ASSIGNE") {
        const profRef = doc(db, "users", profSelectionne);
        await updateDoc(profRef, {
          role: "prof_principal", // Force la double casquette au login
          assigned_classes: arrayUnion(uniqueClassKey) // Ajoute l'ID sans écraser les autres cours
        });
      }

      // 3️⃣ MISE À JOUR ÉDUCATEUR : Écrit la promotion surveillée en direct
      if (educSelectionne && educSelectionne !== "NON_ASSIGNE") {
        const educRef = doc(db, "users", educSelectionne);
        await updateDoc(educRef, {
          assigned_promotion: niveauPromotion.toLowerCase().trim()
        });
      }

      alert(`🎉 Classe "${nomClasseFinal}" initialisée ! L'équipe pédagogique et le rôle de Professeur Principal ont été configurés.`);
      if (onClose) onClose();

    } catch (error) {
      console.error("Erreur d'écriture NoSQL :", error);
      alert("❌ Échec technique lors de la création de la classe.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="formclass bg-white p-6 text-left max-w-md w-full rounded-2xl shadow-lg border">
      <Header />
      <h2 className="tireclasse text-lg font-black text-gray-900 uppercase">
        Recrutement & Gestion des Équipes RH
      </h2>
      <div className="border-b pb-2 mb-4">
        <h3 className="tireclasse1 text-sm font-black text-slate-900 uppercase">Créer une Nouvelle Classe</h3>
        <p className="tireclasse2 text-[11px] text-gray-400 font-medium mt-0.5">Ajoutez une structure divisionnaire avec affectation immédiate de l'équipe pédagogique.</p>
      </div>

      <form onSubmit={handleSubmit} className="form-class">
        
        {/* SÉLECTEUR DE PROMOTION */}
        <div className="label1">
          <label htmlFor="niveauPromotion" className="bas4 block mb-1 text-gray-600">Niveau de la Promotion *</label>
          <select id="niveauPromotion" value={niveauPromotion} onChange={handleNiveauChange} className="section1 form-select w-full px-3 py-2.5 border text-sm rounded-md font-medium bg-white outline-none focus:ring-2 focus:ring-purple-600" required>
            <option value="">-- Choisir le niveau --</option>
            <optgroup label="Premier Cycle (Collège)">
              <option value="6eme">6ème</option>
              <option value="5eme">5ème</option>
              <option value="4eme">4ème</option>
              <option value="3eme">3ème</option>
            </optgroup>
            <optgroup label="Second Cycle (Lycée)">
              <option value="2nd">2nd</option>
              <option value="1ere">1ère</option>
              <option value="terminal">Terminal</option>
            </optgroup>
          </select>
        </div>

        {/* LYCÉE (SECOND CYCLE) */}
        {niveauPromotion && estSecondCycle && (
          <div className="sect1  bg-purple-50/50 border border-purple-100 rounded-xl space-y-3 animate-fadeIn">
            <div>
              <label htmlFor="serieSelectionnee" className="bas4 block mb-1 text-purple-900 text-[10px]">Série / Spécialité *</label>
              <select id="serieSelectionnee" value={serieSelectionnee} onChange={(e) => setSerieSelectionnee(e.target.value)} className="form-select w-full px-3 py-2 border text-xs rounded-md bg-white font-black" required>
                <option value="">-- Sélectionner la Série --</option>
                {niveauPromotion === '2nd' && (
                  <>
                    <option value="A">Série A (Littéraire)</option>
                    <option value="C">Série C (Scientifique)</option>
                  </>
                )}
                {niveauPromotion === '1ere' && (
                  <>
                    <option value="A1">Série A1 (Littéraire)</option>
                    <option value="A2">Série A2 (Langues)</option>
                    <option value="C">Série C (Sciences Exactes)</option>
                    <option value="D">Série D (Sciences Expérimentales)</option>
                  </>
                )}
                              {niveauPromotion === 'terminal' && (
                  <>
                    <option value="A1">Série A1 (Littéraire)</option>
                    <option value="A2">Série A2 (Langues)</option>
                    <option value="C">Série C (Sciences Exactes)</option>
                    <option value="D">Série D (Sciences Expérimentales)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="numeroDivision" className="bas4 block mb-1 text-purple-900 text-[10px]">Numéro de la division (Ex: 1, 2) *</label>
              <input type="number" min="1" id="numeroDivision" value={numeroDivision} onChange={(e) => setNumeroDivision(e.target.value)} className="form-control w-full px-3 py-2 border text-sm rounded-md bg-white font-mono" required />
            </div>
          </div>
        )}

        {/* COLLÈGE (PREMIER CYCLE) */}
        {niveauPromotion && !estSecondCycle && (
          <div className="sect2">
            <label htmlFor="nomClassePremierCycle" className="block mb-1 text-gray-600">Nom de la division (Ex: 1, 2, M1, B) *</label>
            <input type="text" id="nomClassePremierCycle" value={nomClassePremierCycle} onChange={(e) => setNomClassePremierCycle(e.target.value)} placeholder="Ex: 1" className="form-control w-full px-3 py-2.5 border text-sm rounded-md font-medium outline-none bg-slate-50 focus:bg-white" required />
          </div>
        )}

        {/* SÉLECTEUR DE L'ÉDUCATEUR RÉFÉRENT */}
        <div className="sect3">
          <label htmlFor="educSelectionne" className="bas4 block mb-1 text-orange-600">Affecter l&apos;éducateur référent *</label>
          <select 
            id="educSelectionne"
            value={educSelectionne} 
            onChange={(e) => setEducSelectionne(e.target.value)} 
            className="form-select w-full px-3 py-2.5 border text-sm rounded-md font-bold bg-white outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer" 
            required
          >
            <option value="">-- Sélectionner l&apos;éducateur --</option>
            {listeEducateurs.map(e => (
              <option key={e.id} value={e.id}>👮 {e.nomComplet}</option>
            ))}
          </select>
        </div>

        {/* SÉLECTEUR DU PROFESSEUR PRINCIPAL */}
        <div className="sect4">
          <label htmlFor="profSelectionne" className="bas4 block mb-1 text-blue-600">Affecter le Professeur Principal</label>
          <select 
            id="profSelectionne"
            value={profSelectionne} 
            onChange={(e) => setProfSelectionne(e.target.value)} 
            className="form-select form-select w-full px-3 py-2.5 border text-sm rounded-md font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">-- Sélectionner l&apos;enseignant --</option>
            {listeProfesseurs.map(p => (
              <option key={p.id} value={p.id}>👨‍🏫 {p.nomComplet}</option>
            ))}
          </select>
        </div>

        {/* CAPACITÉ LIMITATION */}
        <div className="sect5">
          <label htmlFor="floatingInput" className="bas4 block mb-1 text-gray-600">Capacité maximale de la salle</label>
          <input 
            type="number" 
            value={capaciteMaximale} 
            id="floatingInput"
            onChange={(e) => setCapaciteMaximale(e.target.value)} 
            className="selection3 form-control w-full px-3 py-2.5 border text-sm rounded-md font-mono bg-slate-50 outline-none" 
          />
        </div>

        {/* CONTENEUR DES ACTIONS ET RECOMBINAISON DES LIENS */}
        <div className="flex flex-row justify-between items-center gap-2 pt-4 border-t">
          <Link
            to="/admin/dashboard"
            className="sumitform btn bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl shadow-md transition cursor-pointer border-0 decoration-none inline-flex items-center"
          >
            Retour ↩
          </Link>

          <div className="flex gap-2 text-xs font-black uppercase">
            {onClose && (
              <button 
                type="button" 
                onClick={onClose} 
                className="btn bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-500 px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
            )}
            
            <button 
              type="submit" 
              disabled={saving} 
              className="btnsub bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl border-0 font-black cursor-pointer shadow-xs transition disabled:bg-gray-200"
            >
              {saving ? "Enregistrement..." : "💾 Valider la création"}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default FormulaireClasse;
