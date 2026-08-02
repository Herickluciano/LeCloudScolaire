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

                <h3 className="text-sm font-black text-gray-800 uppercase">
                  📊 Relevé de Notes Provisoire
                </h3>


                <select
                  value={trimestre}
                  onChange={(e)=>setTrimestre(e.target.value)}
                  className="bg-gray-50 border rounded-lg p-2 text-xs font-bold"
                >

                  <option value="1">1er Trimestre</option>
                  <option value="2">2ème Trimestre</option>
                  <option value="3">3ème Trimestre</option>

                </select>


              </div>


              {loadingNotes ? (

                <p className="text-center text-xs text-gray-400">
                  Chargement...
                </p>

              ) : notes.filter(n=>n.trimestre===Number(trimestre)).length===0 ? (

                <p className="text-center text-xs text-gray-400 py-6">
                  Aucune note publiée.
                </p>

              ) : (

                <div className="overflow-x-auto">

                  <table className="w-full text-xs">

                    <thead>

                      <tr className="bg-gray-50 text-gray-400 uppercase">

                        <th className="p-3 text-left">Matière</th>
                        <th>Interrogation</th>
                        <th>Devoir</th>
                        <th>Commun</th>

                      </tr>

                    </thead>


                    <tbody>

                    {notes
                    .filter(n=>n.trimestre===Number(trimestre))
                    .map(note=>(

                      <tr key={note.id} className="border-b">

                        <td className="p-3 font-black">
                          {note.matiere}
                        </td>

                        <td className="text-center">
                          {note.interrogation ?? "-"}
                        </td>

                        <td className="text-center">
                          {note.devoirSurveille ?? "-"}
                        </td>

                        <td className="text-center font-bold text-purple-600">
                          {note.devoirCommun ?? "-"}
                        </td>

                      </tr>

                    ))}

                    </tbody>

                  </table>

                </div>

              )}

            </div>


            <div className="bg-white rounded-2xl border p-2 shadow-sm">
              <NotificationCentre/>
            </div>


          </div>




          {/* DROITE */}

          <div className="space-y-8">


            <div className="bg-white rounded-2xl border p-6 shadow-sm">

              <h3 className="text-xs font-black text-gray-400 uppercase">
                Suivi Assiduité
              </h3>

              <p className="text-3xl font-black mt-3">
                {user?.absences || 0} H
              </p>

            </div>



            <div className="bg-white rounded-2xl border p-6 shadow-sm">

              <h3 className="text-xs font-black uppercase mb-4">
                📂 Documents privés
              </h3>


              {documentsPrives.length===0 ? (

                <p className="text-xs text-gray-400">
                  Aucun document disponible.
                </p>

              ) : (

                documentsPrives.map(doc=>(

                  <a
                  key={doc.id}
                  href={doc.fileData}
                  download={doc.titre}
                  className="block p-3 bg-orange-50 rounded-lg mb-2 text-xs font-bold text-orange-700"
                  >

                    📥 {doc.titre}

                  </a>

                ))

              )}


            </div>



            <div className="bg-white rounded-2xl border p-6 shadow-sm">

              <h3 className="text-xs font-black uppercase mb-4">
                📝 Demande administrative
              </h3>


              <form onSubmit={handleSendSecretariatRequest}
              className="space-y-3">


                <select
                value={objet}
                onChange={(e)=>setObjet(e.target.value)}
                className="w-full border rounded-lg p-2 text-xs">

                  <option>
                    Demande de Certificat de Fréquentation
                  </option>

                  <option>
                    Demande de Relevé de Notes Officiel
                  </option>

                  <option>
                    Demande Duplicata Badge
                  </option>


                </select>


                <textarea
                value={motif}
                onChange={(e)=>setMotif(e.target.value)}
                rows="3"
                className="w-full border rounded-lg p-2 text-xs"
                placeholder="Motif..."
                />


                <button
                disabled={sendingRequest}
                className="w-full bg-orange-500 text-white rounded-lg py-2 text-xs font-black">

                  {sendingRequest ? "Envoi..." : "🚀 Envoyer"}

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
