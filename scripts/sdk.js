import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
	getFirestore,
	doc,
	getDoc,
	setDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

export let app = null;
export let firebaseConfig = null;
export let db = null;

function isValidFirebaseConfig(cfg) {
	if (!cfg || typeof cfg !== "object") return false;
	const required = ["apiKey", "authDomain", "projectId", "appId"];
	return required.every(
		(k) => typeof cfg[k] === "string" && cfg[k].length > 0,
	);
}

try {
	const response = await fetch("sdk.json", { cache: "no-store" });
	if (!response.ok) {
		throw new Error(
			`Failed to load sdk.json: ${response.status} ${response.statusText}`,
		);
	}

	const cfg = await response.json();
	if (!isValidFirebaseConfig(cfg)) {
		throw new Error("Invalid firebase config in sdk.json");
	}

	firebaseConfig = Object.freeze(cfg);
	app = initializeApp(firebaseConfig);
	db = getFirestore(app);

	if (window.__EXPOSE_FIREBASE_GLOBALS__ === true) {
		Object.defineProperty(window, "firebaseConfig", {
			value: firebaseConfig,
			writable: false,
		});
	}
	console.log("Firebase initialized");
} catch (err) {
	console.error(
		"SDK initialization failed:",
		err && err.message ? err.message : err,
	);
}

export async function loadUserData(user) {
	const userRef = doc(db, "users", user.uid);

	try {
		const userSnap = await getDoc(userRef);

		if (userSnap.exists()) {
			return userSnap.data();
		} else {
			console.log("New user detected. Creating profile...");
			const defaultData = {
				username: user.displayName,
				projects: {},
			};
			await setDoc(userRef, defaultData);
			return defaultData;
		}
	} catch (error) {
		console.error("Error accessing Firestore:", error);
	}
}
