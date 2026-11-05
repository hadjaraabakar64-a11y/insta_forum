import { useEffect, useState } from "react";
import "./LoginPage.css";
import "./SignupPage.css";
import { demanderReinitialisation, reinitialiserMotDePasse, verifierLien } from "../api";

const Icon = ({ children, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const MailIcon = () => (
  <Icon><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 8l8 6 8-6" /></Icon>
);
const LockIcon = () => (
  <Icon>
    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    <rect x="4" y="11" width="16" height="10" rx="3" fill="currentColor" stroke="none" />
  </Icon>
);
const GradCap = () => (
  <svg width="120" height="76" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#fff" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#fff" />
    <path d="M150 38v34" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <rect x="145" y="70" width="10" height="18" rx="3" fill="#fff" />
  </svg>
);

const PanneauMarque = () => (
  <section className="login__brand">
    <div className="login__brand-top">
      <GradCap />
      <h1 className="login__title">INSTA-<span>FORUM</span></h1>
      <p className="login__subtitle">
        Le forum de résolution de problèmes
        <br />
        informatiques de l’INSTA
      </p>
      <hr className="login__divider" />
      <ul className="login__keywords">
        <li>Posez vos questions</li>
        <li>Partagez vos connaissances</li>
        <li>Progressez ensemble</li>
      </ul>
    </div>
    <div className="login__photo" role="img" aria-label="Bâtiment de l’INSTA">
      <p className="login__slogan">Ensemble pour<br />un meilleur apprentissage !</p>
    </div>
  </section>
);

function Demande({ onRetour }) {
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErreur("Indiquez l’adresse email de votre compte.");
      return;
    }
    try {
      setEnvoi(true);
      const { detail } = await demanderReinitialisation(email.trim());
      setMessage(detail);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form className="login__form" onSubmit={handleSubmit} noValidate>
      <h2>Mot de passe oublié</h2>
      <p className="login__lead">
        Indiquez l’adresse email de votre compte :
        <br />
        nous vous enverrons un lien pour en choisir un nouveau.
      </p>

      {message ? (
        <p className="login__succes" role="status">{message}</p>
      ) : (
        <>
          <label className="field">
            <span className="field__icon"><MailIcon /></span>
            <input type="email" name="email" placeholder="Adresse email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Adresse email" autoFocus />
          </label>

          {erreur && <p className="login__error" role="alert">{erreur}</p>}

          <button type="submit" className="btn btn--primary" disabled={envoi}>
            <MailIcon />
            {envoi ? "Envoi…" : "Envoyer le lien"}
          </button>
        </>
      )}

      <p className="signup__switch">
        <button type="button" className="link" onClick={onRetour}>← Retour à la connexion</button>
      </p>
    </form>
  );
}

function NouveauMotDePasse({ uid, token, onTermine, onNouvelleDemande }) {
  const [compte, setCompte] = useState(null);
  const [erreurLien, setErreurLien] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    verifierLien(uid, token)
      .then(({ email }) => setCompte(email))
      .catch((err) => {
        setCompte(false);
        setErreurLien(err.message);
      });
  }, [uid, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur("");
    if (motDePasse.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    try {
      setEnvoi(true);
      const { detail } = await reinitialiserMotDePasse(uid, token, motDePasse);
      onTermine(detail);
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  };

  return (
    <form className="login__form" onSubmit={handleSubmit} noValidate>
      <h2>Nouveau mot de passe</h2>

      {compte === null && <p className="login__lead">Vérification du lien…</p>}

      {compte === false && (
        <>
          <p className="login__error" role="alert">{erreurLien}</p>
          <button type="button" className="btn btn--primary" onClick={onNouvelleDemande}>
            Refaire une demande
          </button>
        </>
      )}

      {compte && (
        <>
          <p className="login__lead">
            Choisissez un nouveau mot de passe pour
            <br />
            <strong>{compte}</strong>
          </p>

          <label className="field">
            <span className="field__icon"><LockIcon /></span>
            <input type="password" placeholder="Nouveau mot de passe" autoComplete="new-password"
              value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
              aria-label="Nouveau mot de passe" autoFocus />
          </label>
          <label className="field">
            <span className="field__icon"><LockIcon /></span>
            <input type="password" placeholder="Confirmer le mot de passe" autoComplete="new-password"
              value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
              aria-label="Confirmer le mot de passe" />
          </label>

          {erreur && <p className="login__error" role="alert">{erreur}</p>}

          <button type="submit" className="btn btn--primary" disabled={envoi}>
            <LockIcon />
            {envoi ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </button>
        </>
      )}
    </form>
  );
}

export default function MotDePassePage({ uid, token, onRetour, onTermine, onNouvelleDemande }) {
  return (
    <main className="login">
      <PanneauMarque />
      <section className="login__panel">
        {uid && token ? (
          <NouveauMotDePasse uid={uid} token={token} onTermine={onTermine} onNouvelleDemande={onNouvelleDemande} />
        ) : (
          <Demande onRetour={onRetour} />
        )}
      </section>
    </main>
  );
}
