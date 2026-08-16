import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/api';

import {
  collection,
  query,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';

import HistoriqueMessage from '../../features/admin/pages/messages/HistoriqueMessage';

/* =========================================================
   SERVER.JS
========================================================= */

const SERVER_URL = (
  import.meta.env.VITE_SERVER_URL ||
  'http://localhost:10000'
).replace(/\/$/, '');

/* =========================================================
   ROLES
========================================================= */

const ROLES_PROFESSEURS = [
  'professeur',
  'prof_principal',
  'prof',
];

const ROLES_EDUCATEURS = [
  'educateur',
  'educateur_principal',
];

const ROLES_ELEVES = [
  'eleve',
  'etudiant',
];

const ROLES_PARENTS = [
  'parent',
  'parent_eleve',
];

/* =========================================================
   OUTILS
========================================================= */

const normaliser = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const nomCompletUtilisateur = (person) =>
  `${person?.nom || ''} ${
    person?.prenoms ||
    person?.prenom ||
    person?.name ||
    ''
  }`
    .trim()
    .toUpperCase();

const emailValide = (email) =>
  String(email || '').includes('@');

/* =========================================================
   COMPOSANT
========================================================= */

const NotificationCentre = () => {
  const navigate = useNavigate();

  const {
    user,
    schoolId,
    schoolName,
  } = useAuth();

  const currentSchool = (
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_moderne_gagnoa'
  )
    .trim()
    .toLowerCase();

  const idUtilisateurConnecte =
    user?.matricule ||
    user?.id ||
    'UNKNOWN';

  const roleUtilisateur =
    normaliser(user?.role);

  /* =======================================================
     ÉTATS
  ======================================================= */

  const [
    tousLesMessagesDuEtablissement,
    setTousLesMessagesDuEtablissement,
  ] = useState([]);

  const [
    listeCamaradesEtPersonnels,
    setListeCamaradesEtPersonnels,
  ] = useState([]);

  const [loading, setLoading] = useState(true);

  const [canalActif, setCanalActif] =
    useState('OFFICIEL');

  const [scopeFiltreContacts, setScopeFiltreContacts] =
    useState('eleve');

  const [barreRechercheContact, setBarreRechercheContact] =
    useState('');

  const [titreAnnonce, setTitreAnnonce] =
    useState('');

  const [corpsAnnonceOrChat, setCorpsAnnonceOrChat] =
    useState('');

  const [cibleAudienceGlobale, setCibleAudienceGlobale] =
    useState('all');

  const [sending, setSending] =
    useState(false);

  const [feedback, setFeedback] =
    useState('');

  const [fileBase64, setFileBase64] =
    useState(null);

  const [fileName, setFileName] =
    useState('');

  /* =======================================================
     UTILISATEUR CONNECTÉ
  ======================================================= */

  const utilisateurConnecte = useMemo(
    () =>
      listeCamaradesEtPersonnels.find(
        (person) =>
          person.id ===
            idUtilisateurConnecte ||
          person.matricule ===
            idUtilisateurConnecte
      ) || user || {},
    [
      listeCamaradesEtPersonnels,
      idUtilisateurConnecte,
      user,
    ]
  );

  /* =======================================================
     ÉCOUTE TEMPS RÉEL
  ======================================================= */

  useEffect(() => {
    if (
      !idUtilisateurConnecte ||
      !currentSchool
    ) {
      return undefined;
    }

    const qNotifications =
      query(
        collection(
          db,
          'notifications'
        )
      );

    const unsubNotifications =
      onSnapshot(
        qNotifications,
        (snapshot) => {
          const list = [];

          snapshot.forEach(
            (docSnap) => {
              const d =
                docSnap.data();

              const schoolCleanDoc =
                normaliser(
                  d.schoolId
                );

              if (
                schoolCleanDoc ===
                currentSchool
              ) {
                list.push({
                  id: docSnap.id,
                  ...d,
                });
              }
            }
          );

          list.sort(
            (a, b) =>
              new Date(
                a.createdAt || 0
              ) -
              new Date(
                b.createdAt || 0
              )
          );

          setTousLesMessagesDuEtablissement(
            list
          );
        },
        (error) => {
          console.error(
            '❌ Erreur écoute notifications :',
            error
          );
        }
      );

    const qUsers =
      query(
        collection(
          db,
          'users'
        )
      );

    const unsubUsers =
      onSnapshot(
        qUsers,
        (snapshot) => {
          const uList = [];

          snapshot.forEach(
            (docSnap) => {
              const uData =
                docSnap.data();

              const schoolCleanDoc =
                normaliser(
                  uData.schoolId
                );

              if (
                schoolCleanDoc ===
                  currentSchool &&
                docSnap.id !==
                  idUtilisateurConnecte &&
                uData.matricule !==
                  idUtilisateurConnecte
              ) {
                uList.push({
                  id: docSnap.id,
                  ...uData,
                });
              }
            }
          );

          setListeCamaradesEtPersonnels(
            uList
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            '❌ Erreur écoute utilisateurs :',
            error
          );

          setLoading(false);
        }
      );

    return () => {
      unsubNotifications();
      unsubUsers();
    };
  }, [
    idUtilisateurConnecte,
    currentSchool,
  ]);

  /* =======================================================
     FICHIER
  ======================================================= */

  const handleFileChange = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.size >
      2 * 1024 * 1024
    ) {
      alert(
        'La pièce jointe ne doit pas dépasser 2 Mo.'
      );

      e.target.value = '';

      return;
    }

    setFileName(file.name);

    const reader =
      new FileReader();

    reader.readAsDataURL(file);

    reader.onload = () => {
      setFileBase64(
        reader.result
      );
    };

    reader.onerror = () => {
      console.error(
        '❌ Impossible de lire la pièce jointe.'
      );

      setFileBase64(null);
      setFileName('');
    };
  };

  /* =======================================================
     EST-CE UN ÉLÈVE ?
  ======================================================= */

  const estEleve =
    ROLES_ELEVES.includes(
      roleUtilisateur
    );

  /* =======================================================
     DESTINATAIRES D'UN MESSAGE PRIVÉ
     
     Élève → autre élève + parent
     Professeur → élève + parent
     Éducateur → élève + parent
  ======================================================= */

  const construireDestinatairesPourUtilisateur =
    (person) => {
      const result = [];

      if (!person) {
        return result;
      }

      if (
        emailValide(
          person.email
        )
      ) {
        result.push({
          email:
            String(
              person.email
            )
              .trim()
              .toLowerCase(),

          name:
            nomCompletUtilisateur(
              person
            ) ||
            'Utilisateur Edulink',

          type: 'eleve',
        });
      }

      /*
        Pour un élève :
        on récupère automatiquement
        emailParent.
      */

      if (
        ROLES_ELEVES.includes(
          normaliser(
            person.role
          )
        ) &&
        emailValide(
          person.emailParent
        )
      ) {
        result.push({
          email:
            String(
              person.emailParent
            )
              .trim()
              .toLowerCase(),

          name:
            `Parent de ${
              nomCompletUtilisateur(
                person
              )
            }`,

          type: 'parent',
        });
      }

      /*
        Si un compte parent existe
        directement dans users.
      */

      if (
        ROLES_PARENTS.includes(
          normaliser(
            person.role
          )
        ) &&
        emailValide(
          person.email
        )
      ) {
        result.push({
          email:
            String(
              person.email
            )
              .trim()
              .toLowerCase(),

          name:
            nomCompletUtilisateur(
              person
            ) ||
            'Parent Edulink',

          type: 'parent',
        });
      }

      return result;
    };

  /* =======================================================
     DESTINATAIRES D'UNE PROMOTION
  ======================================================= */

  const construireDestinatairesPromotion =
    (promotion) => {
      const result = [];

      if (!promotion) {
        return result;
      }

      const promotionNormalisee =
        normaliser(
          promotion
        );

      listeCamaradesEtPersonnels
        .filter(
          (person) =>
            ROLES_ELEVES.includes(
              normaliser(
                person.role
              )
            ) &&
            normaliser(
              person.promotion
            ) ===
              promotionNormalisee
        )
        .forEach(
          (person) => {
            result.push(
              ...construireDestinatairesPourUtilisateur(
                person
              )
            );
          }
        );

      return result;
    };

  /* =======================================================
     DESTINATAIRES D'UNE AUDIENCE
  ======================================================= */

  const construireDestinatairesAudience =
    () => {
      const result = [];

      const audience =
        normaliser(
          cibleAudienceGlobale
        );

      listeCamaradesEtPersonnels.forEach(
        (person) => {
          const role =
            normaliser(
              person.role
            );

          /*
            TOUT L'ÉTABLISSEMENT
          */

          if (
            audience ===
            'all'
          ) {
            if (
              ROLES_ELEVES.includes(
                role
              )
            ) {
              result.push(
                ...construireDestinatairesPourUtilisateur(
                  person
                )
              );
            } else {
              if (
                emailValide(
                  person.email
                )
              ) {
                result.push({
                  email:
                    String(
                      person.email
                    )
                      .trim()
                      .toLowerCase(),

                  name:
                    nomCompletUtilisateur(
                      person
                    ) ||
                    'Utilisateur Edulink',

                  type:
                    'personnel',
                });
              }
            }

            return;
          }

          /*
            PROFESSEURS
          */

          if (
            audience ===
              'professeur' &&
            ROLES_PROFESSEURS.includes(
              role
            )
          ) {
            if (
              emailValide(
                person.email
              )
            ) {
              result.push({
                email:
                  String(
                    person.email
                  )
                    .trim()
                    .toLowerCase(),

                name:
                  nomCompletUtilisateur(
                    person
                  ) ||
                  'Professeur Edulink',

                type:
                  'professeur',
              });
            }

            return;
          }

          /*
            ÉDUCATEURS
          */

          if (
            audience ===
              'educateur' &&
            ROLES_EDUCATEURS.includes(
              role
            )
          ) {
            if (
              emailValide(
                person.email
              )
            ) {
              result.push({
                email:
                  String(
                    person.email
                  )
                    .trim()
                    .toLowerCase(),

                name:
                  nomCompletUtilisateur(
                    person
                  ) ||
                  'Éducateur Edulink',

                type:
                  'educateur',
              });
            }

            return;
          }

          /*
            ÉLÈVES + PARENTS
          */

          if (
            audience ===
              'eleve' &&
            ROLES_ELEVES.includes(
              role
            )
          ) {
            result.push(
              ...construireDestinatairesPourUtilisateur(
                person
              )
            );
          }
        }
      );

      return result;
    };

  /* =======================================================
     SUPPRESSION DES DOUBLONS
  ======================================================= */

  const supprimerDoublonsEmails =
    (destinataires) => {
      const map =
        new Map();

      destinataires.forEach(
        (destinataire) => {
          if (
            !emailValide(
              destinataire?.email
            )
          ) {
            return;
          }

          const email =
            String(
              destinataire.email
            )
              .trim()
              .toLowerCase();

          /*
            Ne jamais envoyer
            à l'expéditeur.
          */

          const emailExpediteur =
            normaliser(
              user?.email
            );

          if (
            emailExpediteur &&
            email ===
              emailExpediteur
          ) {
            return;
          }

          if (
            !map.has(email)
          ) {
            map.set(
              email,
              {
                ...destinataire,
                email,
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      );
    };

  /* =======================================================
     DESTINATAIRES EMAIL
  ======================================================= */

  const obtenirDestinatairesEmail =
    () => {
      /*
        ---------------------------------------------------
        COMMUNIQUÉ OFFICIEL
        ---------------------------------------------------
      */

      if (
        canalActif ===
        'OFFICIEL'
      ) {
        return supprimerDoublonsEmails(
          construireDestinatairesAudience()
        );
      }

      /*
        ---------------------------------------------------
        MESSAGE À LA PROMOTION
        ---------------------------------------------------
      */

      if (
        canalActif ===
        'PROMOTION'
      ) {
        return supprimerDoublonsEmails(
          construireDestinatairesPromotion(
            user?.promotion
          )
        );
      }

      /*
        ---------------------------------------------------
        MESSAGE PRIVÉ
        ---------------------------------------------------
      */

      const contact =
        listeCamaradesEtPersonnels.find(
          (person) =>
            person.id ===
            canalActif ||
            person.matricule ===
              canalActif
        );

      if (!contact) {
        return [];
      }

      return supprimerDoublonsEmails(
        construireDestinatairesPourUtilisateur(
          contact
        )
      );
    };

  /* =======================================================
     ENVOI EMAIL
  ======================================================= */

  const envoyerNotificationsEmail =
    async ({
      titre,
      message,
      destinataires,
      typeMessage,
    }) => {
      const destinatairesPropres =
        supprimerDoublonsEmails(
          destinataires || []
        );

      if (
        destinatairesPropres.length ===
        0
      ) {
        return {
          success: true,
          sent: 0,
          failed: 0,
        };
      }

      try {
        const response =
          await fetch(
            `${SERVER_URL}/api/send-notification-email`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                recipients:
                  destinatairesPropres,

                schoolName:
                  schoolName ||
                  currentSchool,

                schoolId:
                  currentSchool,

                title:
                  titre ||
                  'Nouveau message Edulink',

                message:
                  message ||
                  '',

                senderName:
                  nomCompletUtilisateur(
                    user
                  ) ||
                  'UTILISATEUR EDULINK',

                type:
                  typeMessage ||
                  'message',

                appUrl:
                  import.meta.env
                    .VITE_EDULINK_APP_URL ||
                  window.location.origin,

                hasAttachment:
                  Boolean(
                    fileName
                  ),
              }),
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (!response.ok) {
          throw new Error(
            data?.message ||
              data?.msg ||
              'Erreur du serveur d’e-mail.'
          );
        }

        return data;
      } catch (error) {
        console.error(
          '❌ Erreur e-mail :',
          error
        );

        return {
          success: false,
          sent: 0,
          failed:
            destinatairesPropres.length,
          error:
            error.message,
        };
      }
    };

  /* =======================================================
     ENVOI DU MESSAGE
  ======================================================= */

  const handlePublishMessageCentral =
    async (e) => {
      e.preventDefault();

      setFeedback('');

      if (
        !corpsAnnonceOrChat.trim()
      ) {
        return;
      }

      /*
        COMMUNIQUÉ OFFICIEL :
        uniquement administration.
      */

      if (
        canalActif ===
          'OFFICIEL' &&
        ![
          'admin',
          'super_admin',
        ].includes(
          roleUtilisateur
        )
      ) {
        return;
      }

      setSending(true);

      try {
        const expediteurNomComplet =
          nomCompletUtilisateur(
            user
          ) ||
          'UTILISATEUR EDULINK';

        const titreFinal =
          titreAnnonce.trim() ||
          'COMMUNIQUÉ OFFICIEL';

        const messageFinal =
          corpsAnnonceOrChat.trim();

        /* ================================================
           PROMOTION
        ================================================= */

        if (
          canalActif ===
          'PROMOTION'
        ) {
          if (
            !estEleve ||
            !user?.promotion
          ) {
            throw new Error(
              'La promotion de l’élève est introuvable.'
            );
          }

          const notificationData =
            {
              schoolId:
                currentSchool,

              expediteurId:
                idUtilisateurConnecte,

              expediteurNom:
                expediteurNomComplet,

              destinataireId:
                `PROMOTION_${user.promotion}`,

              destinataireNom:
                `PROMOTION ${user.promotion}`,

              titre:
                'Message de promotion',

              message:
                messageFinal,

              promotion:
                user.promotion,

              type:
                'promotion',

              audience:
                'promotion',

              pjName:
                fileName ||
                null,

              pjData:
                fileBase64 ||
                null,

              createdAt:
                new Date().toISOString(),
            };

          await addDoc(
            collection(
              db,
              'notifications'
            ),
            notificationData
          );

          const destinataires =
            obtenirDestinatairesEmail();

          const emailResult =
            await envoyerNotificationsEmail(
              {
                titre:
                  'Message de promotion',

                message:
                  messageFinal,

                destinataires,

                typeMessage:
                  'promotion',
              }
            );

          if (
            emailResult.success
          ) {
            setFeedback(
              `✅ Message envoyé à la promotion. ${emailResult.sent || 0} notification(s) e-mail envoyée(s).`
            );
          } else {
            setFeedback(
              '⚠️ Message enregistré dans Edulink, mais l’envoi des e-mails a rencontré un problème.'
            );
          }
        }

        /* ================================================
           COMMUNIQUÉ OFFICIEL
        ================================================= */

        else if (
          canalActif ===
          'OFFICIEL'
        ) {
          const notificationData =
            {
              schoolId:
                currentSchool,

              expediteurId:
                idUtilisateurConnecte,

              expediteurNom:
                expediteurNomComplet,

              destinataireId:
                'ALL',

              destinataireNom:
                "TOUT L'ÉTABLISSEMENT",

              titre:
                titreFinal,

              message:
                messageFinal,

              audience:
                cibleAudienceGlobale,

              type:
                'global',

              pjName:
                fileName ||
                null,

              pjData:
                fileBase64 ||
                null,

              createdAt:
                new Date().toISOString(),
            };

          await addDoc(
            collection(
              db,
              'notifications'
            ),
            notificationData
          );

          const destinataires =
            obtenirDestinatairesEmail();

          const emailResult =
            await envoyerNotificationsEmail(
              {
                titre:
                  titreFinal,

                message:
                  messageFinal,

                destinataires,

                typeMessage:
                  'global',
              }
            );

          if (
            emailResult.success
          ) {
            setFeedback(
              `✅ Communiqué enregistré. ${emailResult.sent || 0} e-mail(s) envoyé(s).`
            );
          } else {
            setFeedback(
              '⚠️ Communiqué enregistré dans Edulink, mais l’envoi e-mail a échoué.'
            );
          }

          setTitreAnnonce('');
        }

        /* ================================================
           ADMINISTRATION
        ================================================= */

        else if (
          canalActif ===
          'ADMIN'
        ) {
          const notificationData =
            {
              schoolId:
                currentSchool,

              expediteurId:
                idUtilisateurConnecte,

              expediteurNom:
                expediteurNomComplet,

              destinataireId:
                'ADMIN',

              destinataireNom:
                'ADMINISTRATION CENTRALE',

              message:
                messageFinal,

              type:
                'reclamation',

              createdAt:
                new Date().toISOString(),
            };

          await addDoc(
            collection(
              db,
              'notifications'
            ),
            notificationData
          );

          /*
            On envoie aussi un e-mail
            à l'administration si elle
            possède une adresse.
          */

          const admins =
            listeCamaradesEtPersonnels.filter(
              (person) =>
                [
                  'admin',
                  'super_admin',
                  'secretaire',
                ].includes(
                  normaliser(
                    person.role
                  )
                )
            );

          const destinataires =
            supprimerDoublonsEmails(
              admins.map(
                (person) => ({
                  email:
                    person.email,

                  name:
                    nomCompletUtilisateur(
                      person
                    ),
                })
              )
            );

          const emailResult =
            await envoyerNotificationsEmail(
              {
                titre:
                  'Nouvelle réclamation',

                message:
                  messageFinal,

                destinataires,

                typeMessage:
                  'reclamation',
              }
            );

          if (
            emailResult.success
          ) {
            setFeedback(
              `✅ Réclamation envoyée. ${emailResult.sent || 0} e-mail(s) envoyé(s).`
            );
          } else {
            setFeedback(
              '⚠️ Réclamation enregistrée dans Edulink, mais l’e-mail n’a pas pu être envoyé.'
            );
          }
        }

        /* ================================================
           MESSAGE PRIVÉ
        ================================================= */

        else {
          const contactCibleObj =
            listeCamaradesEtPersonnels.find(
              (x) =>
                x.id ===
                  canalActif ||
                x.matricule ===
                  canalActif
            );

          if (
            !contactCibleObj
          ) {
            throw new Error(
              'Destinataire introuvable.'
            );
          }

          const typeMessageCalcule =
            'chat_eleve';

          await addDoc(
            collection(
              db,
              'notifications'
            ),
            {
              schoolId:
                currentSchool,

              expediteurId:
                idUtilisateurConnecte,

              expediteurNom:
                expediteurNomComplet,

              destinataireId:
                contactCibleObj.id,

              destinataireNom:
                nomCompletUtilisateur(
                  contactCibleObj
                ),

              message:
                messageFinal,

              type:
                typeMessageCalcule,

              createdAt:
                new Date().toISOString(),
            }
          );

          /*
            E-mail au destinataire
            + parent si le destinataire
            est un élève.
          */

          const destinataires =
            obtenirDestinatairesEmail();

          const emailResult =
            await envoyerNotificationsEmail(
              {
                titre:
                  'Nouveau message Edulink',

                message:
                  messageFinal,

                destinataires,

                typeMessage:
                  'prive',
              }
            );

          if (
            emailResult.success
          ) {
            setFeedback(
              `✅ Message envoyé. ${emailResult.sent || 0} e-mail(s) envoyé(s).`
            );
          } else {
            setFeedback(
              '⚠️ Message enregistré dans Edulink, mais l’e-mail n’a pas pu être envoyé.'
            );
          }
        }

        /* ================================================
           NETTOYAGE
        ================================================= */

        setCorpsAnnonceOrChat('');
        setFileBase64(null);
        setFileName('');

        const fileInput =
          document.getElementById(
            'fileCentralInput'
          );

        if (fileInput) {
          fileInput.value = '';
        }
      } catch (err) {
        console.error(
          '❌ Erreur lors de l’envoi :',
          err
        );

        setFeedback(
          `❌ ${err.message || 'Une erreur est survenue lors de l’envoi.'}`
        );
      } finally {
        setSending(false);
      }
    };

  /* =======================================================
     CONTACTS
  ======================================================= */

  const filtrerFichesDestinatairesLeft =
    listeCamaradesEtPersonnels.filter(
      (contact) => {
        const role =
          normaliser(
            contact.role
          );

        const matcheRole =
          role ===
            normaliser(
              scopeFiltreContacts
            ) ||
          (
            scopeFiltreContacts ===
              'professeur' &&
            role ===
              'prof_principal'
          );

        const nomComplet =
          `${contact.nom || ''} ${
            contact.prenoms ||
            contact.prenom ||
            ''
          } ${contact.id}`
            .toLowerCase();

        return (
          matcheRole &&
          nomComplet.includes(
            barreRechercheContact
              .toLowerCase()
              .trim()
          )
        );
      }
    );

  /* =======================================================
     MESSAGES
  ======================================================= */

  const messagesFiltresAAfficher =
    tousLesMessagesDuEtablissement.filter(
      (m) => {
        /* -----------------------------------------------
           OFFICIEL
        ------------------------------------------------ */

        if (
          canalActif ===
          'OFFICIEL'
        ) {
          if (
            ![
              'global',
              'promotion',
            ].includes(
              m.type
            )
          ) {
            return false;
          }

          if (
            [
              'admin',
              'super_admin',
            ].includes(
              roleUtilisateur
            )
          ) {
            return true;
          }

          if (
            m.type ===
            'promotion'
          ) {
            return (
              estEleve &&
              normaliser(
                m.promotion
              ) ===
                normaliser(
                  user?.promotion
                )
            );
          }

          return (
            m.audience ===
              'all' ||
            m.audience ===
              roleUtilisateur ||
            (
              m.audience ===
                'eleve' &&
              estEleve
            )
          );
        }

        /* -----------------------------------------------
           PROMOTION
        ------------------------------------------------ */

        if (
          canalActif ===
          'PROMOTION'
        ) {
          return (
            m.type ===
              'promotion' &&
            normaliser(
              m.promotion
            ) ===
              normaliser(
                user?.promotion
              )
          );
        }

        /* -----------------------------------------------
           ADMIN
        ------------------------------------------------ */

        if (
          canalActif ===
          'ADMIN'
        ) {
          return (
            m.type ===
              'reclamation' &&
            (
              m.expediteurId ===
                idUtilisateurConnecte ||
              m.destinataireId ===
                idUtilisateurConnecte ||
              m.destinataireId ===
                'ADMIN'
            )
          );
        }

        /* -----------------------------------------------
           PRIVÉ
        ------------------------------------------------ */

        return (
          (
            m.type ===
              'chat_eleve' ||
            m.type ===
              'reclamation'
          ) &&
          (
            (
              m.expediteurId ===
                idUtilisateurConnecte &&
              m.destinataireId ===
                canalActif
            ) ||
            (
              m.expediteurId ===
                canalActif &&
              m.destinataireId ===
                idUtilisateurConnecte
            )
          )
        );
      }
    );

  /* =======================================================
     CHARGEMENT
  ======================================================= */

  if (loading) {
    return (
      <div
        className="
          p-8
          text-center
          text-xs
          font-bold
          text-purple-600
          animate-pulse
          uppercase
        "
      >
        Ouverture de la centrale des messages...
      </div>
    );
  }

  /* =======================================================
     INTERFACE
  ======================================================= */

  return (
    <div
      className="
        max-w-7xl
        mx-auto
        p-4
        sm:p-6
        font-sans
        text-gray-700
        text-left
        animate-fadeIn
        min-h-screen
        bg-gray-50
      "
    >
      {/* RETOUR */}

      <div className="mb-4">
        <button
          type="button"
          onClick={() =>
            navigate(-1)
          }
          className="
            inline-flex
            items-center
            text-xs
            font-black
            bg-white
            border
            hover:bg-gray-100
            text-gray-700
            px-4
            py-2
            rounded-xl
            transition
            shadow-sm
            cursor-pointer
          "
        >
          ⬅️ Retour au Bureau Établissement
        </button>
      </div>

      {/* BANDEAU */}

      <div
        className="
          bg-slate-900
          p-5
          rounded-2xl
          border
          shadow-md
          mb-6
        "
      >
        <span
          className="
            text-[10px]
            font-black
            uppercase
            tracking-widest
            text-orange-400
            bg-orange-950/40
            px-3
            py-1
            rounded-full
          "
        >
          📡 Routeur de Flux NoSQL
        </span>

        <h2
          className="
            text-xl
            font-black
            mt-2
            text-white
          "
        >
          Centre National des Correspondances Scolaires
        </h2>

        <p
          className="
            text-xs
            text-slate-400
            mt-0.5
          "
        >
          Utilisateur connecté :

          <span
            className="
              font-bold
              uppercase
              ml-1
            "
          >
            {user?.nom ||
              'UTILISATEUR'}{' '}
            ({idUtilisateurConnecte})
          </span>
        </p>
      </div>

      {/* FEEDBACK */}

      {feedback && (
        <div
          className={`
            mb-5
            p-3
            rounded-xl
            border
            text-xs
            font-bold
            ${
              feedback.startsWith('❌')
                ? 'bg-red-50 text-red-700 border-red-200'
                : feedback.startsWith('⚠️')
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }
          `}
        >
          {feedback}
        </div>
      )}

      {/* GRILLE */}

      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-3
          gap-6
          items-start
        "
      >
        {/* GAUCHE */}

        <div
          className="
            bg-white
            rounded-2xl
            border
            shadow-sm
            p-4
            space-y-4
            h-[540px]
            flex
            flex-col
          "
        >
          <div>
            <h3
              className="
                text-xs
                font-black
                text-gray-400
                uppercase
                tracking-wider
                border-b
                pb-2
              "
            >
              Canaux d'Aiguillage
            </h3>
          </div>

          <div
            className="
              space-y-1.5
              flex-1
              overflow-y-auto
              pr-1
            "
          >
            {/* OFFICIEL */}

            <button
              type="button"
              onClick={() =>
                setCanalActif(
                  'OFFICIEL'
                )
              }
              className={`
                w-full
                text-left
                p-3
                rounded-xl
                transition
                font-black
                text-xs
                flex
                items-center
                justify-between
                cursor-pointer
                border
                ${
                  canalActif ===
                  'OFFICIEL'
                    ? 'bg-purple-600 text-white border-purple-700 shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <span>
                📢 Communiqués Officiels
              </span>

              <span
                className="
                  text-[8px]
                  bg-white/20
                  text-white
                  px-2
                  py-0.5
                  rounded
                  uppercase
                "
              >
                Général
              </span>
            </button>

            {/* PROMOTION ÉLÈVE */}

            {estEleve &&
              user?.promotion && (
                <button
                  type="button"
                  onClick={() =>
                    setCanalActif(
                      'PROMOTION'
                    )
                  }
                  className={`
                    w-full
                    text-left
                    p-3
                    rounded-xl
                    transition
                    font-black
                    text-xs
                    flex
                    items-center
                    justify-between
                    cursor-pointer
                    border
                    ${
                      canalActif ===
                      'PROMOTION'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }
                  `}
                >
                  <span>
                    🎓 Ma promotion
                  </span>

                  <span
                    className="
                      text-[8px]
                      bg-blue-200
                      text-blue-800
                      px-2
                      py-0.5
                      rounded
                      uppercase
                    "
                  >
                    {user.promotion}
                  </span>
                </button>
              )}

            {/* ADMIN */}

            {roleUtilisateur !==
              'admin' &&
              roleUtilisateur !==
                'super_admin' && (
                <button
                  type="button"
                  onClick={() =>
                    setCanalActif(
                      'ADMIN'
                    )
                  }
                  className={`
                    w-full
                    text-left
                    p-3
                    rounded-xl
                    transition
                    font-black
                    text-xs
                    flex
                    items-center
                    justify-between
                    cursor-pointer
                    border
                    ${
                      canalActif ===
                      'ADMIN'
                        ? 'bg-red-600 text-white border-red-700 shadow-md'
                        : 'bg-red-50 text-red-700 hover:bg-red-100/50'
                    }
                  `}
                >
                  <span>
                    🏛️ Réclamation Secrétariat Admin
                  </span>

                  <span
                    className="
                      text-[8px]
                      bg-red-950
                      text-red-300
                      px-2
                      py-0.5
                      rounded
                      font-mono
                    "
                  >
                    SOS
                  </span>
                </button>
              )}

            {/* CONTACTS */}

            <div
              className="
                pt-4
                border-t
                mt-4
                space-y-2
              "
            >
              <span
                className="
                  text-[10px]
                  font-black
                  uppercase
                  text-gray-400
                  tracking-wider
                "
              >
                Carnet de Contacts Interconnecté
              </span>

              <div
                className="
                  flex
                  bg-gray-100
                  p-0.5
                  rounded-lg
                  border
                  text-[9px]
                  font-black
                  uppercase
                "
              >
                <button
                  type="button"
                  onClick={() =>
                    setScopeFiltreContacts(
                      'eleve'
                    )
                  }
                  className={`
                    flex-1
                    py-1
                    rounded
                    transition
                    cursor-pointer
                    ${
                      scopeFiltreContacts ===
                      'eleve'
                        ? 'bg-slate-900 text-orange-400'
                        : 'text-gray-400'
                    }
                  `}
                >
                  Élèves
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setScopeFiltreContacts(
                      'professeur'
                    )
                  }
                  className={`
                    flex-1
                    py-1
                    rounded
                    transition
                    cursor-pointer
                    ${
                      scopeFiltreContacts ===
                      'professeur'
                        ? 'bg-slate-900 text-orange-400'
                        : 'text-gray-400'
                    }
                  `}
                >
                  Professeurs
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setScopeFiltreContacts(
                      'educateur'
                    )
                  }
                  className={`
                    flex-1
                    py-1
                    rounded
                    transition
                    cursor-pointer
                    ${
                      scopeFiltreContacts ===
                      'educateur'
                        ? 'bg-slate-900 text-orange-400'
                        : 'text-gray-400'
                    }
                  `}
                >
                  Éducateurs
                </button>
              </div>

              <input
                type="text"
                placeholder="🔍 Filtrer par nom ou prénom..."
                value={
                  barreRechercheContact
                }
                onChange={(e) =>
                  setBarreRechercheContact(
                    e.target.value
                  )
                }
                className="
                  w-full
                  bg-gray-50
                  border
                  p-2
                  rounded-lg
                  text-[11px]
                  font-bold
                  outline-none
                  text-gray-700
                  focus:ring-1
                  focus:ring-purple-500
                "
              />
            </div>

            {/* LISTE */}

            <div
              className="
                space-y-1
                max-h-[160px]
                overflow-y-auto
                pt-2
              "
            >
              {filtrerFichesDestinatairesLeft.map(
                (contact) => (
                  <button
                    key={
                      contact.id
                    }
                    type="button"
                    onClick={() =>
                      setCanalActif(
                        contact.id
                      )
                    }
                    className={`
                      w-full
                      text-left
                      p-2
                      rounded-lg
                      text-[11px]
                      transition
                      flex
                      justify-between
                      items-center
                      cursor-pointer
                      ${
                        canalActif ===
                        contact.id
                          ? 'bg-slate-900 text-orange-400 font-black shadow-xs'
                          : 'bg-white border hover:bg-gray-50'
                      }
                    `}
                  >
                    <span
                      className="
                        truncate
                        uppercase
                        font-black
                      "
                    >
                      {contact.nom}{' '}
                      {contact.prenoms ||
                        contact.prenom ||
                        contact.name ||
                        ''}
                    </span>

                    <span
                      className="
                        font-mono
                        text-[8px]
                        text-gray-400
                        bg-gray-100
                        px-1
                        py-0.5
                        rounded
                        uppercase
                        font-bold
                      "
                    >
                      {contact.classeId ||
                        contact.promotion ||
                        contact.role}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* DISCUSSION */}

        <div
          className="
            lg:col-span-2
            flex
            flex-col
            justify-between
            bg-white
            rounded-2xl
            border
            shadow-sm
            h-[540px]
            overflow-hidden
          "
        >
          {/* HEADER */}

          <div
            className="
              p-4
              bg-gray-50
              border-b
              flex
              justify-between
              items-center
              text-xs
              font-black
              text-gray-800
            "
          >
            <p>
              Fil Connecté :

              <span
                className="
                  text-purple-700
                  uppercase
                  ml-1
                "
              >
                {canalActif ===
                'OFFICIEL'
                  ? 'Affichage Communiqués Généraux'
                  : canalActif ===
                    'PROMOTION'
                  ? `Promotion ${user?.promotion || ''}`
                  : canalActif ===
                    'ADMIN'
                  ? 'Secrétariat de la Direction'
                  : `Discussion avec ${
                      listeCamaradesEtPersonnels.find(
                        (v) =>
                          v.id ===
                            canalActif ||
                          v.matricule ===
                            canalActif
                      )?.nom ||
                      'Membre Équipe'
                    }`}
              </span>
            </p>

            <span
              className="
                text-[10px]
                font-mono
                text-emerald-600
                uppercase
                bg-emerald-50
                px-2
                py-0.5
                rounded
                animate-pulse
              "
            >
              ● Canal Actif
            </span>
          </div>

          {/* MESSAGES */}

          <div
            className="
              p-4
              overflow-y-auto
              flex-1
              space-y-4
              bg-gray-50/40
              max-h-[340px]
            "
          >
            {messagesFiltresAAfficher.length ===
            0 ? (
              <div
                className="
                  text-center
                  py-20
                  text-gray-400
                  italic
                  text-xs
                  font-medium
                "
              >
                Aucun message échangé.
                Saisissez votre texte ci-dessous
                pour démarrer le dialogue en direct.
              </div>
            ) : (
              messagesFiltresAAfficher.map(
                (m, index) => {
                  const estAnnonceOfficielle =
                    m.type ===
                      'global' ||
                    m.type ===
                      'promotion';

                  const estMoi =
                    m.expediteurId ===
                    idUtilisateurConnecte;

                  if (
                    estAnnonceOfficielle
                  ) {
                    return (
                      <div
                        key={
                          m.id ||
                          index
                        }
                        className="
                          p-4
                          rounded-xl
                          border-l-4
                          border-l-purple-600
                          bg-white
                          shadow-2xs
                          text-xs
                          font-medium
                          space-y-2
                          animate-fadeIn
                        "
                      >
                        <div
                          className="
                            flex
                            justify-between
                            items-center
                            font-bold
                            text-gray-900
                            border-b
                            pb-1
                          "
                        >
                          <span
                            className="
                              text-purple-700
                              uppercase
                            "
                          >
                            📣 {m.titre}
                          </span>

                          <span
                            className="
                              text-[10px]
                              text-gray-400
                              font-mono
                              font-bold
                            "
                          >
                            {m.expediteurNom ||
                              'DIRECTION'}
                          </span>
                        </div>

                        <p
                          className="
                            text-gray-600
                            leading-relaxed
                            font-medium
                            whitespace-pre-wrap
                          "
                        >
                          {m.message}
                        </p>

                        {m.pjName &&
                          m.pjData && (
                            <div
                              className="
                                mt-2
                                p-2
                                bg-gray-50
                                border
                                rounded-lg
                                flex
                                items-center
                                justify-between
                                font-bold
                              "
                            >
                              <span
                                className="
                                  text-[10px]
                                  font-mono
                                  text-gray-400
                                "
                              >
                                📎 {m.pjName}
                              </span>

                              <a
                                href={
                                  m.pjData
                                }
                                download={
                                  m.pjName
                                }
                                className="
                                  text-purple-700
                                  bg-purple-100
                                  hover:bg-purple-200
                                  px-2.5
                                  py-1
                                  rounded
                                  text-[10px]
                                  uppercase
                                  font-black
                                "
                              >
                                📥 Télécharger
                              </a>
                            </div>
                          )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={
                        m.id ||
                        index
                      }
                      className={`
                        flex
                        flex-col
                        max-w-[80%]
                        p-3
                        rounded-2xl
                        shadow-2xs
                        text-xs
                        ${
                          estMoi
                            ? 'ml-auto bg-slate-900 text-white rounded-br-none'
                            : 'mr-auto bg-white border text-gray-800 rounded-bl-none'
                        }
                      `}
                    >
                      <span
                        className="
                          text-[8px]
                          font-black
                          uppercase
                          text-purple-400
                          mb-1
                        "
                      >
                        {m.expediteurNom}
                      </span>

                      <p
                        className="
                          leading-relaxed
                          whitespace-pre-wrap
                          font-medium
                        "
                      >
                        {m.message}
                      </p>
                    </div>
                  );
                }
              )
            )}
          </div>

          {/* FORMULAIRE */}

          <form
            onSubmit={
              handlePublishMessageCentral
            }
            className="
              p-3
              border-t
              bg-gray-50
              space-y-3
              font-bold
              text-xs
            "
          >
            {/* OPTIONS OFFICIELLES */}

            {canalActif ===
              'OFFICIEL' &&
              [
                'admin',
                'super_admin',
              ].includes(
                roleUtilisateur
              ) && (
                <div
                  className="
                    grid
                    grid-cols-1
                    sm:grid-cols-3
                    gap-3
                    animate-fadeIn
                  "
                >
                  <input
                    type="text"
                    placeholder="Objet du communiqué officiel *"
                    value={
                      titreAnnonce
                    }
                    onChange={(e) =>
                      setTitreAnnonce(
                        e.target.value
                      )
                    }
                    className="
                      sm:col-span-2
                      bg-white
                      border
                      rounded-xl
                      px-3
                      py-2
                      outline-none
                      text-gray-800
                      focus:ring-1
                      focus:ring-purple-500
                      font-bold
                    "
                    required
                  />

                  <select
                    value={
                      cibleAudienceGlobale
                    }
                    onChange={(e) =>
                      setCibleAudienceGlobale(
                        e.target.value
                      )
                    }
                    className="
                      bg-white
                      border
                      rounded-xl
                      px-3
                      py-2
                      outline-none
                      cursor-pointer
                      text-purple-700
                      font-black
                    "
                  >
                    <option value="all">
                      🌍 Tout l'Établissement
                    </option>

                    <option value="professeur">
                      👨‍🏫 Corps Enseignant
                    </option>

                    <option value="educateur">
                      🧑‍💼 Éducateurs
                    </option>

                    <option value="eleve">
                      🎓 Élèves & Parents
                    </option>
                  </select>
                </div>
              )}

            {/* PIÈCE JOINTE */}

            {canalActif ===
              'OFFICIEL' &&
              [
                'admin',
                'super_admin',
              ].includes(
                roleUtilisateur
              ) && (
                <div
                  className="
                    bg-white
                    border
                    p-2
                    rounded-xl
                    text-[10px]
                    text-gray-400
                    flex
                    items-center
                    justify-between
                    gap-4
                    animate-fadeIn
                  "
                >
                  <span>
                    📎 Attacher un document officiel
                    (Max 2 Mo) :
                  </span>

                  <input
                    id="fileCentralInput"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={
                      handleFileChange
                    }
                  />
                </div>
              )}

            {/* MESSAGE */}

            <div
              className="
                flex
                gap-2
              "
            >
              <input
                type="text"
                placeholder={
                  canalActif ===
                  'OFFICIEL'
                    ? [
                        'admin',
                        'super_admin',
                      ].includes(
                        roleUtilisateur
                      )
                      ? 'Saisissez l’annonce administrative...'
                      : 'Lecture seule. Droits d’écriture réservés à la Direction.'
                    : canalActif ===
                      'PROMOTION'
                    ? 'Écrire un message à toute ma promotion...'
                    : canalActif ===
                      'ADMIN'
                    ? 'Exprimez votre réclamation...'
                    : 'Écrire un message privé direct...'
                }
                value={
                  corpsAnnonceOrChat
                }
                onChange={(e) =>
                  setCorpsAnnonceOrChat(
                    e.target.value
                  )
                }
                disabled={
                  canalActif ===
                    'OFFICIEL' &&
                  ![
                    'admin',
                    'super_admin',
                  ].includes(
                    roleUtilisateur
                  )
                }
                className="
                  flex-1
                  bg-white
                  border
                  rounded-xl
                  px-4
                  py-2.5
                  text-xs
                  font-bold
                  outline-none
                  focus:ring-2
                  focus:ring-purple-500
                  text-gray-800
                  disabled:bg-gray-100
                "
                required
              />

              <button
                type="submit"
                disabled={
                  sending ||
                  (
                    canalActif ===
                      'OFFICIEL' &&
                    ![
                      'admin',
                      'super_admin',
                    ].includes(
                      roleUtilisateur
                    )
                  ) ||
                  !corpsAnnonceOrChat.trim()
                }
                className="
                  bg-purple-600
                  hover:bg-purple-700
                  text-white
                  font-black
                  text-xs
                  uppercase
                  px-5
                  py-2.5
                  rounded-xl
                  shadow-md
                  transition
                  cursor-pointer
                  disabled:bg-gray-200
                "
              >
                {sending
                  ? 'Envoi...'
                  : '⚡ Envoyer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <HistoriqueMessage />
    </div>
  );
};

export default NotificationCentre;