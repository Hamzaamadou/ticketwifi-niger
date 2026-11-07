import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  reload,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const form = document.getElementById("ownerRegisterForm");
const message = document.getElementById("message");
const button = document.getElementById("registerButton");

let processing = false;

const actionCodeSettings = {
  url: window.location.origin + "/owner-register.html?verified=1"
};

// Vérification après retour du lien e-mail
onAuthStateChanged(auth, async (user) => {
  const verified =
    new URLSearchParams(window.location.search).get("verified");

  if (!user || verified !== "1" || processing) return;

  processing = true;
  button.disabled = true;
  message.textContent = "Vérification de votre adresse e-mail...";

  try {
    await reload(user);
    await user.getIdToken(true);

    if (!user.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    const storageKey = "ticketwifi_pending_owner_" + user.uid;
    const saved = localStorage.getItem(storageKey);

    if (!saved) {
      throw new Error("INSCRIPTION_DATA_MISSING");
    }

    const data = JSON.parse(saved);

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: data.name,
      city: data.city,
      businessName: data.businessName,
      phone: data.phone,
      role: "owner",
      status: "active",
      trialStart: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    localStorage.removeItem(storageKey);

    message.textContent =
      "Votre compte est vérifié ! Bienvenue sur TicketWifi Niger.";

    window.location.replace("owner-dashboard.html");

  } catch (error) {
    console.error(error);

    const messages = {
      EMAIL_NOT_VERIFIED:
        "Votre adresse e-mail n'est pas encore vérifiée.",
      INSCRIPTION_DATA_MISSING:
        "Informations d'inscription introuvables. Contactez le support."
    };

    message.textContent =
      messages[error.message] ||
      "Une erreur est survenue. Vérifiez votre connexion et réessayez.";

    processing = false;
    button.disabled = false;
  }
});

// Création du compte
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (processing) return;

  const name =
    document.getElementById("ownerName").value.trim();

  const city =
    document.getElementById("ownerCity").value.trim();

  const email =
    document.getElementById("ownerEmail").value.trim();

  const phoneNumber =
    document.getElementById("ownerPhone").value.trim();

  const countryCode =
    document.getElementById("phoneCountry").value;

  const phone = phoneNumber
    ? countryCode + phoneNumber.replace(/[\s-]/g, "")
    : "";

  const businessName =
    document.getElementById("businessName").value.trim();

  const password =
    document.getElementById("ownerPassword").value;

  const confirmation =
    document.getElementById("ownerPasswordConfirm").value;

  const accepted =
    document.getElementById("acceptTerms").checked;

  if (!accepted) {
    message.textContent =
      "Veuillez accepter les conditions générales.";
    return;
  }

  if (password.length < 8) {
    message.textContent =
      "Le mot de passe doit contenir au moins 8 caractères.";
    return;
  }

  if (password !== confirmation) {
    message.textContent =
      "Les mots de passe ne correspondent pas.";
    return;
  }

  if (!name || !city || !email || !businessName) {
    message.textContent =
      "Veuillez remplir tous les champs obligatoires.";
    return;
  }

  processing = true;
  button.disabled = true;
  button.textContent = "Création du compte...";
  message.textContent = "Veuillez patienter...";

  let userCreated = false;

  try {
    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = credential.user;
    userCreated = true;

    const data = {
      name,
      city,
      businessName,
      phone
    };

    localStorage.setItem(
      "ticketwifi_pending_owner_" + user.uid,
      JSON.stringify(data)
    );

    await sendEmailVerification(
      user,
      actionCodeSettings
    );

    form.classList.add("hidden");

    message.textContent =
      "Un lien de vérification a été envoyé à votre adresse e-mail. Ouvrez ce lien sur le même téléphone et le même navigateur pour activer votre compte.";

  } catch (error) {
    console.error(error);

    if (userCreated) {
      message.textContent =
        "Compte créé, mais l'envoi du lien a échoué. Contactez le support avant de recommencer.";
    } else {
      message.textContent =
        error.code === "auth/email-already-in-use"
          ? "Cette adresse e-mail possède déjà un compte."
          : error.code === "auth/weak-password"
          ? "Choisissez un mot de passe plus sécurisé."
          : "Erreur lors de l'inscription. Vérifiez votre connexion.";
    }

    processing = false;
    button.disabled = false;
    button.textContent = "S'inscrire";
  }
});
