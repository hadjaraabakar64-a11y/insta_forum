import { useEffect, useMemo, useRef, useState } from "react";
import "./HomePage.css";
import {
  accepterReponse, basculerFavori, lireClassement, lireStatistiques, listerCategories, listerQuestions,
  listerReponses, urlMedia, voterReponse,
} from "../api";
import {
  Avatar, Avis, BadgeAdmin, BadgeEnseignant, Cloche, Difficulte, MenuCompte, couleurPour, ilYA, lienProfil, nomCourt, pluriel, useAvis,
} from "../commun";
import TexteFormate, { sansMiseEnForme } from "../TexteFormate";

const Icon = ({ children, size = 20, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);
const I = {
  search: <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Icon>,
  home: <Icon><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></Icon>,
  question: <Icon><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></Icon>,
  folder: <Icon><path d="M3 6a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></Icon>,
  user: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></Icon>,
  star: <Icon><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
  etoilePleine: <Icon fill="currentColor"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
  trophy: <Icon><path d="M7 4h10v6a5 5 0 0 1-10 0zM12 15v4M8 20h8" /></Icon>,
  plus: <Icon><path d="M12 5v14M5 12h14" /></Icon>,
  eye: <Icon size={16}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>,
};

const ICONES_MENU = {
  "Accueil": [
    <Icon key="c" size={24}><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></Icon>,
    <Icon key="p" size={24} stroke="none" fill="currentColor"><path d="M11.3 2.4a1 1 0 0 1 1.4 0l8.9 8a1 1 0 0 1 .4.7V20a2 2 0 0 1-2 2h-4.5v-6.5h-5V22H4a2 2 0 0 1-2-2v-8.9a1 1 0 0 1 .4-.7z" /></Icon>,
  ],
  "Questions": [
    <Icon key="c" size={24}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></Icon>,
    <Icon key="p" size={24}><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" stroke="#fff" /></Icon>,
  ],
  "Catégories": [
    <Icon key="c" size={24}><path d="M3 6a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M3 10h18" /></Icon>,
    <Icon key="p" size={24} stroke="none" fill="currentColor"><path d="M2 6a2 2 0 0 1 2-2h5.5l2 3H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" /></Icon>,
  ],
  "Mes questions": [
    <Icon key="c" size={24}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></Icon>,
    <Icon key="p" size={24} stroke="none" fill="currentColor"><circle cx="12" cy="7.5" r="4.5" /><path d="M3 21c0-4.6 4-8 9-8s9 3.4 9 8z" /></Icon>,
  ],
  "Favoris": [
    <Icon key="c" size={24}><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
    <Icon key="p" size={24} fill="currentColor"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
  ],
  "Classement": [
    <Icon key="c" size={24}><path d="M7 4h10v6a5 5 0 0 1-10 0zM12 15v4M8 20h8" /></Icon>,
    <Icon key="p" size={24}><path d="M7 4h10v6a5 5 0 0 1-10 0z" fill="currentColor" /><path d="M12 15v4M8 20h8" /></Icon>,
  ],
  "Administration": [
    <Icon key="c" size={24}><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.6 2.8-.2-.1a1.7 1.7 0 0 0-1.8.4l-.1.1h-3.2l-.1-.2a1.7 1.7 0 0 0-1.6-1.1 1.7 1.7 0 0 0-1.6 1.1l-.1.2H6.3l-.1-.1a1.7 1.7 0 0 0-1.8-.4l-.2.1-1.6-2.8.1-.1A1.7 1.7 0 0 0 3 15l-.1-.2v-3.2L3 11.5a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.6-2.8.2.1a1.7 1.7 0 0 0 1.8-.4l.1-.1h3.2l.1.2a1.7 1.7 0 0 0 1.6 1.1 1.7 1.7 0 0 0 1.6-1.1l.1-.2h3.2l.1.1a1.7 1.7 0 0 0 1.8.4l.2-.1 1.6 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9l.1.2v3.2z" /></Icon>,
    <Icon key="p" size={24}><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.6 2.8-.2-.1a1.7 1.7 0 0 0-1.8.4l-.1.1h-3.2l-.1-.2a1.7 1.7 0 0 0-1.6-1.1 1.7 1.7 0 0 0-1.6 1.1l-.1.2H6.3l-.1-.1a1.7 1.7 0 0 0-1.8-.4l-.2.1-1.6-2.8.1-.1A1.7 1.7 0 0 0 3 15l-.1-.2v-3.2L3 11.5a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.6-2.8.2.1a1.7 1.7 0 0 0 1.8-.4l.1-.1h3.2l.1.2a1.7 1.7 0 0 0 1.6 1.1 1.7 1.7 0 0 0 1.6-1.1l.1-.2h3.2l.1.1a1.7 1.7 0 0 0 1.8.4l.2-.1 1.6 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9l.1.2v3.2z" fill="currentColor" /></Icon>,
  ],
};

const IconeQuestions = () => (
  <Icon size={26} stroke="none" fill="currentColor"><circle cx="12" cy="7.5" r="4.5" /><path d="M3.5 21c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z" /></Icon>
);
const IconeReponses = () => (
  <Icon size={26} stroke="none" fill="currentColor">
    <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M7 8h10M7 12h6" stroke="#c9eedb" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);
const IconeMembres = ({ size = 26 }) => (
  <Icon size={size} stroke="none" fill="currentColor">
    <circle cx="9" cy="7.5" r="3.8" /><path d="M1.5 20c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8z" />
    <circle cx="17.5" cy="8.5" r="3" /><path d="M17 13.3c3.3.2 5.5 2.6 5.5 5.7h-4.6" />
  </Icon>
);

const GradCap = () => (
  <svg width="44" height="28" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#1766f0" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#1766f0" />
    <path d="M150 38v30" stroke="#1766f0" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const ICONES_CATEGORIE = {
  "Programmation": <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />,
  "Réseaux": <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5v4M12 11.5l-5.5 5.5M12 11.5l5.5 5.5" /></>,
  "Bases de données": <><ellipse cx="12" cy="5.5" rx="7" ry="2.5" /><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>,
  "Systèmes & Linux": <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 9l3 3-3 3M12.5 15H17" /></>,
  "Génie logiciel": <path d="M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5" />,
};
const IconeCategorie = ({ nom }) => (
  <Icon size={16}>{ICONES_CATEGORIE[nom] ?? <path d="M3 6a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />}</Icon>
);

function BadgeReponses({ questionId, nombre, resolue, ouvert, onClick }) {
  const texte = `${nombre} réponse${nombre > 1 ? "s" : ""}`;
  return (
    <button type="button"
      className={`qcarte__compteur${resolue ? " is-resolue" : nombre === 0 ? " is-sans-reponse" : " is-reponses"}`}
      onClick={onClick}
      aria-expanded={ouvert}
      aria-controls={`reponses-question-${questionId}`}
      aria-label={`${resolue ? "Question résolue. " : ""}Voir les ${texte} et leurs auteurs`}
      title={resolue ? "Question résolue" : texte}>
      <Icon size={15}><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" /></Icon>
      {nombre}
    </button>
  );
}

function BadgeAccords({ nombre, onClick }) {
  if (!nombre) return null;
  return (
    <button type="button" className="qcarte__compteur" title={pluriel(nombre, "vote")}
      onClick={onClick} aria-label={`Voir les ${pluriel(nombre, "vote")} et les réponses concernées`}>
      <Icon size={15}><path d="M7 10v11M14 5l-1 5h6a2 2 0 0 1 2 2l-1.5 7H7V10l4-7a2 2 0 0 1 3 2zM3 10h4v11H3z" /></Icon>
      {pluriel(nombre, "vote")}
    </button>
  );
}

function CarteQuestion({ q, user, onOuvrir, onFavori, onResolutionChange, afficherAvis }) {
  const [reponsesOuvertes, setReponsesOuvertes] = useState(false);
  const [reponses, setReponses] = useState([]);
  const [reponsesChargees, setReponsesChargees] = useState(false);
  const [chargementReponses, setChargementReponses] = useState(false);
  const [reponseEnCours, setReponseEnCours] = useState(null);
  const [voteEnCours, setVoteEnCours] = useState(null);
  const estAuteurQuestion = user?.username === q.authorUsername;
  const peutVoter = !estAuteurQuestion;

  const basculerReponses = async () => {
    if (reponsesOuvertes) {
      setReponsesOuvertes(false);
      return;
    }
    setReponsesOuvertes(true);
    if (reponsesChargees) return;

    setChargementReponses(true);
    try {
      setReponses(await listerReponses(q.id));
      setReponsesChargees(true);
    } catch (err) {
      setReponsesOuvertes(false);
      afficherAvis(err.message);
    } finally {
      setChargementReponses(false);
    }
  };

  const accepter = async (reponse) => {
    setReponseEnCours(reponse.id);
    try {
      const modifiee = await accepterReponse(reponse.id);
      setReponses((liste) => liste.map((item) => ({
        ...item,
        acceptee: item.id === modifiee.id && modifiee.acceptee,
      })));
      onResolutionChange(modifiee.acceptee);
    } catch (err) {
      afficherAvis(err.message);
    } finally {
      setReponseEnCours(null);
    }
  };

  const voter = async (reponse) => {
    setVoteEnCours(reponse.id);
    try {
      const resultat = await voterReponse(reponse.id);
      setReponses((liste) => liste.map((item) => (
        item.id === reponse.id
          ? {
            ...item,
            accords: resultat.accords,
            personnes_accord: resultat.personnes_accord,
            mon_accord: resultat.mon_accord,
          }
          : item
      )));
    } catch (err) {
      afficherAvis(err.message);
    } finally {
      setVoteEnCours(null);
    }
  };

  return (
    <article className="card qcarte">
      <div className="qcarte__haut">
        <span className="qcarte__etiquettes">
          <span className="qcarte__categorie" style={{ "--couleur-categorie": q.categorieCouleur }}>
            <IconeCategorie nom={q.categorie} />{q.categorie}
          </span>
          <Difficulte niveau={q.difficulte} />
        </span>
        <button type="button" className={`etoile${q.favori ? " is-active" : ""}`} onClick={onFavori}
          aria-pressed={q.favori} title={q.favori ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-label={q.favori ? "Retirer des favoris" : "Ajouter aux favoris"}>
          {q.favori ? I.etoilePleine : I.star}
        </button>
      </div>

      <div className={`qcarte__corps${q.apercu ? " avec-apercu" : ""}`}>
        <div className="qcarte__texte">
          <h2 className="qcarte__titre">
            <button type="button" onClick={onOuvrir}>{q.title}</button>
          </h2>
          <p className="qcarte__extrait">{q.excerpt}</p>
        </div>
        {q.apercu && (
          <button type="button" className={`qcarte__apercu${q.captures > 1 ? " is-pile" : ""}`} onClick={onOuvrir}
            aria-label={`Ouvrir « ${q.title} » (${pluriel(q.captures, "capture")})`}>
            <span className="qcarte__apercu-cadre">
              <img src={q.apercu} alt="" loading="lazy" />
              {q.captures > 1 && <span className="qcarte__apercu-plus">+{q.captures - 1}</span>}
            </span>
          </button>
        )}
      </div>

      {(q.langage || (q.captures > 0 && !q.apercu)) && (
        <div className="qcarte__joints">
          {q.langage && (
            <span className="qcarte__joint" title="Contient un extrait de code">
              <Icon size={14}><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" /></Icon>{q.langage}
            </span>
          )}
          {q.captures > 0 && !q.apercu && (
            <span className="qcarte__joint" title="Contient des captures d’écran">
              <Icon size={14}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></Icon>
              {pluriel(q.captures, "capture")}
            </span>
          )}
        </div>
      )}

      {q.tags.length > 0 && (
        <div className="qcarte__tags">{q.tags.map((t) => <span key={t}>#{t}</span>)}</div>
      )}

      <div className="qcarte__pied">
        <a className="qcarte__auteur lien-membre" href={lienProfil(q.authorUsername)} title="Voir le profil">
          <Avatar name={q.author} color={q.color} size={36} photo={q.authorPhoto} />
          <span>
            <strong>
              {q.authorIsAdmin && <BadgeAdmin />}{q.author}
              {estAuteurQuestion && <span className="question__author-vous"> (vous)</span>}
            </strong>
            <small>{q.when}</small>
          </span>
        </a>
        <span className="qcarte__compteurs">
          <BadgeReponses questionId={q.id} nombre={q.answers} resolue={q.solved} ouvert={reponsesOuvertes}
            onClick={basculerReponses} />
          <BadgeAccords nombre={q.agreements} onClick={onOuvrir} />
          <span className="qcarte__compteur" title={pluriel(q.views, "vue")}>{I.eye}{q.views}</span>
        </span>
      </div>

      {reponsesOuvertes && (
        <section id={`reponses-question-${q.id}`} className="qcarte__reponses"
          aria-label={`Réponses à la question ${q.title}`}>
          {chargementReponses ? (
            <p className="qcarte__reponses-vide">Chargement des réponses…</p>
          ) : reponses.length === 0 ? (
            <p className="qcarte__reponses-vide">Aucune réponse pour le moment.</p>
          ) : reponses.map((reponse) => (
            <article key={reponse.id} className={`qcarte__reponse${reponse.acceptee ? " is-acceptee" : ""}`}>
              <div className="qcarte__reponse-entete">
                <a className="qcarte__reponse-auteur lien-membre"
                  href={lienProfil(reponse.auteur.username)}>
                  <Avatar name={nomCourt(reponse.auteur)}
                    color={couleurPour(reponse.auteur.username)} size={30} photo={reponse.auteur.photo} />
                  <strong>
                    {reponse.auteur.is_staff && <BadgeAdmin />}
                    {reponse.auteur.profil === "enseignant" && <BadgeEnseignant />}
                    {nomCourt(reponse.auteur)}
                  </strong>
                </a>
                <span className="qcarte__reponse-date">{ilYA(reponse.date_creation)}</span>
                {reponse.acceptee && <span className="qcarte__reponse-badge">✓ Réponse acceptée</span>}
              </div>
              <TexteFormate texte={reponse.contenu} className="qcarte__reponse-texte" />
              <div className="qcarte__reponse-actions">
                <button type="button" className={`qcarte__vote${reponse.mon_accord ? " is-actif" : ""}`}
                  onClick={() => voter(reponse)}
                  disabled={voteEnCours !== null || !peutVoter || user?.username === reponse.auteur.username}
                  aria-pressed={reponse.mon_accord}
                  title={!peutVoter
                    ? "L’auteur de la question ne peut pas voter pour ses réponses"
                    : user?.username === reponse.auteur.username
                    ? "Vous ne pouvez pas voter pour votre propre réponse"
                    : reponse.mon_accord ? "Retirer votre vote" : "Voter pour cette réponse"}
                  aria-label={reponse.mon_accord ? "Retirer votre vote" : "Voter pour cette réponse"}>
                  <Icon size={15}>
                    <path d="M7 10v11M14 5l-1 5h6a2 2 0 0 1 2 2l-1.5 7H7V10l4-7a2 2 0 0 1 3 2zM3 10h4v11H3z" />
                  </Icon>
                </button>
                <span className="qcarte__vote-count" aria-label={pluriel(reponse.accords, "vote")}>
                  {reponse.accords}
                </span>
                {estAuteurQuestion && (
                  <button type="button" className="qcarte__accepter"
                    onClick={() => accepter(reponse)} disabled={reponseEnCours !== null}>
                    {reponseEnCours === reponse.id ? "Enregistrement…" : reponse.acceptee ? "Retirer l’acceptation" : "Accepter cette réponse"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </article>
  );
}

const CarteCommunaute = () => (
  <div className="communaute">
    <span className="communaute__icone">
      <svg width="64" height="54" viewBox="0 0 64 54" aria-hidden="true" fill="currentColor">
        <path d="M14 6l3 4M50 6l-3 4M32 1v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="18" r="8" />
        <path d="M17 50c0-9 6.7-15 15-15s15 6 15 15z" />
        <circle cx="14" cy="24" r="6" opacity=".85" />
        <path d="M2 50c0-7 5.4-12 12-12 2.4 0 4.6.6 6.4 1.8C17.6 42.6 16 46 16 50z" opacity=".85" />
        <circle cx="50" cy="24" r="6" opacity=".85" />
        <path d="M62 50c0-7-5.4-12-12-12-2.4 0-4.6.6-6.4 1.8C46.4 42.6 48 46 48 50z" opacity=".85" />
      </svg>
    </span>
    <strong>Une communauté<br />étudiante et solidaire</strong>
    <span className="communaute__texte">Ensemble, on va plus loin !</span>
    <svg className="communaute__vagues" viewBox="0 0 240 120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="vague-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd3fb" /><stop offset="1" stopColor="#a5c3fa" />
        </linearGradient>
        <linearGradient id="vague-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5d9bf8" /><stop offset="1" stopColor="#1766f0" />
        </linearGradient>
      </defs>
      <path d="M0 50 C60 20 120 80 240 30 V120 H0z" fill="url(#vague-a)" opacity=".7" />
      <path d="M0 85 C70 55 150 110 240 70 V120 H0z" fill="url(#vague-b)" />
    </svg>
  </div>
);

const extrait = (texte, max = 180) =>
  texte.length > max ? `${texte.slice(0, max).trimEnd()}…` : texte;

const NOMS_LANGAGES = {
  javascript: "JavaScript", python: "Python", java: "Java", c: "C", "c++": "C++", "c#": "C#",
  php: "PHP", typescript: "TypeScript", sql: "SQL", html: "HTML", css: "CSS", bash: "Bash", json: "JSON",
};

const versCarte = (q) => ({
  id: q.id,

  answers: q.reponses,
  agreements: q.accords,
  solved: q.resolue,
  title: q.titre,
  excerpt: extrait(sansMiseEnForme(q.description)),
  description: q.description,
  tags: q.tags,
  categorie: q.categorie.nom,
  categorieId: q.categorie.id,
  categorieCouleur: q.categorie.couleur,
  author: nomCourt(q.auteur),
  authorUsername: q.auteur.username,
  authorPhoto: q.auteur.photo,
  authorIsAdmin: q.auteur.is_staff,
  color: couleurPour(q.auteur.username),
  when: ilYA(q.date_creation),
  views: q.vues,
  favori: q.favori,
  difficulte: q.difficulte,
  langage: q.code_extrait ? NOMS_LANGAGES[q.langage] ?? (q.langage || "Code") : "",
  code: q.code_extrait,
  captures: q.captures?.length ?? 0,
  apercu: q.captures?.[0]?.miniature ? urlMedia(q.captures[0].miniature) : null,
});

const MENU = ["Accueil", "Questions", "Catégories", "Mes questions", "Favoris", "Classement"];
const TABS = ["Récents", "Sans réponse"];

const VUES_LISTE = ["Accueil", "Questions", "Mes questions", "Favoris"];

const ENTETES = {
  "Questions": ["Toutes les questions", "Parcourez les questions posées par la communauté."],
  "Mes questions": ["Mes questions", "Les questions que vous avez posées sur le forum."],
  "Favoris": ["Mes favoris", "Les questions que vous avez mises de côté avec l’étoile."],
  "Catégories": ["Catégories", "Choisissez un thème pour voir ses questions."],
  "Classement": ["Classement", "Les membres qui aident le plus la communauté."],
};

export default function HomePage({ user, vue, onChangerVue, onLogout, onAskQuestion, onOpenQuestion }) {
  const { menu, categorie: categorieFiltre } = vue;
  const menuVisible = user?.is_staff ? [...MENU, "Administration"] : MENU;
  const nomComplet = `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim();
  const [tab, setTab] = useState("Récents");
  const [query, setQuery] = useState("");
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({ questions: 0, reponses: 0, membres: 0, contributeurs: [] });
  const [classement, setClassement] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [erreurClassement, setErreurClassement] = useState("");
  const [avis, afficherAvis] = useAvis();
  const chargementInitialEffectue = useRef(false);

  const charger = () => {
    setChargement(true);
    setErreur("");
    Promise.all([listerQuestions(), listerCategories(), lireStatistiques()])
      .then(([q, c, s]) => {
        setQuestions(q.map(versCarte));
        setCategories(c);
        setStats(s);
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  };

  useEffect(() => {
    if (chargementInitialEffectue.current) return;
    chargementInitialEffectue.current = true;
    charger();
  }, []);

  useEffect(() => {
    if (menu === "Classement" && !classement && !erreurClassement) {
      lireClassement().then(setClassement).catch((err) => setErreurClassement(err.message));
    }
  }, [menu, classement, erreurClassement]);

  useEffect(() => setTab("Récents"), [menu, categorieFiltre]);

  const changerMenu = (nouveau, categorie = null) => onChangerVue({ menu: nouveau, categorie });

  const rechercher = (texte) => {
    setQuery(texte);
    if (texte && !VUES_LISTE.includes(menu)) changerMenu("Questions");
  };

  const handleFavori = async (id) => {
    try {
      const { favori } = await basculerFavori(id);
      setQuestions((liste) => liste.map((q) => (q.id === id ? { ...q, favori } : q)));
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  const handleResolutionChange = (id, resolue) => {
    setQuestions((liste) => liste.map((question) => (
      question.id === id ? { ...question, solved: resolue } : question
    )));
  };

  const list = useMemo(() => {
    let items = [...questions];
    if (menu === "Mes questions") items = items.filter((q) => q.authorUsername === user?.username);
    if (menu === "Favoris") items = items.filter((q) => q.favori);
    if (menu === "Questions" && categorieFiltre) items = items.filter((q) => q.categorieId === categorieFiltre);

    if (tab === "Sans réponse") items = items.filter((q) => q.answers === 0);
    const s = query.trim().toLowerCase();
    if (s) {
      items = items.filter((q) =>
        [q.title, q.description, q.author, q.categorie, q.langage, q.code, ...q.tags]
          .some((texte) => texte.toLowerCase().includes(s))
      );
    }
    return items;
  }, [questions, menu, categorieFiltre, user, tab, query]);

  const messageVide = () => {
    if (query.trim() || tab !== "Récents") return "Aucune question ne correspond. Essayez un autre filtre ou une autre recherche.";
    if (menu === "Mes questions") return "Vous n’avez pas encore posé de question.";
    if (menu === "Favoris") return "Aucun favori pour le moment. Cliquez sur l’étoile d’une question pour la retrouver ici.";
    if (menu === "Questions" && categorieFiltre) return "Aucune question dans cette catégorie pour le moment.";
    return "Aucune question pour le moment. Soyez le premier à poser une question !";
  };

  const [titreVue, sousTitreVue] = ENTETES[menu] ?? [];

  return (
    <div className="home">
      <header className="home__nav home__nav--recherche">
        <a className="home__logo" href="#/">
          <GradCap />
          <span>INSTA-<b>FORUM</b></span>
        </a>

        <label className="home__search">
          {I.search}
          <input type="search" placeholder="Rechercher une question, un sujet…"
            value={query} onChange={(e) => rechercher(e.target.value)} aria-label="Rechercher" />
        </label>

        <div className="home__actions">
          <button className="home__ask" onClick={onAskQuestion} aria-label="Poser une question">
            {I.plus} <span>Poser une question</span>
          </button>
          <Cloche />
          <MenuCompte user={user} onLogout={onLogout} />
        </div>
      </header>

      <div className={`home__body${stats.contributeurs.length > 0 ? " avec-aside" : ""}`}>
        <aside className="card home__menu" aria-label="Navigation">
          {menuVisible.map((label) => (
            <button key={label}
              className={`home__menu-item${menu === label ? " is-active" : ""}`}
              aria-current={menu === label ? "page" : undefined}
              onClick={() => changerMenu(label)}>
              {ICONES_MENU[label][menu === label ? 1 : 0]}<span>{label}</span>
            </button>
          ))}
          <CarteCommunaute />
        </aside>

        <main className="home__main">
          {menu === "Accueil" ? (
            <>
              <section className="home__hero">
                <h1>Bienvenue{nomComplet ? `, ${nomComplet}` : ""} sur INSTA-FORUM</h1>
                <p>Posez vos questions, partagez vos connaissances et progressez ensemble.</p>
                <img className="home__hero-image" src="/images/banniere-idees.webp" alt="" />
              </section>

              <ul className="stats" aria-label="Statistiques du forum">
                <li className="is-bleu">
                  <span className="stats__icone"><IconeQuestions /></span>
                  <div><strong>{stats.questions}</strong><span>question{stats.questions > 1 ? "s" : ""}</span></div>
                </li>
                <li className="is-vert">
                  <span className="stats__icone"><IconeReponses /></span>
                  <div><strong>{stats.reponses}</strong><span>réponse{stats.reponses > 1 ? "s" : ""}</span></div>
                </li>
                <li className="is-violet">
                  <span className="stats__icone"><IconeMembres /></span>
                  <div><strong>{stats.membres}</strong><span>membre{stats.membres > 1 ? "s" : ""}</span></div>
                </li>
              </ul>
            </>
          ) : (
            <section className="home__entete">
              <h1>{titreVue}</h1>
              <p>{sousTitreVue}</p>
            </section>
          )}

          {menu === "Questions" && (
            <div className="home__filtres" aria-label="Filtrer par catégorie">
              <button className={!categorieFiltre ? "is-active" : ""} onClick={() => changerMenu("Questions")}>
                Toutes
              </button>
              {categories.map((c) => (
                <button key={c.id} className={categorieFiltre === c.id ? "is-active" : ""}
                  onClick={() => changerMenu("Questions", c.id)}>
                  <i style={{ background: c.couleur }} />{c.nom}
                </button>
              ))}
            </div>
          )}

          {erreur && (
            <div className="card home__empty" role="alert">
              {erreur}
              <button type="button" className="home__ask home__empty-action" onClick={charger}>Réessayer</button>
            </div>
          )}

          {VUES_LISTE.includes(menu) && (
            <>
              <div className="home__tabs" role="tablist">
                {TABS.map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t}
                    className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                    {t}
                  </button>
                ))}
              </div>

              {chargement && <div className="card home__empty">Chargement des questions…</div>}

              {!chargement && !erreur && list.length === 0 && (
                <div className="card home__empty">
                  {messageVide()}
                  {menu === "Mes questions" && !query && tab === "Récents" && (
                    <button className="home__ask home__empty-action" onClick={onAskQuestion}>
                      {I.plus} Poser une question
                    </button>
                  )}
                </div>
              )}

              {list.map((q) => (
                <CarteQuestion key={q.id} q={q}
                  user={user} onOuvrir={() => onOpenQuestion(q.id)}
                  onFavori={() => handleFavori(q.id)}
                  onResolutionChange={(resolue) => handleResolutionChange(q.id, resolue)}
                  afficherAvis={afficherAvis} />
              ))}
            </>
          )}

          {menu === "Catégories" && (
            <div className="cats-grille">
              {categories.map((c) => (
                <button key={c.id} className="card cats-grille__carte" onClick={() => changerMenu("Questions", c.id)}
                  style={{ borderTopColor: c.couleur }}>
                  <strong>{c.nom}</strong>
                  <span>{pluriel(c.nb_questions, "question")}</span>
                </button>
              ))}
            </div>
          )}

          {menu === "Classement" && (
            <section className="card classement">
              {!classement && !erreurClassement && <p className="home__empty">Chargement du classement…</p>}
              {erreurClassement && (
                <div className="home__empty" role="alert">
                  {erreurClassement}
                  <button type="button" className="home__ask home__empty-action"
                    onClick={() => setErreurClassement("")}>Réessayer</button>
                </div>
              )}
              {classement && (
                <>
                  <p className="classement__bareme">
                    Barème : question {classement.bareme.question} pts · réponse {classement.bareme.reponse} pts ·
                    réponse acceptée +{classement.bareme.acceptee} pts · chaque vote reçu ±1 pt
                  </p>
                  {classement.membres.length === 0 ? (
                    <p className="home__empty">Personne n’a encore participé. Soyez le premier !</p>
                  ) : (
                    <div className="classement__defilement">
                      <table>
                        <thead>
                          <tr>
                            <th>Rang</th><th>Membre</th><th>Questions</th><th>Réponses</th>
                            <th>Acceptées</th><th>Votes reçus</th><th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classement.membres.map((m) => (
                            <tr key={m.username} className={m.username === user?.username ? "is-moi" : ""}>
                              <td className="classement__rang">{m.rang <= 3 ? ["🥇", "🥈", "🥉"][m.rang - 1] : m.rang}</td>
                              <td>
                                <a className="classement__membre lien-membre" href={lienProfil(m.username)}>
                                  <Avatar name={`${m.prenom} ${m.nom}`} color={couleurPour(m.username)} size={28} />
                                  {nomCourt(m)}{m.username === user?.username && " (vous)"}
                                </a>
                              </td>
                              <td>{m.questions}</td>
                              <td>{m.reponses}</td>
                              <td>{m.acceptees}</td>
                              <td>{m.votes_recus}</td>
                              <td><strong>{m.points}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </main>

        {stats.contributeurs.length > 0 && (
          <aside className="home__side">
            <section className="card">
              <h3>Meilleurs contributeurs</h3>
              <ul className="top">
                {stats.contributeurs.map((m) => (
                  <li key={m.username}>
                    <Avatar name={`${m.prenom} ${m.nom}`} color={couleurPour(m.username)} />
                    <div>
                      <a className="lien-membre" href={lienProfil(m.username)}><strong>{nomCourt(m)}</strong></a>
                      <small>{pluriel(m.nb_reponses, "réponse")}</small>
                    </div>
                    <span className="top__trophy">{I.trophy}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
      <button type="button" className="bouton-flottant" onClick={onAskQuestion}
        aria-label="Poser une question" title="Poser une question">
        {I.plus}
      </button>
      <Avis texte={avis} />
    </div>
  );
}
