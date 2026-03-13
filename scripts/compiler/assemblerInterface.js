import { XenonAssembler } from "./assembler.js";
import { app, db } from "../sdk.js";

import { loadFiles } from "../fnInput.js";
import {
	doc,
	updateDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

const auth = getAuth(app);

async function exportBuildToFirestore(instructions) {
	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");
	const fn = urlParams.get("file").replace(".xasm", "");

	if (!pname || !auth.currentUser) {
		printToTerminal("Export failed: Project context missing.", "error");
		return;
	}

	const userRef = doc(db, "users", auth.currentUser.uid);
	const sanitizedProjectName = pname.replace(/\./g, "_");

	const outputFileName = `${fn}_bin`;

	try {
		printToTerminal("Saving build...", "system");

		await updateDoc(userRef, {
			[`projects.${sanitizedProjectName}.files.${outputFileName}`]:
				instructions.join("\n"),
		});

		printToTerminal(
			`Build exported: ${outputFileName.replace("_", ".")}`,
			"bin",
		);
		loadFiles(auth.currentUser);
	} catch (error) {
		console.error("Export error:", error);
		printToTerminal("Export failed.", "error");
	}
}

const assembleBtn = document.querySelector("#btn-assemble");
const codeSpace = document.querySelector("#codespace");

const terminalOutput = document.getElementById("terminal-output");

function printToTerminal(message, type = "default") {
	const line = document.createElement("span");
	line.className = `terminal-line ${type}-msg`;
	line.innerText = message;
	terminalOutput.appendChild(line);
	terminalOutput.scrollTop = terminalOutput.scrollHeight;

	localStorage.setItem("terminal-msg", terminalOutput.innerHTML);
}

function logCompilerAction(type, subsystem, message) {
	const types = {
		info: { label: "INFO", class: "term-info" },
		opt: { label: "OPT", class: "term-opt" },
		warn: { label: "WARN", class: "term-warn" },
		err: { label: "ERR", class: "term-danger" },
	};

	const config = types[type] || types.info;

	// Example output: [OPT] transformer: removed identity x + 0
	terminalOutput.innerHTML +=
		`<span class="terminal-line">⚙️ <span class="${config.class}">[${config.label}]</span> ` +
		`<span class="term-subsystem">${subsystem}:</span> ${message}</span>`;
	localStorage.setItem("terminal-msg", terminalOutput.innerHTML);
}

const assemble = () => {
	const ftxt = codeSpace.innerText;

	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");
	const fn = urlParams.get("file");

	const compileResult = new XenonAssembler().assemble(ftxt, `${pname}/${fn}`);
	return compileResult;
};

assembleBtn.addEventListener("click", () => {
	printToTerminal("Starting assembly...", "system");
	const result = assemble();

	if (result.error) {
		printToTerminal(
			"Encountered an error during compilation:\n" +
				result.error.toString(),
			"error",
		);
	} else {
		printToTerminal("Assembly successful!", "success");
		exportBuildToFirestore(result.value);
	}
});
