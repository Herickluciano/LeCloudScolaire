import { Link } from 'react-router-dom';
import SecretariatAdmin from './SecretariatAdmin.jsx';
import Header from '../../../pages/Header.jsx';

const PageSecretariat = () => {
  return (
    <div >
     
      <div className="mb-4 max-w-4xl mx-auto bg-white">
         <Header/>
      </div>
      <div className="secretaria">
        <SecretariatAdmin />
      </div>
    </div>
  );
};

export default PageSecretariat;
