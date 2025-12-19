const TT = Object.freeze(
	ttList.reduce((obj, item) => {
		obj[item] = Symbol(item);
		return obj;
	}, {})
);

const KEYWORDS = ["var", "const", "for", "while"];
const DATATYPES = ["int", "float"];
KEYWORDS.push(...DATATYPES);
const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const VALID_IDEN = LETTERS + DIGITS + "_";

const varOperators = ["ADDBY", "SUBBY", "MULBY", "DIVBY", "MODBY", "POWBY"];
const compOperators = ["LT", "LE", "GT", "GE", "EQ", "NE"];

class Token {
	constructor(type, value, startPos, endPos) {
		this.type = type;
		this.value = value;
		this.startPos = startPos;
		this.endPos = endPos;
	}

	toString() {
		let result =
			this.value !== undefined
				? `<span class='token-type'>${this.type.description}</span>:<span class='token-value'>${this.value}</span>`
				: `<span class='token-type'>${this.type.description}</span>`;
		return result;
	}
}

class Position {
	constructor(idx, ln, col, fn, ftxt) {
		this.idx = idx;
		this.ln = ln;
		this.col = col;
		this.fn = fn;
		this.ftxt = ftxt;
	}

	advance(currentChar) {
		this.idx++;
		this.col++;
		if (currentChar === "\n") {
			this.col = 0;
			this.ln++;
		}
	}

	copy() {
		return new Position(this.idx, this.ln, this.col, this.fn, this.ftxt);
	}
}

class BaseError {
	constructor(startPos, endPos, name, details) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.name = name;
		this.details = details;
	}

	toString() {
		let resStr = `File <span class='token-value'>${
			this.startPos ? this.startPos.fn : "&lt;code&gt;"
		}</span>, line <span class='token-value'>${
			this.startPos.ln + 1
		}</span> column <span class='token-value'>${
			this.startPos.col + 1
		}</span><br><br><span class='token-error'>${
			this.name
		}</span>: <span class='token-error-msg'>${this.details}</span>`;

		return resStr;
	}
}

class Error_UnknownChar extends BaseError {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Unknown Character", details);
	}
}

class Error_InvalidSyntax extends BaseError {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Invalid Syntax", details);
	}
}

class Error_Compilation extends BaseError {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Compilation Error", details);
	}
}

class Result {
	constructor() {
		this.value = undefined;
		this.error = undefined;
	}

	register(res) {
		if (res.error) this.error = res.error;
		return res.value;
	}

	success(value) {
		this.value = value;
		return this;
	}

	fail(error) {
		this.error = error;
		return this;
	}
}

class Compiler {
	constructor(tokens, declaredVars, asmLang) {
		this.tokens = tokens;
		this.declaredVars = [...declaredVars];
		this.asmLang = asmLang;
		this.pos = -1;
		this.advance();
		this.instructions = [];
		this.regDest = document.getElementById("store-res").value;
		this.isFloatMode = false;
		this.lastMode = false;

		this.symbolTable = {};
		this.labelCount = 0;
	}

	advance() {
		this.pos++;
		if (this.pos < this.tokens.length)
			this.currentTok = this.tokens[this.pos];
	}

	pushInstruction(inst, operands) {
		const flags = ["NV", "CR", "LT", "EQ", "LE", "GT", "NE", "GE", "AL"];
		let joinedOperands =
			typeof operands === "string"
				? [operands]
				: operands
						.map((operand) => {
							operand = operand.toString();
							if (flags.includes(operand))
								return `<span class='token-flag'>${operand}</span>`;
							if (operand.startsWith("#"))
								return `<span class='token-value'>${operand}</span>`;
							if (operand.startsWith("."))
								return `<span class='label'>${operand}</span>`;
							if (operand.endsWith("X"))
								return `<span class='token-register'>${operand}</span>`;
							if (
								operand.startsWith("[") &&
								operand.endsWith("X]")
							)
								return `[<span class='token-register'>${operand[1]}X</span>]`;
							return `<span>${operand}</span>`;
						})
						.join(", ");

		this.instructions.push(
			`<span class='token-inst'>${inst}</span> ${joinedOperands}`
		);
		// this.instructions.push({ op: inst, operands: operands, });
	}

