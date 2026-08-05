import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../services/api';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc 
} from 'firebase/firestore';

import NotificationCentre from '../../../component/Shared/NotificationCentre.jsx';


const DashboardEleve = () => {


  const { user, schoolName } = useAuth();


  const identifiantEleve = user?.matricule || user?.id;


  const currentSchool =
    user?.schoolId || 'lycee_Moderne_Gagnoa';



  const statutActuel =
    (user?.statut || "actif")
    .trim()
    .toLowerCase();



  const [trimestre,setTrimestre]=useState("1");

  const [notes,setNotes]=useState([]);

  const [loadingNotes,setLoadingNotes]=useState(true);

  const [documentsPrives,setDocumentsPrives]=useState([]);



  const [objet,setObjet]=useState(
    "Demande de Certificat de Fréquentation"
  );


  const [motif,setMotif]=useState("");

  const [sendingRequest,setSendingRequest]=useState(false);


  const [requestMsg,setRequestMsg]=useState({
    type:"",
    text:""
  });



  // 🔴 PROTECTION LOCALE DU DASHBOARD
  // Si l'élève est exclu ou suspendu
  // on ne charge aucune donnée privée

  const accesAutorise =
    statutActuel === "actif";



  // ===============================
  // CHARGEMENT NOTES
  // ===============================

  useEffect(()=>{


    if(!accesAutorise || !identifiantEleve)
    {
      setNotes([]);
      setLoadingNotes(false);
      return;
    }



    const q=query(

      collection(db,"notes"),

      where(
        "schoolId",
        "==",
        currentSchool
      ),

      where(
        "eleveId",
        "==",
        identifiantEleve
      )

    );



    const unsubscribe=onSnapshot(
      q,

      snapshot=>{

        const liste=[];


        snapshot.forEach(doc=>{

          liste.push({
            id:doc.id,
            ...doc.data()
          });

        });


        setNotes(liste);

        setLoadingNotes(false);

      },


      error=>{

        console.error(
          "Erreur chargement notes :",
          error
        );

        setLoadingNotes(false);

      }

    );



    return ()=>unsubscribe();


  },[
    identifiantEleve,
    currentSchool,
    accesAutorise
  ]);




  // ===============================
  // DOCUMENTS PRIVES
  // ===============================


  useEffect(()=>{


    if(!accesAutorise || !identifiantEleve)
    {
      setDocumentsPrives([]);
      return;
    }



    const qDoc=query(

      collection(db,"documents_prives"),

      where(
        "schoolId",
        "==",
        currentSchool
      ),

      where(
        "eleveId",
        "==",
        identifiantEleve
      )

    );



    const unsubscribe=onSnapshot(

      qDoc,

      snapshot=>{


        const liste=[];


        snapshot.forEach(doc=>{

          liste.push({
            id:doc.id,
            ...doc.data()
          });

        });



        liste.sort(
          (a,b)=>
          new Date(b.createdAt)
          -
          new Date(a.createdAt)
        );


        setDocumentsPrives(liste);


      }

    );


    return ()=>unsubscribe();



  },[
    identifiantEleve,
    currentSchool,
    accesAutorise
  ]);
  // 🚀 ENVOI D'UNE DEMANDE ADMINISTRATIVE AU SECRÉTARIAT
const handleSendSecretariatRequest = async (e) => {
  e.preventDefault();

  setRequestMsg({ type: '', text: '' });

  if (!motif.trim()) {
    setRequestMsg({
      type: 'error',
      text: 'Veuillez préciser le motif de votre demande.'
    });
    return;
  }

  setSendingRequest(true);

  try {

    await addDoc(collection(db, "messages"), {

      eleveId: user.id,

      eleveName: `${user.nom || ''} ${user.prenoms || user.prenom || ''}`,

      matricule: user.matricule || user.id,

      classeId: user.classeId || 'N/A',

      schoolId: currentSchool,

      objetMessage: objet,

      contenuMessage: motif.trim(),

      statut: "en_attente",

      createdAt: new Date().toISOString(),

      expediteurRole: "eleve"

    });


    setRequestMsg({

      type: 'success',

      text: '🎯 Votre demande a été transmise au secrétariat.'

    });


    setMotif('');


  } catch (error) {

    console.error(
      "Erreur envoi demande administrative :",
      error
    );


    setRequestMsg({

      type: 'error',

      text: 'Erreur lors de la transmission.'

    });


  } finally {

    setSendingRequest(false);

  }

};

return (
  <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8">

    {/* Vérification locale du statut */}
    {user?.statut && !['actif', 'active'].includes(user.statut.toLowerCase()) ? (

      <div className="max-w-xl mx-auto mt-20 bg-white rounded-2xl shadow-lg border border-red-200 p-8 text-center">

        <div className="text-5xl mb-4">
          🚫
        </div>

        <h1 className="text-xl font-black text-red-700 uppercase mb-3">
          Accès portail suspendu
        </h1>

        <p className="text-sm text-gray-600 font-semibold">
          Votre compte élève n'est actuellement pas autorisé à accéder aux services numériques.
        </p>

        <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-black text-red-800 uppercase">
            Statut actuel :
          </p>

          <p className="text-lg font-black text-red-600 uppercase mt-1">
            {user.statut}
          </p>
        </div>

        <p className="mt-5 text-xs text-gray-400">
          Veuillez contacter l'administration de votre établissement.
        </p>

      </div>

    ) : (

      <>

        {/* ================= EN-TÊTE PROFIL ================= */}

        <div className="max-w-7xl mx-auto bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

          <div>

            <div className="flex items-center gap-2">
              <span className="text-xl">🎓</span>

              <span className="text-xs font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-md">
                Espace Élève Connecté
              </span>
            </div>


            <h1 className="text-2xl font-black text-gray-800 tracking-tight mt-2 uppercase">
              {user?.nom}
              <span className="font-normal lowercase first-letter:uppercase text-gray-600 ml-2">
                {user?.prenoms || user?.prenom}
              </span>
            </h1>


            <p className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-wide">

              🏛️ {schoolName}

              {" — MATRICULE : "}

              <span className="font-mono text-gray-700">
                {user?.matricule || user?.id}
              </span>


              {" — CLASSE : "}

              <span className="text-orange-500 font-extrabold">
                {user?.classeId
                  ?.replace(/_/g,' ')
                  .toUpperCase() || "NON ASSIGNÉE"}
              </span>

            </p>

          </div>


          {/* Badge actif */}

          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">

            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>

            <div>

              <h4 className="text-[10px] font-bold text-emerald-600 uppercase">
                Statut d'accès portail
              </h4>

              <p className="text-sm font-black text-emerald-900 uppercase">
                Autorisé
              </p>

            </div>

          </div>


        </div>



        {/* ================= CONTENU DASHBOARD ================= */}

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">


          {/* GAUCHE */}

          <div className="lg:col-span-2 space-y-8">


            {/* NOTES */}

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

              <div className="flex justify-between items-center border-b pb-3 mb-4">

                                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  📝 Relevé Synoptique des Évaluations Continue
                </h3>
                <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-md">
                  Trimestre Live
                </span>
              </div>

              {loadingNotes ? (
                <p className="text-xs text-center py-6 text-gray-400 font-bold animate-pulse">Chargement de votre carnet de notes...</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-center py-6 text-gray-400 font-medium">Aucune note n'a été saisie par vos professeurs pour le moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-bold border-collapse">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                      <tr>
                        <th className="p-3">Matière / Discipline</th>
                        <th className="p-3 text-center">Type</th>
                        <th className="p-3 text-center">Note Obtenue</th>
                        <th className="p-3 text-center">Coefficient</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-gray-700">
                      {notes.map((n) => (
                        <tr key={n.id} className="hover:bg-gray-50/40 transition">
                          <td className="p-3 font-black uppercase text-gray-900">{n.matiere || "Général"}</td>
                          <td className="p-3 text-center text-gray-400">{n.typeEvaluation || "Interrogation"}</td>
                          <td className="p-3 text-center font-mono text-base text-purple-700 font-black">{parseFloat(n.valeur).toFixed(2)} / 20</td>
                          <td className="p-3 text-center font-mono text-gray-400">{n.coefficient || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 📥 SECTION SCELLÉE DES BULLETINS ET LIVRETS SCOLAIRES (SANS GPS) */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  📥 Téléchargement des Bulletins Trimestriels
                </h3>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Vos livrets sont générés et certifiés par la direction après le conseil de classe.</p>
              </div>

              <div className="space-y-4">
                {/* TRIMESTRE 1 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs hover:border-orange-500/30 transition">
                  <div>
                    <h4 className="text-sm font-black text-gray-800">📊 Livret Scolaire Officiel — Trimestre 1</h4>
                    <p className="text-[11px] text-emerald-600 font-bold mt-1">
                      Statut : Clôturé et Certifié par le Professeur Principal
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => alert("📥 Préparation du moteur d'impression PDF... Téléchargement imminent du bulletin T1.")}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition shadow-xs cursor-pointer self-end sm:self-auto"
                  >
                    📥 Télécharger
                  </button>
                </div>

                {/* TRIMESTRE 2 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs opacity-50">
                  <div>
                    <h4 className="text-sm font-black text-gray-800">📊 Livret Scolaire Officiel — Trimestre 2</h4>
                    <p className="text-[11px] text-gray-400 font-medium mt-1">État : Évaluations non ouvertes</p>
                  </div>
                  <button type="button" disabled className="bg-gray-200 text-gray-400 font-black text-xs uppercase px-5 py-2.5 rounded-xl cursor-not-allowed">
                    🔒 Bloqué
                  </button>
                </div>
              </div>
            </div>

            {/* DOSSIER CIVIL PERSONNEL / DOCUMENTS PRIVÉS */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">🗂️ Pièces Officielles & Actes d'Établissement</h3>
              </div>
              
              {documentsPrives.length === 0 ? (
                <p className="text-xs text-center py-6 text-gray-400 font-medium">Aucun autre document d'établissement n'a été déposé dans votre casier.</p>
              ) : (
                <div className="space-y-3">
                  {documentsPrives.map((docItem) => (
                    <div key={docItem.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-black text-gray-800 uppercase">{docItem.naturePiece || "Document Personnel"}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">Déposé le : {new Date(docItem.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <a href={docItem.fichierUrl} target="_blank" rel="noreferrer" className="text-purple-600 font-black uppercase text-[10px] bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 hover:bg-purple-100 transition">Voir la pièce</a>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>


          {/* COLONNE DROITE : COMMUNICATIONS & DEMANDES ADMINISTRATIVE */}
          <div className="space-y-8">
            
            {/* NOTIFICATION CENTRE CENTRALISE */}
            <NotificationCentre />

            {/* GUICHET DEMANDE ADMINISTRATIVE SECRÉTARIAT */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">✉️ Guichet Unique Administratif</h3>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Soumettez vos demandes de documents civils directement à la direction.</p>
              </div>

              {requestMsg.text && (
                <div className={`mb-4 p-2.5 text-xs font-bold rounded-lg border-l-4 ${
                  requestMsg.type === 'success' ? 'bg-emerald-950 text-emerald-400 border-emerald-500' : 'bg-red-950 text-red-400 border-red-500'
                }`}>
                  {requestMsg.text}
                </div>
              )}

              <form onSubmit={handleSendSecretariatRequest} className="space-y-4 text-xs font-bold text-gray-700">
                <div>
                  <label className="block text-gray-400 uppercase mb-1">Nature de la pièce demandée</label>
                  <select value={objet} onChange={(e) => setObjet(e.target.value)} className="w-full bg-gray-50 border rounded-lg p-2.5 outline-none bg-white cursor-pointer focus:ring-2 focus:ring-orange-500">
                    <option value="Demande de Certificat de Fréquentation">📜 Certificat de Fréquentation & Scolarité</option>
                    <option value="Demande de Relevé Provisoire">📊 Relevé de Notes Provisoire</option>
                    <option value="Demande de Duplicata de Carte">🪪 Duplicata de Carte d'Élève</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 uppercase mb-1">Motif justificatif détaillé</label>
                  <textarea 
                    rows="4" 
                    placeholder="Ex: Justification pour le dossier de bourse nationale de l'année scolaire en cours." 
                    value={motif} 
                    onChange={(e) => setMotif(e.target.value)}
                    className="w-full bg-gray-50 border rounded-lg p-2.5 font-medium text-gray-600 outline-none focus:ring-2 focus:ring-orange-500"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={sendingRequest}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-orange-400 font-black py-2.5 rounded-xl uppercase tracking-wider transition disabled:bg-gray-300 cursor-pointer"
                >
                  {sendingRequest ? "Transmission..." : "🚀 Soumettre ma demande"}
                </button>
              </form>
            </div>

          </div>

        </div>

      </>
    )}
  </div>
);
};

export default DashboardEleve;
