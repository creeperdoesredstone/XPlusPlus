import { lex } from "./lexer.js";
import { parse, optimizeAST } from "./parser.js";
import { Xenon124Compiler } from "./compiler.js";
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
			"asm",
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
	line.innerText = message;
	terminalOutput.appendChild(line);
	terminalOutput.scrollTop = terminalOutput.scrollHeight;

	localStorage.setItem("terminal-msg", terminalOutput.innerHTML);
}

document.getElementById("btn-clear-terminal").addEventListener("click", () => {
	terminalOutput.innerHTML =
		"<span class='terminal-line'>Terminal cleared.</span>";
	localStorage.setItem("terminal-msg", terminalOutput.innerHTML);
});

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

const run = () => {
	const ftxt = codeSpace.innerText;

	const urlParams = new URLSearchParams(window.location.search);
	const pname = urlParams.get("project");
	const fn = urlParams.get("file");

	const lexResult = lex(`${pname}/${fn}`, ftxt);
	if (lexResult.error) return lexResult;

	const parseResult = parse(lexResult.value);
	if (parseResult.error) return parseResult;

	const { ast, compilerActions } = optimizeAST(parseResult.value);
	compilerActions.forEach((action) => {
		logCompilerAction(action.type, action.subsystem, action.message);
	});

	const compileResult = new Xenon124Compiler().compile(ast);
	return compileResult;
};

compileBtn.addEventListener("click", () => {
	printToTerminal("Starting compilation...", "system");
	const result = run();

	if (result.error) {
		printToTerminal(
			"Encountered an error during compilation:\n" +
				result.error.toString(),
			"error",
		);
	} else {
		printToTerminal("Compilation successful!", "success");
		exportBuildToFirestore(result.value);
	}
});