	formatHTML(inst) {
		const flags = ["NV", "CR", "LT", "EQ", "LE", "GT", "NE", "GE", "AL"];
		let joinedOperands =
			typeof inst.operands === "string"
				? [inst.operands]
				: inst.operands
						.map((operand) => {
							operand = operand.toString();
							if (flags.includes(operand))
								return `<span class='token-flag'>${operand}</span>`;
							if (operand.startsWith("#"))
								return `<span class='token-value'>${operand}</span>`;
							if (operand.startsWith("."))
								return `<span class='label'>${operand}</span>`;
							if (operand.endsWith("X"))
								return `<span class='token-register'>${operand}</span>`;
							if (
								operand.startsWith("[") &&
								operand.endsWith("X]")
							)
								return `[<span class='token-register'>${operand[1]}X</span>]`;
							return `<span>${operand}</span>`;
						})
						.join(", ");

		this.instructions.push(
			`<span class='token-inst'>${inst.op}</span> ${joinedOperands}`
		);
	}

	xenon_constOperation(operatorType, rightTok, leftTok) {
		const res = new Result();
		if (rightTok.type !== TT.INT && rightTok.type !== TT.FLOAT)
			return res.success(null);

		if (
			leftTok !== undefined &&
			leftTok.type !== TT.INT &&
			leftTok.type !== TT.FLOAT
		)
			return res.success(null);

		const left = leftTok !== undefined ? Number(leftTok.value) : 0;
		const right = Number(rightTok.value);
		let resultValue;
		let resultType =
			rightTok.type === TT.FLOAT ||
			(leftTok !== undefined && leftTok.type === TT.FLOAT)
				? TT.FLOAT
				: TT.INT;

		switch (operatorType) {
			case "ADD":
				resultValue = left + right;
				break;
			case "SUB":
				resultValue = left - right;
				break;
			case "MUL":
				resultValue = left * right;
				break;
			case "DIV":
				if (right === 0) {
					return res.fail(
						new Error_Compilation(
							rightTok.startPos,
							rightTok.endPos,
							"Division by 0."
						)
					);
				}
				resultValue = left / right;
				if (resultType === TT.INT) {
					resultValue = Math.trunc(resultValue);
				}
				break;
			case "MOD":
				resultValue = left % right;
				if (resultType === TT.INT) {
					resultValue = Math.trunc(resultValue);
				}
				break;
			case "POW":
				resultValue = Math.pow(left, right);
				break;
			case "USUB":
				resultValue = -right;
				break;
			case "UADD":
				resultValue = right;
				break;
			case "LT":
				resultValue = -Number(left < right);
				break;
			case "LE":
				resultValue = -Number(left <= right);
				break;
			case "GT":
				resultValue = -Number(left > right);
				break;
			case "GE":
				resultValue = -Number(left >= right);
				break;
			case "EQ":
				resultValue = -Number(left == right);
				break;
			case "NE":
				resultValue = -Number(left != right);
				break;
			default:
				return res.success(null);
		}

		// Adjust result value and type for INT/FLOAT consistency
		if (resultType === TT.INT) {
			resultValue = Math.trunc(resultValue);
			if (
				!Number.isInteger(resultValue) &&
				rightTok.type === TT.INT &&
				leftTok.type === TT.INT
			) {
				resultType = TT.FLOAT;
			}
		} else {
			resultType = TT.FLOAT;
		}

		const resultToken = new Token(
			resultType,
			String(resultValue),
			leftTok !== undefined ? leftTok.startPos : rightTok.startPos,
			rightTok.endPos
		);
		return res.success(resultToken);
	}

	xenon_pushImmediate(value) {
		const maxPushImmediate = 0x3ff;
		value = Number(value);
		if (this.isFloatMode) value = this.fp16ToBitRepr(value);
		if (value < 0) value += 65536; // Clamp result to range [0, 65535]

		const hexValue = value.toString(16).padStart(3, "0");
		if (this.lastMode) {
			this.isFloatMode = true;
			this.lastMode = false;
		}

		if (this.lastMode !== this.isFloatMode || !this.instructions) {
			if (this.isFloatMode) this.pushInstruction("CMOD", ["float"]);
			else this.pushInstruction("CMOD", ["int"]);
		}

		if (value <= maxPushImmediate)
			this.pushInstruction("PSHI", [`#${hexValue}`]);
		else {
			this.pushInstruction("LDIA", [`#${hexValue.padStart(4, "0")}`]);
			this.pushInstruction("PUSH", [this.regDest]);
		}
	}

	emerald_pushImmediate(value) {
		if (this.isFloatMode) value = this.fp8ToBitRepr(value);
		if (value < 0) value += 256; // Clamp result to range [0, 255]

		const hexValue = value.toString(16).padStart(2, "0");
		if (this.lastMode) {
			this.isFloatMode = true;
			this.lastMode = false;
		}

		if (this.lastMode !== this.isFloatMode || !this.instructions) {
			if (this.isFloatMode) this.pushInstruction("AMD", ["float"]);
			else this.pushInstruction("AMD", ["int"]);
		}
		this.pushInstruction("PSH", [`#${hexValue}`]);
	}

