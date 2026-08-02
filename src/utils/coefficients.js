/**
 * Matrice officielle des coefficients en Côte d'Ivoire (Normes MENA / DECO)
 */
const COEFFICIENTS_MATRICE = {
  // --- PREMIER CYCLE ---
  '6eme': { 'Compo Française': 3, 'Orthographe/Grammaire': 2, 'Anglais': 2, 'Mathématiques': 4, 'Physique-Chimie': 2, 'SVT': 2, 'Histoire-Géo': 2, 'EDHC': 1, 'Arts Plastiques': 1, 'Musique': 1, 'EPS': 1 },
  '5eme': { 'Compo Française': 3, 'Orthographe/Grammaire': 2, 'Anglais': 2, 'Mathématiques': 4, 'Physique-Chimie': 2, 'SVT': 2, 'Histoire-Géo': 2, 'EDHC': 1, 'Arts Plastiques': 1, 'Musique': 1, 'EPS': 1 },
  '4eme': { 'Compo Française': 3, 'Orthographe/Grammaire': 2, 'Anglais': 3, 'Mathématiques': 4, 'Physique-Chimie': 3, 'SVT': 2, 'Histoire-Géo': 2, 'EDHC': 1, 'Arts Plastiques': 1, 'Musique': 1, 'EPS': 1, 'Allemand': 2, 'Espagnol': 2 },
  '3eme': { 'Compo Française': 3, 'Orthographe/Grammaire': 2, 'Anglais': 3, 'Mathématiques': 4, 'Physique-Chimie': 3, 'SVT': 2, 'Histoire-Géo': 2, 'EDHC': 1, 'Arts Plastiques': 1, 'Musique': 1, 'EPS': 1, 'Allemand': 2, 'Espagnol': 2 },

  // --- SECOND CYCLE (Nouveaux codes alignés sur vos options) ---
  '2nd_A': { 'Français': 5, 'Anglais': 4, 'Allemand': 3, 'Espagnol': 3, 'Mathématiques': 2, 'Physique-Chimie': 2, 'SVT': 2, 'Histoire-Géo': 3, 'Philosophie': 0, 'EPS': 1 },
  '2nd_C': { 'Français': 3, 'Anglais': 2, 'Mathématiques': 5, 'Physique-Chimie': 4, 'SVT': 2, 'Histoire-Géo': 2, 'Philosophie': 0, 'EPS': 1 },

  '1ere_A': { 'Français': 5, 'Anglais': 4, 'Allemand': 3, 'Espagnol': 3, 'Mathématiques': 2, 'Physique-Chimie': 0, 'SVT': 0, 'Histoire-Géo': 3, 'Philosophie': 4, 'EPS': 1 },
  '1ere_C': { 'Français': 2, 'Anglais': 2, 'Mathématiques': 6, 'Physique-Chimie': 5, 'SVT': 2, 'Histoire-Géo': 2, 'Philosophie': 2, 'EPS': 1 },
  '1ere_D': { 'Français': 3, 'Anglais': 2, 'Mathématiques': 4, 'Physique-Chimie': 4, 'SVT': 4, 'Histoire-Géo': 2, 'Philosophie': 2, 'EPS': 1 },

  'T_A1': { 'Français': 5, 'Anglais': 4, 'Allemand': 3, 'Espagnol': 3, 'Mathématiques': 2, 'Physique-Chimie': 0, 'SVT': 0, 'Histoire-Géo': 3, 'Philosophie': 5, 'EPS': 1 },
  'T_A2': { 'Français': 5, 'Anglais': 4, 'Allemand': 3, 'Espagnol': 3, 'Mathématiques': 2, 'Physique-Chimie': 0, 'SVT': 0, 'Histoire-Géo': 3, 'Philosophie': 5, 'EPS': 1 },
  'T_D':  { 'Français': 3, 'Anglais': 2, 'Mathématiques': 4, 'Physique-Chimie': 4, 'SVT': 5, 'Histoire-Géo': 2, 'Philosophie': 2, 'EPS': 1 },
  'T_C':  { 'Français': 2, 'Anglais': 2, 'Mathématiques': 6, 'Physique-Chimie': 5, 'SVT': 2, 'Histoire-Géo': 2, 'Philosophie': 2, 'EPS': 1 }
};

