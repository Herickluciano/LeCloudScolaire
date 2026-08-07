import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


const ProtectedRoute = ({allowedRoles=[]})=>{
const rolesAutorisesNettoyes = allowedRoles.map(r => r.trim().toLowerCase());

const {user,loading}=useAuth();



if(loading){

return (

<div className="flex h-screen items-center justify-center">

<p className="font-bold text-gray-500">
Vérification sécurité...
</p>

</div>

);

}



if(!user){

return <Navigate to="/login" replace />;

}



// 👑 ADMIN TOUJOURS AUTORISE
if(user.role==="admin"){

return <Outlet/>;

}



// 🚫 BLOQUE LES COMPTES NON ACTIFS

const statut =
(user.statut || "actif")
.toLowerCase();



if(statut !== "actif"){

return (

<Navigate
to="/unauthorized"
replace
/>

);

}



// Vérification rôle

if(!allowedRoles.includes(user.role)){

return <Navigate
to="/unauthorized"
replace
/>;

}



return <Outlet/>;


};


export default ProtectedRoute;