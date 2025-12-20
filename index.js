const importBtn = document.getElementById("import-btn");
const fileInput = document.getElementById("file-input");
const exportBtn = document.getElementById("export-btn");
const showRPNCheck = document.getElementById("show-rpn");
const language = document.getElementById("language");
const tabSlider = document.getElementById("tab-size");
const tabOut = document.getElementById("tab-size-display");

importBtn.addEventListener("click", () => {
	fileInput.click();
});

const checkRPNState = () => {
	const rpnDisplay = document.getElementById("rpn-output");
	if (!showRPNCheck.checked) rpnDisplay.style = "display: none;";
	else rpnDisplay.style = "";
};

const downloadFile = (fn) => {
	var textToWrite = document
		.getElementById("code")
		.innerText.replace("	", "\t")
		.replace(" ", " ");
	const fileNameToSaveAs = fn + ".xs";
	const textFileAsBlob = new Blob([textToWrite], { type: "text/plain" });

	const downloadLink = document.createElement("a");
	downloadLink.download = fileNameToSaveAs;
	downloadLink.href = window.URL.createObjectURL(textFileAsBlob);

	document.body.appendChild(downloadLink);
	downloadLink.click();
	document.body.removeChild(downloadLink);
	window.URL.revokeObjectURL(downloadLink.href);
};

const toggleLanguageStuff = () => {
	const dtInt = document.getElementById("dt-int");
	const dtFloat = document.getElementById("dt-float");

	switch (language.value) {
		case "XenonASM":
			dtInt.innerText = "int16";
			dtFloat.innerText = "fp16 (bias = 15)";
			break;
		case "EmeraldASM":
			dtInt.innerText = "int8";
			dtFloat.innerText = "fp8 (bias = 7)";
			break;
	}
};

const checkValidExport = () => {
	exportBtn.disabled = document.getElementById("fn").value.length == 0;
};

fileInput.addEventListener("change", (event) => {
	const output = document.getElementById("code");
	const file = event.target.files[0];
	if (!file) {
		return;
	}

	const reader = new FileReader();

	reader.onload = (e) => {
		const content = e.target.result;
		output.innerText = content.replace("\t", "	");
		document.getElementById("fn").value = file.name.replace(".xs", "");
		exportBtn.disabled = false;
	};

	reader.readAsText(file);
});

showRPNCheck.addEventListener("change", checkRPNState);
language.addEventListener("change", toggleLanguageStuff);
document.getElementById("fn").addEventListener("input", checkValidExport);

exportBtn.addEventListener("click", () => {
	downloadFile(document.getElementById("fn").value);
});

document.getElementById("code").addEventListener("keydown", (event) => {
	if (event.key === "Tab") {
		event.preventDefault();
		const selection = window.getSelection();
		if (selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			range.deleteContents();
			const node = document.createTextNode("	");
			range.insertNode(node);

			range.setStartAfter(node);
			range.setEndAfter(node);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}
});

tabSlider.addEventListener("input", () => {
	tabOut.innerText = tabSlider.value;
	document.documentElement.style.setProperty(
		"--tab-size-val",
		tabSlider.value
	);
});
const fileUpload = document.getElementById("file-upload");
const fileList = document.getElementById("file-list");

fileUpload.addEventListener("change", (event) => {
	const files = event.target.files;

	for (const file of files) {
		const reader = new FileReader();

		reader.onload = (e) => {
			virtualFileSystem[file.name] = e.target.result.replaceAll(
				"\r\n",
				"\n"
			);

			const symb = file.name.endsWith(".xs") ? "📄" : "⌨️";

			const li = document.createElement("li");
			li.textContent = `${symb} ${file.name}`;
			fileList.appendChild(li);
		};

		reader.readAsText(file);
	}
});

checkRPNState();
toggleLanguageStuff();
checkValidExport();
