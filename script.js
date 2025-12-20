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
		this.nextChar =
			this.pos.idx < this.ftxt.length - 1
				? this.ftxt[this.pos.idx + 1]
				: null;
	}

	lex() {
		const tokens = [];
		let ttype, lastTokType, resStr, startPos, endPos;

		while (this.currentChar !== null) {
			lastTokType =
				tokens.length > 0 ? tokens.at(-1).type.description : null;
			startPos = this.pos.copy();

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

				case this.currentChar === ",":
					tokens.push(
						new Token(
							TT.COMMA,
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
					if (this.nextChar === "=") {
						ttype = TT.ADDBY;
						this.advance();
					}

					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
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
					if (this.nextChar === "=") {
						ttype = TT.SUBBY;
						this.advance();
					}

					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
					);
					this.advance();
					break;

				case this.currentChar === "*":
					ttype = TT.MUL;
					if (this.nextChar === "=") {
						ttype = TT.MULBY;
						this.advance();
					}
					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
					);
					this.advance();
					break;

				case this.currentChar === "/":
					ttype = TT.DIV;
					if (this.nextChar === "=") {
						ttype = TT.DIVBY;
						this.advance();
					} else if (this.nextChar === "/") {
						while (
							this.currentChar !== null &&
							this.currentChar !== "\n"
						)
							this.advance();
						break;
					}
					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
					);
					this.advance();
					break;

				case this.currentChar === "%":
					ttype = TT.MOD;
					if (this.nextChar === "=") {
						ttype = TT.MODBY;
						this.advance();
					}
					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
					);
					this.advance();
					break;

				case this.currentChar === "^":
					ttype = TT.POW;
					if (this.nextChar === "=") {
						ttype = TT.POWBY;
						this.advance();
					}
					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
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

				case this.currentChar === "{":
					tokens.push(
						new Token(
							TT.LBR,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;

				case this.currentChar === "}":
					tokens.push(
						new Token(
							TT.RBR,
							undefined,
							this.pos.copy(),
							this.pos.copy()
						)
					);
					this.advance();
					break;

				case this.currentChar === "=":
					ttype = TT.ASGN;
					if (this.nextChar === "=") {
						ttype = TT.EQ;
						this.advance();
					}

					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
					);
					this.advance();
					break;

				case this.currentChar === "<":
					ttype = TT.LT;
					if (this.nextChar === "=") {
						ttype = TT.LE;
						this.advance();
					} else if (this.nextChar === ">") {
						ttype = TT.NE;
						this.advance();
					}

					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
					);
					this.advance();
					break;

				case this.currentChar === ">":
					ttype = TT.GT;
					if (this.nextChar === "=") {
						ttype = TT.GE;
						this.advance();
					}

					tokens.push(
						new Token(ttype, undefined, startPos, this.pos.copy())
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

		if (
			tokens.length > 0 &&
			tokens.at(-1).type !== TT.SEMI &&
			tokens.at(-1).type !== TT.RBR
		)
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
		this.lastTok = null;
		this.advance();

		this.declaredVars = new Set();
		this.readOnlyVars = new Set();
		this.functions = new Map();
		this.nextIdenForAssignment = null;
	}

	advance() {
		this.lastTok = this.pos < 0 ? null : this.tokens[this.pos];
		this.pos++;
		if (this.pos < this.tokens.length)
			this.currentTok = this.tokens[this.pos];
	}

	peek() {
		return this.pos < this.tokens.length
			? this.tokens[this.pos + 1]
			: this.tokens.at(-1);
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
			this.parseSingleToken(outputQueue, operatorStack, res);
		}

		const finalizeResult = this.finalizeStatement(
			outputQueue,
			operatorStack,
			res
		);
		if (finalizeResult.error) return finalizeResult;
		return res.success(outputQueue);
	}

	parseSingleToken(outputQueue, operatorStack, res) {
		switch (true) {
			case this.currentTok.type === TT.INT:
			case this.currentTok.type === TT.FLOAT:
			case this.currentTok.type === TT.IDEN:
				if (
					this.currentTok.type === TT.IDEN &&
					this.peek().type === TT.LPR
				) {
					// Subroutine call
					const fn = this.functions.get(this.currentTok.value);
					if (!fn)
						return res.fail(
							new Error_Runtime(
								tok.startPos,
								tok.endPos,
								"Unknown function"
							)
						);

					this.advance(); // name
					this.advance(); // '('

					let argc = 0;
					while (this.lastTok.type !== TT.RPR) {
						this.parseExpressionUntil(
							[TT.COMMA, TT.RPR],
							outputQueue,
							res
						);
						argc++;
					}

					const callTok = new Token(
						TT.CALL,
						fn.label,
						this.currentTok.endPos,
						this.currentTok.endPos
					);
					callTok.argc = argc;

					outputQueue.push(callTok);
				} else {
					outputQueue.push(this.currentTok);
					this.advance();
				}
				break;

			case this.currentTok.type === TT.KEYW:
				const kw = this.currentTok.value;
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

					case "return":
						this.isReturning = true;
						this.advance();
						this.parseExpressionUntil(TT.SEMI, outputQueue, res);
						if (res.error) return res;
						outputQueue.push(
							new Token(
								TT.RET,
								undefined,
								this.currentTok.endPos,
								this.currentTok.endPos
							)
						);
						break;

					case "for":
						res.register(this.parseFor(outputQueue, res));
						break;
					case "while":
						res.register(this.parseWhile(outputQueue, res));
						break;
					case "sub":
						res.register(this.parseSub(outputQueue, res));
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
				if (kw !== "var" && kw !== "const") break;

			case this.currentTok.type.description in operators:
				const o1 = this.currentTok;
				const o1Type = o1.type.description;
				let o2 = operatorStack.at(-1);
				let o2Type = o2 === undefined ? undefined : o2.type.description;

				if (o1Type === "ASGN") {
					let targetTok = null;
					if (this.nextIdenForAssignment) {
						targetTok = this.nextIdenForAssignment;
					} else {
						const lastOut =
							outputQueue.length > 0 ? outputQueue.pop() : null;
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
					if (
						this.readOnlyVars.has(targetName) &&
						!this.nextIdenForAssignment
					) {
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
						(operators[o2Type].prec === operators[o1Type].prec &&
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

		return res.success(null);
	}

	parseExpressionUntil(endType, outputQueue, res) {
		const operatorStack = [];
		endType = typeof endType === "object" ? endType : [endType];

		while (!endType.includes(this.currentTok.type)) {
			if (this.currentTok.type === TT.EOF)
				return res.fail(
					new Error_InvalidSyntax(
						this.currentTok.startPos,
						this.currentTok.endPos,
						"Unexpected EOF"
					)
				);

			const r = this.parseSingleToken(outputQueue, operatorStack, res);
			if (r.error) return r;
		}

		this.advance(); // consume end token
		return this.finalizeStatement(outputQueue, operatorStack, res);
	}

	parseStatement(outputQueue, res) {
		const operatorStack = [];

		while (
			this.currentTok.type !== TT.SEMI &&
			this.currentTok.type !== TT.RBR
		) {
			const r = this.parseSingleToken(outputQueue, operatorStack, res);
			if (r.error) return r;
		}

		if (this.currentTok.type === TT.SEMI) this.advance();

		const r = this.finalizeStatement(outputQueue, operatorStack, res);
		if (r.error) return r;

		outputQueue.push(new Token(TT.END));
		return res.success(null);
	}

	parseFor(outputQueue, res) {
		this.advance(); // 'for'

		if (this.currentTok.type !== TT.LPR)
			return res.fail(
				new Error_InvalidSyntax(
					this.currentTok.startPos,
					this.currentTok.endPos,
					"Expected '(' after for"
				)
			);
		this.advance();

		this.parseExpressionUntil(TT.SEMI, outputQueue, res);
		outputQueue.push(new Token(TT.END));

		const startLabel = newLabel(
			this.currentTok.endPos,
			this.currentTok.endPos
		);
		const endLabel = newLabel(
			this.currentTok.endPos,
			this.currentTok.endPos
		);

		outputQueue.push(startLabel);
		this.parseExpressionUntil(TT.SEMI, outputQueue, res);
		outputQueue.push(
			new Token(
				TT.JMP_IF_FALSE,
				endLabel,
				this.currentTok.endPos,
				this.currentTok.endPos
			)
		);

		const updateQueue = [];
		this.parseExpressionUntil(TT.RPR, updateQueue, res);

		if (this.currentTok.type !== TT.LBR)
			return res.fail(
				new Error_InvalidSyntax(
					this.currentTok.startPos,
					this.currentTok.endPos,
					"Expected '{'"
				)
			);
		this.advance();

		while (this.currentTok.type !== TT.RBR) {
			const r = this.parseStatement(outputQueue, res);
			if (r.error) return r;
		}

		this.advance();

		outputQueue.push(...updateQueue);
		outputQueue.push(
			new Token(
				TT.JMP,
				startLabel,
				this.currentTok.endPos,
				this.currentTok.endPos
			)
		);
		outputQueue.push(endLabel);

		return res.success(null);
	}

	parseWhile(outputQueue, res) {
		this.advance();

		if (this.currentTok.type !== TT.LPR)
			return res.fail(
				new Error_InvalidSyntax(
					this.currentTok.startPos,
					this.currentTok.endPos,
					"Expected '(' after while"
				)
			);
		this.advance();

		const startLabel = newLabel(
			this.currentTok.endPos,
			this.currentTok.endPos
		);
		const endLabel = newLabel(
			this.currentTok.endPos,
			this.currentTok.endPos
		);
		outputQueue.push(startLabel);

		this.parseExpressionUntil(TT.RPR, outputQueue, res);
		outputQueue.push(
			new Token(
				TT.JMP_IF_FALSE,
				endLabel,
				this.currentTok.endPos,
				this.currentTok.endPos
			)
		);

		if (this.currentTok.type !== TT.LBR)
			return res.fail(
				new Error_InvalidSyntax(
					this.currentTok.startPos,
					this.currentTok.endPos,
					"Expected '{'"
				)
			);
		this.advance();

		while (this.currentTok.type !== TT.RBR) {
			const r = this.parseStatement(outputQueue, res);
			if (r.error) return r;
		}

		this.advance();

		outputQueue.push(
			new Token(
				TT.JMP,
				startLabel,
				this.currentTok.endPos,
				this.currentTok.endPos
			)
		);
		outputQueue.push(endLabel);

		return res.success(null);
	}

	parseSub(outputQueue, res) {
		this.isReturning = false;
		this.advance(); // 'sub'

		if (this.currentTok.type !== TT.IDEN)
			return res.fail(
				new Error_InvalidSyntax(
					this.currentTok.startPos,
					this.currentTok.endPos,
					"Expected subroutine name after 'sub'."
				)
			);
		const fname = this.currentTok.value;
		this.advance();

		if (this.currentTok.type !== TT.LPR)
			return res.fail(
				new Error_InvalidSyntax(
					this.currentTok.startPos,
					this.currentTok.endPos,
					"Expected '(' after subroutine name."
				)
			);
		this.advance();

		const params = [];
		while (this.currentTok.type !== TT.RPR) {
			if (this.currentTok.type !== TT.IDEN)
				return res.fail(
					new Error_InvalidSyntax(
						this.currentTok.startPos,
						this.currentTok.endPos,
						"Expected parameter name"
					)
				);
			params.push(this.currentTok.value);
			this.declaredVars.add(this.currentTok.value);
			this.advance();

			if (this.currentTok.type === TT.COMMA) this.advance();
		}
		this.advance();

		const fnLabel = newLabel(
			this.currentTok.endPos,
			this.currentTok.endPos
		);
		this.functions.set(fname, { label: fnLabel, params });
		this.declaredVars.add(fname);

		const skipLabel = newLabel(
			this.currentTok.endPos,
			this.currentTok.endPos
		);
		outputQueue.push(
			new Token(
				TT.JMP,
				skipLabel,
				this.currentTok.endPos,
				this.currentTok.endPos
			)
		);

		outputQueue.push(fnLabel);

		for (let i = params.length - 1; i >= 0; i--) {
			outputQueue.push(
				new Token(
					TT.POP,
					params[i],
					this.currentTok.endPos,
					this.currentTok.endPos
				)
			);
		}

		if (this.currentTok.type !== TT.LBR)
			return res.fail(
				new Error_InvalidSyntax(
					this.currentTok.startPos,
					this.currentTok.endPos,
					"Expected '{'"
				)
			);
		this.advance();
		let body = this.currentTok;

		while (this.currentTok.type !== TT.RBR) {
			res.register(this.parseStatement(outputQueue, res));
			if (res.error) return res;
			body = this.currentTok;
		}
		this.advance();

		if (this.isReturning) return res.success(null);

		outputQueue.push(new Token(TT.PUSH, 0, body.endPos, body.endPos));
		outputQueue.push(
			new Token(TT.RET, undefined, body.endPos, body.endPos)
		);

		outputQueue.push(skipLabel);
		return res.success(null);
	}
}

const compileBtn = document.getElementById("compile-btn");
const code = document.getElementById("code");
const output = document.getElementById("output");
const rpnOutput = document.getElementById("rpn-output");

const rpnLabel = "<span class='label'>RPN</span>";
const outLabel = "<span class='label'>Assembly Output</span>";

const storeRes = document.getElementById("store-res");

const basePos = new Position(0, 0, 0, "&ltcode&gt", "");

function flattenSource(source, vfs, visited = new Set()) {
	// Regex matches: include <filename> // optional comment
	const regex = /^\s*include\s+<([^>]+)>(?:\s*\/\/.*)?$/gm;

	return source.replace(regex, (match, fileName) => {
		if (visited.has(fileName))
			throw new Error(`Circular include: ${fileName}`);

		const content = vfs[fileName];
		if (!content) throw new Error(`Module <${fileName}> not found.`);

		visited.add(fileName);
		return flattenSource(content, vfs, visited);
	});
}

const run = (fn, ftxt) => {
	labelCounter = 0;
	rpnOutput.innerHTML = rpnLabel;
	output.innerHTML = outLabel;
	const asmLang = document.getElementById("language").value;

	if (!ftxt.trim()) return new Result().success([]);

	try {
		const processedCode = flattenSource(ftxt, virtualFileSystem);

		const lexer = new Lexer(fn, processedCode);
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
	} catch (e) {
		basePos.fn = fn;
		return new Result().fail(
			new Error_Processing(basePos, basePos, e.message)
		);
	}
};

const compileCode = () => {
	let mainCode = code.innerText.trimEnd();
	const result = run(
		document.getElementById("fn").value || "&lt;code&gt;",
		mainCode
	);

	if (result.error) {
		output.innerHTML = result.error.toString();
	} else {
		output.innerHTML = `${outLabel}<br>${result.value.join("<br>")}`;
	}
};

compileBtn.addEventListener("click", compileCode);
