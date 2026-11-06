
import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const form = document.getElementById("ownerLoginForm");
const message = document.getElementById("loginMessage");
const button = document.getElementById("loginButton");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const profile = await getDoc(doc(db, "users", user.uid));

    if (
      profile.exists() &&
      profile.data().role === "owner" &&
      profile.data().status === "active"
    ) {
      window.location.replace("owner-dashboard.html");
    } else {
      await signOut(auth);
      message.textContent = "Ce compte n'est pas un compte propriétaire actif.";
    }
  } catch (error) {
    console.error(error);
    message.textContent = "Impossible de vérifier votre compte.";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("ownerEmail").value.trim();
  const password = document.getElementById("ownerPassword").value;

  button.disabled = true;
  button.textContent = "Connexion...";
  message.textContent = "Vérification en cours...";

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const profile = await getDoc(doc(db, "users", result.user.uid));

    if (
      !profile.exists() ||
      profile.data().role !== "owner" ||
      profile.data().status !== "active"
    ) {
      await signOut(auth);
      message.textContent = "Compte propriétaire introuvable ou désactivé.";
      return;
    }

    message.textContent = "Connexion réussie !";
    window.location.href = "owner-dashboard.html";

  } catch (error) {
    console.error(error);

    message.textContent =
      "Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.";
  } finally {
    button.disabled = false;
    button.textContent = "Se connecter";
  }
});
