import { useEffect, useRef, useState } from "react";
import "./HomePage.css";
import "./QuestionPage.css";
import {
  basculerFavori, lireQuestion, listerReponses, publierReponse, supprimerQuestion,
} from "../api";
import {
  Avatar, Avis, BadgeAdmin, BadgeEnseignant, Cloche, Difficulte, MenuCompte, couleurPour, ilYA, lienProfil,
  nomCourt, pluriel, useAvis,
} from "../commun";
import TexteFormate, { OutilCode } from "../TexteFormate";
import Galerie from "../Galerie";

const GradCap = () => (
  <svg width="44" height="28" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#1766f0" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#1766f0" />
    <path d="M150 38v30" stroke="#1766f0" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const Etoile = ({ pleine }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={pleine ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" />
  </svg>
);

const Modifiee = ({ date }) =>
  date ? (
    <>
      <span>•</span>
      <span title={`Modifiée le ${new Date(date).toLocaleString("fr-FR")}`}>modifiée {ilYA(date)}</span>
    </>
  ) : null;

export default function QuestionPage({ id, reponseId, user, onBack, onEdit, onDeleted, onResponsePublished, onLogout }) {
  const [question, setQuestion] = useState(null);
  const [reponseCible, setReponseCible] = useState(null);
  const [erreurReponseCible, setErreurReponseCible] = useState("");
  const [erreur, setErreur] = useState("");
  const [contenu, setContenu] = useState("");
  const [erreurReponse, setErreurReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [avis, afficherAvis] = useAvis();
  const zoneReponse = useRef(null);
  const elementReponseCible = useRef(null);
  const vueEnregistreePour = useRef(null);

  useEffect(() => {
    if (vueEnregistreePour.current === id) return;
    vueEnregistreePour.current = id;
    lireQuestion(id)
      .then(setQuestion)
      .catch((err) => setErreur(err.message));
  }, [id]);

  useEffect(() => {
    if (!reponseId) {
      setReponseCible(null);
      setErreurReponseCible("");
      return;
    }
    let actif = true;
    setReponseCible(null);
    setErreurReponseCible("");
    listerReponses(id)
      .then((reponses) => {
        if (!actif) return;
        const cible = reponses.find((reponse) => reponse.id === reponseId);
        if (cible) setReponseCible(cible);
        else setErreurReponseCible("Cette réponse n’existe plus ou n’est pas disponible.");
      })
      .catch((err) => {
        if (actif) setErreurReponseCible(err.message);
      });
    return () => { actif = false; };
  }, [id, reponseId]);

  useEffect(() => {
    if (reponseCible && elementReponseCible.current) {
      elementReponseCible.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [reponseCible]);

  const estAuteur = question && user && question.auteur.username === user.username;

  const handleSupprimerQuestion = async () => {
    const message = question.reponses
      ? `Supprimer cette question et ses ${pluriel(question.reponses, "réponse")} ? Cette action est définitive.`
      : "Supprimer cette question ? Cette action est définitive.";
    if (!window.confirm(message)) return;
    try {
      await supprimerQuestion(id);
      onDeleted();
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  const handleRepondre = async (e) => {
    e.preventDefault();
    setErreurReponse("");

    if (!contenu.trim()) {
      setErreurReponse("Écrivez votre réponse avant de la publier.");
      return;
    }

    try {
      setEnvoi(true);
      await publierReponse(id, contenu.trim());
      setContenu("");
      onResponsePublished();
    } catch (err) {
      setErreurReponse(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const handleFavori = async () => {
    try {
      const { favori } = await basculerFavori(id);
      setQuestion((q) => ({ ...q, favori }));
    } catch (err) {
      afficherAvis(err.message);
    }
  };

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

      <main className="detail">
        <button type="button" className="detail__retour" onClick={onBack}>
          ← Retour aux questions
        </button>

        {erreur && <div className="card home__empty" role="alert">{erreur}</div>}

        {!question && !erreur && <div className="card home__empty">Chargement de la question…</div>}

        {question && (
          <>
            <article className="card detail__question detail__ligne">
              <div className="detail__contenu">
              <div className="detail__entete">
                <h1>{question.titre}</h1>
                <div className="detail__actions">
                  {question.resolue && <span className="detail__badge">✓ Résolue</span>}
                  <button type="button" className={`detail__favori${question.favori ? " is-active" : ""}`}
                    onClick={handleFavori} aria-pressed={question.favori}>
                    <Etoile pleine={question.favori} />
                    {question.favori ? "En favori" : "Ajouter aux favoris"}
                  </button>
                </div>
              </div>

              <div className="question__meta">
                <Avatar name={`${question.auteur.prenom} ${question.auteur.nom}`}
                  color={couleurPour(question.auteur.username)} size={24} photo={question.auteur.photo} />
                <a className="question__author lien-membre" href={lienProfil(question.auteur.username)}>
                  {question.auteur.is_staff && <BadgeAdmin />}{nomCourt(question.auteur)}
                  {estAuteur && <span className="question__author-vous"> (vous)</span>}
                </a>
                <span>•</span><span>{ilYA(question.date_creation)}</span>
                <Modifiee date={question.date_modification} />
                <span>•</span><span>{pluriel(question.vues, "vue")}</span>
              </div>

              <TexteFormate texte={question.description} className="detail__texte" />

              {question.code_extrait && (
                <div className="detail__code-extrait" style={{ margin: "16px 0" }}>
                  <TexteFormate texte={`\`\`\`${question.langage || ""}\n${question.code_extrait}\n\`\`\``} />
                </div>
              )}

              <Galerie images={question.captures} />

              <div className="question__tags">
                <span className="tag">{question.categorie.nom}</span>
                <Difficulte niveau={question.difficulte} />
                {question.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>

              {estAuteur && (
                <div className="detail__outils">
                  <button type="button" onClick={onEdit}>Modifier</button>
                  <button type="button" className="is-danger" onClick={handleSupprimerQuestion}>Supprimer</button>
                </div>
              )}
              </div>
            </article>

            {reponseId && (
              <section className="detail__reponse-cible" aria-labelledby="titre-reponse-cible">
                <h2 id="titre-reponse-cible">Réponse concernée</h2>
                {erreurReponseCible && <p className="detail__erreur" role="alert">{erreurReponseCible}</p>}
                {!reponseCible && !erreurReponseCible && <p>Chargement de la réponse…</p>}
                {reponseCible && (
                  <article
                    id={`reponse-${reponseCible.id}`}
                    ref={elementReponseCible}
                    className={`card detail__reponse-cible-carte${reponseCible.acceptee ? " is-acceptee" : ""}`}
                  >
                    <div className="detail__reponse-cible-auteur">
                      <Avatar
                        name={nomCourt(reponseCible.auteur)}
                        color={couleurPour(reponseCible.auteur.username)}
                        size={36}
                        photo={reponseCible.auteur.photo}
                      />
                      <strong>
                        {reponseCible.auteur.is_staff && <BadgeAdmin />}
                        {reponseCible.auteur.profil === "enseignant" && <BadgeEnseignant />}
                        {nomCourt(reponseCible.auteur)}
                      </strong>
                      <span>{ilYA(reponseCible.date_creation)}</span>
                      {reponseCible.acceptee && <span className="detail__badge">✓ Réponse acceptée</span>}
                    </div>
                    <TexteFormate texte={reponseCible.contenu} className="detail__texte" />
                  </article>
                )}
              </section>
            )}

            {!estAuteur && (
              <form className="card detail__formulaire" onSubmit={handleRepondre} noValidate>
                <h2>Répondre à cette question</h2>
                <textarea
                  rows="6"
                  placeholder="Expliquez votre solution en détail…"
                  value={contenu}
                  onChange={(e) => setContenu(e.target.value)}
                  aria-label="Votre réponse"
                  ref={zoneReponse}
                />
                <OutilCode zone={zoneReponse} valeur={contenu} setValeur={setContenu} />
                {erreurReponse && <p className="detail__erreur" role="alert">{erreurReponse}</p>}
                <button type="submit" className="home__ask" disabled={envoi}>
                  {envoi ? "Publication…" : "Publier ma réponse"}
                </button>
              </form>
            )}
          </>
        )}
      </main>
      <Avis texte={avis} />
    </div>
  );
}