	compile() {
		if (this.asmLang === "XenonASM") {
			const xenonRes = this.compileXenon();
			if (xenonRes.error) return xenonRes;
			return xenonRes.success(this.optimizeXenonASM());
		}
		if (this.asmLang === "EmeraldASM") {
			const emRes = this.compileEmerald();
			if (emRes.error) return emRes;
			this.instructions = [...this.optimizeEmeraldASM()];
			this.emerald_padVars();
			return emRes.success(this.instructions);
		}
		return new Result().fail(
			new Error_Compilation(
				this.currentTok.startPos,
				this.currentTok.endPos,
				`Undefined assembly language: ${this.asmLang}`
			)
		);
	}

	compileXenon() {
		const optStack = [];

		const res = new Result();

		while (this.pos < this.tokens.length) {
			switch (true) {
				case this.currentTok.type === TT.END:
					if (this.pos < this.tokens.length - 1) {
						this.pushInstruction("LDIS", ["#ffff"]);
						optStack.length = 0;
					}
					this.advance();
					break;

				case this.currentTok.type === TT.INT:
				case this.currentTok.type === TT.FLOAT:
					let value = Number(this.currentTok.value);
					optStack.length = optStack.push(this.currentTok);

					this.lastMode = this.isFloatMode;
					this.isFloatMode = this.currentTok.type === TT.FLOAT;

					this.xenon_pushImmediate(value);
					this.advance();
					break;

				case this.currentTok.type === TT.IDEN:
					const varName = this.currentTok.value;
					const varInfo = this.symbolTable[varName];

					if (!varInfo) {
						return res.fail(
							new Error_Compilation(
								this.currentTok.startPos,
								this.currentTok.endPos,
								`Variable ${this.currentTok} is undefined.`
							)
						);
					}

					if (varInfo.isConst && varInfo.foldedValue !== undefined) {
						const value = varInfo.foldedValue;
						const propagatedTok = new Token(
							Number.isInteger(value) ? TT.INT : TT.FLOAT,
							value.toString(),
							this.currentTok.startPos,
							this.currentTok.endPos
						);
						optStack.length = optStack.push(propagatedTok);
					} else {
						const varLocation = this.declaredVars.indexOf(varName);
						this.pushInstruction("LDIB", [
							"#" + varLocation.toString(16).padStart(4, "0"),
						]);
						this.pushInstruction("PUSH", ["[BX]"]);

						optStack.length = optStack.push(this.currentTok);
					}
					this.advance();
					break;

				case this.currentTok.type === TT.TOASSIGN:
					optStack.length = optStack.push(this.currentTok);
					this.advance();
					break;

				case this.currentTok.type === TT.LABEL:
					this.pushInstruction("", ["." + this.currentTok.value]);
					this.advance();
					break;

				case this.currentTok.type === TT.JMP_IF_FALSE:
					this.pushInstruction("JUMP", [
						"EQ",
						"." + this.currentTok.value.value,
					]);
					this.advance();
					break;

				case this.currentTok.type === TT.JMP:
					this.pushInstruction("JUMP", [
						"AL",
						"." + this.currentTok.value.value,
					]);
					this.advance();
					break;

				case this.currentTok.type.description in operators:
					const isUnary =
						this.currentTok.type.description.startsWith("U");
					if (optStack.length < 2 - Number(isUnary)) {
						return res.fail(
							new Error_Compilation(
								this.currentTok.startPos,
								this.currentTok.endPos,
								`Expected ${
									2 - Number(isUnary)
								} operands for operator ${
									this.currentTok.type.description
								}.`
							)
						);
					}

					const rightTok = optStack.pop();
					let leftTok;
					if (!isUnary) leftTok = optStack.pop();
					const operatorType = this.currentTok.type.description;

					const foldedResult = res.register(
						this.xenon_constOperation(
							operatorType,
							rightTok,
							leftTok
						)
					);
					if (res.error) return res;

					const removeNum = (value) => {
						let valToRemove = value;
						if (!Number.isInteger(value))
							valToRemove = this.fp16ToBitRepr(value);

						const hexValue = valToRemove
							.toString(16)
							.padStart(3, "0");
						while (
							this.instructions.length > 0 &&
							this.instructions.at(-1).indexOf(hexValue) === -1
						) {
							this.instructions.splice(-1, 1);
						}
						this.instructions.splice(-1, 1);
					};

					if (foldedResult) {
						removeNum(rightTok.value);
						if (!isUnary) removeNum(leftTok.value);
						this.xenon_pushImmediate(foldedResult.value);

						optStack.length = optStack.push(foldedResult);
						this.advance();
						break;
					}

					if (this.currentTok.type === TT.ASGN) {
						const varLocation = this.declaredVars.indexOf(
							leftTok.value
						);
						if (varLocation === -1)
							return res.fail(
								new Error_Compilation(
									leftTok.startPos,
									leftTok.endPos,
									`Variable ${leftTok} is undefined.`
								)
							);

						if (!(leftTok.value in this.symbolTable)) {
							this.symbolTable[leftTok.value] = {
								location: varLocation,
								type: rightTok.type,
								isConst: leftTok.isConst,
							};
							if (
								leftTok.isConst &&
								(rightTok.type === TT.INT ||
									rightTok.type === TT.FLOAT)
							) {
								this.symbolTable[leftTok.value].foldedValue =
									Number(rightTok.value);
								this.advance();
								break;
							}
						} else {
							if (rightTok.type === TT.IDEN) {
								if (
									this.symbolTable[leftTok.value].type !==
									this.symbolTable[rightTok.value].type
								) {
									return res.fail(
										new Error_Compilation(
											rightTok.startPos,
											rightTok.endPos,
											`Cannot assign '${
												rightTok.type.description
											}' to '${
												this.symbolTable[leftTok.value]
													.type.description
											}'.`
										)
									);
								}
							} else if (
								rightTok.type !==
								this.symbolTable[leftTok.value].type
							) {
								return res.fail(
									new Error_Compilation(
										rightTok.startPos,
										rightTok.endPos,
										`Cannot assign '${
											rightTok.type.description
										}' to '${
											this.symbolTable[leftTok.value].type
												.description
										}'.`
									)
								);
							}
						}

						this.pushInstruction("POP", [this.regDest]);
						this.pushInstruction("LDIB", [
							"#" + varLocation.toString(16).padStart(4, "0"),
						]);
						this.pushInstruction("STRE", ["[BX]", this.regDest]);
						this.pushInstruction("PUSH", [this.regDest]);
						this.advance();
						break;
					} else if (
						this.currentTok.type.description.endsWith("BY")
					) {
						const varLocation = this.declaredVars.indexOf(
							leftTok.value
						);
						if (varLocation === -1)
							return res.fail(
								new Error_Compilation(
									leftTok.startPos,
									leftTok.endPos,
									`Variable ${leftTok} is undefined.`
								)
							);

						if (this.symbolTable[leftTok.value].isConst)
							return res.fail(
								new Error_Compilation(
									leftTok.startPos,
									leftTok.endPos,
									`Cannot assign to constant ${leftTok.value}.`
								)
							);

						if (rightTok.type === TT.IDEN) {
							if (
								this.symbolTable[leftTok.value].type !==
								this.symbolTable[rightTok.value].type
							) {
								return res.fail(
									new Error_Compilation(
										rightTok.startPos,
										rightTok.endPos,
										`Cannot assign '${
											rightTok.type.description
										}' to '${
											this.symbolTable[leftTok.value].type
												.description
										}'.`
									)
								);
							}
						} else if (
							rightTok.type !==
							this.symbolTable[leftTok.value].type
						) {
							return res.fail(
								new Error_Compilation(
									rightTok.startPos,
									rightTok.endPos,
									`Cannot assign '${
										rightTok.type.description
									}' to '${
										this.symbolTable[leftTok.value].type
											.description
									}'.`
								)
							);
						}
						const op = this.currentTok.type.description.substr(
							0,
							3
						);

						this.pushInstruction("POP", [this.regDest]);
						this.pushInstruction("LDIB", [
							"#" + varLocation.toString(16).padStart(4, "0"),
						]);
						this.pushInstruction(op, [
							this.regDest,
							"[BX]",
							["BX"],
						]);
						this.pushInstruction("MOVE", ["BX", this.regDest]);
						this.pushInstruction("PUSH", [this.regDest]);
						this.advance();
						break;
					}

					if (isUnary) {
						this.pushInstruction("LDIA", ["#0000"]);
						this.pushInstruction("POP", ["DX"]);
						this.pushInstruction(
							this.currentTok.type.description.substr(1),
							["AX", "DX", this.regDest]
						);
					} else {
						if (
							compOperators.includes(
								this.currentTok.type.description
							)
						) {
							this.pushInstruction("COMP", ["DX", "AX"]);
							this.pushInstruction("JUMP", [
								this.currentTok.type.description,
								`.bool-truthy-${this.labelCount}`,
							]);
							this.pushInstruction("LDIA", ["#0000"]);
							this.pushInstruction("JUMP", [
								"AL",
								`.bool-rtn-${this.labelCount}`,
							]);
							this.pushInstruction("", [
								`.bool-truthy-${this.labelCount}`,
							]);
							this.pushInstruction("LDIA", ["#ffff"]);
							this.pushInstruction("", [
								`.bool-rtn-${this.labelCount}`,
							]);
						} else {
						this.pushInstruction("POP", ["AX"]); // right
						this.pushInstruction("POP", ["DX"]); // left
						this.pushInstruction(this.currentTok.type.description, [
							"DX",
							"AX",
							this.regDest,
						]);}
					}
					optStack.length = optStack.push(rightTok);
					this.pushInstruction("PUSH", [this.regDest]);
					this.advance();
					break;
				default:
					return res.fail(
						new Error_InvalidSyntax(
							this.currentTok.startPos,
							this.currentTok.endPos,
							`Unexpected token ${this.currentTok} during compilation.`
						)
					);
			}
		}

		if (!this.instructions.at(-1).endsWith(this.regDest))
			this.pushInstruction("POP", [this.regDest]);
		this.pushInstruction("HALT", []);
		return res.success(this.instructions);
	}

