
import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const form = document.getElementById("ownerRegisterForm");
const message = document.getElementById("message");
const button = document.getElementById("registerButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("ownerName").value.trim();
  const businessName = document.getElementById("businessName").value.trim();
  const phone = document.getElementById("ownerPhone").value.trim();
  const email = document.getElementById("ownerEmail").value.trim();
  const password = document.getElementById("ownerPassword").value;
  const confirmation = document.getElementById("ownerPasswordConfirm").value;

  if (password !== confirmation) {
    message.textContent = "Les deux mots de passe ne correspondent pas.";
    return;
  }

  if (password.length < 8) {
    message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
    return;
  }

  button.disabled = true;
  button.textContent = "Création du compte...";
  message.textContent = "Veuillez patienter...";

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = credential.user.uid;

    await setDoc(doc(db, "users", uid), {
      uid: uid,
      name: name,
      businessName: businessName,
      phone: phone,
      role: "owner",
      status: "active",
      trialStart: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    message.textContent = "Compte créé ! Ouverture de votre espace...";
    window.location.href = "owner-dashboard.html";

  } catch (error) {
    console.error(error);

    const messages = {
      "auth/email-already-in-use": "Cette adresse e-mail possède déjà un compte.",
      "auth/invalid-email": "Adresse e-mail invalide.",
      "auth/weak-password": "Mot de passe trop faible.",
      "permission-denied": "Accès refusé par Firebase. Vérifiez les règles Firestore."
    };

    message.textContent =
      messages[error.code] || "Une erreur est survenue. Réessayez.";
  } finally {
    button.disabled = false;
    button.textContent = "Créer mon compte propriétaire";
  }
});
