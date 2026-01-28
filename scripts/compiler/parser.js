import { TT, Exception, Result, dataTypes } from "./helper.js";

class InvalidSyntax extends Exception {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Invalid Syntax", details);
	}
}

class Statements {
	constructor(startPos, endPos, body) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.body = body;
	}
}

class IntLiteral {
	constructor(startPos, endPos, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.value = value;
	}
}

class FloatLiteral {
	constructor(startPos, endPos, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.value = value;
	}
}

class BinaryOpNode {
	constructor(startPos, endPos, left, op, right) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.left = left;
		this.op = op;
		this.right = right;
	}
}

class UnaryOpNode {
	constructor(startPos, endPos, op, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.op = op;
		this.value = value;
	}
}

class VarDeclaration {
	constructor(startPos, endPos, symbol, dataType, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.symbol = symbol;
		this.dataType = dataType;
		this.value = value;
	}
}

export function parse(tokens) {
	let pos = -1;
	let currentTok;

	function advance() {
		pos++;
		if (pos < tokens.length) currentTok = tokens[pos];
	}
	advance();
	const res = new Result();
	const stmts = res.register(statements());
	if (res.error) return res;

	if (currentTok.type !== TT.EOF)
		return res.fail(
			new InvalidSyntax(
				currentTok.startPos,
				currentTok.endPos,
				"Expected an operator.",
			),
		);

	return res.success(stmts);

	function statements() {
		const res = new Result();
		const stmts = [];
		const startPos = currentTok.startPos;

		while (currentTok.type === TT.NEWL) advance();

		let stmt = res.register(statement());
		if (res.error) return res;
		stmts.push(stmt);

		let newlineCount;
		let moreStatements = true;

		while (true) {
			newlineCount = 0;
			while (currentTok.type === TT.NEWL) {
				advance();
				newlineCount++;
			}
			if (newlineCount === 0) moreStatements = false;

			if (!moreStatements) break;

			const tmpPos = pos;
			stmt = res.register(statement());
			if (res.error) {
				pos = tmpPos;
				currentTok = tokens[pos];
				moreStatements = false;
				continue;
			}
			stmts.push(stmt);
		}

		return res.success(new Statements(startPos, stmt.endPos, stmts));
	}

	function statement() {
		if (currentTok.type === TT.KEYW) {
			switch (currentTok.value) {
				case "var":
					return varDeclaration();
			}
		}
		return expr();
	}

	function varDeclaration() {
		const res = new Result();
		const startPos = currentTok.startPos.copy();
		advance();

		if (currentTok.type !== TT.IDENT)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected an identifier after 'var'.",
				),
			);
		const iden = currentTok.value;
		advance();

		if (currentTok.type !== TT.COL)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected ':' after identifier.",
				),
			);
		advance();

		if (
			currentTok.type !== TT.KEYW ||
			!dataTypes.includes(currentTok.value)
		)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected a data type after ':'.",
				),
			);
		const dataType = currentTok.value;
		advance();

		if (!currentTok.matches(TT.OP, "="))
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected '=' after data type.",
				),
			);
		advance();

		const value = res.register(expr());
		if (res.error) return res;

		return res.success(
			new VarDeclaration(startPos, value.endPos, iden, dataType, value),
		);
	}

	function binaryOp(ops, fLeft, fRight = undefined) {
		if (!fRight) fRight = fLeft;
		const res = new Result();

		let left = res.register(fLeft());
		if (res.error) return res;

		while (currentTok.type === TT.OP && ops.includes(currentTok.value)) {
			const op = currentTok;
			advance();

			const right = res.register(fRight());
			if (res.error) return res;

			left = new BinaryOpNode(
				left.startPos,
				right.endPos,
				left,
				op,
				right,
			);
		}

		return res.success(left);
	}

	function expr() {
		return additive();
	}

	function additive() {
		return binaryOp(["+", "-"], multiplicative);
	}

	function multiplicative() {
		return binaryOp(["*", "/", "%"], unary);
	}

	function unary() {
		const res = new Result();

		if (currentTok.type === TT.OP && "+-".includes(currentTok.value)) {
			const op = currentTok;
			advance();

			const value = res.register(unary());
			if (res.error) return res;

			return res.success(
				new UnaryOpNode(op.startPos, value.endPos, op, value),
			);
		}
		return literal();
	}

	function literal() {
		const res = new Result();
		const tok = currentTok;
		advance();

		if (tok.type === TT.INT)
			return res.success(
				new IntLiteral(tok.startPos, tok.endPos, tok.value),
			);
		if (tok.type === TT.FLOAT)
			return res.success(
				new FloatLiteral(tok.startPos, tok.endPos, tok.value),
			);
		if (tok.type === TT.LPAREN) {
			const expression = res.register(expr());
			if (res.error) return res;

			if (currentTok.type !== TT.RPAREN)
				return res.success(
					new InvalidSyntax(
						currentTok.startPos,
						currentTok.endPos,
						"Expected matching ')'.",
					),
				);
			advance();
			return res.success(expression);
		}

		return res.fail(
			new InvalidSyntax(
				tok.startPos,
				tok.endPos,
				`Unrecognized token: ${tok.type.description}`,
			),
		);
	}
}
