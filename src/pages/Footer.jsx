import React from 'react';
import logoEdulink from '../assets/logoedulink.png';
import luhamcode from '../assets/luhamcode.jpg';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 font-sans border-t border-slate-900 mt-auto text-left">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* 🟢 RECTIFICATION : Remplacement de class par className pour éliminer l'alerte console */}
        <div className="barre-bi-couleur"></div>
        <div className="parti-footer grid grid-cols-1 md:grid-cols-3 gap-8 items-start pb-8 border-b border-slate-900">
          
          {/* COLONNE 1 : LOGO & INSTANCE FIXE */}
          <div className="flex flex-col space-y-3">
            <div className="flex items-center gap-2">
              {logoEdulink && <img src={logoEdulink} alt="Logo" className="logoedulink h-6 w-auto" />}
            </div>
             <div className="flex items-center gap-2">
              {luhamcode && <img src={luhamcode} alt="Logo" className="luhamcode h-6 w-auto" />}
            </div>
            <p className="footer-tex text-[8px] text-slate-500 font-medium">
              Manager Général : <span className="text-slate-300 font-bold">M. FRANÇOIS</span><br />
              Code Instance : <span className="text-slate-300 font-mono">lycee_saint_bernard</span>
            </p>
          </div>

          {/* COLONNE 2 : LIENS LÉGAUX ET CONFORMITÉ */}
          <div className=" flex flex-col space-y-3">
            <div className=" grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
              <ul className='menu-footer'>
                <li><a 
                href="https://luhamcode.com/mention" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-orange-500 transition duration-150 flex items-center gap-1"
              >
                 Mentions Légales
              </a></li>
              <li>
                  <a 
                href="https://luhamcode.com/politique" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-orange-500 transition duration-150 flex items-center gap-1"
              >
                Politique d'utilisation
              </a>
              </li>
              <li>
                 <a 
                href="https://luhamcode.com/protection" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-orange-500 transition duration-150 flex items-center gap-1"
              >
                Protection des données
              </a>
              </li>
              <li>
                <a 
                href="https://luhamcode.com/cookis" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-orange-500 transition duration-150 flex items-center gap-1"
              >
                Gestion des Cookies
              </a>
              </li>
              </ul>
            </div>
          </div>
        </div>

        {/* MENTIONS DE DROITS ET CRÉDITS DE FIN */}
        <div className=" bas-footer flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 text-[11px] font-bold uppercase tracking-wider text-slate-600 text-center sm:text-left select-none">
          <span >
            © 2026 Edulink - le lien Educatif , by <span className="text-slate-400 font-black">Luhamcode -  info_services@luhamcode.com, 0039 327 803 6337 & 00337 58 69 42 51 All rights reserved</span>.<br/>
          </span>
           <span>LuhamCode S.R.L , Siége Social : Via G . Garibaldi, N. 6 Ponte Lambro (CO) , Region de Lombardia - Italy , Code Fiscal : BLGGYR85T20Z313Y</span><br/>
          <span className="text-info text-[10px] font-mono bg-slate-900 px-3 py-1 rounded-full text-slate-500">
            v2.0.26 — Cloud Connected - <a href='https://luhamcode.com/' className="text-info hover:text-orange-500 transition">https://luhamcode.com/</a>
          </span>
        </div>

      </div>
    </footer>
  );
}
