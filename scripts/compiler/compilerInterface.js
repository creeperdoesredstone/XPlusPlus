import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { Xenon124Compiler } from "./compiler.js";
import { app, db } from "../sdk.js";

import { loadFiles } from "../fnInput.js";
import {
	doc,
	updateDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import {
	getAuth,
	onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

const auth = getAuth(app);

async function exportBuildToFirestore(instructions) {
	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");
	const fn = urlParams.get("file").replace(".xs", "");

	if (!pname || !auth.currentUser) {
		printToTerminal("Export failed: Project context missing.", "error");
		return;
	}

	const userRef = doc(db, "users", auth.currentUser.uid);
	const sanitizedProjectName = pname.replace(/\./g, "_");

	const outputFileName = `${fn}_xasm`;

	try {
		printToTerminal("Saving build...", "system");

		await updateDoc(userRef, {
			[`projects.${sanitizedProjectName}.files.${outputFileName}`]:
				instructions.join("\n"),
		});

		printToTerminal(
			`Build exported: ${outputFileName.replace("_", ".")}`,
			"success",
		);
		loadFiles(auth.currentUser);
	} catch (error) {
		console.error("Export error:", error);
		printToTerminal("Export failed.", "error");
	}
}

const compileBtn = document.querySelector("#btn-compile");
const codeSpace = document.querySelector("#codespace");

const terminalOutput = document.getElementById("terminal-output");

function printToTerminal(message, type = "default") {
	const line = document.createElement("span");
	line.className = `terminal-line ${type}-msg`;

	const prefix = type === "asm" ? "> " : "  ";
	line.innerText = prefix + message;
	terminalOutput.appendChild(line);
	terminalOutput.scrollTop = terminalOutput.scrollHeight;

	localStorage.setItem("terminal-msg", terminalOutput.innerHTML);
}

document.getElementById("btn-clear-terminal").addEventListener("click", () => {
	terminalOutput.innerHTML = "Terminal cleared.";
	localStorage.setItem("terminal-msg", terminalOutput.innerHTML);
});

const run = () => {
	const ftxt = codeSpace.innerText;

	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");
	const fn = urlParams.get("file");

	const lexResult = lex(`${pname}/${fn}`, ftxt);
	if (lexResult.error) return lexResult;

	const parseResult = parse(lexResult.value);
	console.log(parseResult);
	if (parseResult.error) return parseResult;

	const compileResult = new Xenon124Compiler().compile(parseResult.value);
	return compileResult;
};

compileBtn.addEventListener("click", () => {
	printToTerminal("Starting compilation...", "system");
	const result = run();

	if (result.error) {
		printToTerminal("Encountered an error during compilation:\n" + result.error.toString(), "error");
	} else {
		printToTerminal("Compilation successful!", "success");
		exportBuildToFirestore(result.value);
	}
});
