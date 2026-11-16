// src/pages/DashboardAdminHeader.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../services/api';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ModifierEleve from './ModifierEleve';

const DashboardAdminHeader = () => {
  const { user, logout, schoolName, schoolId } = useAuth();
  const navigate = useNavigate();

  const currentSchool = (schoolId || user?.schoolId || sessionStorage.getItem('sgs_school_id') || 'lycee_saint_bernard').trim().toLowerCase();
  const adminDocId = `ADMIN_${currentSchool.toUpperCase()}`;
  const [nomAdministrateurLive, setNomAdministrateurLive] = useState('Chargement...');

  useEffect(() => {
    if (!currentSchool) return;
    const docAdminRef = doc(db, "users", adminDocId);
    const unsubscribe = onSnapshot(docAdminRef, (docSnap) => {
      if (docSnap.exists()) {
        const dataAdmin = docSnap.data();
        let nomExtrait = dataAdmin.name || (Array.isArray(dataAdmin.nom) ? dataAdmin.nom.filter(Boolean).join(' ') : "Administrateur");
        setNomAdministrateurLive(nomExtrait.replace(',', '.').toUpperCase());
      } else {
        setNomAdministrateurLive("ADMINISTRATEUR CENTRAL");
      }
    }, (err) => {
      setNomAdministrateurLive("ADMINISTRATEUR");
    });
    return () => unsubscribe();
  }, [adminDocId, currentSchool]);

  const handleLogout = async () => {
    if (!window.confirm("🔒 Souhaitez-vous fermer la console d'administration ?")) return;
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-7xl mx-auto bg-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left select-none">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-2 uppercase text-white">
          🏛️ {schoolName || sessionStorage.getItem('sgs_school_name') || "Établissement Scolaire"}
        </h1>
        <span className="text-xs font-black uppercase tracking-wider text-slate-500 block mt-1">
          Console d'Administration Centrale
        </span>
        <p className="text-sm text-slate-400 mt-2 font-medium">
          Bienvenue, M. le Responsable <strong className="text-orange-400 font-black">{nomAdministrateurLive}</strong> — ID Instance : <span className="font-mono text-orange-300 font-bold uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800 ml-1">{currentSchool}</span>
        </p>
      </div>
      <button onClick={handleLogout} className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition shadow-md cursor-pointer">
        Quitter la session
      </button>
    
    </div>
    
  );
};

export default DashboardAdminHeader;
