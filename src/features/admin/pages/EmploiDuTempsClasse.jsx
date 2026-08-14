import React from 'react';
import EmploiDuTempsAdmin from '../../../components/dashboard/admin/EmploiDuTempsAdmin.jsx';

const EmploiDuTempsClasse = () => {
  return (
    <div className="p-4">
      {/* On appelle directement le compositeur automatique que l'on vient de créer */}
      <EmploiDuTempsAdmin />
    </div>
  );
};

export default EmploiDuTempsClasse;
