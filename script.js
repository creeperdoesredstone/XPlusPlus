class Lexer {
	constructor(fn, ftxt) {
		this.ftxt = ftxt;
		this.pos = new Position(-1, 0, -1, fn, ftxt);
		this.currentChar = null;
		this.advance();
	}

	advance() {
		this.pos.advance(this.currentChar);
		this.currentChar =
			this.pos.idx < this.ftxt.length ? this.ftxt[this.pos.idx] : null;
	}

	lex() {
		const tokens = [];
		let ttype, lastTokType, resStr, startPos, endPos;

		while (this.currentChar !== null) {
			lastTokType =
				tokens.length > 0 ? tokens.at(-1).type.description : null;
			switch (true) {
				case this.currentChar === " ":
				case this.currentChar === "\t":
				case this.currentChar === " ":
				case this.currentChar === "\n":
					this.advance();
					break;
				case this.currentChar === ";":
					tokens.push(
						new Token(
							TT.SEMI,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === ":":
					tokens.push(
						new Token(
							TT.COL,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "+":
					ttype = TT.ADD;
					if (
						tokens.length === 0 ||
						lastTokType === "LPR" ||
						lastTokType in operators ||
						lastTokType === "SEMI"
					)
						ttype = TT.UADD;

					tokens.push(
						new Token(
							ttype,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "-":
					ttype = TT.SUB;
					if (
						tokens.length === 0 ||
						lastTokType === "LPR" ||
						lastTokType in operators ||
						lastTokType === "SEMI"
					)
						ttype = TT.USUB;

					tokens.push(
						new Token(
							ttype,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "*":
					tokens.push(
						new Token(
							TT.MUL,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "/":
					tokens.push(
						new Token(
							TT.DIV,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "%":
					tokens.push(
						new Token(
							TT.MOD,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "^":
					tokens.push(
						new Token(
							TT.POW,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "(":
					tokens.push(
						new Token(
							TT.LPR,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === ")":
					tokens.push(
						new Token(
							TT.RPR,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case this.currentChar === "=":
					tokens.push(
						new Token(
							TT.ASGN,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;
				case DIGITS.indexOf(this.currentChar) > -1:
					let dotCount = 0;
					resStr = "";
					startPos = this.pos.copy();
					endPos = this.pos.copy();

					while (
						this.currentChar !== null &&
						(DIGITS.indexOf(this.currentChar) > -1 ||
							this.currentChar === ".")
					) {
						if (this.currentChar === ".") dotCount++;
						if (dotCount > 1) break;

						resStr += this.currentChar;
						endPos = this.pos.copy();
						this.advance();
					}
					tokens.push(
						new Token(
							dotCount > 0 ? TT.FLOAT : TT.INT,
							resStr,
							startPos,
							endPos
						)
					);
					break;
				case LETTERS.indexOf(this.currentChar) > -1:
					resStr = "";
					startPos = this.pos.copy();
					endPos = this.pos.copy();

					while (
						this.currentChar !== null &&
						VALID_IDEN.indexOf(this.currentChar) > -1
					) {
						resStr += this.currentChar;
						endPos = this.pos.copy();
						this.advance();
					}
					tokens.push(
						new Token(
							KEYWORDS.includes(resStr) ? TT.KEYW : TT.IDEN,
							resStr,
							startPos,
							endPos
						)
					);
					break;
				default:
					const error = new Error_UnknownChar(
						this.pos.copy(),
						this.pos.copy(),
						`'${this.currentChar}'`
					);
					return new Result().fail(error);
			}
		}

		if (tokens.length > 0 && tokens.at(-1).type !== TT.SEMI)
			return new Result().fail(
				new Error_InvalidSyntax(
					tokens.at(-1).startPos,
					tokens.at(-1).endPos,
					"Expected ';' after statement."
				)
			);

		tokens.push(new Token(TT.EOF, undefined, undefined, undefined));
		return new Result().success(tokens);
	}
}

class Parser {
	constructor(tokens) {
		this.tokens = tokens;
		this.pos = -1;
		this.currentTok = null;
		this.advance();
		this.declaredVars = new Set();
		this.readOnlyVars = new Set();
		this.nextIdenForAssignment = null;
	}

	advance() {
		this.pos++;
		if (this.pos < this.tokens.length)
			this.currentTok = this.tokens[this.pos];
	}

	finalizeStatement(outputQueue, operatorStack, res) {
		while (operatorStack.length > 0) {
			let topOfStack = operatorStack.at(-1);

			if (topOfStack.type === TT.LPR) {
				return res.fail(
					new Error_InvalidSyntax(
						topOfStack.startPos,
						topOfStack.endPos,
						"Mismatched parenthesis: Expected ')' before statement end."
					)
				);
			}

			outputQueue.push(operatorStack.pop());
		}

		return res.success(null);
	}

	parse() {
		const outputQueue = [];
		const operatorStack = [];
		const res = new Result();

		while (this.currentTok.type !== TT.EOF) {
			switch (true) {
				case this.currentTok.type === TT.INT:
				case this.currentTok.type === TT.FLOAT:
				case this.currentTok.type === TT.IDEN:
					outputQueue.push(this.currentTok);
					this.advance();
					break;

				case this.currentTok.type === TT.KEYW:
					switch (this.currentTok.value) {
						case "var":
						case "const":
							const isConst = this.currentTok.value === "const";
							this.advance();
							if (this.currentTok.type !== TT.IDEN)
								return res.fail(
									new Error_InvalidSyntax(
										this.currentTok.startPos,
										this.currentTok.endPos,
										"Expected identifier after 'var' keyword."
									)
								);

							const varName = this.currentTok.value;
							this.nextIdenForAssignment = this.currentTok;
							this.nextIdenForAssignment.type = TT.TOASSIGN;
							this.nextIdenForAssignment.isConst = isConst;

							if (this.declaredVars.has(varName)) {
								return res.fail(
									new Error_InvalidSyntax(
										this.currentTok.startPos,
										`Variable '${varName}' already declared`
									)
								);
							}
							this.declaredVars.add(varName);
							this.advance();

							if (isConst) this.readOnlyVars.add(varName);

							if (this.currentTok.type !== TT.COL)
								return res.fail(
									new Error_InvalidSyntax(
										this.currentTok.startPos,
										this.currentTok.endPos,
										"Expected ':' after identifier in var declaration."
									)
								);
							this.advance();

							if (
								this.currentTok.type !== TT.KEYW ||
								DATATYPES.indexOf(this.currentTok.value) === -1
							) {
								console.log(this.currentTok);
								return res.fail(
									new Error_InvalidSyntax(
										this.currentTok.startPos,
										this.currentTok.endPos,
										"Expected a data type after ':'."
									)
								);
							}
							this.nextIdenForAssignment.dataType =
								this.currentTok.value;
							this.advance();

							if (this.currentTok.type !== TT.ASGN)
								return res.fail(
									new Error_InvalidSyntax(
										this.currentTok.startPos,
										this.currentTok.endPos,
										"Expected '=' after data type in var declaration."
									)
								);
							break;

						default:
							return res.fail(
								new Error_InvalidSyntax(
									this.currentTok.startPos,
									this.currentTok.endPos,
									`Unexpected keyword: ${this.currentTok.value}`
								)
							);
					}
					break;

				case this.currentTok.type.description in operators:
					const o1 = this.currentTok;
					const o1Type = o1.type.description;
					let o2 = operatorStack.at(-1);
					let o2Type =
						o2 === undefined ? undefined : o2.type.description;

					if (o1Type === "ASGN") {
						let targetTok = null;
						if (this.nextIdenForAssignment) {
							targetTok = this.nextIdenForAssignment;
						} else {
							const lastOut =
								outputQueue.length > 0
									? outputQueue.pop()
									: null;
							if (lastOut && lastOut.type === TT.IDEN) {
								targetTok = lastOut;
							} else {
								return res.fail(
									new Error_InvalidSyntax(
										o1.startPos,
										o1.endPos,
										"Invalid assignment target."
									)
								);
							}
						}

						const targetName = targetTok.value || "";
						if (this.readOnlyVars.has(targetName) && !this.nextIdenForAssignment) {
							return res.fail(
								new Error_InvalidSyntax(
									o1.startPos,
									o1.endPos,
									`Cannot reassign to constant variable '${targetName}'.`
								)
							);
						}

						// Mark token as an assignment target and push to output queue.
						targetTok.type = TT.TOASSIGN;
						outputQueue.push(targetTok);
						this.nextIdenForAssignment = null;
					}

					while (
						o2 !== undefined &&
						o2Type !== "LPR" &&
						(operators[o2Type].prec > operators[o1Type].prec ||
							(operators[o2Type].prec ===
								operators[o1Type].prec &&
								operators[o1Type].assoc === "left"))
					) {
						outputQueue.push(operatorStack.pop());
						if (operatorStack.length > 0) {
							o2 = operatorStack.at(-1);
							o2Type = o2.type.description;
						} else o2 = undefined;
					}
					operatorStack.push(o1);
					this.advance();
					break;

				case this.currentTok.type === TT.LPR:
					operatorStack.push(this.currentTok);
					this.advance();
					break;

				case this.currentTok.type === TT.RPR:
					let topOfStack = operatorStack.at(-1);
					while (topOfStack.type !== TT.LPR) {
						if (operatorStack.length === 0)
							return res.fail(
								new Error_InvalidSyntax(
									this.currentTok.startPos,
									this.currentTok.endPos,
									"Mismatched parenthesis: ')' without matching '('."
								)
							);

						outputQueue.push(operatorStack.pop());
						topOfStack = operatorStack.at(-1);
					}

					if (topOfStack.type !== TT.LPR)
						return res.fail(
							new Error_InvalidSyntax(
								topOfStack.startPos,
								topOfStack.endPos,
								"Expected matching left parenthesis."
							)
						);
					operatorStack.pop();
					this.advance();
					break;

				case this.currentTok.type === TT.SEMI:
					this.advance();
					const finalizeResult = this.finalizeStatement(
						outputQueue,
						operatorStack,
						res
					);
					if (finalizeResult.error) return finalizeResult;
					outputQueue.push(
						new Token(
							TT.END,
							undefined,
							this.currentTok.startPos,
							this.currentTok.endPos
						)
					);
					break;

				default:
					return res.fail(
						new Error_InvalidSyntax(
							this.currentTok.startPos,
							this.currentTok.endPos,
							`Unrecognized token: ${this.currentTok}`
						)
					);
			}
		}

		const finalizeResult = this.finalizeStatement(
			outputQueue,
			operatorStack,
			res
		);
		if (finalizeResult.error) return finalizeResult;
		return res.success(outputQueue);
	}
}

const compileBtn = document.getElementById("compile-btn");
const code = document.getElementById("code");
const output = document.getElementById("output");
const rpnOutput = document.getElementById("rpn-output");

const rpnLabel = "<span class='label'>RPN</span>";
const outLabel = "<span class='label'>Assembly Output</span>";

const storeRes = document.getElementById("store-res");

const run = (fn, ftxt) => {
	rpnOutput.innerHTML = rpnLabel;
	output.innerHTML = outLabel;
	const asmLang = document.getElementById("language").value;

	if (!ftxt.trim()) return new Result().success([]);

	const lexer = new Lexer(fn, ftxt);
	const lexRes = lexer.lex();
	if (lexRes.error) return lexRes;

	const parser = new Parser(lexRes.value);
	const rpn = parser.parse();

	if (!rpn.error)
		rpnOutput.innerHTML = `${rpnLabel}<br>${rpn.value.join(", ")}`;
	else {
		rpnOutput.innerHTML = rpnLabel;
		return rpn;
	}

	const compiler = new Compiler(rpn.value, parser.declaredVars, asmLang);
	const asm = compiler.compile();
	return asm;
};

const compileCode = () => {
	const result = run("&lt;code&gt;", code.innerText.trimEnd());

	if (result.error) {
		output.innerHTML = result.error.toString();
	} else {
		output.innerHTML = `${outLabel}<br>${result.value.join("<br>")}`;
	}
};

compileBtn.addEventListener("click", compileCode);
