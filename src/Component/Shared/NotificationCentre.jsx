import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/api';

import {
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';

import Header from '../../pages/Header';

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

const ROLES_ADMIN = [
  'admin',
  'super_admin',
  'secretaire',
];

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

const obtenirRoleNormalise = (person) =>
  normaliser(person?.role);

const obtenirIdentifiantDocument = (person) =>
  String(
    person?.id ||
    person?.uid ||
    person?.matricule ||
    ''
  ).trim();

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

  /* =======================================================
     ECOLE
  ======================================================= */

  const currentSchool = String(
    schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    ''
  )
    .trim()
    .toLowerCase();

  /* =======================================================
     IDENTIFICATION
  ======================================================= */

  const idUtilisateurConnecte = String(
    user?.matricule ||
    user?.id ||
    user?.uid ||
    ''
  ).trim();

  const roleUtilisateur = normaliser(
    user?.role
  );

  const estAdministrateur =
    ROLES_ADMIN.includes(
      roleUtilisateur
    );

  const estEducateur =
    ROLES_EDUCATEURS.includes(
      roleUtilisateur
    );

  const estEleve =
    ROLES_ELEVES.includes(
      roleUtilisateur
    );

  /* =======================================================
     ETATS
  ======================================================= */

  const [
    tousLesMessagesDuEtablissement,
    setTousLesMessagesDuEtablissement,
  ] = useState([]);

  const [
    listeCamaradesEtPersonnels,
    setListeCamaradesEtPersonnels,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  /*
   * CANAL :
   *
   * OFFICIEL
   * PROMOTION
   * ADMIN
   * DIRECT
   */
  const [
    canalActif,
    setCanalActif,
  ] = useState('OFFICIEL');

  /*
   * Destinataire individuel séparé du canal.
   *
   * Cela évite les confusions entre :
   * OFFICIEL / ADMIN / PROMOTION
   * et l'ID réel d'un utilisateur.
   */
  const [
    destinataireIndividuel,
    setDestinataireIndividuel,
  ] = useState(null);

  const [
    scopeFiltreContacts,
    setScopeFiltreContacts,
  ] = useState('eleve');

  const [
    barreRechercheContact,
    setBarreRechercheContact,
  ] = useState('');

  const [
    titreAnnonce,
    setTitreAnnonce,
  ] = useState('');

  const [
    corpsAnnonceOrChat,
    setCorpsAnnonceOrChat,
  ] = useState('');

  const [
    cibleAudienceGlobale,
    setCibleAudienceGlobale,
  ] = useState('all');

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    feedback,
    setFeedback,
  ] = useState('');

  const [
    fileBase64,
    setFileBase64,
  ] = useState(null);

  const [
    fileName,
    setFileName,
  ] = useState('');

  const [
    suppressionEnCours,
    setSuppressionEnCours,
  ] = useState('');

  /* =======================================================
     UTILISATEUR CONNECTE
  ======================================================= */

  const utilisateurConnecte = useMemo(
    () =>
      listeCamaradesEtPersonnels.find(
        (person) =>
          String(person.id || '').trim() ===
            idUtilisateurConnecte ||
          String(person.matricule || '').trim() ===
            idUtilisateurConnecte ||
          String(person.uid || '').trim() ===
            idUtilisateurConnecte
      ) ||
      user ||
      {},
    [
      listeCamaradesEtPersonnels,
      idUtilisateurConnecte,
      user,
    ]
  );

  /* =======================================================
     FIREBASE TEMPS REEL
  ======================================================= */

  useEffect(() => {
    if (
      !idUtilisateurConnecte ||
      !currentSchool
    ) {
      setLoading(false);
      return undefined;
    }

    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    const qNotifications = query(
      collection(
        db,
        'notifications'
      )
    );

    const unsubscribeNotifications =
      onSnapshot(
        qNotifications,
        (snapshot) => {
          const list = [];

          snapshot.forEach(
            (docSnap) => {
              const data =
                docSnap.data() || {};

              if (
                normaliser(
                  data.schoolId
                ) !==
                normaliser(
                  currentSchool
                )
              ) {
                return;
              }

              const masquePour =
                Array.isArray(
                  data.masquePour
                )
                  ? data.masquePour.map(
                      (id) =>
                        String(id).trim()
                    )
                  : [];

              if (
                masquePour.includes(
                  idUtilisateurConnecte
                )
              ) {
                return;
              }

              list.push({
                id: docSnap.id,
                ...data,
              });
            }
          );

          list.sort(
            (a, b) =>
              new Date(
                b.createdAt || 0
              ).getTime() -
              new Date(
                a.createdAt || 0
              ).getTime()
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

          setFeedback(
            '❌ Impossible de suivre les notifications en temps réel.'
          );
        }
      );

    /* =====================================================
       UTILISATEURS
    ===================================================== */

    const qUsers = query(
      collection(
        db,
        'users'
      )
    );

    const unsubscribeUsers =
      onSnapshot(
        qUsers,
        (snapshot) => {
          const uList = [];

          snapshot.forEach(
            (docSnap) => {
              const data =
                docSnap.data() || {};

              const docId =
                String(
                  docSnap.id
                ).trim();

              const matricule =
                String(
                  data.matricule ||
                  ''
                ).trim();

              if (
                normaliser(
                  data.schoolId
                ) !==
                normaliser(
                  currentSchool
                )
              ) {
                return;
              }

              /*
               * Ne pas afficher l'utilisateur connecté
               * dans ses propres destinataires.
               */
              if (
                docId ===
                  idUtilisateurConnecte ||
                matricule ===
                  idUtilisateurConnecte
              ) {
                return;
              }

              uList.push({
                id: docId,
                ...data,
              });
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
      unsubscribeNotifications();
      unsubscribeUsers();
    };
  }, [
    idUtilisateurConnecte,
    currentSchool,
  ]);

  /* =======================================================
     SUPPRESSION NOTIFICATION
  ======================================================= */

  const supprimerNotificationRecue =
    async (notification) => {
      if (
        !notification ||
        !notification.id
      ) {
        return;
      }

      if (
        !ROLES_ADMIN.includes(
          roleUtilisateur
        )
      ) {
        return;
      }

      const idAdmin =
        String(
          idUtilisateurConnecte
        ).trim();

      if (!idAdmin) {
        return;
      }

      const expediteurId =
        String(
          notification.expediteurId ||
          notification.senderId ||
          ''
        ).trim();

      if (
        expediteurId &&
        normaliser(expediteurId) ===
          normaliser(idAdmin)
      ) {
        setFeedback(
          '⚠️ Vous ne pouvez pas supprimer ici votre propre message envoyé.'
        );

        setTimeout(
          () => setFeedback(''),
          3000
        );

        return;
      }

      const confirmation =
        window.confirm(
          'Voulez-vous supprimer cette notification de votre historique ?'
        );

      if (!confirmation) {
        return;
      }

      setSuppressionEnCours(
        notification.id
      );

      try {
        const notificationRef =
          doc(
            db,
            'notifications',
            notification.id
          );

        await updateDoc(
          notificationRef,
          {
            masquePour:
              arrayUnion(
                idAdmin
              ),
          }
        );

        setTousLesMessagesDuEtablissement(
          (ancienneListe) =>
            ancienneListe.filter(
              (item) =>
                item.id !==
                notification.id
            )
        );

        setFeedback(
          '✅ Notification supprimée de votre historique.'
        );

        setTimeout(
          () => setFeedback(''),
          3000
        );
      } catch (error) {
        console.error(
          '❌ Erreur suppression notification :',
          error
        );

        setFeedback(
          '❌ Impossible de supprimer cette notification.'
        );
      } finally {
        setSuppressionEnCours('');
      }
    };

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

    setFileName(
      file.name
    );

    const reader =
      new FileReader();

    reader.readAsDataURL(
      file
    );

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
     AUTORISATION MESSAGE INDIVIDUEL
  ======================================================= */

  const peutEnvoyerIndividuelA =
    (person) => {
      if (!person) {
        return false;
      }

      const role =
        obtenirRoleNormalise(
          person
        );

      /*
       * ADMIN :
       * professeur + éducateur + élève
       */
      if (estAdministrateur) {
        return (
          ROLES_PROFESSEURS.includes(
            role
          ) ||
          ROLES_EDUCATEURS.includes(
            role
          ) ||
          ROLES_ELEVES.includes(
            role
          )
        );
      }

      /*
       * EDUCATEUR :
       * uniquement élève.
       */
      if (estEducateur) {
        return ROLES_ELEVES.includes(
          role
        );
      }

      /*
       * Pour les autres utilisateurs,
       * on conserve la possibilité de contacter
       * les contacts affichés.
       */
      return true;
    };

  /* =======================================================
     CONTACTS INDIVIDUELS AUTORISES
  ======================================================= */

  const contactsIndividuelsAutorises =
    useMemo(
      () =>
        listeCamaradesEtPersonnels.filter(
          (person) =>
            peutEnvoyerIndividuelA(
              person
            )
        ),
      [
        listeCamaradesEtPersonnels,
        roleUtilisateur,
        estAdministrateur,
        estEducateur,
      ]
    );

  /* =======================================================
     DESTINATAIRES EMAIL - MESSAGE INDIVIDUEL
     
     IMPORTANT :
     Ici on envoie uniquement à la personne choisie.
     
     PAS d'emailParent automatique.
  ======================================================= */

  const construireDestinataireIndividuelEmail =
    (person) => {
      if (
        !person ||
        !emailValide(
          person.email
        )
      ) {
        return [];
      }

      return [
        {
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
            'UTILISATEUR EDULINK',

          type:
            normaliser(
              person.role
            ) || 'utilisateur',

          userId:
            obtenirIdentifiantDocument(
              person
            ),

          role:
            normaliser(
              person.role
            ),
        },
      ];
    };

  /* =======================================================
     DESTINATAIRES PROMOTION
  ======================================================= */

  const construireDestinatairesPromotion =
    (promotion) => {
      const result = [];

      if (!promotion) {
        return result;
      }

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
              normaliser(
                promotion
              )
        )
        .forEach(
          (person) => {
            /*
             * Pour les messages de promotion,
             * on conserve le comportement existant :
             * élève + parent.
             */
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
                  ),

                type:
                  'eleve',
              });
            }

            if (
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
                  `Parent de ${nomCompletUtilisateur(
                    person
                  )}`,

                type:
                  'parent',
              });
            }
          }
        );

      return result;
    };

  /* =======================================================
     DESTINATAIRES UTILISATEUR
     
     Fonction utilisée pour les audiences générales.
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
            'EDULINK - LE LIEN SCOLAIRE',

          type:
            normaliser(
              person.role
            ) || 'personnel',
        });
      }

      /*
       * Parent uniquement pour les messages
       * collectifs/audience élève.
       *
       * PAS pour le message individuel.
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
            `Parent de ${nomCompletUtilisateur(
              person
            )}`,

          type:
            'parent',
        });
      }

      return result;
    };

  /* =======================================================
     AUDIENCE
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
            } else if (
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
                  'EDULINK - LE LIEN SCOLAIRE',

                type:
                  'personnel',
              });
            }

            return;
          }

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
                  ),

                type:
                  'professeur',
              });
            }

            return;
          }

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
                  ),

                type:
                  'educateur',
              });
            }

            return;
          }

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
     DEDUPLICATION EMAILS
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
            !map.has(
              email
            )
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
       * MESSAGE INDIVIDUEL
       *
       * Priorité absolue à la personne sélectionnée.
       */
      if (
        canalActif ===
        'DIRECT'
      ) {
        if (
          !destinataireIndividuel
        ) {
          return [];
        }

        return supprimerDoublonsEmails(
          construireDestinataireIndividuelEmail(
            destinataireIndividuel
          )
        );
      }

      if (
        canalActif ===
        'OFFICIEL'
      ) {
        return supprimerDoublonsEmails(
          construireDestinatairesAudience()
        );
      }

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

      if (
        canalActif ===
        'ADMIN'
      ) {
        const admins =
          listeCamaradesEtPersonnels.filter(
            (person) =>
              ROLES_ADMIN.includes(
                normaliser(
                  person.role
                )
              )
          );

        return supprimerDoublonsEmails(
          admins.map(
            (person) => ({
              email:
                person.email,

              name:
                nomCompletUtilisateur(
                  person
                ),

              type:
                'administration',
            })
          )
        );
      }

      return [];
    };

  /* =======================================================
     EMAIL
  ======================================================= */

  const envoyerNotificationsEmail =
    async ({
      titre,
      message,
      destinataires,
      typeMessage,
      destinataire = null,
    }) => {
      if (
        !destinataires ||
        destinataires.length ===
          0
      ) {
        return {
          success: true,
          sent: 0,
        };
      }

      try {
        const listeEmailsExtrait =
          destinataires
            .map(
              (d) =>
                d.email
            )
            .filter(Boolean);

        if (
          listeEmailsExtrait.length ===
          0
        ) {
          return {
            success: true,
            sent: 0,
          };
        }

        const response =
          await fetch(
            `${SERVER_URL}/api/send-notification-email`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  recipients:
                    listeEmailsExtrait,

                  schoolName:
                    schoolName ||
                    currentSchool,

                  schoolId:
                    currentSchool,

                  title:
                    titre,

                  message:
                    message,

                  senderName:
                    nomCompletUtilisateur(
                      utilisateurConnecte
                    ) ||
                    'Administration',

                  senderRole:
                    roleUtilisateur,

                  senderId:
                    idUtilisateurConnecte,

                  recipientName:
                    destinataire
                      ? nomCompletUtilisateur(
                          destinataire
                        )
                      : '',

                  recipientRole:
                    destinataire
                      ? normaliser(
                          destinataire.role
                        )
                      : '',

                  recipientId:
                    destinataire
                      ? obtenirIdentifiantDocument(
                          destinataire
                        )
                      : '',

                  type:
                    typeMessage ||
                    'notification',

                  appUrl:
                    window.location.origin,

                  hasAttachment:
                    !!fileBase64,
                }),
            }
          );

        if (
          response.ok
        ) {
          return {
            success: true,
            sent:
              listeEmailsExtrait.length,
          };
        }

        const errData =
          await response
            .json()
            .catch(
              () => ({})
            );

        console.error(
          '⚠️ Erreur serveur email :',
          errData
        );

        return {
          success: false,
          error:
            errData,
        };
      } catch (
        error
      ) {
        console.error(
          '❌ Erreur email :',
          error
        );

        return {
          success: false,
          error:
            error.message,
        };
      }
    };

  /* =======================================================
     SELECTION DESTINATAIRE INDIVIDUEL
  ======================================================= */

  const selectionnerDestinataireIndividuel =
    (person) => {
      if (
        !peutEnvoyerIndividuelA(
          person
        )
      ) {
        return;
      }

      setDestinataireIndividuel(
        person
      );

      setCanalActif(
        'DIRECT'
      );

      setFeedback('');
    };

  /* =======================================================
     OUVRIR CANAL OFFICIEL
  ======================================================= */

  const ouvrirCanalOfficiel =
    () => {
      setCanalActif(
        'OFFICIEL'
      );

      setDestinataireIndividuel(
        null
      );

      setFeedback('');
    };

  /* =======================================================
     OUVRIR PROMOTION
  ======================================================= */

  const ouvrirCanalPromotion =
    () => {
      setCanalActif(
        'PROMOTION'
      );

      setDestinataireIndividuel(
        null
      );

      setFeedback('');
    };

  /* =======================================================
     OUVRIR ADMIN
  ======================================================= */

  const ouvrirCanalAdmin =
    () => {
      setCanalActif(
        'ADMIN'
      );

      setDestinataireIndividuel(
        null
      );

      setFeedback('');
    };

  /* =======================================================
     ENVOI MESSAGE
  ======================================================= */

  const handlePublishMessageCentral =
    async (e) => {
      e.preventDefault();

      setFeedback('');

      if (
        !corpsAnnonceOrChat.trim()
      ) {
        setFeedback(
          '❌ Veuillez saisir un message.'
        );

        return;
      }

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
            utilisateurConnecte
          ) ||
          '';

        const titreFinal =
          titreAnnonce.trim() ||
          'COMMUNIQUÉ OFFICIEL';

        const messageFinal =
          corpsAnnonceOrChat.trim();

        /* =================================================
           MESSAGE INDIVIDUEL
        ================================================= */

        if (
          canalActif ===
          'DIRECT'
        ) {
          if (
            !destinataireIndividuel
          ) {
            throw new Error(
              'Veuillez sélectionner un destinataire.'
            );
          }

          if (
            !peutEnvoyerIndividuelA(
              destinataireIndividuel
            )
          ) {
            throw new Error(
              'Vous n’êtes pas autorisé à contacter cet utilisateur.'
            );
          }

          const destinataireId =
            obtenirIdentifiantDocument(
              destinataireIndividuel
            );

          if (
            !destinataireId
          ) {
            throw new Error(
              'Identifiant du destinataire introuvable.'
            );
          }

          const destinataireNom =
            nomCompletUtilisateur(
              destinataireIndividuel
            ) ||
            'UTILISATEUR';

          const destinataireRole =
            normaliser(
              destinataireIndividuel.role
            );

          /*
           * DOCUMENT FIRESTORE INDIVIDUEL
           */
          const notificationData = {
            schoolId:
              currentSchool,

            expediteurId:
              idUtilisateurConnecte,

            expediteurNom:
              expediteurNomComplet,

            expediteurRole:
              roleUtilisateur,

            expediteurEmail:
              user?.email ||
              '',

            expediteurClasseId:
              utilisateurConnecte?.classeId ||
              null,

            expediteurClasse:
              utilisateurConnecte?.classe ||
              null,

            expediteurPromotionId:
              utilisateurConnecte?.promotionId ||
              null,

            expediteurPromotion:
              utilisateurConnecte?.promotion ||
              null,

            destinataireId:
              destinataireId,

            destinataireNom:
              destinataireNom,

            destinataireRole:
              destinataireRole,

            destinataireEmail:
              destinataireIndividuel.email ||
              '',

            destinataireClasseId:
              destinataireIndividuel.classeId ||
              null,

            destinataireClasse:
              destinataireIndividuel.classe ||
              null,

            destinatairePromotionId:
              destinataireIndividuel.promotionId ||
              null,

            destinatairePromotion:
              destinataireIndividuel.promotion ||
              null,

            titre:
              titreAnnonce.trim() ||
              'Message individuel',

            message:
              messageFinal,

            cible:
              'individuel',

            audience:
              'individuel',

            type:
              'message_individuel',

            pjName:
              fileName ||
              null,

            pjData:
              fileBase64 ||
              null,

            lu:
              false,

            masquePour:
              [],

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
           * EMAIL UNIQUEMENT AU DESTINATAIRE
           */
          const destinataires =
            obtenirDestinatairesEmail();

          const emailResult =
            await envoyerNotificationsEmail(
              {
                titre:
                  titreAnnonce.trim() ||
                  'Message individuel Edulink',

                message:
                  messageFinal,

                destinataires,

                typeMessage:
                  'message_individuel',

                destinataire:
                  destinataireIndividuel,
              }
            );

          if (
            emailResult.success
          ) {
            setFeedback(
              `✅ Message individuel envoyé à ${destinataireNom}.`
            );
          } else {
            setFeedback(
              `⚠️ Message enregistré pour ${destinataireNom}, mais l'e-mail n'a pas pu être envoyé.`
            );
          }

          /*
           * RESET INDIVIDUEL
           */
          setDestinataireIndividuel(
            null
          );

          setCanalActif(
            'DIRECT'
          );
        }

        /* =================================================
           PROMOTION
        ================================================= */

        else if (
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

          const notificationData = {
            schoolId:
              currentSchool,

            expediteurId:
              idUtilisateurConnecte,

            expediteurNom:
              expediteurNomComplet,

            expediteurRole:
              roleUtilisateur,

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

            cible:
              'promotion',

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

            masquePour:
              [],

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

          setFeedback(
            emailResult.success
              ? '✅ Message envoyé à la promotion.'
              : "⚠️ Message enregistré, mais l’e-mail n’a pas pu être envoyé."
          );
        }

        /* =================================================
           OFFICIEL
        ================================================= */

        else if (
          canalActif ===
          'OFFICIEL'
        ) {
          const notificationData = {
            schoolId:
              currentSchool,

            expediteurId:
              idUtilisateurConnecte,

            expediteurNom:
              expediteurNomComplet,

            expediteurRole:
              roleUtilisateur,

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

            cible:
              'groupe',

            type:
              'global',

            pjName:
              fileName ||
              null,

            pjData:
              fileBase64 ||
              null,

            masquePour:
              [],

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

          setFeedback(
            '✅ Communiqué enregistré.'
          );

          setTitreAnnonce('');
        }

        /* =================================================
           ADMIN / RECLAMATION
        ================================================= */

        else if (
          canalActif ===
          'ADMIN'
        ) {
          const notificationData = {
            schoolId:
              currentSchool,

            expediteurId:
              idUtilisateurConnecte,

            expediteurNom:
              expediteurNomComplet,

            expediteurRole:
              roleUtilisateur,

            destinataireId:
              'ADMIN',

            destinataireNom:
              'ADMINISTRATION CENTRALE',

            message:
              messageFinal,

            cible:
              'administration',

            type:
              'reclamation',

            masquePour:
              [],

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

          const admins =
            listeCamaradesEtPersonnels.filter(
              (person) =>
                ROLES_ADMIN.includes(
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

                  type:
                    'administration',
                })
              )
            );

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

          setFeedback(
            '✅ Réclamation envoyée.'
          );
        }

        /* =================================================
           RESET
        ================================================= */

        setCorpsAnnonceOrChat(
          ''
        );

        setFileBase64(
          null
        );

        setFileName(
          ''
        );

        const fileInput =
          document.getElementById(
            'fileCentralInput'
          );

        if (
          fileInput
        ) {
          fileInput.value =
            '';
        }
      } catch (
        error
      ) {
        console.error(
          '❌ Erreur lors de l’envoi :',
          error
        );

        setFeedback(
          `❌ ${error.message}`
        );
      } finally {
        setSending(false);
      }
    };

  /* =======================================================
     FILTRE CONTACTS
  ======================================================= */

  const filtrerFichesDestinatairesLeft =
    contactsIndividuelsAutorises.filter(
      (contact) => {
        const role =
          normaliser(
            contact.role
          );

        /*
         * ÉDUCATEUR :
         * seulement les élèves.
         */
        if (
          estEducateur
        ) {
          if (
            !ROLES_ELEVES.includes(
              role
            )
          ) {
            return false;
          }
        }

        /*
         * ADMIN :
         * filtre selon l'onglet.
         */
        let matcheRole =
          false;

        if (
          scopeFiltreContacts ===
          'eleve'
        ) {
          matcheRole =
            ROLES_ELEVES.includes(
              role
            );
        }

        if (
          scopeFiltreContacts ===
          'professeur'
        ) {
          matcheRole =
            ROLES_PROFESSEURS.includes(
              role
            );
        }

        if (
          scopeFiltreContacts ===
          'educateur'
        ) {
          matcheRole =
            ROLES_EDUCATEURS.includes(
              role
            );
        }

        /*
         * Pour les éducateurs,
         * l'onglet élèves est forcé.
         */
        if (
          estEducateur
        ) {
          matcheRole =
            ROLES_ELEVES.includes(
              role
            );
        }

        const nomComplet =
          `${contact.nom || ''} ${
            contact.prenoms ||
            contact.prenom ||
            ''
          } ${
            contact.matricule ||
            ''
          } ${
            contact.id ||
            ''
          }`
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
     MESSAGES A AFFICHER
  ======================================================= */

  const messagesFiltresAAfficher =
    tousLesMessagesDuEtablissement.filter(
      (message) => {
        /* ================================================
           OFFICIEL
        ================================================ */

        if (
          canalActif ===
          'OFFICIEL'
        ) {
          if (
            ![
              'global',
              'promotion',
            ].includes(
              message.type
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
            message.type ===
            'promotion'
          ) {
            return (
              estEleve &&
              normaliser(
                message.promotion
              ) ===
                normaliser(
                  user?.promotion
                )
            );
          }

          return (
            message.audience ===
              'all' ||
            message.audience ===
              roleUtilisateur ||
            (
              message.audience ===
                'eleve' &&
              estEleve
            )
          );
        }

        /* ================================================
           PROMOTION
        ================================================ */

        if (
          canalActif ===
          'PROMOTION'
        ) {
          return (
            message.type ===
              'promotion' &&
            normaliser(
              message.promotion
            ) ===
              normaliser(
                user?.promotion
              )
          );
        }

        /* ================================================
           ADMIN
        ================================================ */

        if (
          canalActif ===
          'ADMIN'
        ) {
          return (
            message.type ===
              'reclamation' &&
            (
              String(
                message.expediteurId ||
                ''
              ) ===
                idUtilisateurConnecte ||
              String(
                message.destinataireId ||
                ''
              ) ===
                idUtilisateurConnecte ||
              message.destinataireId ===
                'ADMIN'
            )
          );
        }

        /* ================================================
           MESSAGE INDIVIDUEL
        ================================================ */

        if (
          canalActif ===
          'DIRECT'
        ) {
          /*
           * Si aucun destinataire n'est sélectionné,
           * on montre les messages individuels où
           * l'utilisateur connecté intervient.
           */
          if (
            !destinataireIndividuel
          ) {
            return (
              message.cible ===
                'individuel' ||
              message.type ===
                'message_individuel' ||
              message.type ===
                'chat_eleve'
            ) &&
            (
              normaliser(
                message.expediteurId
              ) ===
                normaliser(
                  idUtilisateurConnecte
                ) ||
              normaliser(
                message.destinataireId
              ) ===
                normaliser(
                  idUtilisateurConnecte
                )
            );
          }

          const selectedId =
            obtenirIdentifiantDocument(
              destinataireIndividuel
            );

          return (
            (
              message.cible ===
                'individuel' ||
              message.type ===
                'message_individuel' ||
              message.type ===
                'chat_eleve'
            ) &&
            (
              (
                normaliser(
                  message.expediteurId
                ) ===
                  normaliser(
                    idUtilisateurConnecte
                  ) &&
                normaliser(
                  message.destinataireId
                ) ===
                  normaliser(
                    selectedId
                  )
              ) ||
              (
                normaliser(
                  message.expediteurId
                ) ===
                  normaliser(
                    selectedId
                  ) &&
                normaliser(
                  message.destinataireId
                ) ===
                  normaliser(
                    idUtilisateurConnecte
                  )
              )
            )
          );
        }

        return false;
      }
    );

  /* =======================================================
     CHARGEMENT
  ======================================================= */

  if (
    loading
  ) {
    return (
      <div className="p-8 text-center text-xs font-bold text-purple-600 animate-pulse uppercase">
        Ouverture de la centrale...
      </div>
    );
  }

  /* =======================================================
     RENDU
  ======================================================= */

  return (
    <div className="max-w-7xl mx-auto p-0 sm:p-6 font-sans text-gray-700 text-left bg-white min-h-screen">

      <Header />

      {/* ===================================================
          RETOUR
      =================================================== */}

      <div className="mb-4">
        <button
          type="button"
          onClick={() =>
            navigate(-1)
          }
          className="inline-flex items-center text-xs font-black bg-white border hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl transition shadow-sm cursor-pointer"
        >
          ⬅️ Retour au Bureau Établissement
        </button>
      </div>

      {/* ===================================================
          BANDEAU
      =================================================== */}

      <div className="bg-slate-900 p-5 rounded-2xl border shadow-md mb-6">

        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-950/40 px-3 py-1 rounded-full">
          📡 Routeur de Flux NoSQL
        </span>

        <h2 className="text-xl font-black mt-2 ">
          Centre National des Correspondances Scolaires
        </h2>

        <p className="text-xs text-slate-400 mt-0.5">

          Connecté :

          <span className="font-bold uppercase ml-1">

            {
              user?.nom ||
              user?.name ||
              'UTILISATEUR'
            }

            {' '}

            (
            {
              idUtilisateurConnecte
            }
            )

          </span>

        </p>

      </div>

      {/* ===================================================
          FEEDBACK
      =================================================== */}

      {feedback && (
        <div
          className={`mb-5 p-3 rounded-xl border text-xs font-bold ${
            feedback.startsWith('❌')
              ? 'bg-red-50 text-red-700 border-red-200'
              : feedback.startsWith('⚠️')
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}
        >
          {feedback}
        </div>
      )}

      {/* ===================================================
          PANNEAU
      =================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* =================================================
            GAUCHE
        ================================================= */}

        <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-4 h-[540px] flex flex-col">

          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider border-b pb-2">
              Canaux d'Aiguillage
            </h3>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">

            {/* ============================================
                OFFICIEL
            ============================================ */}

            <button
              type="button"
              onClick={
                ouvrirCanalOfficiel
              }
              className={`w-full text-left p-3 rounded-xl transition font-black text-xs flex items-center justify-between cursor-pointer border ${
                canalActif ===
                'OFFICIEL'
                  ? 'bg-purple-600  border-purple-700 shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>
                📢 Communiqués Officiels
              </span>

              <span className="text-[8px] bg-white/20  px-2 py-0.5 rounded uppercase">
                Général
              </span>
            </button>

            {/* ============================================
                PROMOTION
            ============================================ */}

            {estEleve &&
              user?.promotion && (
                <button
                  type="button"
                  onClick={
                    ouvrirCanalPromotion
                  }
                  className={`w-full text-left p-3 rounded-xl transition font-black text-xs flex items-center justify-between cursor-pointer border ${
                    canalActif ===
                    'PROMOTION'
                      ? 'bg-blue-600  border-blue-700 shadow-md'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <span>
                    🎓 Ma promotion
                  </span>

                  <span className="text-[8px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded uppercase">
                    {
                      user.promotion
                    }
                  </span>
                </button>
              )}

            {/* ============================================
                ADMIN
            ============================================ */}

            {!estAdministrateur && (
              <button
                type="button"
                onClick={
                  ouvrirCanalAdmin
                }
                className={`w-full text-left p-3 rounded-xl transition font-black text-xs flex items-center justify-between cursor-pointer border ${
                  canalActif ===
                  'ADMIN'
                    ? 'bg-red-600  border-red-700 shadow-md'
                    : 'bg-red-50 text-red-700 hover:bg-red-100/50'
                }`}
              >
                <span>
                  🏛️ Réclamation Secrétariat
                </span>

                <span className="text-[8px] bg-red-950 text-red-300 px-2 py-0.5 rounded font-mono">
                  SOS
                </span>
              </button>
            )}

            {/* ============================================
                CONTACTS INDIVIDUELS
            ============================================ */}

            <div className="pt-4 border-t mt-4 space-y-2">

              <div className="flex items-center justify-between">

                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  💬 Messages individuels
                </span>

                {estAdministrateur && (
                  <span className="text-[8px] font-black uppercase bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                    Admin
                  </span>
                )}

                {estEducateur && (
                  <span className="text-[8px] font-black uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Élèves uniquement
                  </span>
                )}

              </div>

              {/* ==========================================
                  FILTRES ADMIN
              ========================================== */}

              {estAdministrateur && (
                <div className="flex bg-gray-100 p-0.5 rounded-lg border text-[9px] font-black uppercase">

                  <button
                    type="button"
                    onClick={() =>
                      setScopeFiltreContacts(
                        'eleve'
                      )
                    }
                    className={`flex-1 py-1 rounded transition cursor-pointer ${
                      scopeFiltreContacts ===
                      'eleve'
                        ? 'bg-slate-900 text-orange-400'
                        : 'text-gray-400'
                    }`}
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
                    className={`flex-1 py-1 rounded transition cursor-pointer ${
                      scopeFiltreContacts ===
                      'professeur'
                        ? 'bg-slate-900 text-orange-400'
                        : 'text-gray-400'
                    }`}
                  >
                    Profs
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setScopeFiltreContacts(
                        'educateur'
                      )
                    }
                    className={`flex-1 py-1 rounded transition cursor-pointer ${
                      scopeFiltreContacts ===
                      'educateur'
                        ? 'bg-slate-900 text-orange-400'
                        : 'text-gray-400'
                    }`}
                  >
                    Éducateurs
                  </button>

                </div>
              )}

              {/* ==========================================
                  EDUCATEUR
              ========================================== */}

              {estEducateur && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-[9px] font-bold text-blue-700">
                  🧑‍💼 En tant qu'éducateur, vous pouvez envoyer un message individuel uniquement à un élève.
                </div>
              )}

              <input
                type="text"
                placeholder="🔍 Rechercher un destinataire..."
                value={
                  barreRechercheContact
                }
                onChange={(e) =>
                  setBarreRechercheContact(
                    e.target.value
                  )
                }
                className="w-full bg-gray-50 border p-2 rounded-lg text-[11px] font-bold outline-none text-gray-700 focus:ring-1 focus:ring-purple-500"
              />

            </div>

            {/* ============================================
                LISTE DESTINATAIRES
            ============================================ */}

            <div className="space-y-1 max-h-[190px] overflow-y-auto pt-2">

              {filtrerFichesDestinatairesLeft.length ===
              0 ? (
                <div className="text-center py-5 text-[10px] text-gray-400 font-bold">
                  Aucun destinataire trouvé.
                </div>
              ) : (
                filtrerFichesDestinatairesLeft.map(
                  (contact) => {

                    const estSelectionne =
                      canalActif ===
                        'DIRECT' &&
                      destinataireIndividuel &&
                      obtenirIdentifiantDocument(
                        destinataireIndividuel
                      ) ===
                        obtenirIdentifiantDocument(
                          contact
                        );

                    return (
                      <button
                        key={
                          contact.id
                        }
                        type="button"
                        onClick={() =>
                          selectionnerDestinataireIndividuel(
                            contact
                          )
                        }
                        className={`w-full text-left p-2.5 rounded-lg text-[11px] transition flex justify-between items-center cursor-pointer ${
                          estSelectionne
                            ? 'bg-slate-900 text-orange-400 font-black shadow-md border border-slate-900'
                            : 'bg-white border hover:bg-gray-50'
                        }`}
                      >

                        <span className="min-w-0">

                          <span className="truncate uppercase font-black block">

                            {
                              contact.nom
                            }

                            {' '}

                            {
                              contact.prenoms ||
                              contact.prenom ||
                              ''
                            }

                          </span>

                          <span
                            className={`text-[8px] uppercase ${
                              estSelectionne
                                ? 'text-orange-300'
                                : 'text-gray-400'
                            }`}
                          >
                            {
                              normaliser(
                                contact.role
                              )
                            }
                          </span>

                        </span>

                        <span
                          className={`font-mono text-[8px] px-1 py-0.5 rounded uppercase font-bold ${
                            estSelectionne
                              ? 'bg-white/10 text-orange-300'
                              : 'text-gray-400 bg-gray-100'
                          }`}
                        >
                          {
                            contact.classeId ||
                            contact.promotion ||
                            contact.matricule ||
                            contact.role
                          }
                        </span>

                      </button>
                    );
                  }
                )
              )}

            </div>

          </div>

        </div>

        {/* =================================================
            CENTRE
        ================================================= */}

        <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border shadow-sm h-[540px] overflow-hidden">

          {/* ==============================================
              BANDEAU
          ============================================== */}

          <div className="p-4 bg-gray-50 border-b flex justify-between items-center text-xs font-black text-gray-800">

            <div>

              <p>

                Fil Connecté :

                <span className="text-purple-700 uppercase ml-1">

                  {canalActif ===
                  'OFFICIEL'
                    ? 'Communiqués Généraux'
                    : canalActif ===
                      'PROMOTION'
                    ? `Promotion ${
                        user?.promotion ||
                        ''
                      }`
                    : canalActif ===
                      'ADMIN'
                    ? 'Secrétariat Direction'
                    : canalActif ===
                      'DIRECT'
                    ? destinataireIndividuel
                      ? `Message avec ${nomCompletUtilisateur(
                          destinataireIndividuel
                        )}`
                      : 'Messages individuels'
                    : 'Discussion Directe'}

                </span>

              </p>

              {canalActif ===
                'DIRECT' &&
                destinataireIndividuel && (
                  <p className="text-[9px] text-gray-400 mt-1">

                    Destinataire :

                    <span className="font-black text-gray-600 ml-1">

                      {
                        nomCompletUtilisateur(
                          destinataireIndividuel
                        )
                      }

                    </span>

                    <span className="ml-2 uppercase">

                      (
                      {
                        normaliser(
                          destinataireIndividuel.role
                        )
                      }
                      )

                    </span>

                  </p>
                )}

            </div>

            <span className="text-[10px] font-mono text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded animate-pulse">
              ● Canal Actif
            </span>

          </div>

          {/* ==============================================
              HISTORIQUE
          ============================================== */}

          <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-gray-50/40">

            {messagesFiltresAAfficher.length ===
            0 ? (

              <div className="text-center py-20 text-gray-400 italic text-xs font-medium">

                {canalActif ===
                  'DIRECT' &&
                !destinataireIndividuel
                  ? 'Sélectionnez un destinataire pour ouvrir une conversation individuelle.'
                  : 'Aucun message échangé.'}

              </div>

            ) : (

              messagesFiltresAAfficher.map(
                (message, index) => {

                  const estAnnonceOfficielle =
                    message.type ===
                      'global' ||
                    message.type ===
                      'promotion';

                  const estMoi =
                    normaliser(
                      message.expediteurId
                    ) ===
                    normaliser(
                      idUtilisateurConnecte
                    );

                  const estAdministrateurLocal =
                    ROLES_ADMIN.includes(
                      roleUtilisateur
                    );

                  const estRecu =
                    !estMoi;

                 
                  /* ========================================
                     MESSAGE NORMAL / INDIVIDUEL
                  ======================================== */

                  return (
                    <div
                      key={
                        message.id ||
                        index
                      }
                      className={`flex flex-col max-w-[80%] p-3 rounded-2xl shadow-sm text-xs ${
                        estMoi
                          ? 'ml-auto bg-slate-900  rounded-br-none'
                          : 'mr-auto bg-white border text-gray-800 rounded-bl-none'
                      }`}
                    >

                      <div className="flex items-start gap-3">

                        <div className="flex-1 min-w-0">

                          <div className="flex items-center gap-2 mb-1">

                            <span
                              className={`text-[8px] font-black uppercase ${
                                estMoi
                                  ? 'text-orange-300'
                                  : 'text-purple-400'
                              }`}
                            >
                              {
                                message.expediteurNom ||
                                'UTILISATEUR'
                              }
                            </span>

                            {message.expediteurRole && (
                              <span
                                className={`text-[7px] uppercase px-1.5 py-0.5 rounded ${
                                  estMoi
                                    ? 'bg-white/10 text-orange-200'
                                    : 'bg-purple-50 text-purple-500'
                                }`}
                              >
                                {
                                  message.expediteurRole
                                }
                              </span>
                            )}

                          </div>

                          {message.titre && (
                            <div className="font-black mb-1">
                              {
                                message.titre
                              }
                            </div>
                          )}

                          {message.cible ===
                            'individuel' && (
                            <div
                              className={`text-[8px] uppercase font-black mb-1 ${
                                estMoi
                                  ? 'text-slate-300'
                                  : 'text-gray-400'
                              }`}
                            >
                              🔒 Message individuel
                            </div>
                          )}

                          <p className="leading-relaxed whitespace-pre-wrap font-medium">
                            {
                              message.message
                            }
                          </p>

                          {message.destinataireNom &&
                            estMoi && (
                              <div
                                className={`text-[8px] mt-2 ${
                                  estMoi
                                    ? 'text-slate-400'
                                    : 'text-gray-400'
                                }`}
                              >
                                À :{' '}
                                {
                                  message.destinataireNom
                                }
                              </div>
                            )}

                        </div>

                        {estAdministrateurLocal &&
                          estRecu && (
                            <button
                              type="button"
                              onClick={() =>
                                supprimerNotificationRecue(
                                  message
                                )
                              }
                              disabled={
                                suppressionEnCours ===
                                message.id
                              }
                              title="Supprimer de mon historique"
                              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {
                                suppressionEnCours ===
                                message.id
                                  ? '⏳'
                                  : '🗑️'
                              }
                            </button>
                          )}

                      </div>

                    </div>
                  );
                }
              )

            )}

          </div>

          {/* ==============================================
              SAISIE
          ============================================== */}

          <form
            onSubmit={
              handlePublishMessageCentral
            }
            className="p-3 border-t bg-gray-50 space-y-3 font-bold text-xs"
          >

            {/* ============================================
                OBJET + AUDIENCE OFFICIEL
            ============================================ */}

            {canalActif ===
              'OFFICIEL' &&
              [
                'admin',
                'super_admin',
              ].includes(
                roleUtilisateur
              ) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

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
                    className="sm:col-span-2 bg-white border rounded-xl px-3 py-2 outline-none text-gray-800 focus:ring-1 focus:ring-purple-500 font-bold"
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
                    className="bg-white border rounded-xl px-3 py-2 outline-none cursor-pointer text-purple-700 font-black"
                  >

                    <option value="all">
                      🌍 Tout l'Établissement
                    </option>

                    <option value="professeur">
                      👨‍🏫 Corps enseignant
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

            {/* ============================================
                DESTINATAIRE INDIVIDUEL
            ============================================ */}

            {canalActif ===
              'DIRECT' &&
              destinataireIndividuel && (
                <div className="bg-white border border-purple-200 rounded-xl p-3">

                  <div className="flex items-center justify-between gap-3">

                    <div>

                      <div className="text-[9px] text-gray-400 uppercase font-black">
                        Message individuel vers
                      </div>

                      <div className="text-sm font-black text-purple-700 uppercase">
                        {
                          nomCompletUtilisateur(
                            destinataireIndividuel
                          )
                        }
                      </div>

                      <div className="text-[9px] text-gray-400 uppercase">
                        {
                          normaliser(
                            destinataireIndividuel.role
                          )
                        }

                        {destinataireIndividuel.promotion &&
                          ` • ${destinataireIndividuel.promotion}`}

                        {destinataireIndividuel.classeId &&
                          ` • ${destinataireIndividuel.classeId}`}
                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDestinataireIndividuel(
                          null
                        );

                        setCanalActif(
                          'DIRECT'
                        );
                      }}
                      className="text-[9px] font-black uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg"
                    >
                      Changer
                    </button>

                  </div>

                </div>
              )}

            {/* ============================================
                PIECE JOINTE
            ============================================ */}

            {canalActif ===
              'OFFICIEL' &&
              [
                'admin',
                'super_admin',
              ].includes(
                roleUtilisateur
              ) && (
                <div className="bg-white border p-2 rounded-xl text-[10px] text-gray-400 flex items-center justify-between gap-4">

                  <span>
                    📎 Attacher un document officiel (Max 2 Mo) :
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

            {/* ============================================
                MESSAGE
            ============================================ */}

            <div className="flex gap-2">

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
                      : 'Lecture seule. Droits réservés à la Direction.'
                    : canalActif ===
                      'PROMOTION'
                    ? 'Écrire un message à toute ma promotion...'
                    : canalActif ===
                      'ADMIN'
                    ? 'Exprimez votre réclamation...'
                    : destinataireIndividuel
                    ? `Écrire un message à ${nomCompletUtilisateur(
                        destinataireIndividuel
                      )}...`
                    : 'Sélectionnez d’abord un destinataire individuel...'
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
                  (
                    canalActif ===
                      'DIRECT' &&
                    !destinataireIndividuel
                  )
                }
                className="flex-1 bg-white border rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 disabled:bg-gray-100"
                required
              />

              <button
                type="submit"
                disabled={
                  sending ||
                  (
                    canalActif ===
                      'DIRECT' &&
                    !destinataireIndividuel
                  )
                }
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed  font-black px-4 py-2 rounded-xl transition"
              >
                {
                  sending
                    ? '⏳'
                    : '📨'
                }
              </button>

            </div>

          </form>

        </div>

      </div>

    </div>
  );
};

export default NotificationCentre;