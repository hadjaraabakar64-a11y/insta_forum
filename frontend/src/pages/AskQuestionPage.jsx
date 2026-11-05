
import { useCallback, useEffect, useRef, useState } from "react";
import "./AskQuestionPage.css";
import { listerCategories, lireQuestion, listerQuestions, urlMedia } from "../api";

const CAPTURES_MAX = 5;

/* ───── constantes ───── */

const LANGAGES_CODE = [
  "JavaScript", "Python", "Java", "C", "C++", "C#",
  "PHP", "TypeScript", "SQL", "HTML", "CSS", "Bash", "JSON",
];

const MAX_TITRE = 200;

/* ───── sous-composants ───── */

function Breadcrumb({ modification, onBack }) {
  return (
    <nav className="ask__breadcrumb">
      <button type="button" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {modification ? "Retour à la question" : "Retour à l'accueil"}
      </button>
      <span className="ask__breadcrumb-sep">/</span>
      <span>{modification ? "Modifier la question" : "Poser une question"}</span>
    </nav>
  );
}

function ChampTitre({ titre, setTitre }) {
  return (
    <div className="ask__block">
      <label className="ask__label">
        Titre de la question <span>*</span>
      </label>
      <p className="ask__hint">Soyez précis : résumez votre problème en une phrase.</p>
      <div className="ask__input">
        <input
          type="text"
          placeholder="Ex : Comment relier deux composants React avec useContext ?"
          maxLength={MAX_TITRE}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          required
        />
        <small>{titre.length}/{MAX_TITRE}</small>
      </div>
    </div>
  );
}

