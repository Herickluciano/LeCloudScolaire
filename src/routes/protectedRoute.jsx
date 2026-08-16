// src/routes/ProtectedRoute.jsx

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// 🟢 ALIGNEMENT DES PROPS : Gère à la fois 'allowedRoles' et 'rolesAutorises'
const ProtectedRoute = ({ allowedRoles = [], rolesAutorises }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs text-gray-500 font-bold uppercase tracking-widest">
        Synchronisation des verrous de sécurité...
      </div>
    );
  }

  const storedUserRaw = sessionStorage.getItem('sgs_user');
  let sessionUser = null;

  try {
    sessionUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  } catch {
    sessionUser = null;
  }

  const storedRole = sessionStorage.getItem('sgs_user_role');
  const profilCourant = user || sessionUser;
  const roleActif = profilCourant?.role || storedRole || '';

  if (!profilCourant || !roleActif) {
    return <Navigate to="/login" replace />;
  }

  const roleFormate = String(roleActif).trim().toLowerCase();

  // Fusion adaptative des deux sources de données possibles pour parer les erreurs d'App.jsx
  const listeSource = rolesAutorises || allowedRoles || [];
  
  const listeRolesAttendus = Array.isArray(listeSource)
    ? listeSource.map((role) => String(role).trim().toLowerCase())
    : [];

  // 🟢 COUPE-FILTRE ABSOLU : Le SuperAdmin passe toujours toutes les barrières
  const estAutorise = roleFormate === 'super_admin' || listeRolesAttendus.includes(roleFormate);

  if (!estAutorise) {
    console.warn(`❌ Accès refusé : ${roleFormate}`, listeRolesAttendus);
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
