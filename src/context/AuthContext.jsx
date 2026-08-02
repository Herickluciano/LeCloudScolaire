"use no memo";

import { createContext, useContext, useState, useEffect } from 'react';
import { verifyUserOnCloud } from '../services/api';
import { db } from '../services/api';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('sgs_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [schoolName, setSchoolName] = useState(
    sessionStorage.getItem('sgs_school_name') || ''
  );

  const [schoolId, setSchoolId] = useState(
    sessionStorage.getItem('sgs_school_id') || ''
  );

  const [loading, setLoading] = useState(true);


  // 🔄 Vérification permanente du statut réel Firebase
  useEffect(() => {

    const refreshUserStatus = async () => {

      if (!user?.matricule) {
        setLoading(false);
        return;
      }

      try {

        const userRef = doc(db, "users", user.matricule);
        const snap = await getDoc(userRef);


        if (snap.exists()) {

          const cloudData = snap.data();

          const updatedUser = {
            ...user,

            nom: cloudData.nom || '',
            prenoms: cloudData.prenoms || '',
            role: cloudData.role,

            // 🔥 STATUT REEL FIRESTORE
            statut: (cloudData.statut || "actif")
              .trim()
              .toLowerCase(),

            classeId: cloudData.classeId || '',
            promotion: cloudData.promotion || '',
            schoolId: cloudData.schoolId,

          };


          setUser(updatedUser);

          sessionStorage.setItem(
            "sgs_user",
            JSON.stringify(updatedUser)
          );

        }

      } catch(err){
        console.error(
          "Erreur synchronisation statut:",
          err
        );
      }

      setLoading(false);
    };


    refreshUserStatus();


  }, [user?.matricule]);



  // Connexion
  const login = async (matricule,password)=>{

    setLoading(true);


    try{

      const result = await verifyUserOnCloud(
        matricule,
        password
      );


      if(result?.success){


        const profil = {

          id: result.user.matricule,

          matricule: result.user.matricule,

          nom: result.user.nom || '',

          prenoms:
            result.user.prenoms ||
            result.user.prenom ||
            '',

          role: result.user.role,


          statut:
          (result.user.statut || "actif")
          .trim()
          .toLowerCase(),


          classeId:
          result.user.classeId || '',


          promotion:
          result.user.promotion || '',


          schoolId:
          result.user.schoolId,


          telephone:
          result.user.telephone || '',


          absences:
          result.user.absences || 0

        };


        setUser(profil);


        setSchoolId(profil.schoolId);


        setSchoolName(
          profil.schoolId
          ?
          profil.schoolId
          .replace(/_/g," ")
          .toUpperCase()
          :
          "PORTAIL SCOLAIRE"
        );


        sessionStorage.setItem(
          "sgs_user",
          JSON.stringify(profil)
        );


        setLoading(false);


        return {
          success:true,
          role:profil.role
        };

      }


      setLoading(false);

      return {
        success:false,
        msg:"Identifiants incorrects"
      };


    }catch(error){

      console.error(error);

      setLoading(false);

      return {
        success:false,
        msg:"Erreur serveur"
      };

    }

  };



  const logout=()=>{

    setUser(null);

    setSchoolId("");

    setSchoolName("");

    sessionStorage.clear();

    localStorage.clear();

  };



  return (

    <AuthContext.Provider
      value={{
        user,
        schoolName,
        schoolId,
        loading,
        login,
        logout,
        setUser
      }}
    >

      {children}

    </AuthContext.Provider>

  );

};



export const useAuth=()=>{

const context=useContext(AuthContext);

if(!context)
throw new Error(
"useAuth doit être utilisé dans AuthProvider"
);


return context;

};