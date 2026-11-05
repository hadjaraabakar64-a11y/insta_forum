import { useEffect, useState } from "react";
import "./HomePage.css";
import "./AdminPage.css";
import {
  creerCategorieAdmin, creerEnseignantAdmin, creerMatriculeAdmin, lireAdministration, supprimerCategorieAdmin,
  supprimerMatriculeAdmin, supprimerQuestionAdmin, supprimerReponseAdmin,
  supprimerUtilisateurAdmin, modifierCategorieAdmin,
} from "../api";
import { Avis, MenuCompte, pluriel, useAvis } from "../commun";

const SECTIONS = [
  ["utilisateurs", "Utilisateurs"],
  ["questions", "Questions"],
  ["reponses", "Réponses"],
  ["categories", "Catégories"],
  ["matricules", "Matricules"],
];

export default function AdminPage({ user, onBack, onLogout }) {
  const [donnees, setDonnees] = useState(null);
  const [section, setSection] = useState("utilisateurs");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [nomCategorie, setNomCategorie] = useState("");
  const [numeroMatricule, setNumeroMatricule] = useState("");
  const [enseignant, setEnseignant] = useState({ prenom: "", nom: "", email: "", password: "" });
  const [categorieEditee, setCategorieEditee] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [avis, afficherAvis] = useAvis();

  const charger = async () => {
    setChargement(true);
    setErreur("");
    if (!user?.is_staff && !user?.is_superuser) {
      const message = "Accès réservé à l’administration.";
      setErreur(message);
      setChargement(false);
      return message;
    }
    try {
      setDonnees(await lireAdministration());
      return "";
    } catch (err) {
      const message = err.message || "Impossible de charger les données d’administration.";
      setErreur(message);
      return message;
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const executer = async (action, message) => {
    setEnvoi(true);
    try {
      await action();
      const erreurActualisation = await charger();
      afficherAvis(erreurActualisation
        ? `Action effectuée, mais actualisation impossible : ${erreurActualisation}`
        : message);
    } catch (err) {
      afficherAvis(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimerUtilisateur = (item) => {
    if (!window.confirm(
      `Supprimer le compte de ${item.username} ? Ses questions et réponses seront également supprimées. Cette action est définitive.`
    )) return;
    executer(() => supprimerUtilisateurAdmin(item.id), "Le compte et son contenu ont été supprimés.");
  };

  const supprimerQuestion = (item) => {
    if (!window.confirm(`Supprimer la question « ${item.titre} » et ses réponses ? Cette action est définitive.`)) return;
    executer(() => supprimerQuestionAdmin(item.id), "La question et ses réponses ont été supprimées.");
  };

  const supprimerReponse = (item) => {
    if (!window.confirm(`Supprimer cette réponse à « ${item.question} » ?`)) return;
    executer(() => supprimerReponseAdmin(item.id), "La réponse a été supprimée.");
  };

  const enregistrerCategorie = async (e) => {
    e.preventDefault();
    const nom = categorieEditee?.id ? categorieEditee.nom : nomCategorie;
    if (!nom.trim()) return;
    await executer(async () => {
      if (categorieEditee?.id) await modifierCategorieAdmin(categorieEditee.id, nom.trim());
      else await creerCategorieAdmin(nom.trim());
      setCategorieEditee(null);
      setNomCategorie("");
    }, categorieEditee?.id ? "La catégorie a été modifiée." : "La catégorie a été créée.");
  };

  const supprimerCategorie = (item) => {
    if (!window.confirm(`Supprimer la catégorie « ${item.nom} » ?`)) return;
    executer(() => supprimerCategorieAdmin(item.id), "La catégorie a été supprimée.");
  };

  const ajouterMatricule = async (e) => {
    e.preventDefault();
    if (!numeroMatricule.trim()) return;
    await executer(async () => {
      await creerMatriculeAdmin(numeroMatricule.trim());
      setNumeroMatricule("");
    }, "Le matricule a été ajouté.");
  };

  const creerCompteEnseignant = async (e) => {
    e.preventDefault();
    await executer(async () => {
      await creerEnseignantAdmin(enseignant);
      setEnseignant({ prenom: "", nom: "", email: "", password: "" });
    }, "Le compte enseignant a été créé. Il peut se connecter avec son adresse e-mail et le mot de passe choisi.");
  };

  const supprimerMatricule = (item) => {
    if (!window.confirm(`Supprimer le matricule « ${item.numero} » ?`)) return;
    executer(() => supprimerMatriculeAdmin(item.id), "Le matricule a été supprimé.");
  };

  const nombre = (nom) => donnees?.[nom]?.length ?? 0;

  return (
    <div className="home admin">
      <header className="home__nav">
        <a className="home__logo" href="#/">
          <span className="admin__logo">INSTA-<b>FORUM</b></span>
        </a>
        <div className="home__actions">
          <button type="button" className="admin__retour" onClick={onBack}>Retour au forum</button>
          <MenuCompte user={user} onLogout={onLogout} />
        </div>
      </header>

      <main className="admin__main">
        <section className="admin__intro">
          <span className="admin__eyebrow">Espace sécurisé</span>
          <h1>Administration du forum</h1>
          <p>Gérez les comptes, les publications, les catégories et les matricules étudiants.</p>
        </section>

        <section className="admin__stats" aria-label="Résumé du forum">
          {SECTIONS.map(([cle, libelle]) => (
            <div className="card admin__stat" key={cle}>
              <strong>{donnees ? nombre(cle) : "—"}</strong>
              <span>{libelle}</span>
            </div>
          ))}
        </section>

        <nav className="admin__tabs" aria-label="Rubriques d’administration">
          {SECTIONS.map(([cle, libelle]) => (
            <button type="button" key={cle} className={section === cle ? "is-active" : ""}
              aria-current={section === cle ? "page" : undefined} onClick={() => setSection(cle)}>
              {libelle} <span>{donnees ? nombre(cle) : "—"}</span>
            </button>
          ))}
        </nav>

        {erreur && (
          <div className="card admin__message" role="alert">
            {erreur}
            <button type="button" onClick={charger}>Réessayer</button>
          </div>
        )}
        {chargement && <div className="card admin__message">Chargement des données…</div>}

        {!chargement && donnees && section === "utilisateurs" && (
          <section className="card admin__panel">
            <h2>Utilisateurs</h2>
            <h3>Créer un compte enseignant</h3>
            <p>L’enseignant se connectera avec son adresse e-mail et le mot de passe défini ici. Transmettez-lui ces identifiants de manière sécurisée.</p>
            <form className="admin__form" onSubmit={creerCompteEnseignant}>
              <input aria-label="Prénom de l’enseignant" autoComplete="given-name" maxLength={150}
                placeholder="Prénom" required value={enseignant.prenom}
                onChange={(e) => setEnseignant({ ...enseignant, prenom: e.target.value })} />
              <input aria-label="Nom de l’enseignant" autoComplete="family-name" maxLength={150}
                placeholder="Nom" required value={enseignant.nom}
                onChange={(e) => setEnseignant({ ...enseignant, nom: e.target.value })} />
              <input aria-label="Adresse e-mail de l’enseignant" type="email" autoComplete="email" maxLength={254}
                placeholder="Adresse e-mail" required value={enseignant.email}
                onChange={(e) => setEnseignant({ ...enseignant, email: e.target.value })} />
              <input aria-label="Mot de passe de l’enseignant" type="password" autoComplete="new-password" minLength={8}
                placeholder="Mot de passe" required value={enseignant.password}
                onChange={(e) => setEnseignant({ ...enseignant, password: e.target.value })} />
              <button type="submit" className="admin__primary" disabled={envoi}>Créer le compte enseignant</button>
            </form>
            {donnees.utilisateurs.length === 0 ? <p>Aucun utilisateur.</p> : (
              <div className="admin__liste">
                {donnees.utilisateurs.map((item) => (
                  <article className="admin__ligne" key={item.id}>
                    <div className="admin__texte">
                      <strong>{[item.prenom, item.nom].filter(Boolean).join(" ") || item.username}</strong>
                      <span>@{item.username} · {item.email || "Sans adresse e-mail"}</span>
                    </div>
                    <div className="admin__actions">
                      <span className={`admin__badge${item.actif ? " is-actif" : ""}`}>
                        {item.is_staff ? "Administrateur Django" : item.profil === "enseignant"
                          ? `Enseignant · ${item.actif ? "Actif" : "Désactivé"}`
                          : item.actif ? "Actif" : "Désactivé"}
                      </span>
                      {!item.is_staff && (
                        <button type="button" className="admin__danger" disabled={envoi}
                          onClick={() => supprimerUtilisateur(item)}>Supprimer</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!chargement && donnees && section === "questions" && (
          <section className="card admin__panel">
            <h2>Questions</h2>
            {donnees.questions.length === 0 ? <p>Aucune question.</p> : (
              <div className="admin__liste">
                {donnees.questions.map((item) => (
                  <article className="admin__ligne" key={item.id}>
                    <div className="admin__texte">
                      <strong>{item.titre}</strong>
                      <span>Par {item.auteur} · {item.categorie} · {pluriel(item.reponses, "réponse")}</span>
                    </div>
                    <button type="button" className="admin__danger" disabled={envoi}
                      onClick={() => supprimerQuestion(item)}>Supprimer</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!chargement && donnees && section === "reponses" && (
          <section className="card admin__panel">
            <h2>Réponses</h2>
            {donnees.reponses.length === 0 ? <p>Aucune réponse.</p> : (
              <div className="admin__liste">
                {donnees.reponses.map((item) => (
                  <article className="admin__ligne" key={item.id}>
                    <div className="admin__texte">
                      <strong>{item.auteur} · {item.question}</strong>
                      <span>{item.contenu}</span>
                      {item.acceptee && <span className="admin__badge is-actif">Réponse acceptée</span>}
                    </div>
                    <button type="button" className="admin__danger" disabled={envoi}
                      onClick={() => supprimerReponse(item)}>Supprimer</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!chargement && donnees && section === "categories" && (
          <section className="card admin__panel">
            <h2>Catégories</h2>
            <form className="admin__form" onSubmit={enregistrerCategorie}>
              <input aria-label="Nom de catégorie" maxLength={100}
                placeholder="Nom de la catégorie"
                value={categorieEditee?.id ? categorieEditee.nom : nomCategorie}
                onChange={(e) => categorieEditee?.id
                  ? setCategorieEditee({ ...categorieEditee, nom: e.target.value })
                  : setNomCategorie(e.target.value)} />
              <button type="submit" className="admin__primary" disabled={envoi}>
                {categorieEditee?.id ? "Enregistrer" : "Ajouter"}
              </button>
              {categorieEditee?.id && (
                <button type="button" onClick={() => setCategorieEditee(null)}>Annuler</button>
              )}
            </form>
            <div className="admin__liste">
              {donnees.categories.map((item) => (
                <article className="admin__ligne" key={item.id}>
                  <div className="admin__texte">
                    <strong>{item.nom}</strong>
                    <span>{pluriel(item.questions, "question")}</span>
                  </div>
                  <div className="admin__actions">
                    <button type="button" disabled={envoi}
                      onClick={() => { setCategorieEditee(item); setNomCategorie(""); }}>Modifier</button>
                    <button type="button" className="admin__danger" disabled={envoi || item.questions > 0}
                      title={item.questions > 0 ? "Cette catégorie contient des questions" : "Supprimer"}
                      onClick={() => supprimerCategorie(item)}>Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!chargement && donnees && section === "matricules" && (
          <section className="card admin__panel">
            <h2>Matricules étudiants</h2>
            <form className="admin__form" onSubmit={ajouterMatricule}>
              <input aria-label="Nouveau matricule" maxLength={50}
                placeholder="Numéro de matricule"
                value={numeroMatricule} onChange={(e) => setNumeroMatricule(e.target.value)} />
              <button type="submit" className="admin__primary" disabled={envoi}>Ajouter</button>
            </form>
            {donnees.matricules.length === 0 ? <p>Aucun matricule.</p> : (
              <div className="admin__liste">
                {donnees.matricules.map((item) => (
                  <article className="admin__ligne" key={item.id}>
                    <div className="admin__texte">
                      <strong>{item.numero}</strong>
                      <span>{item.utilisateur ? `Attribué à @${item.utilisateur}` : "Disponible"}</span>
                    </div>
                    <button type="button" className="admin__danger"
                      disabled={envoi || Boolean(item.utilisateur)}
                      title={item.utilisateur ? "Ce matricule est déjà attribué" : "Supprimer"}
                      onClick={() => supprimerMatricule(item)}>Supprimer</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <Avis texte={avis} />
    </div>
  );
}
