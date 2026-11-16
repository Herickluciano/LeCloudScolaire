import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';

import { db } from '../services/api';

import { useAuth } from '../context/AuthContext';
import Header from '../pages/Header';


const MessagesNotifications = () => {

  const { user } = useAuth();

  // ============================================================
  // IDENTITÉ
  // ============================================================

  const myId = String(
    user?.matricule ||
    user?.id ||
    ''
  ).trim();

  const currentSchool =
    String(
      user?.schoolId ||
      sessionStorage.getItem(
        'sgs_school_id'
      ) ||
      'lycee_saint_bernard'
    )
      .trim()
      .toLowerCase();

  const role =
    String(
      user?.role || ''
    )
      .trim()
      .toLowerCase();

  const classeId =
    String(
      user?.classeId || ''
    ).trim();

  const promotion =
    String(
      user?.promotion || ''
    ).trim();


  // ============================================================
  // ÉTATS
  // ============================================================

  const [
    notifications,
    setNotifications
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    erreur,
    setErreur
  ] = useState('');


  // ============================================================
  // NORMALISATION
  // ============================================================

  const normaliser = (value) => {

    return String(
      value || ''
    )
      .trim()
      .toLowerCase();
  };


  // ============================================================
  // ÉCOUTE FIRESTORE
  // ============================================================

  useEffect(() => {

    if (
      !currentSchool ||
      !myId
    ) {

      setNotifications([]);

      setLoading(false);

      return undefined;
    }


    setLoading(true);

    setErreur('');


    const q = query(
      collection(
        db,
        'notifications'
      ),
      where(
        'schoolId',
        '==',
        currentSchool
      )
    );


    const unsubscribe =
      onSnapshot(

        q,

        (snapshot) => {

          const list = [];


          snapshot.forEach(
            (docSnap) => {

              const data =
                docSnap.data() || {};


              const notification = {

                id:
                  docSnap.id,

                ...data
              };


              // =================================================
              // NORMALISATION
              // =================================================

              const notificationAudience =
                normaliser(
                  notification.audience
                );

              const notificationType =
                normaliser(
                  notification.type
                );

              const notificationCible =
                normaliser(
                  notification.cible
                );

              const notificationExpediteur =
                String(
                  notification.expediteurId ||
                  ''
                ).trim();


              const notificationClasse =
                String(
                  notification.classeId ||
                  ''
                ).trim();


              const notificationPromotion =
                normaliser(
                  notification.promotion
                );


              // =================================================
              // DESTINATAIRE DIRECT
              // =================================================

              const destinataireDirect =
                String(
                  notification.destinataireId ||
                  ''
                ).trim();


              const destinataireIds =
                Array.isArray(
                  notification.destinataireIds
                )
                  ? notification.destinataireIds
                  : [];


              const estDestinataireDirect =
                destinataireDirect === myId ||
                destinataireIds.includes(
                  myId
                );


              // =================================================
              // EST-CE L'EXPÉDITEUR ?
              // =================================================

              const estExpediteur =
                notificationExpediteur ===
                myId;


              // =================================================
              // ADMIN
              // =================================================

              const estAdmin =
                role === 'admin' ||
                role === 'super_admin';


              if (
                estAdmin
              ) {

                // L'admin voit les messages
                // qui lui sont destinés
                // + les messages envoyés
                // par lui.

                const visibleAdmin =
                  estExpediteur ||
                  estDestinataireDirect ||
                  notificationAudience ===
                    'admin' ||
                  notificationCible ===
                    'admin' ||
                  destinataireDirect ===
                    'ADMIN' ||
                  notificationAudience ===
                    'all';


                if (
                  visibleAdmin
                ) {

                  list.push(
                    notification
                  );
                }

                return;
              }


              // =================================================
              // EXPÉDITEUR
              // =================================================

              if (
                estExpediteur
              ) {

                list.push(
                  notification
                );

                return;
              }


              // =================================================
              // MESSAGE DIRECT
              // =================================================

              if (
                estDestinataireDirect
              ) {

                list.push(
                  notification
                );

                return;
              }


              // =================================================
              // TOUT L'ÉTABLISSEMENT
              // =================================================

              if (
                notificationAudience ===
                  'all' ||
                notificationType ===
                  'global'
              ) {

                list.push(
                  notification
                );

                return;
              }


              // =================================================
              // ÉDUCATEUR
              // =================================================

              if (
                role ===
                  'educateur' &&
                (
                  notificationAudience ===
                    'educateur' ||
                  notificationCible ===
                    'educateur'
                )
              ) {

                list.push(
                  notification
                );

                return;
              }


              // =================================================
              // PROFESSEUR
              // =================================================

              if (
                (
                  role ===
                    'professeur' ||
                  role ===
                    'prof_principal'
                ) &&
                (
                  notificationAudience ===
                    'professeur' ||
                  notificationCible ===
                    'professeur'
                )
              ) {

                list.push(
                  notification
                );

                return;
              }


              // =================================================
              // ÉLÈVE
              // =================================================

              if (
                role === 'eleve' &&
                (
                  notificationAudience ===
                    'eleve' ||
                  notificationCible ===
                    'eleve'
                )
              ) {

                list.push(
                  notification
                );

                return;
              }


              // =================================================
              // CLASSE
              // =================================================

              if (
                notificationAudience ===
                  'classe' &&
                notificationClasse &&
                normaliser(
                  notificationClasse
                ) === normaliser(
                  classeId
                )
              ) {

                list.push(
                  notification
                );

                return;
              }


              // =================================================
              // PROMOTION
              // =================================================

              if (
                notificationAudience ===
                  'promotion' &&
                notificationPromotion &&
                notificationPromotion ===
                  normaliser(
                    promotion
                  )
              ) {

                list.push(
                  notification
                );

                return;
              }

            }
          );


          // =====================================================
          // TRI : PLUS RÉCENT EN PREMIER
          // =====================================================

          list.sort(
            (a, b) =>
              new Date(
                b.createdAt || 0
              ) -
              new Date(
                a.createdAt || 0
              )
          );


          setNotifications(
            list
          );

          setLoading(false);
        },

        (error) => {

          console.error(
            '❌ Erreur notifications :',
            error
          );

          setErreur(
            'Impossible de charger les messages.'
          );

          setLoading(false);
        }
      );


    return () => {
      unsubscribe();
    };

  }, [
    currentSchool,
    myId,
    role,
    classeId,
    promotion
  ]);


  // ============================================================
  // MARQUER COMME LU
  // ============================================================

  const marquerCommeLu =
    async (
      notification
    ) => {

      if (
        !notification?.id
      ) {
        return;
      }

      try {

        const ref =
          doc(
            db,
            'notifications',
            notification.id
          );


        await updateDoc(
          ref,
          {
            luPar:
              arrayUnion(
                myId
              )
          }
        );

      } catch (error) {

        console.error(
          'Erreur marquage lu :',
          error
        );
      }
    };


  // ============================================================
  // NOMBRE NON LUS
  // ============================================================

  const nombreNonLus =
    useMemo(() => {

      return notifications.filter(
        (notification) => {

          const luPar =
            Array.isArray(
              notification.luPar
            )
              ? notification.luPar
              : [];

          return !luPar.includes(
            myId
          );
        }
      ).length;

    }, [
      notifications,
      myId
    ]);


  // ============================================================
  // AFFICHAGE
  // ============================================================

  if (
    loading
  ) {

    return (
      <div className="p-6 text-center text-sm font-bold text-slate-500">
        ⏳ Chargement des messages...
      </div>
    );
  }


  if (
    erreur
  ) {

    return (
      <div className="p-4 rounded-xl bg-red-50 text-red-600 font-bold">
        {erreur}
      </div>
    );
  }


  return (
    <div className="space-y-4">
     <Header/>
      {/* EN-TÊTE */}

      <div className="
        flex
        items-center
        justify-between
        bg-slate-900
        rounded-2xl 
      ">

        <div>

          <h2 className="font-black uppercase">
            📨 Messages
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            {notifications.length}{' '}
            message(s)
          </p>

        </div>

        {nombreNonLus > 0 && (
          <div className="
            bg-orange-500
            
            rounded-full
            px-3
            py-1
            text-xs
            font-black
          ">
            {nombreNonLus} non lu(s)
          </div>
        )}

      </div>


      {/* LISTE */}

      {notifications.length === 0 ? (

        <div className="
          bg-slate-50
          border
          border-slate-200
          rounded-2xl
          p-8
          text-center
          text-slate-500
          font-semibold
        ">
          📭 Aucun message disponible.
        </div>

      ) : (

        notifications.map(
          (notification) => {

            const luPar =
              Array.isArray(
                notification.luPar
              )
                ? notification.luPar
                : [];

            const estLu =
              luPar.includes(
                myId
              );


            return (
              <div
                key={
                  notification.id
                }
                onClick={() =>
                  !estLu &&
                  marquerCommeLu(
                    notification
                  )
                }
                className={`
                  rounded-2xl
                  border
                  p-5
                  cursor-pointer
                  transition
                  ${
                    estLu
                      ? 'bg-white border-slate-200'
                      : 'bg-orange-50 border-orange-300 shadow-sm'
                  }
                `}
              >

                {/* EN-TÊTE MESSAGE */}

                <div className="
                  flex
                  justify-between
                  gap-3
                  mb-2
                ">

                  <div>

                    <h3 className="
                      font-black
                      text-slate-900
                      text-sm
                    ">
                      {notification.titre ||
                        'Notification'}
                    </h3>

                    <p className="
                      text-xs
                      text-slate-500
                      mt-1
                    ">
                      De :{' '}
                      <strong>
                        {notification.expediteurNom ||
                          'Utilisateur'}
                      </strong>
                    </p>

                  </div>

                  {!estLu && (
                    <span className="
                      bg-orange-500
                      
                      text-[10px]
                      font-black
                      px-2
                      py-1
                      rounded-full
                      h-fit
                    ">
                      NOUVEAU
                    </span>
                  )}

                </div>


                {/* MESSAGE */}

                <p className="
                  text-sm
                  text-slate-700
                  whitespace-pre-wrap
                ">
                  {notification.message}
                </p>


                {/* INFORMATIONS */}

                <div className="
                  mt-4
                  flex
                  flex-wrap
                  gap-2
                  text-[10px]
                  font-bold
                  uppercase
                ">

                  {notification.audience && (
                    <span className="
                      bg-slate-100
                      text-slate-600
                      px-2
                      py-1
                      rounded-lg
                    ">
                      {notification.audience}
                    </span>
                  )}

                  {notification.classeId && (
                    <span className="
                      bg-slate-100
                      text-slate-600
                      px-2
                      py-1
                      rounded-lg
                    ">
                      Classe :{' '}
                      {notification.classeId}
                    </span>
                  )}

                  {notification.promotion && (
                    <span className="
                      bg-slate-100
                      text-slate-600
                      px-2
                      py-1
                      rounded-lg
                    ">
                      Promotion :{' '}
                      {notification.promotion}
                    </span>
                  )}

                  {notification.createdAt && (
                    <span className="
                      text-slate-400
                      px-2
                      py-1
                    ">
                      {new Date(
                        notification.createdAt
                      ).toLocaleString(
                        'fr-FR'
                      )}
                    </span>
                  )}

                </div>

              </div>
            );
          }
        )

      )}

    </div>
  );
};


export default MessagesNotifications;