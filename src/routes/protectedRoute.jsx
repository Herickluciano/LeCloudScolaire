// src/routes/ProtectedRoute.jsx

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = [] }) => {
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
    sessionUser = storedUserRaw
      ? JSON.parse(storedUserRaw)
      : null;
  } catch {
    sessionUser = null;
  }

  const storedRole = sessionStorage.getItem('sgs_user_role');

  const profilCourant = user || sessionUser;

  const roleActif =
    profilCourant?.role ||
    storedRole ||
    '';

  if (!profilCourant || !roleActif) {
    return <Navigate to="/login" replace />;
  }

  const roleFormate = String(roleActif)
    .trim()
    .toLowerCase();

  const listeRolesAttendus = Array.isArray(allowedRoles)
    ? allowedRoles.map((role) =>
        String(role).trim().toLowerCase()
      )
    : [];

  const estAutorise =
    listeRolesAttendus.includes(roleFormate);

  if (!estAutorise) {
    console.warn(
      `Accès refusé : ${roleFormate}`,
      listeRolesAttendus
    );

    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;