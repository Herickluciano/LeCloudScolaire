import React, { useState, useEffect } from 'react';

import {
  doc,
  writeBatch,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

import { db } from '../services/api';
import { useAuth } from '../context/AuthContext'; // Chemin relatif corrigé vers la racine
import Header from './Header';

export default function TestFirebase() {
  const { schoolId } = useAuth();
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [ecoleData, setEcoleData] = useState(null);

  // ============================================================
  // ÉTABLISSEMENT DYNAMIQUE (AUCUNE VALEUR EN DUR)
  // ============================================================
  const SCHOOL_ID = schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard';

  // Charger dynamiquement les métadonnées de l'établissement au démarrage
  useEffect(() => {
    const chargerInfosEtablissement = async () => {
      if (!SCHOOL_ID) return;
      try {
        const schoolSnap = await getDoc(doc(db, 'schools', SCHOOL_ID));
        if (schoolSnap.exists()) {
          setEcoleData(schoolSnap.data());
        }
      } catch (err) {
        console.error("Erreur chargement métadonnées école :", err);
      }
    };
    chargerInfosEtablissement();
  }, [SCHOOL_ID]);

  // ============================================================
  // INITIALISATION DU PERSONNEL
  // ============================================================

  const initialiserPersonnelEcole = async () => {
    if (!SCHOOL_ID) {
      setStatus("❌ Erreur : Aucun identifiant d'établissement détecté dans la session.");
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);

    setStatus(
      '⏳ Création des comptes du personnel sur Firebase...'
    );

    try {

      // ========================================================
      // EDUCATEURS (LIAISON 100% DYNAMIQUE SUR L'ÉCOLE CONFIGURÉE)
      // ========================================================

      const educateurs = [
        {
          matricule: 'EDUC_6',
          data: {
            name: 'M. Kouassi',
            role: 'educateur',
            assigned_promotion: '6eme',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_5',
          data: {
            name: 'Mme Gnakpa',
            role: 'educateur',
            assigned_promotion: '5eme',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_4',
          data: {
            name: 'M. Diomandé',
            role: 'educateur',
            assigned_promotion: '4eme',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_3',
          data: {
            name: 'Mme Koné',
            role: 'educateur',
            assigned_promotion: '3eme',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_2NDA',
          data: {
            name: 'M. Traoré A.',
            role: 'educateur',
            assigned_promotion: '2nd_A',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_2NDC',
          data: {
            name: 'M. Koffi C.',
            role: 'educateur',
            assigned_promotion: '2nd_C',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_1EREA',
          data: {
            name: 'Mme Bamba A.',
            role: 'educateur',
            assigned_promotion: '1ere_A',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_1EREC',
          data: {
            name: 'M. Sékou C.',
            role: 'educateur',
            assigned_promotion: '1ere_C',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_TA1',
          data: {
            name: 'Mme Bakayoko A1',
            role: 'educateur',
            assigned_promotion: 'T_A1',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_TA2',
          data: {
            name: 'M. Ouattara A2',
            role: 'educateur',
            assigned_promotion: 'T_A2',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_TD',
          data: {
            name: 'Mme Gbon D.',
            role: 'educateur',
            assigned_promotion: 'T_D',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'EDUC_TC',
          data: {
            name: 'M. Touré C.',
            role: 'educateur',
            assigned_promotion: 'T_C',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        }
      ];

      // ========================================================
      // PROFESSEURS (LIAISON DYNAMIQUE)
      // ========================================================

      const professeurs = [
        {
          matricule: 'PROF_SORO',
          data: {
            name: 'M. Soro (Maths)',
            role: 'professeur',
            assigned_classes: [
              '6eme_1'
            ],
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'PROF_KONAN',
          data: {
            name: 'Mme Konan (Français)',
            role: 'prof_principal',
            assigned_classes: [
              '4eme_2'
            ],
            assigned_main_class: '4eme_2',
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'PROF_TRAORE',
          data: {
            name: 'M. Traoré (Physique)',
            role: 'professeur',
            assigned_classes: [],
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        },
        {
          matricule: 'PROF_KOFFI',
          data: {
            name: 'Mme Koffi (SVT)',
            role: 'professeur',
            assigned_classes: [],
            school_id: SCHOOL_ID,
            schoolId: SCHOOL_ID,
            statut: 'actif'
          }
        }
      ];

      // ========================================================
      // TRANSACTION PAR LOT (WRITE BATCH)
      // ========================================================

      const batch = writeBatch(db);
      const personnel = [...educateurs, ...professeurs];

      personnel.forEach((personnelItem) => {
        const userRef = doc(db, 'users', personnelItem.matricule);
        batch.set(
          userRef,
          {
            id: personnelItem.matricule,
            matricule: personnelItem.matricule,
            ...personnelItem.data,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      });

      await batch.commit();
      setStatus(`✅ ${personnel.length} comptes du personnel synchronisés avec succès.`);

    } catch (error) {
      console.error('Erreur initialisation personnel :', error);
      setStatus(`❌ Erreur Firebase : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDU DE L'INTERFACE UTILISATEUR ENTIÈREMENT SÉCURISÉ
  // ============================================================

  return (
     <div className=" bg-white min-h-screen font-sans text-gray-700 text-left animate-fadeIn">
          <Header />
    <div
      style={{
        padding: '20px',
        fontFamily: 'sans-serif',
        maxWidth: '500px',
        margin: 'auto',
        textAlign: 'center'
      }}
    >
      
      <h2>
        ⚙️ Configuration Initiale de la Base de Données
      </h2>

      <p
        style={{
          backgroundColor: '#eef9ff',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #bce5ff',
          fontSize: '14px'
        }}
      >
        <strong>Statut du Cloud :</strong>
        <br />
        {status || 'Prêt pour la synchronisation...'}
      </p>

      {ecoleData && (
        <div style={{ margin: '15px 0', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          <p>📍 {ecoleData.pays} — {ecoleData.ministere}</p>
          <p style={{ fontStyle: 'italic', marginTop: '2px' }}>"{ecoleData.devise}"</p>
        </div>
      )}

      <p
        style={{
          fontSize: '12px',
          color: '#666',
          marginTop: '10px'
        }}
      >
        École cible : 
        <strong>
          {' '}{ecoleData?.nom || SCHOOL_ID || "Non identifiée"}
        </strong>
      </p>

      <button
        type="button"
        onClick={initialiserPersonnelEcole}
        disabled={loading || !SCHOOL_ID}
        style={{
          padding: '12px 24px',
          backgroundColor: loading || !SCHOOL_ID ? '#999' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: loading || !SCHOOL_ID ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          marginTop: '15px',
          width: '100%'
        }}
      >
        {loading ? '⏳ Synchronisation...' : '🚀 Synchroniser le Personnel Réel'}
      </button>
    </div>
    </div>
  );
}
