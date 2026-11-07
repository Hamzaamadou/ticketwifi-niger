import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  reload
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const form = document.getElementById("ownerRegisterForm");
const message = document.getElementById("message");
const button = document.getElementById("registerButton");

let processing = false;

const actionCodeSettings = {
  url: window.location.origin + "/owner-register.html?verified=1"
};

// Après le clic sur le lien reçu par e-mail
onAuthStateChanged(auth, async (user) => {
  if (
    !user ||
    new URLSearchParams(window.location.search).get("verified") !== "1" ||
    processing
  ) return;

  processing = true;
  message.textContent = "Vérification de votre adresse e-mail...";

  try {
    await reload(user);
    await user.getIdToken(true);

    if (!user.emailVerified) {
      message.textContent =
        "Votre adresse e-mail n'est pas encore vérifiée. Cliquez sur le lien reçu.";
      processing = false;
      return;
    }

    const saved = localStorage.getItem("ticketwifi_pending_owner_" + user.uid);

    if (!saved) {
      message.textContent =
        "Informations d'inscription introuvables. Contactez l'administrateur.";
      processing = false;
      return;
    }

    const data = JSON.parse(saved);

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: data.name,
      businessName: data.businessName,
      phone: data.phone,
      role: "owner",
      status: "active",
      trialStart: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    localStorage.removeItem("ticketwifi_pending_owner_" + user.uid);

    message.textContent = "Compte vérifié ! Ouverture de votre espace...";
    window.location.replace("owner-dashboard.html");

  } catch (error) {
    console.error(error);
    message.textContent =
      "Erreur lors de la création du compte. Réessayez ou contactez l'administrateur.";
    processing = false;
  }
});

// Inscription
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("ownerName").value.trim();
  const businessName = document.getElementById("businessName").value.trim();
  const phone = document.getElementById("ownerPhone").value.trim();
  const email = document.getElementById("ownerEmail").value.trim();
  const password = document.getElementById("ownerPassword").value;
  const confirmation = document.getElementById("ownerPasswordConfirm").value;

  if (password !== confirmation) {
    message.textContent = "Les mots de passe ne correspondent pas.";
    return;
  }

  if (password.length < 8) {
    message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
    return;
  }

  button.disabled = true;
  button.textContent = "Envoi du lien...";
  message.textContent = "Création de votre compte...";

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;

    localStorage.setItem(
      "ticketwifi_pending_owner_" + user.uid,
      JSON.stringify({ name, businessName, phone })
    );

    await sendEmailVerification(user, actionCodeSettings);

    message.textContent =
      "Un lien de vérification vient d'être envoyé à votre adresse e-mail. Ouvrez-le sur ce même téléphone et dans ce même navigateur pour terminer l'inscription.";

    form.classList.add("hidden");

  } catch (error) {
    console.error(error);

    message.textContent =
      error.code === "auth/email-already-in-use"
        ? "Cette adresse possède déjà un compte. Connectez-vous ou récupérez votre accès."
        : "Impossible d'envoyer le lien. Vérifiez votre adresse e-mail et réessayez.";

  } finally {
    button.disabled = false;
    button.textContent = "Créer mon compte propriétaire";
  }
});