	optimizeXenonASM() {
		let optimizedCode = [...this.instructions];
		let changesMade = true;
		let lineStart = 0;

		const getArgs = (node) => {
			const args = [];
			for (let i = 0; i < node.childNodes.length; i++) {
				if (
					node.childNodes[i].tagName === "SPAN" &&
					!node.childNodes[i].classList.contains("token-inst")
				) {
					args.push(node.childNodes[i].textContent.trim());
				}
			}
			return args;
		};

		while (changesMade) {
			changesMade = false;
			let i = 0;
			let nextOp, nextnextOp, nextArgs, nextnextArgs;

			while (i < optimizedCode.length) {
				const current = optimizedCode[i];
				const next = optimizedCode[i + 1];
				const nextNext = optimizedCode[i + 2];

				const currentInst = document.createElement("p");
				currentInst.innerHTML = current;
				const op =
					currentInst.getElementsByClassName("token-inst")[0]
						.innerText;
				const currentArgs = getArgs(currentInst);

				if (next) {
					const nextInst = document.createElement("p");
					nextInst.innerHTML = next;
					nextOp =
						nextInst.getElementsByClassName("token-inst")[0]
							.innerText;
					nextArgs = getArgs(nextInst);
				}

				if (nextNext) {
					const nextnextInst = document.createElement("p");
					nextnextInst.innerHTML = nextNext;
					nextnextOp =
						nextnextInst.getElementsByClassName("token-inst")[0]
							.innerText;
					nextnextArgs = getArgs(nextnextInst);
				}

				if (op === "LDIS" && currentArgs[0] === "#ffff") {
					const line = optimizedCode.slice(lineStart, i + 1);
					const pushIdx = line.find((instruction) => {
						instruction.startsWith(
							"<span class='token-inst'>PUSH</span>"
						);
					});
					lineStart = i + 1;
					if (pushIdx === undefined) {
						optimizedCode.splice(i, 1);
						changesMade = true;
						continue;
					}
				}

				if (op === "CMOD" && next && nextOp === "CMOD") {
					optimizedCode.splice(i, 1);
					changesMade = true;
					continue;
				}

				if (op === "PUSH" && next && nextOp === "POP") {
					if (currentArgs[0] === nextArgs[0]) {
						optimizedCode.splice(i, 2);
						changesMade = true;
						continue;
					}
				}

				if (op === "POP" && next && nextOp === "PUSH") {
					if (currentArgs[0] === nextArgs[0]) {
						optimizedCode.splice(i, 2);
						changesMade = true;
						continue;
					}
				}

				if (
					op === "PSHI" &&
					next &&
					nextOp === "POP" &&
					currentArgs[0].startsWith("#") &&
					nextArgs[0] === "AX"
				) {
					optimizedCode[
						i
					] = `<span class='token-inst'>LDIA</span> <span class='token-value'>#0${currentArgs[0].substr(
						1
					)}</span>`;
					optimizedCode.splice(i + 1, 1);
					changesMade = true;
					continue;
				}

				if (op === "PUSH" && ((next && nextOp == "LDIS") || !next)) {
					optimizedCode.splice(i, 1);
					changesMade = true;
					continue;
				}

				i++;
			}
		}

		return optimizedCode;
	}

