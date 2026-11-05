
import { useState } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import "highlight.js/styles/github-dark.css";
import "./TexteFormate.css";

const LANGAGES = { bash, c, cpp, csharp, css, java, javascript, json, php, python, sql, typescript, xml };
Object.entries(LANGAGES).forEach(([nom, definition]) => hljs.registerLanguage(nom, definition));

const NOMS = {
  bash: "Terminal", c: "C", cpp: "C++", csharp: "C#", css: "CSS", java: "Java", javascript: "JavaScript",
  json: "JSON", php: "PHP", python: "Python", sql: "SQL", typescript: "TypeScript", xml: "HTML",
};

const BLOC = /```[ \t]*([\w+#.-]*)[ \t]*\r?\n([\s\S]*?)\r?\n?```/g;
const EN_LIGNE = /`([^`\n]+)`/g;

const INLINE = new RegExp([
  "(`[^`\\n]+`)",
  "!\\[([^\\]\\n]*)\\]\\((https:\\/\\/[^\\s)]+)\\)",
  "\\*\\*([^*\\n]+?)\\*\\*",
  "__([^_\\n]+?)__",
  "(?<![\\w*])\\*([^*\\s][^*\\n]*?)\\*(?![\\w*])",
  "(?<![\\w_])_([^_\\s][^_\\n]*?)_(?![\\w_])",
  "\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)",
  "(https?:\\/\\/[^\\s<]*[^\\s<.,;:!?)\\]])",
].join("|"), "g");

const LISTE = /^\s*[-*+•]\s+(.*)$/;
const LISTE_NUMEROTEE = /^\s*\d+[.)]\s+(.*)$/;
const TITRE = /^(#{1,3})\s+(.*)$/;
const CITATION = /^>\s?(.*)$/;

function decouper(texte) {
  const morceaux = [];
  let position = 0;
  for (const correspondance of texte.matchAll(BLOC)) {
    if (correspondance.index > position) {
      morceaux.push({ type: "texte", contenu: texte.slice(position, correspondance.index) });
    }
    morceaux.push({ type: "code", langage: correspondance[1].toLowerCase(), contenu: correspondance[2] });
    position = correspondance.index + correspondance[0].length;
  }
  if (position < texte.length) morceaux.push({ type: "texte", contenu: texte.slice(position) });
  return morceaux;
}

function EnLigne({ texte }) {
  const morceaux = [];
  let position = 0;
  for (const m of texte.matchAll(INLINE)) {
    const [tout, code, imageTexte, imageUrl, gras, gras2, italique, italique2, lienTexte, lienUrl, url] = m;
    if (m.index > position) morceaux.push(texte.slice(position, m.index));
    const cle = m.index;
    if (code) morceaux.push(<code key={cle} className="code-en-ligne">{code.slice(1, -1)}</code>);
    else if (imageUrl) {
      morceaux.push(
        <a key={cle} href={imageUrl} target="_blank" rel="noopener noreferrer" className="tf-image">
          <img src={imageUrl} alt={imageTexte} loading="lazy" referrerPolicy="no-referrer" />
        </a>
      );
    }
    else if (gras || gras2) morceaux.push(<strong key={cle}><EnLigne texte={gras || gras2} /></strong>);
    else if (italique || italique2) morceaux.push(<em key={cle}>{italique || italique2}</em>);
    else if (lienTexte) {
      morceaux.push(<a key={cle} href={lienUrl} target="_blank" rel="noopener noreferrer">{lienTexte}</a>);
    } else if (url) {
      morceaux.push(<a key={cle} href={url} target="_blank" rel="noopener noreferrer">{url}</a>);
    }
    position = m.index + tout.length;
  }
  if (position < texte.length) morceaux.push(texte.slice(position));
  return morceaux;
}

function decouperBlocs(texte) {
  const blocs = [];
  for (const ligne of texte.split(/\r?\n/)) {
    const dernier = blocs[blocs.length - 1];
    let m;
    if (!ligne.trim()) blocs.push({ type: "vide" });
    else if ((m = ligne.match(TITRE))) blocs.push({ type: "titre", niveau: m[1].length, texte: m[2] });
    else if ((m = ligne.match(LISTE))) {
      if (dernier?.type === "liste") dernier.elements.push(m[1]);
      else blocs.push({ type: "liste", elements: [m[1]] });
    } else if ((m = ligne.match(LISTE_NUMEROTEE))) {
      if (dernier?.type === "numerotee") dernier.elements.push(m[1]);
      else blocs.push({ type: "numerotee", elements: [m[1]] });
    } else if ((m = ligne.match(CITATION))) {
      if (dernier?.type === "citation") dernier.lignes.push(m[1]);
      else blocs.push({ type: "citation", lignes: [m[1]] });
    } else if (dernier?.type === "paragraphe") dernier.lignes.push(ligne);
    else blocs.push({ type: "paragraphe", lignes: [ligne] });
  }
  return blocs.filter((b) => b.type !== "vide");
}

function Blocs({ texte }) {
  return decouperBlocs(texte).map((bloc, i) => {
    if (bloc.type === "titre") {
      const Balise = `h${bloc.niveau + 2}`;
      return <Balise key={i} className="tf-titre"><EnLigne texte={bloc.texte} /></Balise>;
    }
    if (bloc.type === "liste" || bloc.type === "numerotee") {
      const Liste = bloc.type === "liste" ? "ul" : "ol";
      return (
        <Liste key={i} className="tf-liste">
          {bloc.elements.map((element, j) => <li key={j}><EnLigne texte={element} /></li>)}
        </Liste>
      );
    }
    if (bloc.type === "citation") {
      return <blockquote key={i} className="tf-citation"><EnLigne texte={bloc.lignes.join("\n")} /></blockquote>;
    }
    return <p key={i}><EnLigne texte={bloc.lignes.join("\n")} /></p>;
  });
}

function BlocCode({ langage, contenu }) {
  const [copie, setCopie] = useState(false);
  const code = contenu.replace(/\s+$/, "");

  const definition = langage && hljs.getLanguage(langage);
  const resultat = definition
    ? hljs.highlight(code, { language: langage, ignoreIllegals: true })
    : hljs.highlightAuto(code);
  const nom = definition ? NOMS[Object.keys(LANGAGES).find((n) => hljs.getLanguage(n) === definition)] : "Code";

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const zone = document.createElement("textarea");
      zone.value = code;
      zone.setAttribute("readonly", "");
      zone.style.position = "fixed";
      zone.style.opacity = "0";
      document.body.appendChild(zone);
      zone.select();
      const reussi = document.execCommand("copy");
      zone.remove();
      if (!reussi) return;
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <div className="bloc-code">
      <div className="bloc-code__barre">
        <span>{nom}</span>
        <button type="button" onClick={copier}>{copie ? "✓ Copié" : "Copier"}</button>
      </div>
      <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: resultat.value }} /></pre>
    </div>
  );
}

