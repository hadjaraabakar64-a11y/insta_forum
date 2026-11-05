import { useEffect, useRef, useState } from "react";
import "./HomePage.css";
import "./QuestionPage.css";
import "./SignupPage.css";
import "./ProfilPage.css";
import {
  changerMotDePasse, lireMembre, modifierMonGrade, modifierMonNiveau, modifierMonNomAdministrateur,
  televerserPhotoProfil,
} from "../api";
import { sansMiseEnForme } from "../TexteFormate";
import { Avatar, Cloche, MenuCompte, couleurPour, ilYA, pluriel } from "../commun";

const GradCap = () => (
  <svg width="44" height="28" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#1766f0" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#1766f0" />
    <path d="M150 38v30" stroke="#1766f0" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const PROFILS = {
  etudiant: "Étudiant",
  enseignant: "Enseignant",
  personnel: "Personnel",
  administrateur: "Administrateur",
};
const NIVEAUX = { L1: "Licence 1", L2: "Licence 2", L3: "Licence 3", M1: "Master 1", M2: "Master 2" };
const GRADES_ENSEIGNANT = {
  assistant: "Assistant",
  maitre_assistant: "Maître-assistant",
  maitre_conferences: "Maître de conférences",
  professeur_titulaire: "Professeur titulaire",
};

const moisAnnee = (date) => new Date(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

function PhotoProfil({ photoExistante, onUserUpdate }) {
  const [photo, setPhoto] = useState(null);
  const [etatPhoto, setEtatPhoto] = useState({ envoi: false, message: "", erreur: "" });
  const inputPhoto = useRef(null);

  const enregistrerPhoto = async (e) => {
    e.preventDefault();
    const formulaire = e.currentTarget;
    if (!photo) {
      setEtatPhoto({ envoi: false, message: "", erreur: "Choisissez une photo à envoyer." });
      return;
    }
    setEtatPhoto({ envoi: true, message: "", erreur: "" });
    try {
      const misAJour = await televerserPhotoProfil(photo);
      onUserUpdate(misAJour);
      setPhoto(null);
      formulaire.reset();
      setEtatPhoto({ envoi: false, message: "Votre photo de profil a été mise à jour.", erreur: "" });
    } catch (err) {
      setEtatPhoto({ envoi: false, message: "", erreur: err.message });
    }
  };

  return (
    <form className="profil__photo-action" onSubmit={enregistrerPhoto} noValidate>
      <input
        ref={inputPhoto}
        className="profil__photo-input"
        type="file"
        accept="image/*"
        aria-label="Choisir une photo de profil"
        onChange={(e) => {
          setPhoto(e.target.files?.[0] ?? null);
          setEtatPhoto({ envoi: false, message: "", erreur: "" });
        }}
      />
      <button
        type="button"
        className="profil__photo-bouton"
        onClick={() => inputPhoto.current?.click()}
        disabled={etatPhoto.envoi}
      >
        {photoExistante ? "Modifier la photo" : "Choisir une photo"}
      </button>
      {photo && (
        <>
          <span className="profil__photo-nom">{photo.name}</span>
          <button type="submit" className="profil__photo-enregistrer" disabled={etatPhoto.envoi}>
            {etatPhoto.envoi ? "Envoi…" : "Enregistrer"}
          </button>
        </>
      )}
      {etatPhoto.erreur && <p className="detail__erreur" role="alert">{etatPhoto.erreur}</p>}
      {etatPhoto.message && <p className="profil__succes" role="status">{etatPhoto.message}</p>}
    </form>
  );
}

function ParametresProfil({ membre, onUserUpdate }) {
  const [niveau, setNiveau] = useState(membre.niveau || "");
  const [etatNiveau, setEtatNiveau] = useState({ envoi: false, message: "", erreur: "" });
  const [grade, setGrade] = useState(membre.grade || "");
  const [etatGrade, setEtatGrade] = useState({ envoi: false, message: "", erreur: "" });
  const [nomAdmin, setNomAdmin] = useState({ prenom: membre.prenom, nom: membre.nom });
  const [etatNomAdmin, setEtatNomAdmin] = useState({ envoi: false, message: "", erreur: "" });
  const [motsDePasse, setMotsDePasse] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [etatMotDePasse, setEtatMotDePasse] = useState({ envoi: false, message: "", erreur: "" });

  const enregistrerNomAdmin = async (e) => {
    e.preventDefault();
    if (!nomAdmin.prenom.trim() || !nomAdmin.nom.trim()) {
      setEtatNomAdmin({ envoi: false, message: "", erreur: "Le prénom et le nom sont obligatoires." });
      return;
    }
    setEtatNomAdmin({ envoi: true, message: "", erreur: "" });
    try {
      const misAJour = await modifierMonNomAdministrateur({
        prenom: nomAdmin.prenom.trim(),
        nom: nomAdmin.nom.trim(),
      });
      onUserUpdate(misAJour);
      setEtatNomAdmin({ envoi: false, message: "Votre nom a été mis à jour.", erreur: "" });
    } catch (err) {
      setEtatNomAdmin({ envoi: false, message: "", erreur: err.message });
    }
  };

  const enregistrerNiveau = async (e) => {
    e.preventDefault();
    if (!niveau) {
      setEtatNiveau({ envoi: false, message: "", erreur: "Choisissez votre niveau." });
      return;
    }
    setEtatNiveau({ envoi: true, message: "", erreur: "" });
    try {
      const misAJour = await modifierMonNiveau(niveau);
      onUserUpdate(misAJour);
      setEtatNiveau({ envoi: false, message: "Votre niveau a été mis à jour.", erreur: "" });
    } catch (err) {
      setEtatNiveau({ envoi: false, message: "", erreur: err.message });
    }
  };

  const enregistrerGrade = async (e) => {
    e.preventDefault();
    if (!grade) {
      setEtatGrade({ envoi: false, message: "", erreur: "Choisissez votre grade." });
      return;
    }
    setEtatGrade({ envoi: true, message: "", erreur: "" });
    try {
      const misAJour = await modifierMonGrade(grade);
      onUserUpdate(misAJour);
      setEtatGrade({ envoi: false, message: "Votre grade a été mis à jour.", erreur: "" });
    } catch (err) {
      setEtatGrade({ envoi: false, message: "", erreur: err.message });
    }
  };

  const enregistrerMotDePasse = async (e) => {
    e.preventDefault();
    if (!motsDePasse.ancien || !motsDePasse.nouveau || !motsDePasse.confirmation) {
      setEtatMotDePasse({ envoi: false, message: "", erreur: "Remplissez les trois champs du mot de passe." });
      return;
    }
    if (motsDePasse.nouveau !== motsDePasse.confirmation) {
      setEtatMotDePasse({ envoi: false, message: "", erreur: "Les nouveaux mots de passe ne correspondent pas." });
      return;
    }
    setEtatMotDePasse({ envoi: true, message: "", erreur: "" });
    try {
      const detail = await changerMotDePasse(motsDePasse.ancien, motsDePasse.nouveau);
      setMotsDePasse({ ancien: "", nouveau: "", confirmation: "" });
      setEtatMotDePasse({ envoi: false, message: detail, erreur: "" });
    } catch (err) {
      setEtatMotDePasse({ envoi: false, message: "", erreur: err.message });
    }
  };

  return (
    <>
      {membre.is_staff && (
        <form className="card profil__formulaire" onSubmit={enregistrerNomAdmin} noValidate>
          <h2>Modifier mon nom</h2>
          <label className="profil__champ">
            Prénom
            <input value={nomAdmin.prenom} onChange={(e) => {
              setNomAdmin((n) => ({ ...n, prenom: e.target.value }));
              setEtatNomAdmin({ envoi: false, message: "", erreur: "" });
            }} autoComplete="given-name" />
          </label>
          <label className="profil__champ">
            Nom
            <input value={nomAdmin.nom} onChange={(e) => {
              setNomAdmin((n) => ({ ...n, nom: e.target.value }));
              setEtatNomAdmin({ envoi: false, message: "", erreur: "" });
            }} autoComplete="family-name" />
          </label>
          {etatNomAdmin.erreur && <p className="detail__erreur" role="alert">{etatNomAdmin.erreur}</p>}
          {etatNomAdmin.message && <p className="profil__succes" role="status">{etatNomAdmin.message}</p>}
          <button type="submit" className="home__ask" disabled={etatNomAdmin.envoi}>
            {etatNomAdmin.envoi ? "Enregistrement…" : "Enregistrer le nom"}
          </button>
        </form>
      )}
      {!membre.is_staff && membre.profil === "enseignant" && (
        <form className="card profil__formulaire" onSubmit={enregistrerGrade} noValidate>
          <h2>Modifier mon grade</h2>
          <label className="profil__champ">
            Grade
            <select value={grade} onChange={(e) => {
              setGrade(e.target.value);
              setEtatGrade({ envoi: false, message: "", erreur: "" });
            }}>
              <option value="" disabled>Choisir un grade</option>
              {Object.entries(GRADES_ENSEIGNANT).map(([valeur, texte]) => (
                <option key={valeur} value={valeur}>{texte}</option>
              ))}
            </select>
          </label>
          {etatGrade.erreur && <p className="detail__erreur" role="alert">{etatGrade.erreur}</p>}
          {etatGrade.message && <p className="profil__succes" role="status">{etatGrade.message}</p>}
          <button type="submit" className="home__ask" disabled={etatGrade.envoi}>
            {etatGrade.envoi ? "Enregistrement…" : "Enregistrer le grade"}
          </button>
        </form>
      )}
      {!membre.is_staff && membre.profil !== "enseignant" && (
        <form className="card profil__formulaire" onSubmit={enregistrerNiveau} noValidate>
          <h2>Modifier mon niveau</h2>
          <label className="profil__champ">
            Niveau d’étude
            <select value={niveau} onChange={(e) => {
              setNiveau(e.target.value);
              setEtatNiveau({ envoi: false, message: "", erreur: "" });
            }}>
              <option value="" disabled>Choisir un niveau</option>
              {Object.entries(NIVEAUX).map(([valeur, texte]) => (
                <option key={valeur} value={valeur}>{texte}</option>
              ))}
            </select>
          </label>
          {etatNiveau.erreur && <p className="detail__erreur" role="alert">{etatNiveau.erreur}</p>}
          {etatNiveau.message && <p className="profil__succes" role="status">{etatNiveau.message}</p>}
          <button type="submit" className="home__ask" disabled={etatNiveau.envoi}>
            {etatNiveau.envoi ? "Enregistrement…" : "Enregistrer le niveau"}
          </button>
        </form>
      )}

      <form className="card profil__formulaire" onSubmit={enregistrerMotDePasse} noValidate>
        <h2>Changer mon mot de passe</h2>
        <label className="profil__champ">
          Mot de passe actuel
          <input type="password" autoComplete="current-password" value={motsDePasse.ancien}
            onChange={(e) => setMotsDePasse((m) => ({ ...m, ancien: e.target.value }))} />
        </label>
        <label className="profil__champ">
          Nouveau mot de passe
          <input type="password" autoComplete="new-password" value={motsDePasse.nouveau}
            onChange={(e) => setMotsDePasse((m) => ({ ...m, nouveau: e.target.value }))} />
        </label>
        <label className="profil__champ">
          Confirmer le nouveau mot de passe
          <input type="password" autoComplete="new-password" value={motsDePasse.confirmation}
            onChange={(e) => setMotsDePasse((m) => ({ ...m, confirmation: e.target.value }))} />
        </label>
        {etatMotDePasse.erreur && <p className="detail__erreur" role="alert">{etatMotDePasse.erreur}</p>}
        {etatMotDePasse.message && <p className="profil__succes" role="status">{etatMotDePasse.message}</p>}
        <button type="submit" className="home__ask" disabled={etatMotDePasse.envoi}>
          {etatMotDePasse.envoi ? "Modification…" : "Changer le mot de passe"}
        </button>
      </form>
    </>
  );
}

export default function ProfilPage({ username, user, onUserUpdate, onBack, onLogout }) {
  const [membre, setMembre] = useState(null);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("questions");
  const estMoi = user?.username === username;

  useEffect(() => {
    setMembre(null);
    setErreur("");
    setOnglet("questions");
    lireMembre(username)
      .then((m) => {
        setMembre(m);
        if (m.questions.length === 0 && m.reponses.length > 0) setOnglet("reponses");
      })
      .catch((err) => setErreur(err.statut === 404 ? "Ce membre n’existe pas." : err.message));
  }, [username]);

  const mettreAJour = (misAJour) => {
    onUserUpdate(misAJour);
    setMembre((m) => ({
      ...m,
      prenom: misAJour.prenom,
      nom: misAJour.nom,
      profil: misAJour.profil,
      niveau: misAJour.niveau,
      grade: misAJour.grade,
      photo: misAJour.photo,
    }));
  };

  const nomComplet = membre ? `${membre.prenom} ${membre.nom}`.trim() || membre.username : "";
  const stats = membre?.stats;

  return (
    <div className="home">
      <header className="home__nav">
        <a className="home__logo" href="#/">
          <GradCap />
          <span>INSTA-<b>FORUM</b></span>
        </a>
        <div className="home__actions">
          <Cloche />
          <MenuCompte user={user} onLogout={onLogout} />
        </div>
      </header>

      <main className="profil">
        <button type="button" className="detail__retour" onClick={onBack}>← Retour</button>

        {erreur && (
          <div className="card home__empty" role="alert">
            {erreur}
          </div>
        )}
        {!membre && !erreur && <div className="card home__empty">Chargement du profil…</div>}

        {membre && (
          <>
            <section className="card profil__entete">
              <div className="profil__avatar-zone">
                <Avatar name={nomComplet} color={couleurPour(membre.username)} size={88} photo={membre.photo} />
                {estMoi && (
                  <PhotoProfil photoExistante={Boolean(membre.photo)} onUserUpdate={mettreAJour} />
                )}
              </div>
              <div className="profil__identite">
                <h1>{nomComplet}{estMoi && <span className="profil__vous">vous</span>}</h1>
                <p className="profil__pseudo">@{membre.username}</p>
                <div className="profil__badges">
                  <div className="profil__type">
                    <span className="profil__badge">
                      {PROFILS[membre.profil] ?? "Membre"}
                      {membre.profil === "enseignant" && membre.grade
                        ? ` · ${GRADES_ENSEIGNANT[membre.grade] ?? membre.grade}`
                        : ""}
                    </span>
                    {!membre.is_staff && membre.profil === "etudiant" && (
                      <span className="profil__niveau">
                        Niveau : {membre.niveau ? (NIVEAUX[membre.niveau] ?? membre.niveau) : "Non renseigné"}
                      </span>
                    )}
                  </div>
                  {!estMoi && <span className="profil__depuis">Membre depuis {moisAnnee(membre.date_inscription)}</span>}
                </div>
              </div>
            </section>

            {estMoi ? (
              <>
                <section className="card profil__infos">
                  <h2>Mes informations</h2>
                  <dl>
                    <div><dt>Prénom</dt><dd>{membre.prenom}</dd></div>
                    <div><dt>Nom</dt><dd>{membre.nom}</dd></div>
                    <div><dt>Nom d’utilisateur</dt><dd>@{membre.username}</dd></div>
                    <div><dt>Email</dt><dd>{membre.email}</dd></div>
                    <div><dt>Profil</dt><dd>{PROFILS[membre.profil] ?? "Membre"}</dd></div>
                    {membre.profil === "enseignant" && (
                      <div><dt>Grade</dt><dd>{GRADES_ENSEIGNANT[membre.grade] ?? "Non renseigné"}</dd></div>
                    )}
                    {membre.matricule && <div><dt>Matricule étudiant</dt><dd>{membre.matricule}</dd></div>}
                  </dl>
                  <p className="profil__aide">
                    {membre.is_staff
                      ? "Seuls votre mot de passe et votre photo de profil peuvent être modifiés."
                      : membre.profil === "enseignant"
                        ? "Seuls votre grade, votre mot de passe et votre photo de profil peuvent être modifiés."
                        : "Seuls votre niveau d’étude, votre mot de passe et votre photo de profil peuvent être modifiés."}
                  </p>
                </section>
                <ParametresProfil membre={membre} onUserUpdate={mettreAJour} />
              </>
            ) : (
              <>
                <ul className="profil__stats">
                  <li><strong>{stats.questions}</strong>question{stats.questions > 1 ? "s" : ""}</li>
                  <li><strong>{stats.reponses}</strong>réponse{stats.reponses > 1 ? "s" : ""}</li>
                  <li className="is-vert"><strong>{stats.acceptees}</strong>acceptée{stats.acceptees > 1 ? "s" : ""}</li>
                  <li><strong>{stats.votes_recus}</strong>vote{Math.abs(stats.votes_recus) > 1 ? "s" : ""} reçu{Math.abs(stats.votes_recus) > 1 ? "s" : ""}</li>
                </ul>

                <div className="home__tabs" role="tablist">
                  <button role="tab" aria-selected={onglet === "questions"} className={onglet === "questions" ? "is-active" : ""}
                    onClick={() => setOnglet("questions")}>Questions ({membre.questions.length})</button>
                  <button role="tab" aria-selected={onglet === "reponses"} className={onglet === "reponses" ? "is-active" : ""}
                    onClick={() => setOnglet("reponses")}>Réponses ({membre.reponses.length})</button>
                </div>

                {onglet === "questions" && (
                  membre.questions.length === 0 ? (
                    <div className="card home__empty">{membre.prenom || membre.username} n’a pas encore posé de question.</div>
                  ) : (
                    <ul className="card profil__liste">
                      {membre.questions.map((q) => (
                        <li key={q.id}>
                          <span className="qcarte__categorie" style={{ "--couleur-categorie": q.categorie.couleur }}>{q.categorie.nom}</span>
                          <a href={`#/questions/${q.id}`} className="profil__titre">{q.titre}</a>
                          <span className="profil__meta">
                            {ilYA(q.date_creation)} · {pluriel(q.reponses, "réponse")}
                            {q.resolue && <span className="profil__resolue">✓ Résolue</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                )}

                {onglet === "reponses" && (
                  membre.reponses.length === 0 ? (
                    <div className="card home__empty">{membre.prenom || membre.username} n’a pas encore répondu à une question.</div>
                  ) : (
                    <ul className="card profil__liste">
                      {membre.reponses.map((r) => (
                        <li key={r.id}>
                          <span className="profil__contexte">
                            Réponse à <a href={`#/questions/${r.question.id}`}>{r.question.titre}</a>
                          </span>
                          <p className="profil__extrait">{sansMiseEnForme(r.extrait)}</p>
                          <span className="profil__meta">
                            {ilYA(r.date_creation)} · {pluriel(r.accords, "accord")}
                            {r.acceptee && <span className="profil__resolue">✓ Réponse acceptée</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