	compileEmerald() {
		const optStack = [];
		const res = new Result();

		while (this.pos < this.tokens.length) {
			switch (true) {
				case this.currentTok.type === TT.INT:
				case this.currentTok.type === TT.FLOAT:
					let value = Number(this.currentTok.value);
					optStack.length = optStack.push(this.currentTok);

					this.lastMode = this.isFloatMode;
					this.isFloatMode = this.currentTok.type === TT.FLOAT;

					this.emerald_pushImmediate(value);
					this.advance();
					break;

				case this.currentTok.type === TT.IDEN:
					const varName = this.currentTok.value;
					const varInfo = this.symbolTable[varName];

					if (!varInfo) {
						return res.fail(
							new Error_Compilation(
								this.currentTok.startPos,
								this.currentTok.endPos,
								`Variable ${this.currentTok} is undefined.`
							)
						);
					}

					if (varInfo.isConst && varInfo.foldedValue !== undefined) {
						const value = varInfo.foldedValue;
						const propagatedTok = new Token(
							Number.isInteger(value) ? TT.INT : TT.FLOAT,
							value.toString(),
							this.currentTok.startPos,
							this.currentTok.endPos
						);
						optStack.length = optStack.push(propagatedTok);
					} else {
						this.pushInstruction("LDI", [
							"BX",
							".var-" + this.currentTok.value,
						]);
						this.pushInstruction("PSH", ["[BX]"]);

						optStack.length = optStack.push(this.currentTok);
					}
					this.advance();
					break;

				case this.currentTok.type === TT.END:
					if (this.pos < this.tokens.length - 1) {
						this.pushInstruction("LDI", ["SX", "#0f"]);
						this.pushInstruction("LDP", ["SP s", "#ff"]);
						optStack.length = 0;
					}
					this.advance();
					break;

				case this.currentTok.type === TT.TOASSIGN:
					optStack.length = optStack.push(this.currentTok);
					this.advance();
					break;

				case this.currentTok.type === TT.LABEL:
					this.pushInstruction("", ["." + this.currentTok.value]);
					this.advance();
					break;

				case this.currentTok.type === TT.JMP_IF_FALSE:
					this.pushInstruction("JMP", [
						"EQ",
						"." + this.currentTok.value.value,
					]);
					this.advance();
					break;

				case this.currentTok.type === TT.JMP:
					this.pushInstruction("JMP", [
						"AL",
						"." + this.currentTok.value.value,
					]);
					this.advance();
					break;

					case this.currentTok.type.description in operators:
					const isUnary =
						this.currentTok.type.description.startsWith("U");
					if (optStack.length < 2 - Number(isUnary)) {
						return res.fail(
							new Error_Compilation(
								this.currentTok.startPos,
								this.currentTok.endPos,
								`Expected ${
									2 - Number(isUnary)
								} operands for operator ${
									this.currentTok.type.description
								}.`
							)
						);
					}

					const rightTok = optStack.pop();
					let leftTok;
					if (!isUnary) leftTok = optStack.pop();
					const operatorType = this.currentTok.type.description;

					const foldedResult = res.register(
						this.xenon_constOperation(
							operatorType,
							rightTok,
							leftTok
						)
					);
					if (res.error) return res;

					const removeNum = (value) => {
						let valToRemove = value;
						if (!Number.isInteger(value))
							valToRemove = this.fp8ToBitRepr(value);

						const hexValue = valToRemove
							.toString(16)
							.padStart(2, "0");
						while (
							this.instructions.length > 0 &&
							this.instructions.at(-1).indexOf(hexValue) === -1
						) {
							this.instructions.splice(-1, 1);
						}
						this.instructions.splice(-1, 1);
					};

					if (foldedResult) {
						removeNum(rightTok.value % 26);
						if (!isUnary) removeNum(leftTok.value % 26);
						this.emerald_pushImmediate(foldedResult.value % 256);

						optStack.push(foldedResult);
						this.advance();
						break;
					}

					if (this.currentTok.type.description === "ASGN") {
						const varLocation = this.declaredVars.indexOf(
							leftTok.value
						);
						if (varLocation === -1)
							return res.fail(
								new Error_Compilation(
									leftTok.startPos,
									leftTok.endPos,
									`Variable ${leftTok} is undefined.`
								)
							);

						if (!(leftTok.value in this.symbolTable)) {
							this.symbolTable[leftTok.value] = {
								location: varLocation,
								type: rightTok.type,
								isConst: leftTok.isConst,
							};
							if (
								leftTok.isConst &&
								(rightTok.type === TT.INT ||
									rightTok.type === TT.FLOAT)
							) {
								this.symbolTable[leftTok.value].foldedValue =
									Number(rightTok.value);
								this.advance();
								break;
							}
						} else {
							if (rightTok.type === TT.IDEN) {
								if (
									this.symbolTable[leftTok.value].type !==
									this.symbolTable[rightTok.value].type
								) {
									return res.fail(
										new Error_Compilation(
											rightTok.startPos,
											rightTok.endPos,
											`Cannot assign '${
												rightTok.type.description
											}' to '${
												this.symbolTable[leftTok.value]
													.type.description
											}'.`
										)
									);
								}
							} else if (
								rightTok.type !==
								this.symbolTable[leftTok.value].type
							) {
								return res.fail(
									new Error_Compilation(
										rightTok.startPos,
										rightTok.endPos,
										`Cannot assign '${
											rightTok.type.description
										}' to '${
											this.symbolTable[leftTok.value].type
												.description
										}'.`
									)
								);
							}
						}

						this.pushInstruction("POP", [this.regDest]);
						this.pushInstruction("LDI", [
							"BX",
							".var-" + leftTok.value,
						]);
						this.pushInstruction("STR", ["[BX]", this.regDest]);
						this.pushInstruction("PSH", [this.regDest]);
						this.advance();
						break;
					} else if (
						this.currentTok.type.description.endsWith("BY")
					) {
						const varLocation = this.declaredVars.indexOf(
							leftTok.value
						);
						if (varLocation === -1)
							return res.fail(
								new Error_Compilation(
									leftTok.startPos,
									leftTok.endPos,
									`Variable ${leftTok} is undefined.`
								)
							);

						if (this.symbolTable[leftTok.value].isConst)
							return res.fail(
								new Error_Compilation(
									leftTok.startPos,
									leftTok.endPos,
									`Cannot assign to constant ${leftTok.value}.`
								)
							);

						if (rightTok.type === TT.IDEN) {
							if (
								this.symbolTable[leftTok.value].type !==
								this.symbolTable[rightTok.value].type
							) {
								return res.fail(
									new Error_Compilation(
										rightTok.startPos,
										rightTok.endPos,
										`Cannot assign '${
											rightTok.type.description
										}' to '${
											this.symbolTable[leftTok.value].type
												.description
										}'.`
									)
								);
							}
						} else if (
							rightTok.type !==
							this.symbolTable[leftTok.value].type
						) {
							return res.fail(
								new Error_Compilation(
									rightTok.startPos,
									rightTok.endPos,
									`Cannot assign '${
										rightTok.type.description
									}' to '${
										this.symbolTable[leftTok.value].type
											.description
									}'.`
								)
							);
						}
						const op = this.currentTok.type.description.substr(
							0,
							3
						);

						this.pushInstruction("POP", [this.regDest]);
						this.pushInstruction("LDI", [
							"BX",
							".var-" + leftTok.value,
						]);
						this.pushInstruction(op, [
							this.regDest,
							"[BX]",
							["BX"],
						]);
						this.pushInstruction("MOV", ["BX", this.regDest]);
						this.pushInstruction("PSH", [this.regDest]);
						this.advance();
						break;
					}

					if (isUnary) {
						this.pushInstruction("LDI", ["AX", "#00"]);
						this.pushInstruction("POP", ["DX"]);
						this.pushInstruction(
							this.currentTok.type.description.substr(1),
							["AX", "DX", this.regDest]
						);
					} else {
						this.pushInstruction("POP", ["AX"]); // right
						this.pushInstruction("POP", ["DX"]); // left
						if (
							compOperators.includes(
								this.currentTok.type.description
							)
						) {
							this.pushInstruction("CMP", ["DX", "AX"]);
							this.pushInstruction("JMP", [
								this.currentTok.type.description,
								`.bool-truthy-${this.labelCount}`,
							]);
							this.pushInstruction("LDI", ["AX", "#00"]);
							this.pushInstruction("JMP", [
								"AL",
								`.bool-rtn-${this.labelCount}`,
							]);
							this.pushInstruction("", [
								`.bool-truthy-${this.labelCount}`,
							]);
							this.pushInstruction("LDI", ["AX", "#ff"]);
							this.pushInstruction("", [
								`.bool-rtn-${this.labelCount}`,
							]);
						} else {
							this.pushInstruction(
								this.currentTok.type.description,
								["DX", "AX", this.regDest]
							);
						}
					}
					optStack.length = optStack.push(rightTok);
					this.pushInstruction("PSH", [this.regDest]);
					this.advance();
					break;

				default:
					return res.fail(
						new Error_InvalidSyntax(
							this.currentTok.startPos,
							this.currentTok.endPos,
							`Unexpected token ${this.currentTok} during compilation.`
						)
					);
			}
		}

		if (!this.instructions.at(-1).endsWith(this.regDest))
			this.pushInstruction("POP", [this.regDest]);
		this.pushInstruction("HLT", []);

		return res.success(this.instructions);
	}

