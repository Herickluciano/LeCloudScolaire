// src/features/admin/pages/ConfigurationTerminal.jsx

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../../../services/api';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import ChangerMotDePasse from '../../../pages/ChangerMotDePasse';
import Header from '../../../pages/Header';

const ConfigurationTerminal = () => {
  const { schoolId, schoolName, user } = useAuth();

  const schoolIdRaw =
    schoolId ||
    user?.schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    '';

  const currentSchool = String(schoolIdRaw).trim();

  const [classes, setClasses] = useState([]);
  const [classeSalle, setClasseSalle] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // =========================================================
  // IDENTIFIANT UNIQUE ET PERSISTANT DU TERMINAL
  // =========================================================
 const getTerminalId = () => {
  let terminalId = localStorage.getItem('sgs_terminal_hardware_id');

  if (!terminalId || !terminalId.startsWith('EDULINK_v2.0.26_')) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const tableau = new Uint8Array(16);
    window.crypto.getRandomValues(tableau);

    const identifiant = Array.from(tableau)
      .map((valeur) => caracteres[valeur % caracteres.length])
      .join('');

    terminalId = `EDULINK_v2.0.26_${identifiant}`;

    localStorage.setItem('sgs_terminal_hardware_id', terminalId);
  }

  return terminalId;
};
  const terminalId = getTerminalId();

  // =========================================================
  // CHARGEMENT DES CLASSES
  // =========================================================
  useEffect(() => {
    if (!currentSchool) return;

    const qClasses = query(
      collection(db, 'classes'),
      where('schoolId', '==', currentSchool)
    );

    const unsub = onSnapshot(qClasses, (snap) => {
      const list = [];

      snap.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data()
        });
      });

      const sorted = list.sort((a, b) =>
        String(a.nom || a.name || '').localeCompare(
          String(b.nom || b.name || '')
        )
      );

      setClasses(sorted);

      if (sorted.length > 0 && !classeSalle) {
        setClasseSalle(sorted[0].id);
      }
    });

    return () => unsub();
  }, [currentSchool]);

  // =========================================================
  // SCELLER LE PC DANS FIRESTORE
  // =========================================================
  const handleRegisterPC = async (e) => {
    e.preventDefault();

    if (!currentSchool || !classeSalle) {
      alert('⚠️ Établissement ou classe introuvable.');
      return;
    }

    const classe = classes.find((c) => c.id === classeSalle);

    if (!classe) {
      alert('⚠️ Classe introuvable.');
      return;
    }

    setSaving(true);

    try {
      const terminalRef = doc(db, 'terminaux', terminalId);

      const terminalData = {
        terminalHardwareId: terminalId,

        // Établissement auquel appartient le terminal
        schoolId: currentSchool,

        // Classe définitivement affectée par l'administration
        classeId: classe.id,
        classeIdBrute: classe.idBrute || '',
        classeNom: classe.nom || classe.name || '',

        // État du scellement
        scelle: true,
        actif: true,

        // Informations administratives
        scellePar: user?.id || user?.matricule || '',
        scelleParNom: user?.name || 'Administrateur',

        dateScellement: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(terminalRef, terminalData, { merge: true });

      // =====================================================
      // CACHE LOCAL UNIQUEMENT POUR L'IDENTIFICATION DU TERMINAL
      // LA VRAIE AUTORISATION EST MAINTENANT DANS FIRESTORE
      // =====================================================
      localStorage.setItem(
        'sgs_terminal_hardware_id',
        terminalId
      );

      localStorage.setItem(
        'sgs_terminal_autorise',
        'true'
      );

      localStorage.setItem(
        'poste_officiel',
        'true'
      );

      localStorage.setItem(
        'classe_autorisee',
        classe.id
      );

      localStorage.setItem(
        'sgs_terminal_school_id',
        currentSchool
      );

      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
      }, 5000);

    } catch (error) {
      console.error('Erreur scellement terminal :', error);

      alert(
        `❌ Impossible de sceller cet ordinateur dans Firebase.\n\n${
          error?.message || 'Erreur inconnue'
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 font-sans bg-white border rounded-2xl shadow-xl mt-12 animate-fadeIn text-left">
    <Header/>
        <div className="border-b pb-3 mb-4 text-center">
        <span className="tiretemp text-lg font-black text-gray-900 uppercase">
          Secrétariat Informatique & Gestion des Équipes RH
        </span>
        <h2 className="terminal text-base font-black text-gray-800 mt-2 uppercase">
           Enregistrement du Terminal Fixe
        </h2>

        <p className="termina text-[11px] text-gray-400 font-medium mt-0.5">
          Configurez cet ordinateur comme poste d'émargement officiel.
        </p>
      </div>

      <div className="detecte mb-4 p-3 rounded-xl ">
         Établissement détecté :
        <span className="text-purple-700 uppercase ml-1 text-success">
          {schoolName ||
            currentSchool.replace(/_/g, ' ') ||
            'Chargement...'}
        </span>
      </div>

      <div className="termin mb-4 p-3 bg-slate-900  rounded-xl">
        <div className="text-[9px] uppercase text-slate-400 font-black">
          Identifiant du terminal
        </div>

        <div className="text-danger mt-1 text-[10px] font-mono break-all text-orange-400">
          {terminalId}
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-emerald-950 text-emerald-400 text-xs font-bold rounded-lg border-l-4 border-emerald-500 animate-pulse">
           TERMINAL SCELLÉ DANS FIREBASE !
          <br />
          Ce PC est maintenant affecté à la classe :
          <strong className="ml-1">
            {String(
              classes.find((c) => c.id === classeSalle)?.nom ||
              classes.find((c) => c.id === classeSalle)?.name ||
              classeSalle
            ).toUpperCase()}
          </strong>
        </div>
      )}

      <form
        onSubmit={handleRegisterPC}
        className="space-y-4 text-xs font-bold text-gray-700 mb-6"
      >
               <div>
          <label className="nomfamille19 block uppercase mb-1 font-bold text-gray-700">
            Attribuer cet appareil à une classe :
          </label>

          <select
            value={classeSalle}
            onChange={(e) => setClasseSalle(e.target.value)}
            className="nomfamille18 form-control w-full p-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-gray-800 font-black uppercase cursor-pointer"
            required
          >
            {classes.length === 0 ? (
              <option value="">
                Aucune classe détectée dans Firestore
              </option>
            ) : (
              <>
                <option selected value="">
                  -- Choisir la classe d'affectation --
                </option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏛️ CLASSE : {String(c.nom || c.name || c.id).toUpperCase()}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <button
          type="submit"
          disabled={classes.length === 0 || saving}
          className="nomfamille20 w-full bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-3 rounded-xl uppercase tracking-wider transition shadow-sm cursor-pointer border-0 disabled:opacity-50"
        >
          {saving
            ? ' Scellement Firebase...'
            : ' Activer et Sceller ce PC'}
        </button>
      </form>

      <div className="border-t pt-4">
        <div className="separateur"><div className="trai"></div></div>
      <ChangerMotDePasse />
      </div>
    </div>
  );
};

export default ConfigurationTerminal;