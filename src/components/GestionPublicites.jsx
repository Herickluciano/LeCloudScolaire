import React, { useEffect, useState, Link } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../services/api";
import { useAuth } from "../context/AuthContext";

const formInitial = {
  titre: "",
  description: "",
  lienUrl: "",
  imageUrl: "",
  dateDebut: "",
  dateFin: "",
  actif: true,
  ordre: 0,
};

const GestionPublicites = () => {
  const { user } = useAuth();

  const [publicites, setPublicites] = useState([]);
  const [form, setForm] = useState(formInitial);
  const [publiciteEnCours, setPubliciteEnCours] = useState(null);

  const [chargement, setChargement] = useState(false);
  const [chargementListe, setChargementListe] = useState(true);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  const schoolId =
    user?.schoolId ||
    sessionStorage.getItem("sgs_school_id") ||
    null;

  /*
   * =========================================================
   * CHARGEMENT TEMPS REEL
   * =========================================================
   */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "publicites"),
      (snapshot) => {
        const liste = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .sort((a, b) => {
            const ordreA = Number(a.ordre || 0);
            const ordreB = Number(b.ordre || 0);

            return ordreA - ordreB;
          });

        setPublicites(liste);
        setChargementListe(false);
      },
      (error) => {
        console.error(
          "Erreur chargement publicités :",
          error
        );

        setErreur(
          "Impossible de charger les publicités."
        );

        setChargementListe(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * =========================================================
   * FORMULAIRE
   * =========================================================
   */

  const modifierChamp = (nom, valeur) => {
    setForm((ancien) => ({
      ...ancien,
      [nom]: valeur,
    }));

    setErreur("");
    setMessage("");
  };

  /*
   * =========================================================
   * RESET
   * =========================================================
   */

  const resetForm = () => {
    setForm(formInitial);
    setPubliciteEnCours(null);
    setErreur("");
    setMessage("");
  };

  /*
   * =========================================================
   * EDITION
   * =========================================================
   */

  const modifierPublicite = (pub) => {
    setPubliciteEnCours(pub);

    setForm({
      titre: pub.titre || "",
      description: pub.description || "",
      lienUrl: pub.lienUrl || "",
      imageUrl: pub.imageUrl || "",
      dateDebut: convertirTimestampEnInput(
        pub.dateDebut
      ),
      dateFin: convertirTimestampEnInput(
        pub.dateFin
      ),
      actif: pub.actif !== false,
      ordre: Number(pub.ordre || 0),
    });

    setErreur("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /*
   * =========================================================
   * ENREGISTREMENT
   * =========================================================
   */

  const enregistrerPublicite = async (e) => {
    e.preventDefault();

    setErreur("");
    setMessage("");

    if (!form.titre.trim()) {
      setErreur("Le titre est obligatoire.");
      return;
    }

    if (!form.dateDebut || !form.dateFin) {
      setErreur(
        "Les dates de début et de fin sont obligatoires."
      );
      return;
    }

    const debut = new Date(
      `${form.dateDebut}T00:00:00`
    );

    const fin = new Date(
      `${form.dateFin}T23:59:59`
    );

    if (Number.isNaN(debut.getTime())) {
      setErreur("La date de début est invalide.");
      return;
    }

    if (Number.isNaN(fin.getTime())) {
      setErreur("La date de fin est invalide.");
      return;
    }

    if (fin <= debut) {
      setErreur(
        "La date de fin doit être après la date de début."
      );
      return;
    }

    /*
     * Vérification URL image
     */
    if (form.imageUrl.trim()) {
      try {
        new URL(form.imageUrl.trim());
      } catch {
        setErreur(
          "L'URL de l'image n'est pas valide."
        );
        return;
      }
    }

    /*
     * Vérification lien externe
     */
    if (form.lienUrl.trim()) {
      try {
        new URL(form.lienUrl.trim());
      } catch {
        setErreur(
          "Le lien externe n'est pas valide."
        );
        return;
      }
    }

    setChargement(true);

    try {
      const donnees = {
        titre: form.titre.trim(),
        description: form.description.trim(),
        lienUrl: form.lienUrl.trim(),
        imageUrl: form.imageUrl.trim(),
        dateDebut: debut,
        dateFin: fin,
        actif: Boolean(form.actif),
        ordre: Number(form.ordre || 0),
        schoolId: schoolId || null,
        updatedAt: serverTimestamp(),
      };

      /*
       * =====================================================
       * MODIFICATION
       * =====================================================
       */

      if (publiciteEnCours) {
        await updateDoc(
          doc(
            db,
            "publicites",
            publiciteEnCours.id
          ),
          donnees
        );

        setMessage(
          "Publicité modifiée avec succès."
        );
      }

      /*
       * =====================================================
       * CREATION
       * =====================================================
       */

      else {
        await addDoc(
          collection(db, "publicites"),
          {
            ...donnees,
            createdAt: serverTimestamp(),
          }
        );

        setMessage(
          "Publicité créée avec succès."
        );
      }

      resetForm();
    } catch (error) {
      console.error(
        "Erreur publicité :",
        error
      );

      setErreur(
        "Impossible d’enregistrer la publicité."
      );
    } finally {
      setChargement(false);
    }
  };

  /*
   * =========================================================
   * ACTIVATION / DESACTIVATION
   * =========================================================
   */

  const changerEtat = async (pub) => {
    setErreur("");
    setMessage("");

    try {
      await updateDoc(
        doc(db, "publicites", pub.id),
        {
          actif: !pub.actif,
          updatedAt: serverTimestamp(),
        }
      );

      setMessage(
        pub.actif
          ? "Publicité désactivée."
          : "Publicité activée."
      );
    } catch (error) {
      console.error(
        "Erreur changement état :",
        error
      );

      setErreur(
        "Impossible de modifier l’état de la publicité."
      );
    }
  };

  /*
   * =========================================================
   * SUPPRESSION
   * =========================================================
   */

  const supprimerPublicite = async (pub) => {
    const confirmation = window.confirm(
      `Supprimer la publicité "${pub.titre}" ?`
    );

    if (!confirmation) {
      return;
    }

    setErreur("");
    setMessage("");

    try {
      await deleteDoc(
        doc(db, "publicites", pub.id)
      );

      if (
        publiciteEnCours?.id === pub.id
      ) {
        resetForm();
      }

      setMessage(
        "Publicité supprimée."
      );
    } catch (error) {
      console.error(
        "Erreur suppression :",
        error
      );

      setErreur(
        "Impossible de supprimer la publicité."
      );
    }
  };

  /*
   * =========================================================
   * APERCU URL IMAGE
   * =========================================================
   */

  const imageValide =
    form.imageUrl.trim() !== "";

  /*
   * =========================================================
   * RENDU
   * =========================================================
   */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em]">
            Administration
          </p>

          <h1 className="text-3xl md:text-4xl font-black text-white mt-2">
            Gestion des publicités
          </h1>

          <p className="text-sm text-slate-400 mt-2">
            Programme les publicités affichées sur
            l’écran de veille.
          </p>
        </div>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {message && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-bold">
            {message}
          </div>
        )}

        {erreur && (
          <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-bold">
            {erreur}
          </div>
        )}

        {/* =================================================
            FORMULAIRE
        ================================================= */}

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl mb-8">

          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black">
                {publiciteEnCours
                  ? "Modifier la publicité"
                  : "Nouvelle publicité"}
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Les dates déterminent automatiquement
                la période de diffusion.
              </p>
            </div>

            {publiciteEnCours && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase"
              >
                Annuler
              </button>
            )}
          </div>

          <form
            onSubmit={enregistrerPublicite}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >

            {/* TITRE */}

            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                Titre
              </label>

              <input
                value={form.titre}
                onChange={(e) =>
                  modifierChamp(
                    "titre",
                    e.target.value
                  )
                }
                placeholder="Ex : Promotion rentrée scolaire"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* DESCRIPTION */}

            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                Description
              </label>

              <textarea
                value={form.description}
                onChange={(e) =>
                  modifierChamp(
                    "description",
                    e.target.value
                  )
                }
                rows={4}
                placeholder="Description de la publicité..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
            </div>

            {/* URL IMAGE */}

            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                URL de l'image
              </label>

              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) =>
                  modifierChamp(
                    "imageUrl",
                    e.target.value
                  )
                }
                placeholder="https://exemple.com/image.jpg"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
              />

              <p className="text-[10px] text-slate-400 mt-2">
                Colle ici l'adresse directe de ton
                image. Aucun stockage Firebase Storage
                n'est utilisé.
              </p>
            </div>

            {/* APERCU */}

            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                Aperçu
              </label>

              <div className="h-48 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">

                {imageValide ? (
                  <img
                    src={form.imageUrl}
                    alt="Aperçu de la publicité"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display =
                        "none";
                    }}
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-bold">
                    Aucune image
                  </span>
                )}

              </div>
            </div>

            {/* DATE DEBUT */}

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                Date de début
              </label>

              <input
                type="date"
                value={form.dateDebut}
                onChange={(e) =>
                  modifierChamp(
                    "dateDebut",
                    e.target.value
                  )
                }
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            {/* DATE FIN */}

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                Date de fin
              </label>

              <input
                type="date"
                value={form.dateFin}
                onChange={(e) =>
                  modifierChamp(
                    "dateFin",
                    e.target.value
                  )
                }
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            {/* LIEN */}

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                Lien externe
              </label>

              <input
                type="url"
                value={form.lienUrl}
                onChange={(e) =>
                  modifierChamp(
                    "lienUrl",
                    e.target.value
                  )
                }
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            {/* ORDRE */}

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-2">
                Ordre d'affichage
              </label>

              <input
                type="number"
                value={form.ordre}
                onChange={(e) =>
                  modifierChamp(
                    "ordre",
                    e.target.value
                  )
                }
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            {/* ACTIF */}

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">

                <input
                  type="checkbox"
                  checked={form.actif}
                  onChange={(e) =>
                    modifierChamp(
                      "actif",
                      e.target.checked
                    )
                  }
                  className="w-5 h-5"
                />

                <span className="text-sm font-black">
                  Publicité active
                </span>

              </label>
            </div>

            {/* BOUTON */}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={chargement}
                className="w-full md:w-auto px-8 py-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-black uppercase disabled:opacity-50"
              >
                {chargement
                  ? "Enregistrement..."
                  : publiciteEnCours
                  ? "Enregistrer les modifications"
                  : "Créer la publicité"}
              </button>
            </div>

          </form>
        </div>

        {/* =================================================
            LISTE
        ================================================= */}

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl">

          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black">
                Publicités programmées
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                {publicites.length} publicité(s)
              </p>
            </div>
          </div>

          {chargementListe ? (
            <div className="py-12 text-center text-xs font-black uppercase text-slate-400">
              Chargement...
            </div>
          ) : publicites.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl">
              <p className="text-sm font-black text-slate-600">
                Aucune publicité
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Crée ta première publicité ci-dessus.
              </p>
            </div>
          ) : (
            <div className="space-y-4">

              {publicites.map((pub) => {
                const debut =
                  convertirTimestampEnInput(
                    pub.dateDebut
                  );

                const fin =
                  convertirTimestampEnInput(
                    pub.dateFin
                  );

                const aujourdHui = new Date();

                const dateDebut =
                  convertirDate(pub.dateDebut);

                const dateFin =
                  convertirDate(pub.dateFin);

                const enCours =
                  pub.actif &&
                  aujourdHui >= dateDebut &&
                  aujourdHui <= dateFin;

                return (
                  <div
                    key={pub.id}
                    className="border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row gap-5"
                  >

                    {/* IMAGE */}

                    <div className="w-full lg:w-48 h-32 rounded-xl overflow-hidden bg-slate-100 shrink-0">

                      {pub.imageUrl ? (
                        <img
                          src={pub.imageUrl}
                          alt={pub.titre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                          Sans image
                        </div>
                      )}

                    </div>

                    {/* INFORMATIONS */}

                    <div className="flex-1">

                      <div className="flex flex-wrap gap-2 items-center">

                        <h3 className="font-black text-lg">
                          {pub.titre}
                        </h3>

                        {enCours && (
                          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">
                            En diffusion
                          </span>
                        )}

                        {!pub.actif && (
                          <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-[9px] font-black uppercase">
                            Désactivée
                          </span>
                        )}

                        {pub.actif &&
                          !enCours && (
                            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase">
                              Hors période
                            </span>
                          )}

                      </div>

                      {pub.description && (
                        <p className="text-sm text-slate-500 mt-2">
                          {pub.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 mt-4 text-[10px] font-black uppercase text-slate-400">

                        <span>
                          Début : {debut}
                        </span>

                        <span>
                          Fin : {fin}
                        </span>

                        <span>
                          Ordre : {pub.ordre || 0}
                        </span>

                      </div>

                      {/* ACTIONS */}

                      <div className="flex flex-wrap gap-2 mt-5">

                        <button
                          type="button"
                          onClick={() =>
                            modifierPublicite(pub)
                          }
                          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black uppercase"
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            changerEtat(pub)
                          }
                          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${
                            pub.actif
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {pub.actif
                            ? "Désactiver"
                            : "Activer"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            supprimerPublicite(pub)
                          }
                          className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-[10px] font-black uppercase"
                        >
                          Supprimer
                        </button>

                      </div>
                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

/*
 * =========================================================
 * UTILITAIRES DATES
 * =========================================================
 */

const convertirDate = (valeur) => {
  if (!valeur) {
    return new Date(0);
  }

  if (valeur?.toDate) {
    return valeur.toDate();
  }

  return new Date(valeur);
};

const convertirTimestampEnInput = (valeur) => {
  if (!valeur) {
    return "";
  }

  const date = convertirDate(valeur);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const annee = date.getFullYear();

  const mois = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const jour = String(
    date.getDate()
  ).padStart(2, "0");

  return `${annee}-${mois}-${jour}`;
};

export default GestionPublicites;