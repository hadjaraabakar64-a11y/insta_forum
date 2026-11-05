import { useCallback, useEffect, useRef, useState } from "react";
import { urlMedia } from "./api";
import "./Galerie.css";

function Visionneuse({ images, index, setIndex, onFermer }) {
  const boutonFermer = useRef(null);
  const total = images.length;
  const precedente = useCallback(() => setIndex((i) => (i - 1 + total) % total), [setIndex, total]);
  const suivante = useCallback(() => setIndex((i) => (i + 1) % total), [setIndex, total]);

  useEffect(() => {
    const focusAvant = document.activeElement;
    boutonFermer.current?.focus();
    const ancienDefilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const touche = (e) => {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowLeft") precedente();
      if (e.key === "ArrowRight") suivante();
    };
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("keydown", touche);
      document.body.style.overflow = ancienDefilement;
      focusAvant?.focus?.();
    };
  }, [onFermer, precedente, suivante]);

  const image = images[index];
  return (
    <div className="visionneuse" role="dialog" aria-modal="true" aria-label={`Capture ${index + 1} sur ${total}`}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <button ref={boutonFermer} type="button" className="visionneuse__fermer" onClick={onFermer} aria-label="Fermer">✕</button>

      <figure className="visionneuse__image">
        <img src={urlMedia(image.image)} alt={`Capture ${index + 1} sur ${total}`} />
        <figcaption>
          {total > 1 && <span>{index + 1} / {total}</span>}
          <a href={urlMedia(image.image)} target="_blank" rel="noopener noreferrer">Ouvrir l’original</a>
        </figcaption>
      </figure>

      {total > 1 && (
        <>
          <button type="button" className="visionneuse__fleche is-gauche" onClick={precedente} aria-label="Image précédente">‹</button>
          <button type="button" className="visionneuse__fleche is-droite" onClick={suivante} aria-label="Image suivante">›</button>
        </>
      )}
    </div>
  );
}

export default function Galerie({ images }) {
  const [ouverte, setOuverte] = useState(null);
  const fermer = useCallback(() => setOuverte(null), []);
  if (!images?.length) return null;

  return (
    <>
      <div className={`galerie${images.length === 1 ? " is-unique" : ""}`}>
        {images.map((image, i) => (
          <button key={image.id} type="button" className="galerie__vignette" onClick={() => setOuverte(i)}
            aria-label={`Agrandir la capture ${i + 1} sur ${images.length}`}>
            <img src={urlMedia(image.miniature || image.image)} alt="" loading="lazy" />
            <span className="galerie__loupe" aria-hidden="true">⤢</span>
          </button>
        ))}
      </div>
      {ouverte !== null && (
        <Visionneuse images={images} index={ouverte} setIndex={setOuverte} onFermer={fermer} />
      )}
    </>
  );
}
