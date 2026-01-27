import { app, db, loadUserData } from "./sdk.js";
import {
	doc,
	updateDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import {
	getAuth,
	onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

function debounce(func, timeout = 1000) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			func.apply(this, args);
		}, timeout);
	};
}

const saveContent = debounce(async (content) => {
	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");
	const fname = urlParams.get("file").replace(/\./g, "_");

	if (!pname || !fname || !auth.currentUser) return;

	const userRef = doc(db, "users", auth.currentUser.uid);
	const sanitizedProjectName = pname.replace(/\./g, "_");

	try {
		await updateDoc(userRef, {
			[`projects.${sanitizedProjectName}.files.${fname}`]: content,
		});
		showSaveStatus("Saved");
	} catch (error) {
		console.error("Auto-save failed:", error);
		showSaveStatus("Error");
	}
}, 1500);

const auth = getAuth(app);
const fileList = document.getElementById("files-list");
const codeSpace = document.querySelector("#codespace");
const createFileBtn = document.querySelector("#file-nav button");

export async function loadFiles(user) {
	const data = await loadUserData(user);
	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");
	const fn = urlParams.get("file");
	const terminalOutput = document.getElementById("terminal-output");

	if (data && Object.entries(data.projects[pname].files)) {
		fileList.innerHTML = "";
		Object.entries(data.projects[pname].files).forEach((file) => {
			const li = document.createElement("li");
			li.className = "file-blob";

			const icon = document.createElement("i");
			icon.className = "fa-solid fa-file-code";
			li.appendChild(icon);

			const fn = file[0].replace(/\_/g, ".");

			const fileLink = document.createElement("a");
			fileLink.innerText = fn;
			fileLink.href = `compiler.html?project=${pname}&file=${fn}`;
			li.appendChild(fileLink);
			fileList.appendChild(li);
		});
	}

	if (data && fn) {
		codeSpace.innerText =
			data.projects[pname].files[fn.replace(/\./g, "_")];
		codeSpace.contentEditable = true;
	} else {
		codeSpace.contentEditable = false;
	}

	terminalOutput.innerHTML =
		localStorage.getItem("terminal-msg") ||
		'<span class="system-msg">Xenon OS Compiler [Version 1.0.4]</span> <span class="system-msg">Ready for compilation...</span>';
}

onAuthStateChanged(auth, loadFiles);

createFileBtn.addEventListener("click", () => {
	if (document.getElementById("temp-file-input")) return;

	const li = document.createElement("li");
	li.className = "naming-session";

	const icon = document.createElement("i");
	icon.className = "fa-solid fa-file-code";

	const input = document.createElement("input");
	input.type = "text";
	input.id = "temp-file-input";
	input.placeholder = "filename.xs";

	li.appendChild(icon);
	li.appendChild(input);
	fileList.appendChild(li);

	input.focus();

	input.addEventListener("keydown", async (e) => {
		if (e.key === "Enter") {
			const fileName = input.value.trim();

			if (!fileName) {
				alert("File name cannot be empty.");
				return;
			}

			const illegalChars = /[_<>:"/\\|?*\x00-\x1F]/;
			if (illegalChars.test(fileName)) {
				alert("File name contains illegal characters.");
				return;
			}

			const fileFormat = /.+\..+/;
			if (!fileFormat.test(fileName)) {
				alert("Incorrect format!");
				return;
			}

			const existingFiles = Array.from(
				document.querySelectorAll(".file-blob a"),
			).map((a) => a.innerText.toLowerCase());
			if (existingFiles.includes(fileName.toLowerCase())) {
				alert("A file with this name already exists.");
				return;
			}

			// If all checks pass:
			await finalizeFileCreation(fileName, li);
		} else if (e.key === "Escape") {
			li.remove();
		}
	});
});

async function finalizeFileCreation(name, element) {
	console.log("Saving new file to Firestore:", name);

	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");

	if (!pname || !auth.currentUser) {
		console.error("Missing project name or user session");
		return;
	}

	const userRef = doc(db, "users", auth.currentUser.uid);
	const sanitizedProjectName = pname.replace(/\./g, "_");
	const sanitizedFileName = name.replace(/\./g, "_");

	try {
		await updateDoc(userRef, {
			[`projects.${sanitizedProjectName}.files.${sanitizedFileName}`]:
				"// write your code here",
		});

		console.log(`File ${name} saved successfully!`);

		element.className = "file-blob";
		element.innerHTML = `
            <i class="fa-solid fa-file-code"></i>
            <a href="compiler.html?project=${pname}&file=${sanitizedFileName}">${name}</a>
        `;
	} catch (error) {
		console.error("Error updating files:", error);
		alert("Failed to save file. Check console for details.");
		element.remove();
	}
}

function showSaveStatus(status) {
	const statusEl = document.getElementById("save-status");
	statusEl.innerText =
		status === "Saved" ? "✓ All changes saved!" : "● " + status;
	statusEl.style.color =
		status === "Error" ? "#ff4d4d" : "var(--accent-subheading)";
}

codeSpace.addEventListener("input", () => {
	showSaveStatus("Saving...");
	saveContent(codeSpace.innerText);
});
