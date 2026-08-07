import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';

const EmploiDuTempsAdmin = () => {
  const { schoolId, schoolName } = useAuth();
  const currentSchool = (schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_Moderne_Gagnoa').trim().toLowerCase();

  // --- ÉTATS CENTRALISÉS ---
  const [classes, setClasses] = useState([]);
  const [personnelEnseignant, setPersonnelEnseignant] = useState([]);
  const [planningsPdf, setPlanningsPdf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- ÉTATS FORMULAIRE DÉBLOQUÉS ---
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedProfId, setSelectedProfId] = useState('');
  const [matiere, setMatiere] = useState('');
  
  // 🟢 INITIALISATION INDISPENSABLE DE L'ÉTAT DU RÉGIME HORAIRE
  const [regimeHoraire, setRegimeHoraire] = useState('07H00 - 18H00');
  
  // États de conversion de la pièce jointe PDF
  const [pdfBase64, setFileBase64] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const [sending, setSending] = useState(false);

  // 🔄 ÉCOUTEUR RÉACTIF ET INSENSIBLE À LA CASSE (onSnapshot Infaillible)
  useEffect(() => {
    if (!currentSchool) return;

    // A. Lecture live des promotions et classes de l'école (Tolérant à la casse)
    const qClasses = query(collection(db, "classes"));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.schoolId?.trim().toLowerCase() === currentSchool.toLowerCase()) {
          list.push({ id: d.id, ...data });
        }
      });
      setClasses(list);
      if (list.length > 0 && !selectedClasse) {
        setSelectedClasse(list[0].idBrute || list[0].id);
      }
    });

    // B. Extraction tolérante de tous les profs sans blocage de casse via ID unique
    const qStaff = query(collection(db, "users"));
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      const list = [];
      snap.forEach(d => {
        const userIdKey = d.id.trim().toUpperCase();
        const data = d.data();
        const roleClean = data.role ? data.role.toLowerCase() : '';
        
        const userSchoolClean = data.schoolId ? data.schoolId.trim().toLowerCase() : '';
        const targetSchoolClean = currentSchool.toLowerCase();

        if (userSchoolClean === targetSchoolClean) {
          if (userIdKey.startsWith('PROF_') || roleClean === 'professeur' || roleClean === 'prof_principal') {
            list.push({ id: d.id, ...data });
          }
        }
      });
      setPersonnelEnseignant(list);
      if (list.length > 0 && !selectedProfId) {
        setSelectedProfId(list[0].id);
      }
    });

    // C. Lecture live de la liste des documents PDF d'emplois du temps diffusés
    const qPdfs = query(collection(db, "emplois_du_temps_pdf"));
    const unsubPdfs = onSnapshot(qPdfs, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.schoolId?.trim().toLowerCase() === currentSchool.toLowerCase()) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPlanningsPdf(list);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubStaff();
      unsubPdfs();
    };
  }, [currentSchool, selectedClasse, selectedProfId]);

  // Synchronisation dynamique de la discipline de l'enseignant sélectionné
  useEffect(() => {
    const enseignant = personnelEnseignant.find(p => p.id === selectedProfId);
    if (enseignant) {
      setMatiere(enseignant.matiereEnseignee || 'Général');
    }
  }, [selectedProfId, personnelEnseignant]);

  // 🟢 CONVERTISSEUR PDF SÉCURISÉ : Encode le fichier en Base64
  const handlePdfFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("🛑 Format invalide. Veuillez charger uniquement un document officiel sous format PDF.");
      e.target.value = "";
      return;
    }

    setPdfName(file.name);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setFileBase64(reader.result);
  };

  // 🚀 ACTION DE TRANSMISSION DU FICHIER PDF AVEC RÉGIME DYNAMIQUE
  const handleUploadEmploiTempsPdf = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!selectedClasse || !pdfBase64) {
      setMessage({ type: 'error', text: 'Veuillez désigner la classe et téléverser le document PDF officiel.' });
      return;
    }

    setSending(true);
    const classeData = classes.find(c => (c.idBrute === selectedClasse || c.id === selectedClasse));
    const labelClasse = (classeData?.nom || selectedClasse).toUpperCase();
    const cleanClasseId = (classeData?.idBrute || selectedClasse).toLowerCase();

    const currentProf = personnelEnseignant.find(p => p.id === selectedProfId);
    const documentIdKey = `${currentSchool}_pdf_${cleanClasseId}`;

    try {
      await setDoc(doc(db, "emplois_du_temps_pdf", documentIdKey), {
        id: documentIdKey,
        schoolId: currentSchool,
        classeId: cleanClasseId,
        classeNom: labelClasse,
        pdfDocumentData: pdfBase64, 
        pdfDocumentName: pdfName,
        profId: selectedProfId || 'ADMIN',
        profName: currentProf ? `M. ${currentProf.nom}` : 'Direction',
        matiere: matiere,
        regimeHoraire: regimeHoraire.trim().toUpperCase(), // Enregistrement de la valeur libre
        datePublication: new Date().toLocaleDateString('fr-FR'),
        createdAt: new Date().toISOString()
      });

      setMessage({ type: 'success', text: `🎉 Succès ! L'emploi du temps de la classe ${labelClasse} a été scellé en PDF et publié.` });
      setFileBase64(null);
      setPdfName('');
      if (document.getElementById('pdfInput')) document.getElementById('pdfInput').value = '';
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "💥 Erreur technique lors de la transmission réseau." });
    } finally {
      setSending(false);
    }
  };

  const handleSupprimerPdf = async (idDoc) => {
    if (!window.confirm("Voulez-vous révoquer et effacer ce planning PDF ?")) return;
    try {
      await deleteDoc(doc(db, "emplois_du_temps_pdf", idDoc));
      setMessage({ type: 'success', text: "🗑️ Document PDF supprimé de l'infrastructure." });
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse uppercase">Ouverture de la centrale des plannings...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans bg-gray-50 min-h-screen text-gray-700 animate-fadeIn">
      
      <div className="mb-4 text-left">
        <Link to="/admin/home" className="inline-flex items-center text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition shadow-2xs">
          ⬅️ Retour au Secrétariat
        </Link>
      </div>

      <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-md mb-8 text-left">
        <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-950/60 px-2.5 py-1 rounded-full">
          Consoles Administrateur Générale
        </span>
        <h1 className="text-xl md:text-2xl font-black mt-2">Diffusion Officielle des Emplois du Temps (Fichiers PDF)</h1>
        <p className="text-xs text-slate-400 mt-1">Établissement connecté : <span className="font-bold uppercase">{schoolName || currentSchool}</span></p>
      </div>

      {message.text && (
        <div className={`p-4 mb-6 rounded-xl text-xs font-bold text-left border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COMPARTIMENT DE TÉLÉVERSEMENT */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm h-fit text-left">
          <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider border-b pb-3 mb-4">🔐 Assigner un Créneau Horaire</h3>
          <form onSubmit={handleUploadEmploiTempsPdf} className="space-y-4 text-xs font-bold">
            
            <div>
              <label className="block text-gray-400 uppercase mb-1">1. Sélectionner la Classe *</label>
              <select value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer" required>
                <option value="">-- Choisir la division --</option>
                {classes.map(c => <option key={c.id} value={c.idBrute || c.id}>{c.nom || c.id}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 uppercase mb-1">2. Enseignant Titulaire / Principal *</label>
              <select 
                value={selectedProfId} 
                onChange={(e) => setSelectedProfId(e.target.value)} 
                className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer text-xs font-bold text-gray-800" 
                required
              >
                <option value="">-- Assigner l'enseignant responsable --</option>
                                {personnelEnseignant.map(p => {
                  const idUniqueClean = (p.id || '').trim().toUpperCase();
                  const estPP = p.role?.trim().toLowerCase() === 'prof_principal' || idUniqueClean === 'PROF_BLEGUY_978';
                  const nomProf = (p.nom || p.name || '').toUpperCase();
                  const matiereProf = p.matiereEnseignee || 'Discipline';
                  
                  return (
                    <option key={idUniqueClean} value={idUniqueClean}>
                      {estPP ? `👑 PP : M. ${nomProf} (${matiereProf})` : `👨‍🏫 Prof : M. ${nomProf} (${matiereProf})`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* LA GRILLE DE GRANDE INTERACTIVITE HORAIRE CORRIGÉE */}
                          <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <label className="block text-gray-400 uppercase mb-1">Matière Enseignée</label>
                  <input 
                    type="text" 
                    value={matiere} 
                    disabled 
                    className="w-full bg-gray-100 border border-gray-200 text-gray-500 rounded-lg p-2.5 outline-none cursor-not-allowed text-xs font-bold" 
                  />
                </div>
                <div>
                  {/* 🟢 SAISIE MANUELLE PURE : Champ vierge et modifiable librement sans suggestions */}
                  <label className="block text-gray-600 uppercase mb-1">Régime horaire *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 07H00 - 18H00" 
                    value={regimeHoraire} 
                    onChange={(e) => setRegimeHoraire(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 text-xs font-black uppercase" 
                    required 
                  />
                </div>
              </div>

            {/* CHARGEMENT DU PDF DEPUIS LA MACHINE */}
            <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-left">
              <label className="block text-purple-900 uppercase mb-1">Joindre le planning Officiel en PDF *</label>
              <input 
                id="pdfInput"
                type="file" 
                accept="application/pdf"
                onChange={handlePdfFileChange}
                className="w-full text-gray-700 font-mono file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-black file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                required
              />
              {pdfName && <p className="text-[10px] text-emerald-600 font-mono mt-1.5">✓ Chargé : {pdfName}</p>}
            </div>

            <button 
              type="submit" 
              disabled={sending || !pdfBase64} 
              className="w-full bg-purple-600 hover:bg-purple-700 text-slate-100 font-black py-3 rounded-xl uppercase tracking-wider transition shadow-xs mt-4 cursor-pointer text-center text-xs disabled:bg-gray-200"
            >
              {sending ? "Chiffrement et Publication Cloud..." : "💾 Enregistrer & Imprimer la Fiche PDF"}
            </button>
          </form>
        </div>

        {/* REGISTRE ARCHIVES PDF DES COMMUNIQUÉS EMPLOIS DU TEMPS */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-5 shadow-sm text-left">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-3 mb-4">📋 Récapitulatif des plannings PDF déployés ({planningsPdf.length})</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {planningsPdf.length === 0 ? (
              <p className="text-gray-400 text-center py-12 font-medium">Aucun document PDF d'emploi du temps n'a encore été diffusé.</p>
            ) : (
              planningsPdf.map((p) => (
                <div key={p.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center text-xs font-bold hover:border-purple-500/20 transition">
                  <div>
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] uppercase font-black">🏛️ {p.classeNom}</span>
                    <h4 className="text-gray-900 font-black text-[12px] mt-2 font-mono">📄 Fichier : {p.pdfDocumentName}</h4>
                    <div className="flex gap-4 mt-2 text-[10px] text-gray-400 uppercase font-semibold">
                      <span>Diffusé le : {p.datePublication}</span>
                      <span>• Éducateur / PP : <strong className="text-purple-600">{p.profName}</strong></span>
                      {p.regimeHoraire && <span>• Régime : <strong className="text-orange-600">{p.regimeHoraire}</strong></span>}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <a 
                      href={p.pdfDocumentData} 
                      download={p.pdfDocumentName}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black transition text-center"
                    >
                      📥 Ouvrir
                    </a>
                    <button 
                      type="button" 
                      onClick={() => handleSupprimerPdf(p.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg text-[10px] uppercase font-black transition cursor-pointer"
                    >
                      ✕ Retirer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmploiDuTempsAdmin;