function ChampCategorie({ categorie, setCategorie, categories }) {
  return (
    <div className="ask__block">
      <label className="ask__label">Catégorie <span>*</span></label>
      <div className="ask__input">
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          className={categorie === "" ? "is-empty" : ""}
          required
        >
          <option value="">Choisir une catégorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
        <svg className="ask__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

function BarreOutils({ zone, valeur, setValeur }) {
  const inserer = (avant, apres = avant) => {
    const el = zone.current;
    if (!el) return;
    const debut = el.selectionStart;
    const fin = el.selectionEnd;
    const selection = valeur.slice(debut, fin) || "texte";
    const nouveau = valeur.slice(0, debut) + avant + selection + apres + valeur.slice(fin);
    setValeur(nouveau);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(debut + avant.length, debut + avant.length + selection.length);
    });
  };

  const boutons = [
    { label: "B", title: "Gras", action: () => inserer("**") },
    { label: "I", title: "Italique", action: () => inserer("*"), italic: true },
    { label: "</>", title: "Code en ligne", action: () => inserer("`") },
    { label: "#", title: "Titre", action: () => inserer("\n### ", "\n") },
    { label: "🔗", title: "Lien", action: () => inserer("[", "](url)") },
    { label: "🖼️", title: "Image", action: () => inserer("![alt](", ")") },
  ];

  return (
    <div className="editor__bar">
      {boutons.map((b) => (
        <button
          key={b.label}
          type="button"
          title={b.title}
          style={b.italic ? { fontStyle: "italic" } : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.action}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

function ChampDescription({ description, setDescription, zoneRef }) {
  return (
    <div className="ask__block">
      <label className="ask__label">Description détaillée <span>*</span></label>
      <p className="ask__hint">
        Incluez ce que vous avez essayé, ce que vous attendiez et ce qui se passe réellement.
      </p>
      <div className="editor">
        <BarreOutils zone={zoneRef} valeur={description} setValeur={setDescription} />
        <textarea
          ref={zoneRef}
          rows="8"
          placeholder={"Décrivez votre problème en détail…\n\n• Que voulez-vous obtenir ?\n• Qu'avez-vous déjà essayé ?\n• Quel message d'erreur apparaît ?"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>
    </div>
  );
}

function ChampCode({ code, setCode, langage, setLangage }) {
  return (
    <div className="ask__block">
      <label className="ask__label">
        Extrait de code <span className="ask__label-opt">(facultatif)</span>
      </label>
      <div className="ask__code-header">
        <select value={langage} onChange={(e) => setLangage(e.target.value)}>
          {LANGAGES_CODE.map((l) => (
            <option key={l} value={l.toLowerCase()}>{l}</option>
          ))}
        </select>
        {code.trim() && (
          <svg className="ask__code-ok" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#1e8e4e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <textarea
        className="codearea"
        rows="6"
        placeholder="// Collez votre code ici..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
    </div>
  );
}

function ChampCapture({ captures, setCaptures }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const ajouterFichiers = (fichiers) => {
    const acceptes = Array.from(fichiers).filter(
      (f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024
    );
    const nouvelles = acceptes.slice(0, Math.max(0, CAPTURES_MAX - captures.length)).map((f) => ({
      fichier: f,
      nom: f.name,
      apercu: URL.createObjectURL(f),
    }));
    setCaptures((prev) => [...prev, ...nouvelles]);
  };

  const retirer = (index) => {
    setCaptures((prev) => {
      URL.revokeObjectURL(prev[index].apercu);
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="ask__block">
      <label className="ask__label">
        Capture d'écran <span className="ask__label-opt">(facultatif)</span>
      </label>
      <p className="ask__hint">Ajoutez une image de l'erreur ou du résultat obtenu.</p>
      <div
        className={`dropzone${drag ? " is-drag" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); ajouterFichiers(e.dataTransfer.files); }}
        onKeyDown={(e) => { if (e.key === "Enter") inputRef.current?.click(); }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <p>Glissez une image ici ou <u>parcourez vos fichiers</u></p>
        <small>PNG ou JPG, 5 Mo maximum, {CAPTURES_MAX} images au plus</small>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => ajouterFichiers(e.target.files)}
        />
      </div>
      {captures.length > 0 && (
        <ul className="thumbs">
          {captures.map((c, i) => (
            <li key={i}>
              <img src={c.apercu} alt={c.nom} />
              <span>{c.nom}</span>
              <button type="button" onClick={() => retirer(i)} aria-label="Retirer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sidebar({ titre, similaires }) {
  return (
    <aside className="ask__sidebar">
      {/* Tips */}
      <div className="ask__card">
        <h3>Comment bien poser sa question</h3>
        <ul className="tips">
          <li>
            <i>1</i>
            <div>
              <strong>Un titre précis</strong>
              <span>Résumez le problème en une phrase claire.</span>
            </div>
          </li>
          <li>
            <i>2</i>
            <div>
              <strong>Le Contexte</strong>
              <span>Langages, version et ce que vous essayez de faire.</span>
            </div>
          </li>
          <li>
            <i>3</i>
            <div>
              <strong>Le message d'erreur</strong>
              <span>Copiez-le tel quel : nom, code, le code concerné.</span>
            </div>
          </li>
          <li>
            <i>4</i>
            <div>
              <strong>Ce que vous avez essayé</strong>
              <span>Listez les recherches ou les méthodes déjà testées.</span>
            </div>
          </li>
        </ul>
      </div>

      {/* Similar questions */}
      <div className="ask__card">
        <h3>Questions similaires</h3>
        <p className="ask__card-hint">
          Elles apparaissent au fur et à mesure que vous tapez votre titre.
        </p>
        {similaires.length === 0 ? (
          <p className="similar__empty">Tapez un titre pour voir les suggestions.</p>
        ) : (
          <ul className="similar">
            {similaires.map((q) => (
              <li key={q.id}>
                <a href={`#/questions/${q.id}`}>{q.titre}</a>
                <small>
                  {q.nombre_reponses ?? 0} réponse{(q.nombre_reponses ?? 0) > 1 ? "s" : ""}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/* ───── composant principal ───── */

export default function AskQuestionPage({ questionId, user, onSubmit, onBack }) {
  const modification = Boolean(questionId);

  /* état du formulaire */
  const [titre, setTitre] = useState("");
  const [categorie, setCategorie] = useState("");
  const [description, setDescription] = useState("");
  const [codeExtrait, setCodeExtrait] = useState("");
  const [langage, setLangage] = useState("javascript");
  const [captures, setCaptures] = useState([]);

  /* données */
  const [categories, setCategories] = useState([]);
  const [toutesQuestions, setToutesQuestions] = useState([]);
  const [similaires, setSimilaires] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [pret, setPret] = useState(!modification);
  const capturesInitiales = useRef([]);

  const zoneDescription = useRef(null);

  /* chargement des catégories + questions (pour les similaires) */
  useEffect(() => {
    listerCategories()
      .then(setCategories)
      .catch((err) => setErreur(err.message));

    listerQuestions()
      .then((qs) => setToutesQuestions(Array.isArray(qs) ? qs : qs.results ?? []))
      .catch(() => {});
  }, []);

  /* chargement en mode modification */
  useEffect(() => {
    if (!questionId) return;
    lireQuestion(questionId)
      .then((q) => {
        if (q.auteur.username !== user?.username) {
          setErreur("Seul l'auteur peut modifier cette question.");
          return;
        }
        setTitre(q.titre);
        setCategorie(String(q.categorie.id));
        setDescription(q.description);
        setCodeExtrait(q.code_extrait || "");
        setLangage(q.langage || "javascript");
        if (Array.isArray(q.captures)) {
          capturesInitiales.current = q.captures.map((c) => c.id);
          setCaptures(
            q.captures.map((c) => ({
              id: c.id,
              nom: "Capture",
              apercu: urlMedia(c.miniature || c.image),
            }))
          );
        }
        setPret(true);
      })
      .catch((err) => setErreur(err.message));
  }, [questionId, user]);

  /* recherche de questions similaires */
  useEffect(() => {
    if (titre.trim().length < 3) {
      setSimilaires([]);
      return;
    }
    const mots = titre.toLowerCase().split(/\s+/).filter((m) => m.length > 2);
    const resultats = toutesQuestions
      .filter((q) => {
        if (q.id === questionId) return false;
        const t = q.titre.toLowerCase();
        return mots.some((m) => t.includes(m));
      })
      .slice(0, 5);
    setSimilaires(resultats);
  }, [titre, toutesQuestions, questionId]);

  /* soumission */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur("");

    if (!titre.trim() || !categorie || !description.trim()) {
      setErreur("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    try {
      setEnvoi(true);
      const nouvellesImages = captures.filter((c) => c.fichier).map((c) => c.fichier);
      const gardees = new Set(captures.filter((c) => c.id).map((c) => c.id));
      const retirees = capturesInitiales.current.filter((id) => !gardees.has(id));
      await onSubmit(
        {
          titre: titre.trim(),
          categorie_id: Number(categorie),
          description: description.trim(),
          code_extrait: codeExtrait.trim(),
          langage: codeExtrait.trim() ? langage : "",
        },
        nouvellesImages,
        retirees
      );
    } catch (err) {
      setErreur(err?.message || "Impossible d'enregistrer la question. Réessayez.");
      setEnvoi(false);
    }
  };

  return (
    <div className="ask-page">
      <div className="ask-page__inner">
        {/* ─── left column: form ─── */}
        <main className="ask">
          <Breadcrumb modification={modification} onBack={onBack} />

          <h1>{modification ? "Modifier la question" : "Poser une question"}</h1>
          <p className="ask__lead">
            {modification
              ? "Corrigez ou complétez votre question. Les réponses déjà publiées sont conservées."
              : "Plus votre question est claire, plus vite la communauté pourra vous aider."}
          </p>

          <hr />

          {!pret && !erreur && <p className="ask__lead">Chargement de la question…</p>}
          {!pret && erreur && <p className="ask__error" role="alert">{erreur}</p>}

          {pret && (
            <form onSubmit={handleSubmit} noValidate>
              <ChampTitre titre={titre} setTitre={setTitre} />

              <ChampCategorie
                categorie={categorie}
                setCategorie={setCategorie}
                categories={categories}
              />

              <ChampDescription
                description={description}
                setDescription={setDescription}
                zoneRef={zoneDescription}
              />

              <ChampCode
                code={codeExtrait}
                setCode={setCodeExtrait}
                langage={langage}
                setLangage={setLangage}
              />

              <ChampCapture captures={captures} setCaptures={setCaptures} />

              {erreur && (
                <p className="ask__error" role="alert">{erreur}</p>
              )}

              {/* Actions */}
              <div className="ask__actions">
                <div className="ask__actions-right">
                  <button
                    type="button"
                    className="ask__btn ask__btn--ghost"
                    onClick={onBack}
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    className="ask__btn ask__btn--primary"
                    disabled={envoi}
                  >
                    {modification ? (
                      envoi ? "Enregistrement…" : "Enregistrer les modifications"
                    ) : (
                      <>
                        {envoi ? "Publication…" : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                              strokeLinejoin="round">
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                            Publier la question
                          </>
                        )}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </main>

        {/* ─── right column: sidebar ─── */}
        <Sidebar titre={titre} similaires={similaires} />
      </div>
    </div>
  );
}