/**
 * 1. Récupère le coefficient d'une matière selon la classe et la série
 */
export const getCoefficient = (niveau, matiere, serie = '') => {
  // Normalisation du niveau pour correspondre aux clés (ex: "6ème 2" -> "6eme")
  const niveauClean = niveau.toLowerCase().replace(/è/g, 'e').replace(/[^a-z0-9]/g, '');
  
  const isLyccee = niveauClean.startsWith('2nde') || niveauClean.startsWith('1ere') || niveauClean.startsWith('tle');
  const cleClasse = isLyccee && serie ? `${niveauClean}_${serie.toUpperCase()}` : niveauClean;

  const tableCoefficients = COEFFICIENTS_MATRICE[cleClasse];
  if (!tableCoefficients) return 1;

  return tableCoefficients[matiere] !== undefined ? tableCoefficients[matiere] : 1;
};

/**
 * 2. Calcule la moyenne d'un élève pour une matière (Pondération Ivoirienne)
 * Formule standard : (Moyenne_Interros + (Note_DS * 2)) / 3
 * Formule avec Devoir Commun : (Moyenne_Interros + (Note_DS * 2) + Note_DC) / 4
 * 
 * @param {number[]} interrogations - Tableau des notes d'interros
 * @param {number} noteDevoir - Note du Devoir Surveillé (DS)
 * @param {number|null} [noteDevoirCommun=null] - Optionnel : Note du Devoir Commun / Composition
 */
export const calculerMoyenneMatiere = (interrogations = [], noteDevoir, noteDevoirCommun = null) => {
  const HasInterros = Array.isArray(interrogations) && interrogations.length > 0;
  
  // Calcul de la moyenne des interros (ou la note de DS par défaut si aucune interro)
  const moyenneInterros = HasInterros 
    ? interrogations.reduce((acc, note) => acc + note, 0) / interrogations.length 
    : (noteDevoir || 0);

  const ds = noteDevoir || 0;
  
  let totalPoints = moyenneInterros + (ds * 2);
  let diviseur = 3;

  // Prise en compte du Devoir Commun (compte pour coefficient 1 dans la moyenne de la matière)
  if (noteDevoirCommun !== null && noteDevoirCommun !== undefined) {
    totalPoints += noteDevoirCommun;
    diviseur += 1;
  }

  const moyenneCalculee = totalPoints / diviseur;
  return Math.round(moyenneCalculee * 100) / 100;
};

/**
 * 3. Calcule la Moyenne Générale Trimestrielle / Semestrielle de l'élève
 * Gère automatiquement l'exclusion des matières dispensées (comme l'EPS)
 * 
 * @param {Array} notesMatieres - [{ matiere: 'Mathématiques', moyenne: 14.5, dispense: false }, ...]
 * @param {string} niveau - Ex: '3eme'
 * @param {string} [serie=''] - Ex: 'D'
 */
export const calculerMoyenneGenerale = (notesMatieres, niveau, serie = '') => {
  let totalPoints = 0;
  let totalCoefficients = 0;

  notesMatieres.forEach(({ matiere, moyenne, dispense }) => {
    // Si l'élève est dispensé de cette matière (ex: EPS), on l'ignore complètement
    if (dispense) return;

    const coef = getCoefficient(niveau, matiere, serie);

    if (coef > 0) {
      totalPoints += moyenne * coef;
      totalCoefficients += coef;
    }
  });

  const moyenneGenerale = totalCoefficients > 0 ? totalPoints / totalCoefficients : 0;

  return {
    moyenneGenerale: Math.round(moyenneGenerale * 100) / 100,
    totalPoints: Math.round(totalPoints * 100) / 100,
    totalCoefficients
  };
};
