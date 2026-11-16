import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/api';
import {
  useNavigate,
  useLocation,
  Link
} from 'react-router-dom';

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  getDoc
} from 'firebase/firestore';

import { useAuth } from '../context/AuthContext';
import Header from '../pages/Header';

const BoiteReceptionUnique = () => {

  const { user } = useAuth();

  // ============================================================
  // IDENTITÉ DU RÉCEPTEUR
  // ============================================================

  const currentRole = String(
    user?.role ||
    sessionStorage.getItem('sgs_user_role') ||
    ''
  ).toLowerCase().trim();

  const currentSchool = String(
    user?.schoolId ||
    sessionStorage.getItem('sgs_school_id') ||
    'lycee_saint_bernard'
  ).toLowerCase().trim();

  const myId = String(
    user?.matricule ||
    user?.id ||
    user?.uid ||
    ''
  ).trim();

  const myFirestoreId = String(
    user?.id ||
    user?.uid ||
    ''
  ).trim();

  const classeEleve = String(
    user?.classeId ||
    user?.classe ||
    ''
  ).trim();

  const promoEleve = String(
    user?.promotion ||
    ''
  ).trim();

  // ============================================================
  // NOM DU RÉCEPTEUR
  // ============================================================

  const nomCompletRecepteur = useMemo(() => {

    const prenom =
      user?.prenoms ||
      user?.prenom ||
      user?.firstName ||
      '';

    const nom =
      user?.nom ||
      user?.name ||
      user?.lastName ||
      '';

    const resultat =
      `${prenom} ${nom}`.trim();

    if (resultat) {
      return resultat;
    }

    if (user?.displayName) {
      return String(
        user.displayName
      ).trim();
    }

    return '';
  }, [user]);

  const prenomRecepteur = useMemo(() => {

    const prenom =
      user?.prenoms ||
      user?.prenom ||
      user?.firstName ||
      '';

    if (prenom) {
      return String(
        prenom
      ).trim().split(/\s+/)[0];
    }

    if (user?.displayName) {
      return String(
        user.displayName
      ).trim().split(/\s+/)[0];
    }

    const nom =
      user?.nom ||
      user?.name ||
      user?.lastName ||
      '';

    if (nom) {
      return String(
        nom
      ).trim().split(/\s+/)[0];
    }

    return '';
  }, [user]);

  // ============================================================
  // LIBELLÉ DU PROFIL
  // ============================================================

  const profilLibelle = useMemo(() => {

    switch (currentRole) {

      case 'eleve':
        return 'Élève';

      case 'parent':
      case 'parents':
        return 'Parent';

      case 'professeur':
      case 'prof':
        return 'Professeur';

      case 'prof_principal':
        return 'Professeur principal';

      case 'educateur':
        return 'Éducateur';

      case 'admin':
        return 'Administration';

      case 'super_admin':
        return 'Super-administration';

      case 'secretaire':
        return 'Secrétariat';

      case 'comptable':
        return 'Comptabilité';

      default:
        return 'Membre de l’établissement';
    }

  }, [currentRole]);

  // ============================================================
  // ÉTATS
  // ============================================================

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // ============================================================
  // CACHE DES EXPÉDITEURS
  // ============================================================

  const [profilsExpediteurs, setProfilsExpediteurs] = useState({});

  // ============================================================
  // NORMALISATION
  // ============================================================

  const normaliser = (valeur) => {

    return String(valeur || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const normaliserId = (valeur) => {

    return String(valeur || '')
      .toLowerCase()
      .trim();
  };

  const normaliserClasse = (valeur) => {

    return normaliser(valeur)
      .replace(/[\s_-]+/g, '_');
  };

  // ============================================================
  // ALIAS DE CLASSE
  // ============================================================

  const construireAliasClasse = (valeur) => {

    const base =
      normaliserClasse(valeur);

    if (!base) {
      return [];
    }

    return [
      base,
      base.replace(/_/g, ''),
      base.replace(/_/g, '-'),
      base.replace(/-/g, '_')
    ];
  };

  // ============================================================
  // CLASSES DE L'ÉLÈVE
  // ============================================================

  const classeAliasesUtilisateur =
    useMemo(() => {

      return construireAliasClasse(
        classeEleve
      );

    }, [classeEleve]);

  // ============================================================
  // TEST : MESSAGE POUR MOI
  // ============================================================

  const messageEstPourMoi = (msg) => {

    const cible =
      normaliserId(msg.cible);

    const typeMsg =
      normaliserId(msg.type);

    const roleEmetteur =
      normaliserId(
        msg.expediteurRole ||
        msg.roleEmetteur
      );

    const destinataireId =
      String(
        msg.destinataireId ||
        msg.receiverId ||
        msg.recipientId ||
        ''
      ).trim();

    const destinataireIdNormalise =
      normaliserId(
        destinataireId
      );

    const monIdNormalise =
      normaliserId(myId);

    const monFirestoreIdNormalise =
      normaliserId(myFirestoreId);

    // ========================================================
    // MESSAGE MASQUÉ
    // ========================================================

    const masques =
      Array.isArray(msg.masquePour)
        ? msg.masquePour.map(
            (id) => normaliserId(id)
          )
        : [];

    if (
      (
        monIdNormalise &&
        masques.includes(
          monIdNormalise
        )
      ) ||
      (
        monFirestoreIdNormalise &&
        masques.includes(
          monFirestoreIdNormalise
        )
      )
    ) {
      return false;
    }

    // ========================================================
    // DESTINATAIRE DIRECT
    // ========================================================

    if (destinataireIdNormalise) {

      if (
        destinataireIdNormalise ===
          monIdNormalise ||

        destinataireIdNormalise ===
          monFirestoreIdNormalise
      ) {
        return true;
      }

      return false;
    }

    // ========================================================
    // MESSAGE POUR TOUT L'ÉTABLISSEMENT
    // ========================================================

    if (
      cible === 'all' ||
      cible === 'tous' ||
      cible === 'tout' ||
      cible === 'global' ||
      cible === 'etablissement' ||
      cible === 'etablissement_tous' ||
      typeMsg === 'general'
    ) {
      return true;
    }

    // ========================================================
    // MESSAGE DESTINÉ À MON RÔLE
    // ========================================================

    if (
      cible ===
      normaliserId(currentRole)
    ) {
      return true;
    }

    // ========================================================
    // PROFESSEUR PRINCIPAL
    // ========================================================

    if (
      currentRole === 'prof_principal' &&
      (
        cible === 'professeur' ||
        cible === 'prof'
      )
    ) {
      return true;
    }

    // ========================================================
    // PARENT
    // ========================================================

    if (
      (
        currentRole === 'parent' ||
        currentRole === 'parents'
      ) &&
      (
        cible === 'parent' ||
        cible === 'parents'
      )
    ) {
      return true;
    }

    // ========================================================
    // ADMINISTRATION
    // ========================================================

    if (
      currentRole === 'admin' ||
      currentRole === 'super_admin' ||
      currentRole === 'secretaire' ||
      currentRole === 'comptable'
    ) {

      if (
        cible === 'admin' ||
        cible === 'administration' ||
        cible === 'direction'
      ) {
        return true;
      }

      if (
        roleEmetteur === 'admin' ||
        roleEmetteur === 'super_admin'
      ) {
        return true;
      }
    }

    // ========================================================
    // ÉLÈVE → CLASSE
    // ========================================================

    if (currentRole === 'eleve') {

      if (
        cible.startsWith('classe_')
      ) {

        const classeCible =
          cible.substring(
            'classe_'.length
          );

        const aliasesCible =
          construireAliasClasse(
            classeCible
          );

        const correspond =
          aliasesCible.some(
            (alias) =>
              classeAliasesUtilisateur.includes(
                alias
              )
          );

        if (correspond) {
          return true;
        }
      }

      // ======================================================
      // ÉLÈVE → PROMOTION
      // ======================================================

      if (
        cible.startsWith('promotion_')
      ) {

        const promotionCible =
          normaliser(
            cible.substring(
              'promotion_'.length
            )
          );

        if (
          promotionCible &&
          normaliser(
            promoEleve
          ) === promotionCible
        ) {
          return true;
        }
      }
    }

    // ========================================================
    // PARENT → CLASSE / PROMOTION
    // ========================================================

    if (
      currentRole === 'parent' ||
      currentRole === 'parents'
    ) {

      const classeParent =
        user?.classeId ||
        user?.classe ||
        user?.classeEnfant ||
        '';

      const promotionParent =
        user?.promotion ||
        user?.promotionEnfant ||
        '';

      if (
        cible.startsWith('classe_')
      ) {

        const classeCible =
          cible.substring(
            'classe_'.length
          );

        const aliasesParent =
          construireAliasClasse(
            classeParent
          );

        const aliasesCible =
          construireAliasClasse(
            classeCible
          );

        if (
          aliasesParent.some(
            (alias) =>
              aliasesCible.includes(alias)
          )
        ) {
          return true;
        }
      }

      if (
        cible.startsWith('promotion_')
      ) {

        const promotionCible =
          normaliser(
            cible.substring(
              'promotion_'.length
            )
          );

        if (
          promotionParent &&
          normaliser(
            promotionParent
          ) === promotionCible
        ) {
          return true;
        }
      }
    }

    return false;
  };

  // ============================================================
  // SYNCHRONISATION TEMPS RÉEL
  // ============================================================

  useEffect(() => {

    if (!currentSchool) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const qNotifications =
      query(
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
        qNotifications,
        (snapshot) => {

          const liste = [];

          snapshot.forEach(
            (docSnap) => {

              liste.push({
                id: docSnap.id,
                ...docSnap.data()
              });

            }
          );

          const mesMessages =
            liste.filter(
              (msg) =>
                messageEstPourMoi(msg)
            );

          // ====================================================
          // TRI
          // ====================================================

          mesMessages.sort(
            (a, b) => {

              const convertirDate =
                (valeur) => {

                  if (!valeur) {
                    return 0;
                  }

                  if (
                    typeof valeur ===
                      'object' &&
                    typeof valeur.toDate ===
                      'function'
                  ) {
                    return valeur
                      .toDate()
                      .getTime();
                  }

                  const date =
                    new Date(valeur);

                  return Number.isNaN(
                    date.getTime()
                  )
                    ? 0
                    : date.getTime();
                };

              return (
                convertirDate(
                  b.createdAt
                ) -
                convertirDate(
                  a.createdAt
                )
              );
            }
          );

          setMessages(
            mesMessages
          );

          setLoading(false);
        },
        (err) => {

          console.error(
            'Erreur de synchronisation des notifications :',
            err
          );

          setMessages([]);

          setLoading(false);
        }
      );

    return () =>
      unsubscribe();

  }, [
    currentSchool,
    currentRole,
    myId,
    myFirestoreId,
    classeEleve,
    promoEleve,
    classeAliasesUtilisateur,
    user
  ]);

  // ============================================================
  // RÉCUPÉRATION DES INFORMATIONS DE L'ÉMETTEUR
  // ============================================================

  useEffect(() => {

    let annule = false;

    const chargerProfilsExpediteurs = async () => {

      if (!messages.length) {
        return;
      }

      const idsACharger = [
        ...new Set(
          messages
            .map((msg) => {

              return String(
                msg?.expediteurId ||
                msg?.senderId ||
                msg?.userId ||
                msg?.expediteur?.id ||
                ''
              ).trim();

            })
            .filter(Boolean)
        )
      ];

      if (!idsACharger.length) {
        return;
      }

      const resultats = {};

      await Promise.all(
        idsACharger.map(
          async (id) => {

            try {

              const reference =
                doc(
                  db,
                  'users',
                  id
                );

              const resultat =
                await getDoc(
                  reference
                );

              if (
                resultat.exists()
              ) {

                resultats[id] =
                  {
                    id: resultat.id,
                    ...resultat.data()
                  };

              }

            } catch (error) {

              console.warn(
                `Impossible de récupérer le profil de l'expéditeur ${id}:`,
                error
              );

            }

          }
        )
      );

      if (!annule) {

        setProfilsExpediteurs(
          (precedent) => ({
            ...precedent,
            ...resultats
          })
        );

      }
    };

    chargerProfilsExpediteurs();

    return () => {
      annule = true;
    };

  }, [messages]);

  // ============================================================
  // OBTENIR LE PROFIL DE L'ÉMETTEUR
  // ============================================================

  const obtenirProfilExpediteur = (msg) => {

    const expediteurId =
      String(
        msg?.expediteurId ||
        msg?.senderId ||
        msg?.userId ||
        msg?.expediteur?.id ||
        ''
      ).trim();

    return (
      profilsExpediteurs[expediteurId] ||
      msg?.expediteur ||
      {}
    );
  };

  // ============================================================
  // NOM DE L'ÉMETTEUR
  // ============================================================

  const obtenirNomExpediteur = (msg) => {

    const profil =
      obtenirProfilExpediteur(msg);

    const nomNotification =
      String(
        msg?.expediteurNom ||
        ''
      ).trim();

    if (
      nomNotification
    ) {
      return nomNotification;
    }

    const prenom =
      profil?.prenoms ||
      profil?.prenom ||
      profil?.firstName ||
      '';

    const nom =
      profil?.nom ||
      profil?.name ||
      profil?.lastName ||
      '';

    const resultat =
      `${prenom} ${nom}`.trim();

    if (resultat) {
      return resultat;
    }

    if (profil?.displayName) {

      return String(
        profil.displayName
      ).trim();

    }

    return 'Direction de l’établissement';
  };

  // ============================================================
  // RÔLE DE L'ÉMETTEUR
  // ============================================================

  const obtenirRoleExpediteur = (msg) => {

    const profil =
      obtenirProfilExpediteur(msg);

    return (
      msg?.expediteurRole ||
      msg?.roleEmetteur ||
      profil?.role ||
      ''
    );
  };

  // ============================================================
  // CLASSE DE L'ÉMETTEUR
  // ============================================================

  const obtenirClasseExpediteur = (msg) => {

    const profil =
      obtenirProfilExpediteur(msg);

    const classe =
      msg?.expediteurClasse ||
      msg?.classeExpediteur ||
      msg?.expediteur?.classe ||
      msg?.expediteur?.classeNom ||
      msg?.expediteur?.classeId ||

      profil?.classeNom ||
      profil?.nomClasse ||
      profil?.classeName ||
      profil?.classe ||
      profil?.classeId ||
      profil?.classePrincipale ||
      profil?.classePrincipaleId ||

      '';

    return String(
      classe
    ).trim();
  };

  // ============================================================
  // ID CLASSE DE L'ÉMETTEUR
  // ============================================================

  const obtenirClasseIdExpediteur = (msg) => {

    const profil =
      obtenirProfilExpediteur(msg);

    const classeId =
      msg?.expediteurClasseId ||
      msg?.classeExpediteurId ||
      msg?.expediteur?.classeId ||

      profil?.classeId ||
      profil?.classePrincipaleId ||
      profil?.idClasse ||

      '';

    return String(
      classeId
    ).trim();
  };

  // ============================================================
  // PROMOTION DE L'ÉMETTEUR
  // ============================================================

  const obtenirPromotionExpediteur = (msg) => {

    const profil =
      obtenirProfilExpediteur(msg);

    const promotion =
      msg?.expediteurPromotion ||
      msg?.promotionExpediteur ||
      msg?.expediteur?.promotion ||
      msg?.expediteur?.promotionNom ||
      msg?.expediteur?.promotionId ||

      profil?.promotion ||
      profil?.promotionNom ||
      profil?.promotionId ||
      profil?.assignedPromotion ||
      profil?.assigned_promotion ||

      '';

    return String(
      promotion
    ).trim();
  };

  // ============================================================
  // ID PROMOTION DE L'ÉMETTEUR
  // ============================================================

  const obtenirPromotionIdExpediteur = (msg) => {

    const profil =
      obtenirProfilExpediteur(msg);

    const promotionId =
      msg?.expediteurPromotionId ||
      msg?.promotionExpediteurId ||
      msg?.expediteur?.promotionId ||

      profil?.promotionId ||
      profil?.assignedPromotion ||
      profil?.assigned_promotion ||

      '';

    return String(
      promotionId
    ).trim();
  };

  // ============================================================
  // INFORMATIONS COMPLÈTES DE L'ÉMETTEUR
  // ============================================================

  const obtenirInformationsExpediteur = (msg) => {

    const role =
      afficherRoleEmetteur(
        obtenirRoleExpediteur(msg)
      );

    const classe =
      obtenirClasseExpediteur(msg);

    const classeId =
      obtenirClasseIdExpediteur(msg);

    const promotion =
      obtenirPromotionExpediteur(msg);

    const promotionId =
      obtenirPromotionIdExpediteur(msg);

    return {
      role,
      classe,
      classeId,
      promotion,
      promotionId
    };
  };

  // ============================================================
  // MASQUER UN MESSAGE
  // ============================================================

  const handleMasquerMessage =
    async (msgId) => {

      if (!msgId) {
        return;
      }

      const confirmation =
        window.confirm(
          '🗑️ Supprimer ce message de votre boîte de réception ?'
        );

      if (!confirmation) {
        return;
      }

      try {

        const msgRef =
          doc(
            db,
            'notifications',
            msgId
          );

        const identifiants = [];

        if (myId) {
          identifiants.push(
            myId
          );
        }

        if (
          myFirestoreId &&
          myFirestoreId !== myId
        ) {
          identifiants.push(
            myFirestoreId
          );
        }

        if (
          identifiants.length === 0
        ) {
          return;
        }

        await updateDoc(
          msgRef,
          {
            masquePour:
              arrayUnion(
                ...identifiants
              )
          }
        );

      } catch (err) {

        console.error(
          'Erreur de suppression du message :',
          err
        );
      }
    };

  // ============================================================
  // MARQUER COMME LU
  // ============================================================

  const handleMarquerCommeLu =
    async (msg) => {

      if (
        !msg?.id ||
        msg?.lu === true
      ) {
        return;
      }

      try {

        const msgRef =
          doc(
            db,
            'notifications',
            msg.id
          );

        const identifiantsLecture = [];

        if (myId) {
          identifiantsLecture.push(
            myId
          );
        }

        if (
          myFirestoreId &&
          myFirestoreId !== myId
        ) {
          identifiantsLecture.push(
            myFirestoreId
          );
        }

        await updateDoc(
          msgRef,
          {
            lu: true,
            luPar: arrayUnion(
              ...identifiantsLecture
            )
          }
        );

      } catch (err) {

        console.warn(
          'Impossible de marquer le message comme lu :',
          err
        );
      }
    };

  // ============================================================
  // RÔLE ÉMETTEUR
  // ============================================================

  const afficherRoleEmetteur =
    (role) => {

      const roleNormalise =
        normaliserId(role);

      switch (roleNormalise) {

        case 'admin':
          return 'Administration';

        case 'super_admin':
          return 'Super-administration';

        case 'professeur':
        case 'prof':
          return 'Professeur';

        case 'prof_principal':
          return 'Professeur principal';

        case 'educateur':
          return 'Éducateur';

        case 'eleve':
          return 'Élève';

        case 'parent':
        case 'parents':
          return 'Parent';

        case 'secretaire':
          return 'Secrétariat';

        case 'comptable':
          return 'Comptabilité';

        default:
          return role ||
            'Établissement';
      }
    };

  // ============================================================
  // DATE
  // ============================================================

  const formaterDate =
    (createdAt) => {

      if (!createdAt) {
        return 'En direct';
      }

      let date;

      if (
        typeof createdAt ===
          'object' &&
        typeof createdAt.toDate ===
          'function'
      ) {

        date =
          createdAt.toDate();

      } else {

        date =
          new Date(createdAt);
      }

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return 'En direct';
      }

      return date.toLocaleString(
        'fr-FR',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
    };

  // ============================================================
  // LIEN DE CONNEXION
  // ============================================================

  const obtenirLienConnexion =
    (msg) => {

      const lien =
        String(
          msg?.lienConnexion ||
          '/login'
        ).trim();

      if (
        lien.startsWith('http://') ||
        lien.startsWith('https://')
      ) {
        return lien;
      }

      return lien.startsWith('/')
        ? lien
        : `/${lien}`;
    };

  // ============================================================
  // TEXTE D'ACCUEIL
  // ============================================================

  const texteAccueil =
    prenomRecepteur
      ? `Bonjour ${prenomRecepteur}`
      : 'Votre messagerie';

  // ============================================================
  // AFFICHAGE CHARGEMENT
  // ============================================================

  if (loading) {

    return (
      <div className="text-center py-6 text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">
        Ouverture de votre messagerie...
      </div>
    );
  }

  // ============================================================
  // AFFICHAGE
  // ============================================================

  return (
    <div className="bg-white border border-slate-800 rounded-2xl  shadow-xl font-sans text-xs text-slate-300">
      {/* ========================================================
          EN-TÊTE
      ======================================================== */}

      <div className="border-b border-slate-800 pb-3 mb-4">

        <div className="flex items-center justify-between gap-3">

          <div>

            <h3 className="text-sm font-black uppercase">
              📥 {texteAccueil}
            </h3>

            <p className="text-[10px] text-slate-500 font-semibold mt-1">
              Messagerie — {profilLibelle}
            </p>

          </div>

          <span className="bg-slate-950 px-2.5 py-1 rounded-lg text-[10px] text-orange-400 font-mono font-bold border border-slate-800">
            {messages.length}
          </span>

        </div>

        {nomCompletRecepteur && (
          <p className="text-[10px] text-slate-500 mt-2">
            Messages qui vous sont personnellement destinés ou communiqués à votre espace.
          </p>
        )}

      </div>

      {/* ========================================================
          AUCUN MESSAGE
      ======================================================== */}

      {messages.length === 0 ? (

        <div className="text-center py-8 text-slate-500 font-bold uppercase bg-slate-950 rounded-xl border border-slate-800/40">

          <div className="text-2xl mb-2">
            📭
          </div>

          <div>
            Aucun message reçu
          </div>

          {prenomRecepteur && (
            <div className="text-[9px] text-slate-600 mt-1 normal-case">
              Votre boîte est actuellement vide, {prenomRecepteur}.
            </div>
          )}

        </div>

      ) : (

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 scrollbar-none">

          {messages.map((msg) => {

            const roleEmetteurNet =
              normaliserId(
                msg.expediteurRole ||
                msg.roleEmetteur ||
                msg?.expediteur?.role
              );

            const estAdmin =
              roleEmetteurNet === 'admin' ||
              roleEmetteurNet === 'super_admin';

            const destinataireDirect =
              Boolean(
                msg.destinataireId ||
                msg.receiverId ||
                msg.recipientId
              );

            const titreMessage =
              msg.titre ||
              (
                estAdmin
                  ? '📣 Communiqué de la Direction'
                  : '💬 Nouveau message'
              );

            const lienConnexion =
              obtenirLienConnexion(
                msg
              );

            // ==================================================
            // INFORMATIONS ÉMETTEUR
            // ==================================================

            const nomExpediteur =
              obtenirNomExpediteur(
                msg
              );

            const informationsExpediteur =
              obtenirInformationsExpediteur(
                msg
              );

            const roleExpediteur =
              informationsExpediteur.role;

            const classeExpediteur =
              informationsExpediteur.classe;

            const classeIdExpediteur =
              informationsExpediteur.classeId;

            const promotionExpediteur =
              informationsExpediteur.promotion;

            const promotionIdExpediteur =
              informationsExpediteur.promotionId;

            // ==================================================
            // CLASSE À AFFICHER
            // ==================================================

            const classeFinale =
              classeExpediteur ||
              classeIdExpediteur ||
              '';

            // ==================================================
            // PROMOTION À AFFICHER
            // ==================================================

            const promotionFinale =
              promotionExpediteur ||
              promotionIdExpediteur ||
              '';

            return (
              <div
                key={msg.id}
                onClick={() =>
                  handleMarquerCommeLu(msg)
                }
                className={`
                  border rounded-xl p-4 transition relative group cursor-pointer
                  ${
                    estAdmin
                      ? 'bg-orange-950/20 border-orange-900/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }
                  ${
                    msg.lu === false
                      ? 'ring-1 ring-orange-500/20'
                      : ''
                  }
                `}
              >

                {/* ==================================================
                    SUPPRESSION
                ================================================== */}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();

                    handleMasquerMessage(
                      msg.id
                    );
                  }}
                  className="absolute top-3.5 right-3.5 bg-slate-900/80 hover:bg-red-600 border border-slate-800 text-slate-500 hover:text-white font-bold px-2 py-1 rounded-md text-[9px] uppercase transition cursor-pointer"
                  title="Supprimer le message de ma boîte"
                >
                  🗑️ Supprimer
                </button>

                {/* ==================================================
                    NON LU
                ================================================== */}

                {msg.lu === false && (
                  <span className="absolute top-3.5 right-28 text-[8px] bg-orange-500 text-slate-950 px-1.5 py-0.5 rounded-full font-black uppercase">
                    Nouveau
                  </span>
                )}

                {/* ==================================================
                    ÉMETTEUR
                ================================================== */}

                <div className="flex justify-between items-start gap-2 mb-3 pr-32">

                  <div className="w-full">

                    {/* ==============================================
                        NOM + RÔLE
                    ============================================== */}

                    <div className="flex flex-wrap items-center gap-2">

                      <span className="font-bold uppercase text-slate-100">
                        {nomExpediteur}
                      </span>

                      <span
                        className={`
                          font-black px-1.5 py-0.5 rounded text-[8px] uppercase border
                          ${
                            estAdmin
                              ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }
                        `}
                      >
                        {roleExpediteur}
                      </span>

                    </div>

                    {/* ==============================================
                        INFORMATIONS SCOLAIRES DE L'ÉMETTEUR
                    ============================================== */}

                    {(classeFinale ||
                      promotionFinale ||
                      roleEmetteurNet === 'eleve') && (

                      <div className="mt-2 flex flex-wrap gap-2">

                        {/* CLASSE */}

                        {classeFinale ? (

                          <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-1 rounded-md text-[9px] font-bold">

                            🏫 Classe :
                            <strong className="text-blue-200">
                              {classeFinale}
                            </strong>

                          </span>

                        ) : (

                          roleEmetteurNet === 'eleve' && (

                            <span className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-500 px-2 py-1 rounded-md text-[9px] font-bold">

                              🏫 Classe :
                              <strong>
                                Non renseignée
                              </strong>

                            </span>

                          )

                        )}

                        {/* PROMOTION */}

                        {promotionFinale ? (

                          <span className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-1 rounded-md text-[9px] font-bold">

                            🎓 Promotion :
                            <strong className="text-purple-200">
                              {promotionFinale}
                            </strong>

                          </span>

                        ) : (

                          roleEmetteurNet === 'eleve' && (

                            <span className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-500 px-2 py-1 rounded-md text-[9px] font-bold">

                              🎓 Promotion :
                              <strong>
                                Non renseignée
                              </strong>

                            </span>

                          )

                        )}

                      </div>

                    )}

                    {/* ==============================================
                        MESSAGE PERSONNEL
                    ============================================== */}

                    {destinataireDirect && (

                      <span className="inline-block mt-2 text-[8px] text-emerald-400 font-bold uppercase">

                        🔒 Message personnel

                      </span>

                    )}

                  </div>

                </div>

                {/* ==================================================
                    DATE
                ================================================== */}

                <span className="text-[9px] text-slate-500 font-mono block mb-1.5">

                  {formaterDate(
                    msg.createdAt
                  )}

                </span>

                {/* ==================================================
                    TITRE
                ================================================== */}

                <h4 className="text-[12px] font-black text-orange-400 mb-2">

                  {titreMessage}

                </h4>

                {/* ==================================================
                    DESTINATAIRE
                ================================================== */}

                {nomCompletRecepteur && (

                  <div className="text-[9px] text-slate-600 mb-2 font-semibold">

                    À : {nomCompletRecepteur}

                  </div>

                )}

                {/* ==================================================
                    CONTENU
                ================================================== */}

                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/60">

                  {prenomRecepteur && (

                    <div className="text-[10px] text-slate-300 font-bold mb-2">

                      Bonjour {prenomRecepteur},

                    </div>

                  )}

                  <p className="text-slate-400 leading-relaxed font-medium whitespace-pre-wrap">

                    {msg.message}

                  </p>

                </div>

                {/* ==================================================
                    BOUTON ESPACE
                ================================================== */}

                <div className="mt-3 pt-3 border-t border-slate-800/70">

                  <a
                    href={lienConnexion}
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                    className="inline-flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-slate-950 font-black py-2.5 px-4 rounded-xl uppercase tracking-wide transition"
                  >
                    🔐 Accéder à mon espace Edulink
                  </a>

                  <p className="text-[8px] text-slate-600 text-center mt-1.5">

                    Connexion sécurisée puis redirection vers votre espace.

                  </p>

                </div>

              </div>
            );
          })}

        </div>

      )}

    </div>
  );
};

export default BoiteReceptionUnique;