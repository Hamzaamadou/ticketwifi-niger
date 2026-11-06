
import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentOwner = null;
let trialActive = false;

function message(text) {
  $("dashboardMessage").textContent = text;
}

function showLogin() {
  $("dashboardMessage").innerHTML = `
    <h2>Connexion propriétaire</h2>
    <form id="ownerLoginForm">
      <input id="loginEmail" type="email"
        placeholder="Adresse e-mail" required>
      <input id="loginPassword" type="password"
        placeholder="Mot de passe" required>
      <button class="btn-primary" type="submit">
        Se connecter
      </button>
    </form>
    <p>Pas encore de compte ?
      <a href="owner-register.html">Créer un compte</a>
    </p>
  `;

  $("ownerLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await signInWithEmailAndPassword(
        auth,
        $("loginEmail").value.trim(),
        $("loginPassword").value
      );
      message("Connexion réussie.");
    } catch (error) {
      console.error(error);
      message("Connexion impossible. Vérifiez vos identifiants.");
    }
  });
}

async function loadDashboard(user) {
  try {
    const profile = await getDoc(doc(db, "users", user.uid));

    if (!profile.exists()) {
      message("Profil propriétaire introuvable.");
      return;
    }

    const data = profile.data();

    if (data.role !== "owner" || data.status !== "active") {
      message("Ce compte n'est pas un compte propriétaire actif.");
      return;
    }

    currentOwner = user;
    $("ownerName").textContent = data.name || "Propriétaire";
    $("businessName").textContent = data.businessName || "";

    if (!data.trialStart || !data.trialStart.toDate) {
      trialActive = false;
      $("trialStatus").textContent =
        "Impossible de vérifier votre période d'essai.";
      $("daysRemaining").textContent = "À vérifier";
      return;
    }

    const start = data.trialStart.toDate();
    const end = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
    const remaining = Math.max(
      0,
      Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );

    trialActive = Date.now() < end.getTime();

    $("daysRemaining").textContent = remaining + " jour(s)";

    if (trialActive) {
      $("trialStatus").textContent =
        "Votre essai gratuit est actif jusqu'au " +
        end.toLocaleDateString("fr-FR") + ".";
    } else {
      $("trialStatus").textContent =
        "Votre essai gratuit est terminé. Les ajouts sont suspendus.";
      $("trialStatus").classList.add("danger");
    }

    await loadZones();
    await loadOffers();

  } catch (error) {
    console.error(error);
    message("Erreur lors du chargement de votre espace.");
  }
}

async function loadZones() {
  const list = $("myZones");
  const select = $("offerZone");

  list.textContent = "Chargement...";
  select.innerHTML = '<option value="">Choisir une zone</option>';

  const q = query(
    collection(db, "zones"),
    where("ownerId", "==", currentOwner.uid)
  );

  const snapshot = await getDocs(q);

  $("zoneCount").textContent = snapshot.size;

  if (snapshot.empty) {
    list.textContent = "Vous n'avez pas encore de zone.";
    return;
  }

  list.innerHTML = "";

  snapshot.forEach((item) => {
    const zone = item.data();

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = zone.name || "Zone Wi-Fi";

    const city = document.createElement("p");
    city.textContent = zone.city || "";

    const address = document.createElement("p");
    address.textContent = zone.address || "";

    card.append(title, city, address);
    list.appendChild(card);

    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = zone.name || "Zone Wi-Fi";
    select.appendChild(option);
  });
}

async function loadOffers() {
  const list = $("myOffers");
  list.textContent = "Chargement...";

  const q = query(
    collection(db, "offers"),
    where("ownerId", "==", currentOwner.uid)
  );

  const snapshot = await getDocs(q);

  $("offerCount").textContent = snapshot.size;

  if (snapshot.empty) {
    list.textContent = "Vous n'avez pas encore de forfait.";
    return;
  }

  list.innerHTML = "";

  snapshot.forEach((item) => {
    const offer = item.data();

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = offer.name || "Forfait";

    const price = document.createElement("p");
    price.textContent = (offer.price || 0) + " FCFA";

    const duration = document.createElement("p");
    duration.textContent =
      "Durée : " + (offer.durationMinutes || 0) + " minutes";

    card.append(title, price, duration);
    list.appendChild(card);
  });
}

$("zoneForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentOwner || !trialActive) {
    message("Votre essai est terminé ou votre compte n'est pas connecté.");
    return;
  }

  try {
    await addDoc(collection(db, "zones"), {
      ownerId: currentOwner.uid,
      name: $("zoneName").value.trim(),
      city: $("zoneCity").value.trim(),
      address: $("zoneAddress").value.trim(),
      description: $("zoneDescription").value.trim(),
      status: "active",
      createdAt: serverTimestamp()
    });

    event.target.reset();
    message("Votre zone Wi-Fi a été ajoutée.");
    await loadZones();

  } catch (error) {
    console.error(error);
    message("Impossible d'ajouter la zone. Vérifiez les règles Firebase.");
  }
});

$("offerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentOwner || !trialActive) {
    message("Votre essai est terminé ou votre compte n'est pas connecté.");
    return;
  }

  const price = Number($("offerPrice").value);
  const duration = Number($("offerDuration").value);
  const zoneId = $("offerZone").value;

  if (price <= 0 || duration <= 0 || !zoneId) {
    message("Vérifiez le prix, la durée et la zone choisie.");
    return;
  }

  try {
    const zoneDoc = await getDoc(doc(db, "zones", zoneId));

    if (!zoneDoc.exists() ||
        zoneDoc.data().ownerId !== currentOwner.uid) {
      message("Cette zone ne vous appartient pas.");
      return;
    }

    await addDoc(collection(db, "offers"), {
      ownerId: currentOwner.uid,
      zoneId: zoneId,
      name: $("offerName").value.trim(),
      price: price,
      durationMinutes: duration,
      description: $("offerDescription").value.trim(),
      status: "active",
      createdAt: serverTimestamp()
    });

    event.target.reset();
    message("Votre forfait a été créé.");
    await loadOffers();

  } catch (error) {
    console.error(error);
    message("Impossible de créer le forfait. Vérifiez les règles Firebase.");
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentOwner = null;
    showLogin();
    return;
  }

  loadDashboard(user);
});
