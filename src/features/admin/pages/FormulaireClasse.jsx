import { useState, useEffect } from 'react';
import { createClassOnFirebase, getAllProfesseursFromFirebase, getAllEducateursFromFirebase } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext'; // 🟢 CORRECTION : Extraction indispensable de la session SaaS

const FormulaireClasse = ({ onClasseCreee }) => {
  const { schoolId } = useAuth(); // 🟢 OBTENTION DE LA CLÉ DE L'ÉCOLE (Ex: lycee_Moderne_Gagnoa)
  
  const [professeurs, setProfesseurs] = useState([]);
  const [educateurs, setEducateurs] = useState([]); 
  
  // --- ÉTATS DU FORMULAIRE DE PRODUCTION ---
  const [promotion, setPromotion] = useState('6eme');
  const [extension, setExtension] = useState('');
  const [selectedEducateurId, setSelectedEducateurId] = useState(''); 
  const [profPrincipalId, setProfPrincipalId] = useState('');
  const [delegueName, setDelegueName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 🔄 ÉCOUTE DU PERSONNEL FILTRÉE PAR L'ID DE L'ÉTABLISSEMENT CLIENT CONNECTÉ
  useEffect(() => {
    if (!schoolId) return;

    const chargerDonneesPersonnel = async () => {
      // 🟢 CORRECTION : Envoi du schoolId aux fonctions d'API pour cibler l'école active
      const [listeProfs, listeEducs] = await Promise.all([
        getAllProfesseursFromFirebase(schoolId),
        getAllEducateursFromFirebase(schoolId)
      ]);
      
      setProfesseurs(listeProfs);
      if (listeProfs.length > 0) setProfPrincipalId(listeProfs[0].id);

      setEducateurs(listeEducs);
      if (listeEducs.length > 0) setSelectedEducateurId(listeEducs[0].id); 
    };
    chargerDonneesPersonnel();
  }, [schoolId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const cleanExtension = extension.trim().toUpperCase();
    const cleanDelegue = delegueName.trim();
    const currentSchool = schoolId || 'lycee_Moderne_Gagnoa';

    if (!cleanExtension) {
      setError('Veuillez renseigner l\'extension de la classe (Ex: 1, 2, A).');
      setLoading(false);
      return;
    }

    if (!selectedEducateurId) {
      setError('Veuillez sélectionner un éducateur réel dans la liste de l\'école.');
      setLoading(false);
      return;
    }

    // Clé primaire unique cloud du document (ex: lycee_Moderne_Gagnoa_6eme_A)
    const classId = `${promotion}_${cleanExtension.replace(/\s+/g, '')}`;
    
    // Formatage officiel MENA
    let prefixe = promotion;
    if (promotion === '6eme') prefixe = '6ème';
    else if (promotion === '5eme') prefixe = '5ème';
    else if (promotion === '4eme') prefixe = '4ème';
    else if (promotion === '3eme') prefixe = '3ème';
    else if (promotion.startsWith('2nd')) prefixe = promotion.replace('2nd_', '2nde ');
    else if (promotion.startsWith('1ere')) prefixe = promotion.replace('1ere_', '1ère ');
    else if (promotion.startsWith('T_')) prefixe = promotion.replace('T_', 'Tle ');

    const nomClasseOfficiel = `${prefixe} ${cleanExtension}`;

    const profSelectionne = professeurs.find(p => p.id === profPrincipalId);
    const educSelectionne = educateurs.find(e => e.id === selectedEducateurId);

    // Construction du payload relationnel étanche
    const classData = {
      nom: nomClasseOfficiel,
      promotion: promotion, 
      educateurId: selectedEducateurId, 
      educateurName: educSelectionne ? educSelectionne.name : 'Non assigné', 
      profPrincipalId: profPrincipalId || null,
      profPrincipalName: profSelectionne ? profSelectionne.name : 'Non assigné',
      delegueId: null, 
      delegueName: cleanDelegue || 'Non désigné', 
      elevesCount: 0, 
      maxEleves: 50,
      schoolId: currentSchool // 🟢 Verrou relationnel SaaS injecté
    };

    // 🟢 CORRECTION : Envoi des 3 paramètres requis à l'API de production
    const result = await createClassOnFirebase(classId, classData, currentSchool);

    if (result.success) {
      setSuccess(`Classe "${nomClasseOfficiel}" ouverte avec succès avec l'éducateur ${classData.educateurName} !`);
      setExtension('');
      setDelegueName('');
      if (onClasseCreee) onClasseCreee();
    } else {
      setError(result.msg || 'Erreur lors de l\'enregistrement.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 font-sans">
      <h2 className="text-sm font-bold text-gray-700 uppercase mb-4 tracking-wide border-b pb-2">
        🏛 open d'une Classe Physique (Données réelles SaaS)
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          
          {/* 1. Sélection de la Promotion */}
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">1. Promotion</label>
            <select value={promotion} onChange={(e) => setPromotion(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none">
              <option value="6eme">6ème</option>
              <option value="5eme">5ème</option>
              <option value="4eme">4ème</option>
              <option value="3eme">3ème</option>
              <option value="2nd_A">2nd A</option>
              <option value="2nd_C">2nd C</option>
              <option value="1ere_A">1ere A</option>
              <option value="1ere_C">1ere C</option>
              <option value="T_A1">Terminale A1</option>
              <option value="T_A2">Terminale A2</option>
              <option value="T_D">Terminale D</option>
              <option value="T_C">Terminale C</option>
            </select>
          </div>

          {/* 2. Extension / Numéro */}
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">2. Extension / Numéro</label>
            <input type="text" placeholder="Ex: 1, 2, A..." value={extension} onChange={(e) => setExtension(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-semibold uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          {/* 3. Sélection Éducateur Cloud Réel */}
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">3. Sélection Éducateur</label>
            <select value={selectedEducateurId} onChange={(e) => setSelectedEducateurId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none">
              {educateurs.length > 0 ? (
                educateurs.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))
              ) : (
                <option value="">⚠️ Aucun éducateur trouvé pour cette école</option>
              )}
            </select>
          </div>

          {/* 4. Sélection Prof Principal Cloud Réel */}
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">4. Prof Principal</label>
            <select value={profPrincipalId} onChange={(e) => setProfPrincipalId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none">
              {professeurs.length > 0 ? (
                professeurs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              ) : (
                <option value="">⚠️ Aucun enseignant trouvé pour cette école</option>
              )}
            </select>
          </div>

          {/* 5. Délégué de Classe */}
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1">5. Nom du Délégué</label>
            <input type="text" placeholder="Ex: Traoré Mamadou" value={delegueName} onChange={(e) => setDelegueName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

        </div>

        {/* 🟢 CORRECTION DE LA BALISE COUPÉE : Affichage structuré des messages d'états */}
        {error && <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border-l-4 border-red-500">{error}</div>}
        {success && <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border-l-4 border-green-500">🎉 {success}</div>}

        <div className="flex justify-end border-t pt-3">
          <button type="submit" disabled={loading} className="bg-orange-500 text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-orange-600 shadow-md transition disabled:bg-orange-300 flex items-center justify-center min-w-[150px]">
            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : 'Valider la structure'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormulaireClasse;
