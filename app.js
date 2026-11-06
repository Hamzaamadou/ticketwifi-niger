
import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const zonesList = document.getElementById("zonesList");
const offersList = document.getElementById("offersList");
const adminSection = document.getElementById("adminSection");
const loginModal = document.getElementById("loginModal");
const loginMessage = document.getElementById("loginMessage");

let currentAdmin = false;

function showMessage(element, message) {
  element.textContent = message;
}

async function loadZones() {
  zonesList.innerHTML = "<p>Chargement des zones...</p>";

  try {
    const q = query(
      collection(db, "zones"),
      where("status", "==", "active")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      zonesList.innerHTML = "<p>Aucune zone Wi-Fi disponible pour le moment.</p>";
      return;
    }

    zonesList.innerHTML = "";

    snapshot.forEach((doc) => {
      const zone = doc.data();
      const card = document.createElement("article");
      card.className = "card";

      const title = document.createElement("h3");
      title.textContent = zone.name || "Zone Wi-Fi";

      const city = document.createElement("p");
      city.textContent = zone.city || "";

      const description = document.createElement("p");
      description.textContent = zone.description || "";

      card.append(title, city, description);
      zonesList.appendChild(card);
    });
  } catch (error) {
    zonesList.innerHTML = "<p>Impossible de charger les zones.</p>";
    console.error(error);
  }
}

async function loadOffers() {
  offersList.innerHTML = "<p>Chargement des forfaits...</p>";

  try {
    const q = query(
      collection(db, "offers"),
      where("status", "==", "active")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      offersList.innerHTML = "<p>Aucun forfait disponible pour le moment.</p>";
      return;
    }

    offersList.innerHTML = "";

    snapshot.forEach((doc) => {
      const offer = doc.data();
      const card = document.createElement("article");
      card.className = "card";

      const title = document.createElement("h3");
      title.textContent = offer.name || "Forfait Wi-Fi";

      const price = document.createElement("p");
      price.textContent = `${offer.price || 0} FCFA`;

      const duration = document.createElement("p");
      duration.textContent = `Durée : ${offer.durationMinutes || 0} minutes`;

      const description = document.createElement("p");
      description.textContent = offer.description || "";

      card.append(title, price, duration, description);
      offersList.appendChild(card);
    });
  } catch (error) {
    offersList.innerHTML = "<p>Impossible de charger les forfaits.</p>";
    console.error(error);
  }
}

document.getElementById("loginBtn").addEventListener("click", () => {
  loginModal.classList.remove("hidden");
});

document.getElementById("closeModal").addEventListener("click", () => {
  loginModal.classList.add("hidden");
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showMessage(loginMessage, "Connexion en cours...");

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    const response = await fetchUserRole(credential.user.uid);

    if (!response) {
      await signOut(auth);
      showMessage(loginMessage, "Ce compte n'est pas autorisé comme administrateur.");
      return;
    }

    loginModal.classList.add("hidden");
    loginMessage.textContent = "";
  } catch (error) {
    console.error(error);
    showMessage(loginMessage, "Connexion impossible. Vérifie tes identifiants.");
  }
});

async function fetchUserRole(uid) {
  try {
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
    );

    const userDocument = await getDoc(doc(db, "users", uid));

    return userDocument.exists()
      && userDocument.data().role === "admin"
      && userDocument.data().status === "active";
  } catch (error) {
    console.error(error);
    return false;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdmin = false;
    adminSection.classList.add("hidden");
    return;
  }

  currentAdmin = await fetchUserRole(user.uid);

  if (currentAdmin) {
    adminSection.classList.remove("hidden");
  } else {
    adminSection.classList.add("hidden");
  }
});

document.getElementById("zoneForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentAdmin) return;

  try {
    await addDoc(collection(db, "zones"), {
      name: document.getElementById("zoneName").value.trim(),
      city: document.getElementById("zoneCity").value.trim(),
      description: document.getElementById("zoneDescription").value.trim(),
      status: "active",
      createdAt: serverTimestamp()
    });

    event.target.reset();
    alert("Zone ajoutée avec succès !");
    await loadZones();
  } catch (error) {
    console.error(error);
    alert("Impossible d'ajouter la zone.");
  }
});

document.getElementById("offerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentAdmin) return;

  const price = Number(document.getElementById("offerPrice").value);
  const duration = Number(document.getElementById("offerDuration").value);

  if (price <= 0 || duration <= 0) {
    alert("Le prix et la durée doivent être supérieurs à zéro.");
    return;
  }

  try {
    await addDoc(collection(db, "offers"), {
      name: document.getElementById("offerName").value.trim(),
      price: price,
      durationMinutes: duration,
      description: document.getElementById("offerDescription").value.trim(),
      status: "active",
      createdAt: serverTimestamp()
    });

    event.target.reset();
    alert("Forfait ajouté avec succès !");
    await loadOffers();
  } catch (error) {
    console.error(error);
    alert("Impossible d'ajouter le forfait.");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
});

loadZones();
loadOffers();