	optimizeEmeraldASM() {
		let optimizedCode = [...this.instructions];
		let changesMade = true;

		const getArgs = (htmlString) => {
			const temp = document.createElement("div");
			temp.innerHTML = htmlString;
			return Array.from(
				temp.querySelectorAll("span:not(.token-inst)")
			).map((s) => s.textContent.trim().replace(/,/g, ""));
		};

		const getOp = (htmlString) => {
			const temp = document.createElement("div");
			temp.innerHTML = htmlString;
			return temp.querySelector(".token-inst")?.innerText;
		};

		while (changesMade) {
			changesMade = false;
			let i = 0;

			while (i < optimizedCode.length) {
				const op = getOp(optimizedCode[i]);
				const args = getArgs(optimizedCode[i]);

				const next = optimizedCode[i + 1];
				const nextOp = next ? getOp(next) : null;
				const nextArgs = next ? getArgs(next) : [];

				const nextNext = optimizedCode[i + 2];
				const nextnextOp = nextNext ? getOp(nextNext) : null;
				const nextnextArgs = nextNext ? getArgs(nextNext) : [];

				if (
					op === "PSH" &&
					next &&
					nextOp === "POP" &&
					args[0] === nextArgs[0]
				) {
					optimizedCode.splice(i, 2);
					changesMade = true;
					continue;
				}

				if (
					op === "POP" &&
					next &&
					nextOp === "PSH" &&
					args[0] === nextArgs[0]
				) {
					optimizedCode.splice(i, 2);
					changesMade = true;
					continue;
				}

				if (
					op === "PSH" &&
					nextOp === "POP" &&
					args[0].startsWith("#")
				) {
					const hexVal = args[0];
					const targetReg = nextArgs[0];
					optimizedCode[
						i
					] = `<span class='token-inst'>LDI</span> <span class='token-register'>${targetReg}</span>, <span class='token-value'>${hexVal}</span>`;
					optimizedCode.splice(i + 1, 1);
					changesMade = true;
					continue;
				}

				if (
					op === "PSH" &&
					(nextnextOp === "LDP" || nextOp === "HLT")
				) {
					optimizedCode.splice(i, 1);
					changesMade = true;
					continue;
				}

				i++;
			}
		}

		return optimizedCode;
	}

