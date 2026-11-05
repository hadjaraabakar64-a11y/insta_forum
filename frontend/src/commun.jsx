import { useCallback, useEffect, useRef, useState } from "react";
import { lireNotifications, marquerNotificationsLues, urlMedia } from "./api";

const COULEURS = ["#7c5cfc", "#0e9f6e", "#e5484d", "#f59e0b", "#0b5ed7", "#0891b2"];

export const couleurPour = (username = "") =>
  COULEURS[[...username].reduce((somme, c) => somme + c.charCodeAt(0), 0) % COULEURS.length];

export const nomCourt = (a) =>
  a.prenom ? `${a.prenom} ${a.nom ? `${a.nom[0]}.` : ""}`.trim() : a.username;

const formatRelatif = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
export function ilYA(date) {
  const secondes = Math.round((new Date(date) - Date.now()) / 1000);
  const unites = [["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unite, duree] of unites) {
    if (Math.abs(secondes) >= duree) return formatRelatif.format(Math.round(secondes / duree), unite);
  }
  return "à l’instant";
}

export const lienProfil = (username) => `#/membres/${encodeURIComponent(username)}`;

const DIFFICULTES = {
  debutant: { texte: "Débutant", barres: 1 },
  intermediaire: { texte: "Intermédiaire", barres: 2 },
  avance: { texte: "Avancé", barres: 3 },
};

export function Difficulte({ niveau }) {
  const d = DIFFICULTES[niveau];
  if (!d) return null;
  return (
    <span className={`difficulte is-${niveau}`} title={`Difficulté : ${d.texte}`}>
      <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={i * 5} y={8 - i * 4} width="3.5" height={4 + i * 4} rx="1"
            fill="currentColor" opacity={i < d.barres ? 1 : 0.25} />
        ))}
      </svg>
      {d.texte}
    </span>
  );
}

export const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

const initiales = (nom = "") =>
  nom.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export const Avatar = ({ name, color = "#0b5ed7", size = 36, photo = "" }) => (
  <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
    {photo ? <img src={urlMedia(photo)} alt="" /> : initiales(name)}
  </span>
);

export const BadgeAdmin = () => (
  <span className="badge-admin" aria-label="Administrateur">ADMIN</span>
);

export const BadgeEnseignant = () => (
  <span className="badge-enseignant" title="Enseignant" aria-label="Enseignant">@</span>
);

export function useAvis(duree = 4000) {
  const [avis, setAvis] = useState("");
  const minuteur = useRef(null);

  const afficherAvis = useCallback((texte) => {
    setAvis(texte);
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setAvis(""), duree);
  }, [duree]);

  useEffect(() => () => clearTimeout(minuteur.current), []);
  return [avis, afficherAvis];
}

export const Avis = ({ texte }) =>
  texte ? <div className="avis" role="alert">{texte}</div> : null;

const PROFILS = {
  etudiant: "Étudiant",
  enseignant: "Enseignant",
  personnel: "Personnel",
  administrateur: "Administrateur",
};
const GRADES_ENSEIGNANT = {
  assistant: "Assistant",
  maitre_assistant: "Maître-assistant",
  maitre_conferences: "Maître de conférences",
  professeur_titulaire: "Professeur titulaire",
};

