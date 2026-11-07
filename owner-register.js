import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  reload,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
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

function showMessage(text) {
  message.textContent = text;
}

function getPendingKey(uid) {
  return "ticketwifi_pending_owner_" + uid;
}

function savePendingData(uid, data) {
  localStorage.setItem(getPendingKey(uid), JSON.stringify(data));
}

function showResendButton(user) {
  let resendButton = document.getElementById("resendVerificationButton");

  if (resendButton) return;

  resendButton = document.createElement("button");
  resendButton.id = "resendVerificationButton";
  resendButton.type = "button";
  resendButton.textContent = "Renvoyer le lien de vérification";

  resendButton.style.marginTop = "12px";
  resendButton.style.padding = "12px";
  resendButton.style.cursor = "pointer";

  message.insertAdjacentElement("afterend", resendButton);

  resendButton.addEventListener("click", async () => {
    resendButton.disabled = true;
    resendButton.textContent = "Envoi en cours...";

    try {
      await sendEmailVerification(user, actionCodeSettings);
      showMessage("Un nouveau lien de vérification vient d'être envoyé.");
      resendButton.textContent = "Lien envoyé";
    } catch (error) {
      console.error("Erreur e-mail :", error);
      showMessage("Échec de l'envoi. Code : " + (error.code || error.message));
      resendButton.disabled = false;
      resendButton.textContent = "Réessayer";
    }
  });
}

async function completeOwnerProfile(user) {
  await reload(user);
  await user.getIdToken(true);

  if (!user.emailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const profileRef = doc(db, "users", user.uid);
  const existingProfile = await getDoc(profileRef);

  if (existingProfile.exists()) {
    const profileData = existingProfile.data();

    if (
      profileData.role === "owner" &&
      profileData.status === "active"
    ) {
      localStorage.removeItem(getPendingKey(user.uid));
      window.location.replace("owner-dashboard.html");
      return;
    }

    throw new Error("PROFILE_ALREADY_EXISTS");
  }

  const saved = localStorage.getItem(getPendingKey(user.uid));

  if (!saved) {
    throw new Error("INSCRIPTION_DATA_MISSING");
  }

  const data = JSON.parse(saved);

  await setDoc(profileRef, {
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

  localStorage.removeItem(getPendingKey(user.uid));

  showMessage("Compte propriétaire activé avec succès !");
  window.location.replace("owner-dashboard.html");
}

// Retour après vérification de l'e-mail
onAuthStateChanged(auth, async (user) => {
  const verified = new URLSearchParams(window.location.search).get("verified");

  if (!user || verified !== "1" || processing) return;

  processing = true;
  button.disabled = true;
  showMessage("Vérification de votre adresse e-mail...");

  try {
    await completeOwnerProfile(user);
  } catch (error) {
    console.error("Erreur de finalisation :", error);

    const errors = {
      EMAIL_NOT_VERIFIED: "Votre adresse e-mail n'est pas encore vérifiée.",
      INSCRIPTION_DATA_MISSING: "Informations d'inscription introuvables sur ce navigateur.",
      PROFILE_ALREADY_EXISTS: "Un profil existe déjà pour ce compte. Contactez le support."
    };

    showMessage(errors[error.message] || "Erreur Firestore : " + (error.code || error.message));
  } finally {
    processing = false;
    button.disabled = false;
  }
});

// Inscription ou récupération d'un compte existant
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (processing) return;

  const name = document.getElementById("ownerName").value.trim();
  const city = document.getElementById("ownerCity").value.trim();
  const email = document.getElementById("ownerEmail").value.trim();
  const phoneNumber = document.getElementById("ownerPhone").value.trim();
  const countryCode = document.getElementById("phoneCountry").value;
  const businessName = document.getElementById("businessName").value.trim();
  const password = document.getElementById("ownerPassword").value;
  const confirmation = document.getElementById("ownerPasswordConfirm").value;
  const accepted = document.getElementById("acceptTerms").checked;

  const phone = phoneNumber
    ? countryCode + phoneNumber.replace(/[\s-]/g, "")
    : "";

  if (!name || !city || !email || !businessName) {
    showMessage("Veuillez remplir tous les champs obligatoires.");
    return;
  }

  if (!accepted) {
    showMessage("Veuillez accepter les conditions générales.");
    return;
  }

  if (password.length < 8) {
    showMessage("Le mot de passe doit contenir au moins 8 caractères.");
    return;
  }

  if (password !== confirmation) {
    showMessage("Les mots de passe ne correspondent pas.");
    return;
  }

  const data = { name, city, businessName, phone };

  processing = true;
  button.disabled = true;
  button.textContent = "Traitement...";
  showMessage("Création ou récupération du compte...");

  try {
    let user;

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      user = credential.user;

    } catch (error) {
      if (error.code !== "auth/email-already-in-use") {
        throw error;
      }

      // Récupération du compte Firebase déjà existant
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      user = credential.user;
    }

    savePendingData(user.uid, data);

    await reload(user);

    if (user.emailVerified) {
      await completeOwnerProfile(user);
      return;
    }

    await sendEmailVerification(user, actionCodeSettings);

    form.classList.add("hidden");
    showMessage(
      "Un lien de vérification a été envoyé. Ouvrez-le sur le même navigateur pour activer votre compte."
    );

    showResendButton(user);

  } catch (error) {
    console.error("Erreur inscription :", error);

    showMessage(
      "Erreur : " + (error.code || error.message) +
      ". Vérifiez les paramètres Firebase."
    );

    const currentUser = auth.currentUser;

    if (currentUser && !currentUser.emailVerified) {
      showResendButton(currentUser);
    }

  } finally {
    processing = false;
    button.disabled = false;
    button.textContent = "S'inscrire";
  }
});