	emerald_padVars() {
		for (let i = 0; i < this.declaredVars.length; i++) {
			if (this.symbolTable[this.declaredVars[i]].isConst) {
				continue;
			}
			this.instructions.push(
				`<span class='label'>.var-${this.declaredVars[i]}</span>`
			);
			this.instructions.push(`<span class='token-value'>#00</span>`);
		}
	}

	fp8ToBitRepr(num) {
		num = Number(num);
		let signBit = num < 0 || (num === 0 && 1 / num < 0) ? 1 : 0;
		let absoluteNum = Math.abs(num);
		let result = "";

		if (absoluteNum === 0) {
			result = signBit === 0 ? "00000000" : "10000000";
		} else if (absoluteNum > 448) {
			result = `${signBit}1111111`;
		} else {
			let exponent = Math.floor(Math.log2(absoluteNum));
			let mantissaValue = absoluteNum / Math.pow(2, exponent);
			let biasedExponent = exponent + 7;

			if (biasedExponent < 0) {
				result = signBit === 0 ? "00000000" : "10000000";
			}
			if (biasedExponent >= 15) {
				result = `${signBit}1111111`;
			}

			let fractionalMantissa = mantissaValue - 1.0;
			let mantissaBitsInt = Math.round(
				fractionalMantissa * Math.pow(2, 3)
			);

			let signStr = String(signBit);
			let exponentStr = biasedExponent.toString(2).padStart(4, "0");
			let mantissaStr = mantissaBitsInt
				.toString(2)
				.padStart(3, "0")
				.substring(0, 3); // Ensure only 3 bits

			result = `${signStr}${exponentStr}${mantissaStr}`;
		}
		return parseInt(result, 2);
	}

	fp16ToBitRepr(value) {
		const buffer = new ArrayBuffer(2);
		const dataView = new DataView(buffer);
		dataView.setFloat16(0, value, false);
		const uint16Value = dataView.getUint16(0, false);
		const binaryString = uint16Value.toString(2);
		return parseInt(binaryString, 2);
	}
}
