
import { useEffect, useRef, useState } from "react";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HomePage from "./pages/HomePage";
import AskQuestionPage from "./pages/AskQuestionPage";
import QuestionPage from "./pages/QuestionPage";
import MotDePassePage from "./pages/MotDePassePage";
import ProfilPage from "./pages/ProfilPage";
import AdminPage from "./pages/AdminPage";
import {
  connecter, deconnecter, inscrire, modifierQuestion, publierQuestion, supprimerCapture, televerserCaptures,
  utilisateurConnecte,
} from "./api";

localStorage.removeItem("insta_users");
localStorage.removeItem("insta_questions");

const MENUS = {
  "Accueil": "/",
  "Questions": "/questions",
  "Catégories": "/categories",
  "Mes questions": "/mes-questions",
  "Favoris": "/favoris",
  "Classement": "/classement",
  "Administration": "/admin",
};

const lireAdresse = () => window.location.hash.replace(/^#/, "") || "/";

const aller = (chemin) => {
  window.location.hash = chemin;
};

function analyser(adresse) {
  const [chemin, recherche = ""] = adresse.split("?");
  const parametres = new URLSearchParams(recherche);

  if (chemin === "/connexion") return { page: "connexion" };
  if (chemin === "/inscription") return { page: "inscription" };
  if (chemin === "/poser") return { page: "poser" };
  if (chemin === "/admin") return { page: "admin" };
  if (chemin === "/mot-de-passe-oublie") return { page: "oubli" };

  const lien = chemin.match(/^\/reinitialiser\/([\w-]+)\/([\w-]+)$/);
  if (lien) return { page: "reinitialiser", uid: lien[1], token: lien[2] };

  const detail = chemin.match(/^\/questions\/(\d+)$/);
  if (detail) return {
    page: "question",
    id: Number(detail[1]),
    reponseId: Number(parametres.get("reponse")) || null,
  };

  const profil = chemin.match(/^\/membres\/([^/]+)$/);
  if (profil) return { page: "profil", username: decodeURIComponent(profil[1]) };

  const modification = chemin.match(/^\/questions\/(\d+)\/modifier$/);
  if (modification) return { page: "modifier", id: Number(modification[1]) };

  const menu = Object.keys(MENUS).find((nom) => MENUS[nom] === chemin);
  if (menu) {
    const categorie = Number(parametres.get("categorie")) || null;
    return { page: "accueil", menu, categorie: menu === "Questions" ? categorie : null };
  }

  return { page: "accueil", menu: "Accueil", categorie: null };
}

const TITRES = {
  connexion: "Connexion",
  inscription: "Créer un compte",
  oubli: "Mot de passe oublié",
  reinitialiser: "Nouveau mot de passe",
  poser: "Poser une question",
  modifier: "Modifier la question",
  profil: "Profil",
  question: "Question",
  admin: "Administration",
};

export default function App() {
  const [adresse, setAdresse] = useState(lireAdresse);
  const [currentUser, setCurrentUser] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [messageConnexion, setMessageConnexion] = useState("");
  const derniereVue = useRef("/");

  const route = analyser(adresse);

  useEffect(() => {
    const surChangement = () => {
      setAdresse(lireAdresse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", surChangement);
    return () => window.removeEventListener("hashchange", surChangement);
  }, []);

  useEffect(() => {
    utilisateurConnecte().then((utilisateur) => {
      if (utilisateur) setCurrentUser(utilisateur);
      setChargement(false);
    });
  }, []);

  if (route.page === "accueil") derniereVue.current = adresse;

  const PAGES_PUBLIQUES = ["inscription", "oubli", "reinitialiser"];
  const pageAffichee = currentUser || PAGES_PUBLIQUES.includes(route.page) ? route.page : "connexion";
  useEffect(() => {
    const titre = pageAffichee === "accueil" ? (route.menu === "Accueil" ? "" : route.menu) : TITRES[pageAffichee];
    document.title = titre ? `${titre} — INSTA-FORUM` : "INSTA-FORUM";
  }, [pageAffichee, route.menu]);

  useEffect(() => {
    if (currentUser && ["connexion", "inscription"].includes(route.page)) aller("/");
  }, [currentUser, route.page]);

  const handleRegister = async (data) => {
    await inscrire(data);
    setMessageConnexion("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
    aller("/connexion");
  };

  const handleLogin = async (identifiants) => {
    const utilisateur = await connecter(identifiants);
    setMessageConnexion("");
    setCurrentUser(utilisateur);
  };

  const handleLogout = async () => {
    await deconnecter().catch(() => {});
    setCurrentUser(null);
    derniereVue.current = "/";
    aller("/connexion");
  };

  const handleAddQuestion = async (data, files) => {
    const question = await publierQuestion(data);
    if (files && files.length > 0) {
      await televerserCaptures(question.id, files);
    }
    aller("/");
  };

  if (chargement) return null;

  if (route.page === "oubli" || route.page === "reinitialiser") {
    return (
      <MotDePassePage
        key={route.page}
        uid={route.uid}
        token={route.token}
        onRetour={() => aller(currentUser ? "/" : "/connexion")}
        onNouvelleDemande={() => aller("/mot-de-passe-oublie")}
        onTermine={async (message) => {
          if (currentUser) {
            await deconnecter().catch(() => {});
            setCurrentUser(null);
          }
          setMessageConnexion(message);
          aller("/connexion");
        }}
      />
    );
  }

  if (!currentUser) {
    if (route.page === "inscription") {
      return <SignupPage onSubmit={handleRegister} onGoLogin={() => aller("/connexion")} />;
    }
    return (
      <LoginPage
        message={messageConnexion}
        onLogin={handleLogin}
        onSignup={() => aller("/inscription")}
        onForgotPassword={() => aller("/mot-de-passe-oublie")}
      />
    );
  }

  if (route.page === "question") {
    return (
      <QuestionPage
        key={route.id}
        id={route.id}
        reponseId={route.reponseId}
        user={currentUser}
        onBack={() => aller(derniereVue.current)}
        onEdit={() => aller(`/questions/${route.id}/modifier`)}
        onDeleted={() => aller(derniereVue.current)}
        onResponsePublished={() => aller("/")}
        onLogout={handleLogout}
      />
    );
  }

  if (route.page === "admin") {
    return (
      <AdminPage
        user={currentUser}
        onBack={() => aller("/")}
        onLogout={handleLogout}
      />
    );
  }

  if (route.page === "profil") {
    return (
      <ProfilPage
        username={route.username}
        user={currentUser}
        onUserUpdate={setCurrentUser}
        onBack={() => window.history.length > 1 ? window.history.back() : aller(derniereVue.current)}
        onLogout={handleLogout}
      />
    );
  }

  if (route.page === "poser") {
    return <AskQuestionPage onSubmit={handleAddQuestion} onBack={() => aller(derniereVue.current)} />;
  }

  if (route.page === "modifier") {
    return (
      <AskQuestionPage
        key={route.id}
        questionId={route.id}
        user={currentUser}
        onSubmit={async (data, files, retirees = []) => {
          await modifierQuestion(route.id, data);
          await Promise.all(retirees.map((id) => supprimerCapture(id)));
          if (files && files.length > 0) {
            await televerserCaptures(route.id, files);
          }
          aller(`/questions/${route.id}`);
        }}
        onBack={() => aller(`/questions/${route.id}`)}
      />
    );
  }

  return (
    <HomePage
      user={currentUser}
      vue={route}
      onChangerVue={({ menu, categorie }) =>
        aller(MENUS[menu] + (menu === "Questions" && categorie ? `?categorie=${categorie}` : ""))
      }
      onLogout={handleLogout}
      onAskQuestion={() => aller("/poser")}
      onOpenQuestion={(id) => aller(`/questions/${id}`)}
    />
  );
}
