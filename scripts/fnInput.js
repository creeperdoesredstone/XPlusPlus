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

		const fileLists = Object.entries(data.projects[pname].files);
		fileLists.sort((a, b) => a[0].localeCompare(b[0]));

		fileLists.forEach((file) => {
			const li = document.createElement("li");
			li.className = "file-blob";
			const fn = file[0].replace(/\_/g, ".");
			const isXasm = fn.toLowerCase().endsWith(".xasm");
			const iconClass = isXasm
				? "fa-solid fa-file-lines icon-xasm"
				: "fa-solid fa-file-code icon-default";

			const icon = document.createElement("i");
			icon.className = iconClass;
			li.appendChild(icon);

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
		updateEditorWithPrism();
	} else {
		codeSpace.contentEditable = false;
	}

	terminalOutput.innerHTML =
		localStorage.getItem("terminal-msg") ||
		'<span class="system-msg terminal-line">XenonOS Compiler [Version 1.0.7]</span><span class="system-msg terminal-line">Ready for compilation...</span>';
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
				"// TODO: write code",
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

function getCaretCharacterOffsetWithin(element) {
	let caretOffset = 0;
	const doc = element.ownerDocument || element.document;
	const win = doc.defaultView || doc.parentWindow;
	const sel = win.getSelection();

	if (sel.rangeCount > 0) {
		const range = sel.getRangeAt(0);
		const preCaretRange = range.cloneRange();
		preCaretRange.selectNodeContents(element);
		preCaretRange.setEnd(range.endContainer, range.endOffset);
		caretOffset = preCaretRange.toString().length;
	}
	return caretOffset;
}

function setCaretPosition(element, offset) {
	const range = document.createRange();
	const sel = window.getSelection();
	let charCount = 0;
	let nodeStack = [element];
	let node,
		found = false;

	while (nodeStack.length > 0 && !found) {
		node = nodeStack.pop();
		if (node.nodeType === 3) {
			// Text node
			let nextCharCount = charCount + node.length;
			if (offset <= nextCharCount) {
				range.setStart(node, offset - charCount);
				range.collapse(true);
				found = true;
			}
			charCount = nextCharCount;
		} else {
			for (let i = node.childNodes.length - 1; i >= 0; i--) {
				nodeStack.push(node.childNodes[i]);
			}
		}
	}
	sel.removeAllRanges();
	sel.addRange(range);
}

function updateEditorWithPrism() {
	const urlParams = new URLSearchParams(window.location.search);
	const fname = urlParams.get("file").split(".")[1];
	const code = codeSpace.innerText;
	const offset = getCaretCharacterOffsetWithin(codeSpace);
	const highlighted = Prism.highlight(code, Prism.languages[fname], fname);
	codeSpace.innerHTML = highlighted;
	setCaretPosition(codeSpace, offset);
}

codeSpace.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();

		const selection = window.getSelection();
		const range = selection.getRangeAt(0);
		const br = document.createTextNode("\n");

		range.deleteContents();
		range.insertNode(br);

		range.setStartAfter(br);
		range.setEndAfter(br);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);

		codeSpace.dispatchEvent(new Event("input"));
	}
});

codeSpace.addEventListener("input", () => {
	updateEditorWithPrism();
	showSaveStatus("Saving...");
	saveContent(codeSpace.innerText);
});
