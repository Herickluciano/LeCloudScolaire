import { useState, useEffect } from 'react';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { genererFicheAvecQRCodePDF } from '../../../utils/genererPDF.js';
import Header from '../../../pages/Header.jsx';

const RechercheEleveAdmin = () => {
  const { schoolId } = useAuth();

  const currentSchool =
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    '';

  // --- ÉTATS CONTROLÉS ---
  const [recherche, setRecherche] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [classesPP, setClassesPP] = useState({});
  const [profilSelectionne, setProfilSelectionne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [badgeMsg, setBadgeMsg] = useState('');

  // ============================================================
  // 🔄 RÉCUPÉRATION DES UTILISATEURS
  // ============================================================
  useEffect(() => {
    if (!currentSchool) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};

          list.push({
            id: docSnap.id,
            ...data,
          });
        });

        setAllUsers(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erreur récupération utilisateurs :', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // ============================================================
  // 🔄 RÉCUPÉRATION DES CLASSES
  // ============================================================
  useEffect(() => {
    if (!currentSchool) return;

    const qClasses = query(
      collection(db, 'classes'),
      where('schoolId', '==', currentSchool)
    );

    const unsubscribe = onSnapshot(
      qClasses,
      (snapshot) => {
        const mapping = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};

          if (data.profPrincipalId) {
            mapping[String(data.profPrincipalId).trim()] =
              data.nom ||
              data.nomClasse ||
              data.idBrute ||
              docSnap.id;
          }
        });

        setClassesPP(mapping);
      },
      (err) => {
        console.error('Erreur récupération classes :', err);
      }
    );

    return () => unsubscribe();
  }, [currentSchool]);

  // ============================================================
  // 🔍 RECHERCHE
  // ============================================================
  const elevesFiltres = allUsers.filter((user) => {
    const terme = recherche.toLowerCase().trim();

    if (!terme) return false;

    const nom = String(
      user?.nom ||
      user?.name ||
      ''
    ).toLowerCase();

    const prenom = String(
      user?.prenoms ||
      user?.prenom ||
      ''
    ).toLowerCase();

    const matricule = String(
      user?.matricule ||
      user?.id ||
      ''
    ).toLowerCase();

    const email = String(
      user?.email ||
      ''
    ).toLowerCase();

    const classe = String(
      user?.classeNom ||
      user?.classe ||
      user?.classeId ||
      ''
    ).toLowerCase();

    const promotion = String(
      user?.promotion ||
      ''
    ).toLowerCase();

    return (
      nom.includes(terme) ||
      prenom.includes(terme) ||
      matricule.includes(terme) ||
      email.includes(terme) ||
      classe.includes(terme) ||
      promotion.includes(terme)
    );
  });

  // ============================================================
  // 🖨️ BADGE
  // ============================================================
  const handleRegenererBadge = async (student) => {
    setBadgeMsg(
      `⏳ Compilation du badge de ${
        student?.nom || ''
      } en cours...`
    );

    try {
      await genererFicheAvecQRCodePDF(
        {
          ...student,
          prenom:
            student?.prenoms ||
            student?.prenom ||
            '',
        },
        student?.role === 'eleve'
          ? 'eleve'
          : 'personnel'
      );

      setBadgeMsg(
        `🎉 Badge de ${
          student?.nom || ''
        } généré avec succès !`
      );

      setTimeout(() => {
        setBadgeMsg('');
      }, 4000);
    } catch (err) {
      console.error('Erreur génération badge :', err);

      setBadgeMsg(
        '❌ Échec de génération du document PDF.'
      );

      setTimeout(() => {
        setBadgeMsg('');
      }, 4000);
    }
  };

  // ============================================================
  // ✏️ RECHERCHE
  // ============================================================
  const handleChange = (e) => {
    const valeur = e.target.value;

    setRecherche(valeur);

    if (!valeur.trim()) {
      setProfilSelectionne(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4 text-xs font-bold text-gray-400">
        Synchronisation de l'annuaire de l'établissement...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 font-sans">
      <Header />

      <div className="border-b pb-3 mb-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          🔍 Moteur de Recherche Global & Consultation des Fiches
        </h3>

        <p className="text-[11px] text-gray-400 mt-0.5">
          Saisissez un matricule, un nom ou un prénom pour consulter
          les informations de l'élève.
        </p>
      </div>

      {/* ======================================================
          🔎 BARRE DE RECHERCHE
      ====================================================== */}
      <div className="relative">
        <input
          type="text"
          placeholder="Rechercher un matricule, nom, prénom..."
          value={recherche}
          onChange={handleChange}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
        />

        <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">
          🔍
        </span>
      </div>

      {/* ======================================================
          📋 RÉSULTATS
      ====================================================== */}
      {elevesFiltres.length > 0 &&
        !profilSelectionne &&
        recherche.trim() !== '' && (
          <div className="mt-2 border rounded-xl bg-white shadow-xl max-h-56 overflow-y-auto divide-y z-50 relative">

            {elevesFiltres.map((item) => {
              const matriculeCle = String(
                item?.matricule ||
                item?.id ||
                ''
              ).trim();

              const estProfPrincipal =
                !!classesPP[matriculeCle];

              return (
                <div
                  key={item.id}
                  onClick={() =>
                    setProfilSelectionne(item)
                  }
                  className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center text-xs transition"
                >
                  <div className="flex items-center gap-3">

                    {/* PHOTO */}
                    {(item.photoUrl || item.photo) && (
                      <img
                        src={
                          item.photoUrl ||
                          item.photo
                        }
                        alt="Photo"
                        className="photoeleve rounded-full object-cover border"
                      />
                    )}

                    <div>
                      <span className="font-mono font-black text-gray-400 mr-2">
                        {matriculeCle}
                      </span>

                      <span className="font-bold text-gray-800 uppercase">
                        {item.nom || ''}
                      </span>

                      <span className="font-medium text-gray-600 ml-1">
                        {item.prenoms ||
                          item.prenom ||
                          ''}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-extrabold px-2 py-0.5 rounded text-[9px] uppercase ${
                      item.role === 'eleve'
                        ? 'bg-blue-600 '
                        : estProfPrincipal
                        ? 'bg-purple-600 '
                        : item.role === 'professeur'
                        ? 'bg-purple-100 text-purple-700'
                        : item.role === 'educateur'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {item.role === 'eleve'
                      ? String(
                          item.classeNom ||
                          item.classe ||
                          item.classeId ||
                          'Élève'
                        ).replace(/_/g, ' ')
                      : estProfPrincipal
                      ? `PP — ${classesPP[matriculeCle]}`
                      : item.role || ''}
                  </span><br/>
                  <span className='text-info'>Cliquez pour Voir plus d'information</span>
                </div>
              );
            })}
          </div>
        )}

      {recherche.trim() !== '' &&
        elevesFiltres.length === 0 && (
          <p className="text-[11px] text-red-500 font-bold mt-2">
            ❌ Aucune correspondance trouvée dans l'annuaire de votre école.
          </p>
        )}

      {/* ======================================================
          🗂️ PROFIL
      ====================================================== */}
      {profilSelectionne &&
        (() => {
          const profilMatricule = String(
            profilSelectionne?.matricule ||
            profilSelectionne?.id ||
            ''
          ).trim();

          const affectationClassePP =
            classesPP[profilMatricule];

          return (
            <div className="mt-6 border border-gray-200 bg-gray-50/30 rounded-xl p-5">

              {/* MESSAGE BADGE */}
              {badgeMsg && (
                <div className="mb-4 p-3 bg-slate-900 text-orange-400 text-xs font-bold rounded-lg border-l-4 border-orange-500">
                  {badgeMsg}
                </div>
              )}

              {/* ==================================================
                  EN-TÊTE
              ================================================== */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-3 mb-4">

                <div className="flex items-center gap-4">

                  {/* PHOTO */}
                  {(profilSelectionne.photoUrl ||
                    profilSelectionne.photo) && (
                    <img
                      src={
                        profilSelectionne.photoUrl ||
                        profilSelectionne.photo
                      }
                      alt="Photo de l'élève"
                      className="photoeleve rounded-full object-cover border-4 border-white shadow"
                    />
                  )}

                  <div>
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wide bg-blue-100 text-blue-700">
                      Matricule : {profilMatricule}
                    </span>

                    <h4 className="text-lg font-black text-gray-900 uppercase mt-1">
                      {profilSelectionne.nom || ''}{' '}
                      <span className="font-normal text-gray-700">
                        {profilSelectionne.prenoms ||
                          profilSelectionne.prenom ||
                          ''}
                      </span>
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleRegenererBadge(
                      profilSelectionne
                    )
                  }
                  className="bg-slate-900 hover:bg-slate-800 text-orange-400 font-black text-xs px-4 py-2.5 rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  🖨️ Imprimer Badge PVC
                </button>
              </div>

              {/* ==================================================
                  INFORMATIONS ÉLÈVE
              ================================================== */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-gray-600">

                {/* IDENTITÉ */}
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    Identité
                  </p>

                  <p className="text-sm font-black text-gray-800 mt-1">
                    {profilSelectionne.nom || ''}{' '}
                    {profilSelectionne.prenoms ||
                      profilSelectionne.prenom ||
                      ''}
                  </p>

                  <p className="mt-1">
                    Genre :{' '}
                    <strong>
                      {profilSelectionne.genre ||
                        'Non renseigné'}
                    </strong>
                  </p>

                  <p className="mt-1">
                    Date de naissance :{' '}
                    <strong>
                      {profilSelectionne.dateNaissance ||
                        'Non renseignée'}
                    </strong>
                  </p>
                </div>

                {/* SCOLARITÉ */}
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    Scolarité
                  </p>

                  <p className="text-sm font-black text-blue-700 mt-1">
                    🏫 Classe :{' '}
                    {profilSelectionne.classeNom ||
                      profilSelectionne.classe ||
                      profilSelectionne.classeId ||
                      'Non assignée'}
                  </p>

                  <p className="mt-1">
                    Promotion :{' '}
                    <strong>
                      {profilSelectionne.promotion ||
                        'Non renseignée'}
                    </strong>
                  </p>

                  <p className="mt-1">
                    Année scolaire :{' '}
                    <strong>
                      {profilSelectionne.anneeScolaire ||
                        'Non renseignée'}
                    </strong>
                  </p>

                  {affectationClassePP && (
                    <p className="mt-1 text-purple-600 font-bold">
                      PP : {affectationClassePP}
                    </p>
                  )}
                </div>

                {/* CONTACT */}
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    Contact
                  </p>

                  <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                    📞 {profilSelectionne.telephone ||
                      'Non renseigné'}
                  </p>

                  <p className="text-[11px] mt-1 text-gray-500 break-all">
                    E-mail :{' '}
                    {profilSelectionne.email ||
                      'Non renseigné'}
                  </p>

                  <p className="text-[11px] mt-1 text-gray-500 break-all">
                    Parent :{' '}
                    {profilSelectionne.emailParent ||
                      'Non renseigné'}
                  </p>
                </div>

                {/* ABSENCES */}
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    Présence
                  </p>

                  <p className="text-sm font-black mt-1">
                    Absences :{' '}
                    {profilSelectionne.absences ??
                      0}
                  </p>

                  <p className="mt-1">
                    Retards :{' '}
                    <strong>
                      {profilSelectionne.retards ??
                        0}
                    </strong>
                  </p>

                  <p className="mt-1">
                    Statut :{' '}
                    <strong>
                      {profilSelectionne.statut ||
                        profilSelectionne.statutAcces ||
                        'Non renseigné'}
                    </strong>
                  </p>
                </div>

                {/* MOYENNE */}
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    Résultats
                  </p>

                  <p className="text-sm font-black text-blue-700 mt-1">
                    Moyenne :{' '}
                    {profilSelectionne.moyenneTrimestrielle ??
                      profilSelectionne.moyennes_trimestrielles?.notes_trimestre_1 ??
                      'Non renseignée'}
                  </p>

                  <p className="mt-1">
                    Appréciation :{' '}
                    {profilSelectionne.appreciationPP ||
                      'Non renseignée'}
                  </p>
                </div>

                {/* ORIGINE */}
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    Informations complémentaires
                  </p>

                  <p className="mt-1">
                    École de provenance :{' '}
                    <strong>
                      {profilSelectionne.ecoleProvenance ||
                        'Non renseignée'}
                    </strong>
                  </p>

                  <p className="mt-1">
                    Promotion :{' '}
                    <strong>
                      {profilSelectionne.promotion ||
                        'Non renseignée'}
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default RechercheEleveAdmin;