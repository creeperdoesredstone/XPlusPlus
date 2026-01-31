import { TT, Token, Exception, Position, Result, keywords } from "./helper.js";

class IllegalCharacter extends Exception {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Illegal Character", details);
	}
}

export function lex(fn, ftxt) {
	let currentChar = null;
	const pos = new Position(-1, 0, -1, fn, ftxt);
	let startPos;
	const res = new Result();

	let dotCount, resStr;

	const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const DIGITS = "0123456789";
	const VALID_IDEN = LETTERS + DIGITS + "_";

	function advance() {
		pos.advance(currentChar);
		currentChar = pos.idx < ftxt.length ? ftxt[pos.idx] : null;
	}

	advance();
	const tokens = [];

	while (currentChar !== null) {
		startPos = pos.copy();
		switch (true) {
			case currentChar === " ":
			case currentChar === "\t":
				advance();
				break;
			
			case currentChar === "\n":
				tokens.push(new Token(startPos, startPos, TT.NEWL));
				advance();
				break;

			case currentChar === ";":
				tokens.push(new Token(startPos, startPos, TT.SEMI));
				advance();
				break;
			
			case currentChar === ":":
				tokens.push(new Token(startPos, startPos, TT.COL));
				advance();
				break;

			case currentChar === "(":
				tokens.push(new Token(startPos, startPos, TT.LPAREN));
				advance();
				break;

			case currentChar === ")":
				tokens.push(new Token(startPos, startPos, TT.RPAREN));
				advance();
				break;

			case currentChar === "+":
			case currentChar === "-":
			case currentChar === "%": {
				const op = currentChar;
				advance();
				if (currentChar === "=") {
					tokens.push(new Token(startPos, pos.copy(), TT.OP, op + "="));
					advance();
				} else {
					tokens.push(new Token(startPos, startPos, TT.OP, op));
				}
				break;
			}
			
			case currentChar === "=":
				advance();
				if (currentChar === "=") {
					tokens.push(new Token(startPos, pos.copy(), TT.OP, "=="));
					advance();
				} else {
					tokens.push(new Token(startPos, startPos, TT.OP, "="));
				}
				break;

			case currentChar === "<":
				advance();
				if (currentChar === "=") {
					tokens.push(new Token(startPos, pos.copy(), TT.OP, "<="));
					advance();
				} else {
					tokens.push(new Token(startPos, startPos, TT.OP, "<"));
				}
				break;

			case currentChar === ">":
				advance();
				if (currentChar === "=") {
					tokens.push(new Token(startPos, pos.copy(), TT.OP, ">="));
					advance();
				} else {
					tokens.push(new Token(startPos, startPos, TT.OP, ">"));
				}
				break;

			case currentChar === "*":
				advance();
				if (currentChar === "*") {
					tokens.push(new Token(startPos, pos.copy(), TT.OP, "**"));
					advance();
					if (currentChar === "=") {
						tokens.at(-1).endPos = pos.copy();
						tokens.at(-1).value = "**=";
						advance();
					}
				} else if (currentChar === "=") {
					tokens.push(new Token(startPos, startPos, TT.OP, "*="));
					advance();
				} else {
					tokens.push(new Token(startPos, startPos, TT.OP, "*"));
				}
				break;

			case currentChar === "/":
				advance();
				if (currentChar === "/") {
					while (currentChar !== null && currentChar !== "\n")
						advance();
				} else if (currentChar === "=") {
					tokens.push(new Token(startPos, startPos, TT.OP, "/="));
					advance();
				} else {
					tokens.push(new Token(startPos, startPos, TT.OP, "/"));
				}
				break;

			case DIGITS.includes(currentChar):
				dotCount = 0;
				resStr = "";

				while (
					currentChar !== null &&
					(DIGITS.includes(currentChar) || currentChar === ".")
				) {
					if (currentChar === ".") dotCount++;
					if (dotCount > 1) break;

					resStr += currentChar;
					advance();
				}

				tokens.push(
					new Token(
						startPos,
						pos.copy(),
						dotCount ? TT.FLOAT : TT.INT,
						resStr,
					),
				);
				break;

			case ("_" + LETTERS).includes(currentChar):
				resStr = "";
				while (
					currentChar !== null &&
					VALID_IDEN.includes(currentChar)
				) {
					resStr += currentChar;
					advance();
				}

				tokens.push(
					new Token(
						startPos,
						pos.copy(),
						keywords.includes(resStr) ? TT.KEYW : TT.IDENT,
						resStr,
					),
				);
				break;

			default:
				return res.fail(
					new IllegalCharacter(
						startPos,
						pos.copy(),
						`'${currentChar}'`,
					),
				);
		}
	}

	tokens.push(new Token(pos.copy(), pos.copy(), TT.EOF));
	return res.success(tokens);
}
