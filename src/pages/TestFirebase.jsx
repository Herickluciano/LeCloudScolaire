import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/api';

export default function TestFirebase() {
  const [status, setStatus] = useState('');

  // Injection unique du personnel réel de l'école dans la collection USERS Cloud
  const initialiserPersonnelEcole = async () => {
    setStatus('Création des comptes du personnel sur Firebase...');
    try {
      const educateurs = [
        { matricule: 'EDUC_6', data: { name: 'M. Kouassi', role: 'educateur', assigned_promotion: '6eme', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_5', data: { name: 'Mme Gnakpa', role: 'educateur', assigned_promotion: '5eme', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_4', data: { name: 'M. Diomandé', role: 'educateur', assigned_promotion: '4eme', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_3', data: { name: 'Mme Koné', role: 'educateur', assigned_promotion: '3eme', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_2NDA', data: { name: 'M. Traoré A.', role: 'educateur', assigned_promotion: '2nd_A', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_2NDC', data: { name: 'M. Koffi C.', role: 'educateur', assigned_promotion: '2nd_C', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_1EREA', data: { name: 'Mme Bamba A.', role: 'educateur', assigned_promotion: '1ere_A', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_1EREC', data: { name: 'M. Sékou C.', role: 'educateur', assigned_promotion: '1ere_C', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_TA1', data: { name: 'Mme Bakayoko A1', role: 'educateur', assigned_promotion: 'T_A1', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_TA2', data: { name: 'M. Ouattara A2', role: 'educateur', assigned_promotion: 'T_A2', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_TD', data: { name: 'Mme Gbon D.', role: 'educateur', assigned_promotion: 'T_D', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'EDUC_TC', data: { name: 'M. Touré C.', role: 'educateur', assigned_promotion: 'T_C', school_id: 'lycee_classique_abidjan' } }
      ];

      const professeurs = [
        { matricule: 'PROF_SORO', data: { name: 'M. Soro (Maths)', role: 'professeur', assigned_classes: ['6eme_1'], school_id: 'lycee_classique_abidjan' } },
        { matricule: 'PROF_KONAN', data: { name: 'Mme Konan (Français)', role: 'prof_principal', assigned_classes: ['4eme_2'], assigned_main_class: '4eme_2', school_id: 'lycee_classique_abidjan' } },
        { matricule: 'PROF_TRAORE', data: { name: 'M. Traoré (Physique)', role: 'professeur', assigned_classes: [], school_id: 'lycee_classique_abidjan' } },
        { matricule: 'PROF_KOFFI', data: { name: 'Mme Koffi (SVT)', role: 'professeur', assigned_classes: [], school_id: 'lycee_classique_abidjan' } }
      ];

      for (const u of [...educateurs, ...professeurs]) {
        await setDoc(doc(db, "users", u.matricule), u.data);
      }

      setStatus('✅ Base Firestore initialisée avec le vrai personnel !');
    } catch (error) {
      setStatus(`❌ Erreur : ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto', textAlign: 'center' }}>
      <h2>⚙️ Configuration Initiale de la Base de Données</h2>
      <p style={{ backgroundColor: '#eef9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bce5ff', fontSize: '14px' }}>
        <strong>Statut du Cloud :</strong> {status || 'Prêt pour l\'initialisation...'}
      </p>
      
      <button onClick={initialiserPersonnelEcole} style={{ padding: '12px 24px', backgroundColor: '#28a745', color: 'white', border: 'none', rounded: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '15px', width: '100%' }}>
        🚀 Injecter le Personnel Réel (Éducateurs & Profs)
      </button>
    </div>
  );
}