function useMenuDeroulant() {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    const clicDehors = (e) => { if (!zone.current?.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("mousedown", clicDehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", clicDehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return [ouvert, setOuvert, zone];
}

export function MenuCompte({ user, onLogout }) {
  const [ouvert, setOuvert, zone] = useMenuDeroulant();
  const nomComplet = `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim() || user?.username || "Invité";

  return (
    <div className="compte" ref={zone}>
      <button type="button" className="home__avatar-btn" onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu" aria-expanded={ouvert} aria-label="Mon compte">
        <Avatar name={nomComplet} color={couleurPour(user?.username)} size={46} photo={user?.photo} />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: ouvert ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {ouvert && (
        <div className="compte__menu card" role="menu">
          <div className="compte__identite">
            <strong>{nomComplet}</strong>
            <span>@{user?.username}</span>
            <span>
              {PROFILS[user?.profil] ?? ""}
              {user?.profil === "enseignant" && user?.grade
                ? ` · ${GRADES_ENSEIGNANT[user.grade] ?? user.grade}`
                : ""}
              {user?.profil === "etudiant" && user?.niveau ? ` · ${user.niveau}` : ""}
            </span>
          </div>
          <a role="menuitem" className="compte__lien" href={lienProfil(user?.username)} onClick={() => setOuvert(false)}>
            Mon profil
          </a>
          <button type="button" role="menuitem" className="compte__deconnexion" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

const VERIFIER_TOUTES_LES = 30000;

const texteNotification = (n) =>
  n.type === "acceptee"
    ? <><strong>{nomCourt(n.acteur)}</strong> a accepté votre réponse à « {n.question.titre} »</>
    : n.type === "accord_reponse"
      ? <><strong>{nomCourt(n.acteur)}</strong> a voté votre réponse à « {n.question.titre} »</>
      : <><strong>{nomCourt(n.acteur)}</strong> a répondu à votre question « {n.question.titre} »</>;

export function Cloche() {
  const [ouvert, setOuvert, zone] = useMenuDeroulant();
  const [donnees, setDonnees] = useState({ non_lues: 0, notifications: [] });
  const [erreur, setErreur] = useState("");

  const charger = useCallback(() => {
    lireNotifications()
      .then((resultat) => {
        setDonnees(resultat);
        setErreur("");
      })
      .catch((err) => setErreur(err.message));
  }, []);

  useEffect(() => {
    charger();
    const minuteur = setInterval(() => { if (!document.hidden) charger(); }, VERIFIER_TOUTES_LES);
    window.addEventListener("hashchange", charger);
    window.addEventListener("focus", charger);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener("hashchange", charger);
      window.removeEventListener("focus", charger);
    };
  }, [charger]);

  const basculer = () => {
    if (!ouvert) charger();
    setOuvert(!ouvert);
  };

  const ouvrir = (n) => {
    setOuvert(false);
    if (!n.lue) marquerNotificationsLues(n.id).then(charger).catch((err) => setErreur(err.message));
    if (n.question?.id) {
      const cible = n.reponse?.id
        ? `/questions/${n.question.id}?reponse=${n.reponse.id}`
        : `/questions/${n.question.id}`;
      window.location.hash = cible;
    }
  };

  const toutLire = () => {
    marquerNotificationsLues().then(charger).catch((err) => setErreur(err.message));
  };

  const { non_lues: nonLues, notifications } = donnees;

  return (
    <div className="notifs" ref={zone}>
      <button type="button" className="home__icon-btn" onClick={basculer}
        aria-haspopup="true" aria-expanded={ouvert}
        aria-label={nonLues ? `Notifications : ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 17h12c-2-1.5-2-4-2-7a4 4 0 0 0-8 0c0 3 0 5.5-2 7zM10 20a2 2 0 0 0 4 0" />
        </svg>
        {nonLues > 0 && <span className="notifs__pastille">{nonLues > 9 ? "9+" : nonLues}</span>}
      </button>

      {ouvert && (
        <div className="notifs__menu card">
          <div className="notifs__entete">
            <strong>Notifications</strong>
            {nonLues > 0 && <button type="button" onClick={toutLire}>Tout marquer comme lu</button>}
          </div>

          {erreur ? (
            <p className="notifs__vide" role="alert">{erreur}</p>
          ) : notifications.length === 0 ? (
            <p className="notifs__vide">
              Aucune notification pour le moment. Vous serez prévenu quand quelqu’un répondra à vos questions.
            </p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`notifs__ligne${n.lue ? "" : " is-non-lue"}`} onClick={() => ouvrir(n)}>
                    <Avatar name={`${n.acteur.prenom} ${n.acteur.nom}`} color={couleurPour(n.acteur.username)} size={36} />
                    <span className="notifs__texte">
                      <span>{texteNotification(n)}</span>
                      <small>{ilYA(n.date)}</small>
                    </span>
                    {!n.lue && <i className="notifs__point" aria-label="non lue" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const NIVEAUX = [
  { texte: "Trop court", classe: "is-faible" },
  { texte: "Faible", classe: "is-faible" },
  { texte: "Moyen", classe: "is-moyen" },
  { texte: "Bon", classe: "is-bon" },
  { texte: "Excellent", classe: "is-excellent" },
];

function noterMotDePasse(mdp) {
  if (mdp.length < 8) return 0;
  let points = 1;
  if (mdp.length >= 12) points += 1;
  if (/[a-z]/.test(mdp) && /[A-Z]/.test(mdp)) points += 1;
  if (/\d/.test(mdp)) points += 0.5;
  if (/[^A-Za-z0-9]/.test(mdp)) points += 0.5;
  if (/^\d+$/.test(mdp)) points = 1;
  return Math.min(4, Math.floor(points));
}

export function Solidite({ motDePasse }) {
  if (!motDePasse) return null;
  const note = noterMotDePasse(motDePasse);
  const { texte, classe } = NIVEAUX[note];
  return (
    <div className={`solidite ${classe}`} aria-live="polite">
      <div className="solidite__barres" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => <span key={n} className={n <= Math.max(note, 1) ? "is-pleine" : ""} />)}
      </div>
      <small>Solidité : <strong>{texte}</strong>{note < 3 && " · mélangez majuscules, chiffres et symboles"}</small>
    </div>
  );
}