export default function TexteFormate({ texte, className = "" }) {
  return (
    <div className={`texte-formate ${className}`}>
      {decouper(texte).map((morceau, i) =>
        morceau.type === "code" ? (
          <BlocCode key={i} langage={morceau.langage} contenu={morceau.contenu} />
        ) : (
          <Blocs key={i} texte={morceau.contenu} />
        )
      )}
    </div>
  );
}

export const sansMiseEnForme = (texte) =>
  texte
    .replace(BLOC, (_, _langage, code) => ` ${code.replace(/\s+/g, " ").trim()} `)
    .replace(/^\s*(#{1,3}|>|[-*+•]|\d+[.)])\s+/gm, "")
    .replace(/!\[([^\]\n]*)\]\([^)\n]*\)/g, "")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g, "$1$2")
    .replace(/(?<![\w*])\*([^*\s][^*\n]*?)\*(?![\w*])|(?<![\w_])_([^_\s][^_\n]*?)_(?![\w_])/g, "$1$2")
    .replace(/```[\w+#.-]*/g, "")
    .replace(EN_LIGNE, "$1")
    .replace(/\s+/g, " ")
    .trim();

function inserer(zone, valeur, setValeur, transformer) {
  const debut = zone.selectionStart;
  const fin = zone.selectionEnd;
  const { texte, selection } = transformer(valeur.slice(debut, fin), debut > 0 && valeur[debut - 1] !== "\n");
  const placerCurseur = () => zone.setSelectionRange(debut + selection[0], debut + selection[1]);

  zone.focus();
  if (document.execCommand("insertText", false, texte)) {
    placerCurseur();
    return;
  }
  setValeur(valeur.slice(0, debut) + texte + valeur.slice(fin));
  requestAnimationFrame(() => setTimeout(placerCurseur, 0));
}

const entourer = (marque, exemple) => (choisi) => {
  const contenu = choisi || exemple;
  return { texte: `${marque}${contenu}${marque}`, selection: [marque.length, marque.length + contenu.length] };
};

const OUTILS = [
  { nom: "gras", titre: "Gras", libelle: <strong>B</strong>, transformer: entourer("**", "texte en gras") },
  { nom: "italique", titre: "Italique", libelle: <em>I</em>, transformer: entourer("*", "texte en italique") },
  {
    nom: "liste", titre: "Liste à puces", libelle: "• Liste",
    transformer: (choisi, milieuDeLigne) => {
      const avant = milieuDeLigne ? "\n" : "";
      const lignes = (choisi || "élément").split("\n").map((l) => `- ${l.replace(/^\s*[-*•]\s+/, "")}`).join("\n");
      return { texte: `${avant}${lignes}`, selection: [avant.length + 2, avant.length + lignes.length] };
    },
  },
  {
    nom: "lien", titre: "Lien", libelle: "🔗 Lien",
    transformer: (choisi) => {
      const texte = choisi || "texte du lien";
      const resultat = `[${texte}](https://)`;
      return { texte: resultat, selection: [texte.length + 3, resultat.length - 1] };
    },
  },
  {
    nom: "code", titre: "Bloc de code (ou entourer le texte sélectionné)", libelle: "</> Code",
    transformer: (choisi, milieuDeLigne) => {
      const avant = milieuDeLigne ? "\n" : "";
      return {
        texte: `${avant}\`\`\`\n${choisi}\n\`\`\`\n`,
        selection: [avant.length + 4, avant.length + 4 + choisi.length],
      };
    },
  },
];

export function OutilCode({ zone, valeur, setValeur }) {
  return (
    <div className="outil-code">
      <div className="outil-code__boutons" role="toolbar" aria-label="Mise en forme">
        {OUTILS.map((outil) => (
          <button key={outil.nom} type="button" title={outil.titre} aria-label={outil.titre}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => inserer(zone.current, valeur, setValeur, outil.transformer)}>
            {outil.libelle}
          </button>
        ))}
      </div>
      <small>
        **gras**, *italique*, - liste, [lien](https://…) et ```python pour le code en couleur.
      </small>
    </div>
  );
}
