const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export const urlMedia = (chemin) =>
  chemin.startsWith("http") ? chemin : `${API_URL.replace(/\/api\/?$/, "")}${chemin}`;

const CLE_JETON = "insta_jeton";

export const lireJeton = () =>
  localStorage.getItem(CLE_JETON) || sessionStorage.getItem(CLE_JETON);

const enregistrerJeton = (jeton, seSouvenir) => {
  (seSouvenir ? localStorage : sessionStorage).setItem(CLE_JETON, jeton);
};

const effacerJeton = () => {
  localStorage.removeItem(CLE_JETON);
  sessionStorage.removeItem(CLE_JETON);
};

const textes = (valeur) =>
  typeof valeur === "string" ? [valeur]
    : Array.isArray(valeur) ? valeur.flatMap(textes)
    : valeur && typeof valeur === "object" ? Object.values(valeur).flatMap(textes)
    : [];

const messageErreur = (donnees) => {
  const liste = textes(donnees);
  return liste.length ? liste.join(" ") : "Une erreur est survenue. Réessayez.";
};

async function requete(chemin, { methode = "GET", corps } = {}) {
  const enTetes = { "Content-Type": "application/json" };
  const jeton = lireJeton();
  if (jeton) enTetes.Authorization = `Token ${jeton}`;

  let reponse;
  try {
    reponse = await fetch(`${API_URL}${chemin}`, {
      method: methode,
      headers: enTetes,
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez que le backend est démarré.");
  }

  const donnees = reponse.status === 204 ? null : await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const erreur = new Error(messageErreur(donnees));
    erreur.champs = donnees && typeof donnees === "object" ? donnees : {};
    erreur.statut = reponse.status;
    throw erreur;
  }
  return donnees;
}

export const inscrire = (donnees) =>
  requete("/comptes/inscription/", { methode: "POST", corps: donnees });

export async function connecter({ identifier, password }) {
  effacerJeton();
  const { token, utilisateur } = await requete("/comptes/connexion/", {
    methode: "POST",
    corps: { identifier, password },
  });
  enregistrerJeton(token, false);
  return utilisateur;
}

export async function deconnecter() {
  try {
    await requete("/comptes/deconnexion/", { methode: "POST" });
  } finally {
    effacerJeton();
  }
}

export const listerQuestions = () => requete("/questions/");

export const publierQuestion = (donnees) =>
  requete("/questions/", { methode: "POST", corps: donnees });

export const lireQuestion = (id) => requete(`/questions/${id}/`);

export const modifierQuestion = (id, donnees) =>
  requete(`/questions/${id}/`, { methode: "PATCH", corps: donnees });

export const supprimerCapture = (id) => requete(`/captures/${id}/`, { methode: "DELETE" });

export async function televerserCaptures(questionId, fichiers) {
  if (!fichiers || fichiers.length === 0) return [];
  const form = new FormData();
  fichiers.forEach((f) => form.append("images", f));
  const jeton = lireJeton();
  const enTetes = {};
  if (jeton) enTetes.Authorization = `Token ${jeton}`;

  const reponse = await fetch(`${API_URL}/questions/${questionId}/captures/`, {
    method: "POST",
    headers: enTetes,
    body: form,
  });
  if (!reponse.ok) {
    const donnees = await reponse.json().catch(() => null);
    throw new Error(messageErreur(donnees));
  }
  return reponse.json();
}

export const supprimerQuestion = (id) => requete(`/questions/${id}/`, { methode: "DELETE" });

export const modifierReponse = (id, contenu) =>
  requete(`/reponses/${id}/`, { methode: "PATCH", corps: { contenu } });

export const supprimerReponse = (id) => requete(`/reponses/${id}/`, { methode: "DELETE" });

export const listerReponses = (idQuestion) => requete(`/questions/${idQuestion}/reponses/`);

export const publierReponse = (idQuestion, contenu) =>
  requete(`/questions/${idQuestion}/reponses/`, { methode: "POST", corps: { contenu } });

export const accepterReponse = (idReponse) =>
  requete(`/reponses/${idReponse}/accepter/`, { methode: "POST" });

export const voterReponse = (id) =>
  requete(`/reponses/${id}/voter/`, { methode: "POST" });

export const basculerFavori = (id) =>
  requete(`/questions/${id}/favori/`, { methode: "POST" });

export const lireClassement = () => requete("/classement/");

export const lireNotifications = () => requete("/notifications/");

export const marquerNotificationsLues = (id) =>
  requete("/notifications/lire/", { methode: "POST", corps: id ? { id } : {} });

export const listerCategories = () => requete("/categories/");

export const lireStatistiques = () => requete("/statistiques/");

export const lireMembre = (username) => requete(`/membres/${encodeURIComponent(username)}/`);

export const modifierMonNiveau = (niveau) =>
  requete("/comptes/moi/niveau/", { methode: "POST", corps: { niveau } });

export const modifierMonGrade = (grade) =>
  requete("/comptes/moi/grade/", { methode: "POST", corps: { grade } });

export const modifierMonNomAdministrateur = (donnees) =>
  requete("/comptes/moi/nom-administrateur/", { methode: "POST", corps: donnees });

export async function televerserPhotoProfil(fichier) {
  const form = new FormData();
  form.append("photo", fichier);
  const enTetes = {};
  const jeton = lireJeton();
  if (jeton) enTetes.Authorization = `Token ${jeton}`;

  let reponse;
  try {
    reponse = await fetch(`${API_URL}/comptes/moi/photo/`, {
      method: "POST",
      headers: enTetes,
      body: form,
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez que le backend est démarré.");
  }
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const erreur = new Error(messageErreur(donnees));
    erreur.champs = donnees && typeof donnees === "object" ? donnees : {};
    erreur.statut = reponse.status;
    throw erreur;
  }
  return donnees;
}

export const lireAdministration = () => requete("/admin/forum/");
export const supprimerUtilisateurAdmin = (id) =>
  requete(`/admin/utilisateurs/${id}/`, { methode: "DELETE" });
export const supprimerQuestionAdmin = (id) =>
  requete(`/admin/questions/${id}/`, { methode: "DELETE" });
export const supprimerReponseAdmin = (id) =>
  requete(`/admin/reponses/${id}/`, { methode: "DELETE" });
export const creerCategorieAdmin = (nom) =>
  requete("/admin/categories/", { methode: "POST", corps: { nom } });
export const modifierCategorieAdmin = (id, nom) =>
  requete(`/admin/categories/${id}/`, { methode: "PATCH", corps: { nom } });
export const supprimerCategorieAdmin = (id) =>
  requete(`/admin/categories/${id}/`, { methode: "DELETE" });
export const creerMatriculeAdmin = (numero) =>
  requete("/admin/matricules/", { methode: "POST", corps: { numero } });
export const supprimerMatriculeAdmin = (id) =>
  requete(`/admin/matricules/${id}/`, { methode: "DELETE" });
export const creerEnseignantAdmin = (donnees) =>
  requete("/admin/enseignants/", { methode: "POST", corps: donnees });

export async function changerMotDePasse(ancien, nouveau) {
  const { token, detail } = await requete("/comptes/mot-de-passe/", { methode: "POST", corps: { ancien, nouveau } });
  const seSouvenir = localStorage.getItem(CLE_JETON) !== null;
  enregistrerJeton(token, seSouvenir);
  return detail;
}

export const demanderReinitialisation = (email) =>
  requete("/comptes/mot-de-passe-oublie/", { methode: "POST", corps: { email } });

export const verifierLien = (uid, token) =>
  requete("/comptes/reinitialiser/verifier/", { methode: "POST", corps: { uid, token } });

export const reinitialiserMotDePasse = (uid, token, password) =>
  requete("/comptes/reinitialiser/", { methode: "POST", corps: { uid, token, password } });

export async function utilisateurConnecte() {
  if (!lireJeton()) return null;
  try {
    return await requete("/comptes/moi/");
  } catch {
    effacerJeton();
    return null;
  }
}
