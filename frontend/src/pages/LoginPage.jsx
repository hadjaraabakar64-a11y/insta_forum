import { useState } from "react";
import "./LoginPage.css";

const Icon = ({ children, size = 22, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" stroke="none" />
  </Icon>
);
const LockIcon = () => (
  <Icon>
    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    <rect x="4" y="11" width="16" height="10" rx="3" fill="currentColor" stroke="none" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </Icon>
);
const EyeOffIcon = () => (
  <Icon>
    <path d="M2 12s3.6-7 10-7c2 0 3.8.7 5.3 1.6M22 12s-3.6 7-10 7c-2 0-3.8-.7-5.3-1.6" />
    <path d="M3 3l18 18" />
  </Icon>
);
const LoginIcon = () => (
  <Icon>
    <path d="M10 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
    <path d="M3 12h11M10 8l4 4-4 4" />
  </Icon>
);
const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.5" fill="currentColor" stroke="none" />
    <path d="M2 20c0-3.8 3.1-6 7-6s7 2.2 7 6z" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="9" r="2.8" fill="currentColor" stroke="none" />
    <path d="M17 14.2c3 .2 5 2 5 5.8h-4.5" fill="currentColor" stroke="none" />
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

export default function LoginPage({ message, onLogin, onSignup, onForgotPassword }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password) {
      setError("Veuillez renseigner votre identifiant et votre mot de passe.");
      return;
    }

    try {
      setLoading(true);
      await onLogin?.({ identifier: identifier.trim(), password });
    } catch (err) {
      setError(err?.message || "Identifiants incorrects. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <section className="login__brand">
        <div className="login__brand-top">
          <GradCap />
          <h1 className="login__title">
            INSTA-<span>FORUM</span>
          </h1>
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
          <p className="login__slogan">
            Ensemble pour
            <br />
            un meilleur apprentissage !
          </p>
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <h2>Se connecter</h2>
          <p className="login__lead">
            Accédez à votre compte pour profiter
            <br />
            de toutes les fonctionnalités du forum.
          </p>

          <label className="field">
            <span className="field__icon"><UserIcon /></span>
            <input
              type="text"
              name="identifier"
              placeholder="Nom d’utilisateur ou email"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              aria-label="Nom d’utilisateur ou email"
            />
          </label>

          <label className="field">
            <span className="field__icon"><LockIcon /></span>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Mot de passe"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Mot de passe"
            />
            <button
              type="button"
              className="field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </label>

          <div className="login__options">
            <button type="button" className="link" onClick={onForgotPassword}>
              Mot de passe oublié ?
            </button>
          </div>

          {message && !error && (
            <p className="login__succes" role="status">
              {message}
            </p>
          )}

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn--primary" disabled={loading}>
            <LoginIcon />
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <div className="login__or"><span>OU</span></div>

          <button type="button" className="btn btn--outline" onClick={onSignup}>
            <UsersIcon />
            Créer un compte
          </button>

          <p className="login__note">
            Uniquement pour les étudiants, enseignants
            <br />
            et le personnel de l’INSTA (département de génie informatique).
          </p>
        </form>
      </section>
    </main>
  );
}
