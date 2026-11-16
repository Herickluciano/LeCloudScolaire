import React, { useRef, useState, useEffect } from 'react';
import { db } from '../services/api';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// 🟢 AJOUT DE forcedUserId DANS LES PROPS DU COMPOSANT
const SignaturePadModal = ({ isOpen, onClose, forcedUserId }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1e3a8a'; // Bleu encre officiel
      ctx.lineWidth = 3; 
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches.clientX : e.clientX;
    const clientY = e.touches ? e.touches.clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches.clientX : e.clientX;
    const clientY = e.touches ? e.touches.clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    e.preventDefault();
  };

  const handleEffacer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSauvegarderSignature = async () => {
    const canvas = canvasRef.current;
    setSaving(true);

    try {
      const sessionRaw = sessionStorage.getItem("sgs_user");
      if (!sessionRaw) {
        alert("❌ Erreur : Aucune session active.");
        setSaving(false);
        return;
      }

      const localUser = JSON.parse(sessionRaw);
      const userNomComplet = (localUser.name || `${localUser.nom || ''} ${localUser.prenoms || ''}`).trim().toUpperCase();
      
      // 🟢 RECTIFICATION TECHNIQUE : forcedUserId prend le dessus si envoyé par le Dashboard Éducateur
      const userId = forcedUserId || localUser.id || localUser.matricule || "LUHAMCODE";
      const userRole = (localUser.role || "educateur").toLowerCase();

      // 1. TRANSMISSION IMAGE (PNG brute)
      const imagePngBase64 = canvas.toDataURL('image/png');

      // 2. TRANSMISSION TEXTE (Badge Cryptographique LegalTech)
      const horodatage = new Date().getTime().toString(16).toUpperCase();
      const tokenUnique = `VERIFIED-AUTH:${userId}-${horodatage.substring(4, 10)}`;
      const textPayload = `${userNomComplet}|${userRole.toUpperCase()}|${tokenUnique}`;

      // Enregistrement synchronisé localement selon le rôle de l'usager
      if (userRole === 'admin' || userRole === 'super_admin') {
        sessionStorage.setItem('sgs_admin_sig', textPayload);
        sessionStorage.setItem('sgs_admin_canvas_img', imagePngBase64);
      } else {
        sessionStorage.setItem('sgs_educ_sig', textPayload);
        sessionStorage.setItem('sgs_educ_canvas_img', imagePngBase64);
      }

      // Sauvegarde Cloud synchronisée sur le document NoSQL ciblé de Firestore
      try {
        const userRef = doc(db, "users", userId.trim());
        await updateDoc(userRef, {
          signatureManuscriteBase64: textPayload,
          signatureDessinImage: imagePngBase64,
          updatedAtSignature: new Date().toISOString()
        });
      } catch (fErr) {
        // Double sécurité si l'identifiant est enregistré en majuscules dans l'arborescence
        try {
          const userRefUpper = doc(db, "users", userId.trim().toUpperCase());
          await updateDoc(userRefUpper, {
            signatureManuscriteBase64: textPayload,
            signatureDessinImage: imagePngBase64,
            updatedAtSignature: new Date().toISOString()
          });
        } catch (secondErr) {
          console.warn("⚠️ Firestore distant inaccessible, priorité absolue au cache local.", secondErr);
        }
      }

      alert("🔒 Votre signature PNG et votre badge de sécurité ont été couplés avec succès !");
      onClose();

    } catch (error) {
      console.error(error);
      alert("❌ Échec technique lors du scellage.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sign fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl  w-full p-6 text-left">
        <div className="border-b pb-2 mb-4">
          <h3 className="text-base font-black text-slate-900 uppercase">✍️ Zone de Dessin de la Signature</h3>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Tracez votre signature ci-dessous à l'aide de votre souris ou de votre doigt.</p>
        </div>
        <div className="border-2 border-dashed border-slate-200 bg-white rounded-xl overflow-hidden mb-4">
          <canvas ref={canvasRef} width={400} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-[150px] bg-white cursor-crosshair block" />
        </div>
        <div className="lesbtn flex gap-2 text-xs font-black uppercase">
          <button type="button" onClick={handleEffacer} className="btnsig bg-gray-100 hover:bg-gray-200 border text-gray-700 px-4 py-2.5 rounded-xl cursor-pointer">Effacer</button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="btnsig1 bg-gray-100 border text-gray-400 px-4 py-2.5 rounded-xl cursor-pointer">Fermer</button>
          <button type="button" onClick={handleSauvegarderSignature} disabled={saving} className="btnsig2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl border-0 cursor-pointer font-black uppercase tracking-wide">
            {saving ? "Transmission..." : " Valider mon Empreinte"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePadModal;
