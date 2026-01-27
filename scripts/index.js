import { app, db, loadUserData } from "./sdk.js";
import { placeholders } from "./placeholders.js";
import {
	getAuth,
	signInWithPopup,
	GoogleAuthProvider,
	onAuthStateChanged,
	signOut,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
	doc,
	updateDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const updateHomePage = async (user) => {
	const loginBtn = document.getElementById("btn-login");
	const usernameEl = document.getElementById("username");
	const fileContainer = document.getElementById("files");

	if (user) {
		usernameEl.innerHTML = user.displayName;
		loginBtn.innerHTML =
			'<i class="fa-solid fa-arrow-right-from-bracket"></i> Sign out';
		loginBtn.addEventListener("click", logout);

		const data = await loadUserData(user);
		console.log(data);
		if (data && Object.entries(data.projects).length) {
			fileContainer.innerHTML = "";

			Object.keys(data.projects).forEach((file) => {
				const parent = document.createElement("div");
				parent.className = "file-blob";

				const icon = document.createElement("i");
				icon.className = "fa-solid fa-file-code";
				parent.appendChild(icon);

				const fileLink = document.createElement("a");
				fileLink.innerText = file;
				fileLink.href = `compiler.html?project=${file}`;
				parent.appendChild(fileLink);

				fileContainer.appendChild(parent);
			});
		} else {
			fileContainer.innerHTML = "There are no projects.";
		}
	} else {
		usernameEl.innerHTML = "";
		document.getElementById("btn-login").innerHTML =
			'<i class="fa-brands fa-google"></i> Login';
		loginBtn.addEventListener("click", loginWithGoogle);
		fileContainer.innerHTML =
			"You must be signed in to view your projects!";
	}
};

onAuthStateChanged(auth, async (user) => {
	const loginBtn = document.getElementById("btn-login");
	if (!loginBtn) return;

	loginBtn.removeEventListener("click", loginWithGoogle);
	loginBtn.removeEventListener("click", logout);
	await updateHomePage(user);
});

export const loginWithGoogle = async () => {
	try {
		const result = await signInWithPopup(auth, provider);
		const user = result.user;
		console.log("Successfully logged in:", user);
	} catch (error) {
		console.error("Login failed:", error.message);
	}
};

export const logout = () => signOut(auth);

const modal = document.getElementById("dl-project-name");
const openBtn = document.getElementById("btn-create-project");
const closeBtn = document.getElementById("btn-close-modal");
const confirmBtn = document.getElementById("btn-confirm-project");
const input = document.getElementById("inp-project-name");

openBtn?.addEventListener("click", () => {
	input.placeholder =
		placeholders[Math.floor(Math.random() * placeholders.length)];
	modal.showModal();
});

closeBtn.addEventListener("click", () => {
	modal.close();
	input.value = "";
});

confirmBtn.addEventListener("click", async () => {
	const name = input.value.trim();
	if (name) {
		console.log("Initializing project:", name);
		modal.close();
		input.value = "";

		const userRef = doc(db, "users", auth.currentUser.uid);
		const sanitizedName = name.replace(/\./g, "_");

		try {
			await updateDoc(userRef, {
				[`projects.${sanitizedName}`]: {
					files: {
						"main_xs": "// TODO: write code",
					},
				},
			});
			console.log(`File ${name} saved successfully!`);
		} catch (error) {
			console.error("Error updating files:", error);
		}

		const encodedName = encodeURIComponent(name);
		window.location.href = `compiler.html?project=${encodedName}&file=main.xs`;
	}
});

modal.addEventListener("click", (e) => {
	const dialogDimensions = modal.getBoundingClientRect();
	if (
		e.clientX < dialogDimensions.left ||
		e.clientX > dialogDimensions.right ||
		e.clientY < dialogDimensions.top ||
		e.clientY > dialogDimensions.bottom
	) {
		modal.close();
	}
});

updateHomePage();
