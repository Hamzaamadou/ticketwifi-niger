import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const form = document.getElementById("ownerLoginForm");
const message = document.getElementById("loginMessage");
const button = document.getElementById("loginButton");

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

    const user = result.user;

    if (!user.emailVerified) {
      await signOut(auth);
      message.textContent =
        "Veuillez vérifier votre adresse e-mail avant de vous connecter.";
      return;
    }

    const profileRef = doc(db, "users", user.uid);
    const profile = await getDoc(profileRef);

    if (!profile.exists()) {
      await signOut(auth);
      message.textContent =
        "Profil propriétaire absent. Votre inscription doit être finalisée.";
      return;
    }

    const data = profile.data();

    if (data.role !== "owner" || data.status !== "active") {
      await signOut(auth);
      message.textContent =
        "Ce compte n'est pas un compte propriétaire actif.";
      return;
    }

    message.textContent = "Connexion réussie !";
    window.location.replace("owner-dashboard.html");

  } catch (error) {
    console.error("Erreur de connexion :", error);

    message.textContent =
      "Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.";
  } finally {
    button.disabled = false;
    button.textContent = "Se connecter";
  }
});
