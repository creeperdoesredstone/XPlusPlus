import { TT, Exception, Result, dataTypes } from "./helper.js";

class InvalidSyntax extends Exception {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Invalid Syntax", details);
	}
}

export class Statements {
	constructor(startPos, endPos, body) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.body = body;
	}
}

export class IntLiteral {
	constructor(startPos, endPos, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.value = value;
	}
}

export class FloatLiteral {
	constructor(startPos, endPos, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.value = value;
	}
}

export class Identifier {
	constructor(startPos, endPos, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.value = value;
	}
}

export class BinaryOpNode {
	constructor(startPos, endPos, left, op, right) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.left = left;
		this.op = op;
		this.right = right;
	}
}

export class UnaryOpNode {
	constructor(startPos, endPos, op, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.op = op;
		this.value = value;
	}
}

export class VarDeclaration {
	constructor(startPos, endPos, symbol, dataType, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.symbol = symbol;
		this.dataType = dataType;
		this.value = value;
	}
}

export class Assignment {
	constructor(startPos, endPos, symbol, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.symbol = symbol;
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
		const startPos = currentTok.startPos.copy();

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

			if (currentTok.type === TT.EOF) moreStatements = false;

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

		if (res.error) return res;

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
		const res = new Result();
		const left = res.register(additive());
		if (res.error) return res;

		if (currentTok.matches(TT.OP, "=")) {
			if (!(left instanceof Identifier)) {
				return res.fail(
					InvalidSyntax(
						left.startPos,
						left.endPos,
						"Expected an identifier before '='.",
					),
				);
			}

			advance();
			const value = res.register(additive());
			if (res.error) return res;

			return res.success(
				new Assignment(left.startPos, value.endPos, left.value, value),
			);
		}
		return res.success(left);
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
		return power();
	}

	function power() {
		return binaryOp(["**"], literal, multiplicative);
	}

	function literal() {
		const res = new Result();
		const tok = currentTok;
		advance();

		if (tok.type === TT.INT)
			return res.success(
				new IntLiteral(tok.startPos, tok.endPos, Number(tok.value)),
			);
		if (tok.type === TT.FLOAT)
			return res.success(
				new FloatLiteral(tok.startPos, tok.endPos, Number(tok.value)),
			);
		if (tok.type === TT.IDENT)
			return res.success(
				new Identifier(tok.startPos, tok.endPos, tok.value),
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
				`Unexpected token: ${tok.type.description}`,
			),
		);
	}
}

class Symbol {
	constructor(name, dataType, address) {
		this.name = name;
		this.dataType = dataType;
		this.address = address;
		this.useCount = 0;
		this.isDead = false;
	}
}

export class SymbolTable {
	constructor() {
		this.symbols = new Map();
		this.nextAddress = 0x0000;
	}

	define(name, dataType, size = 1) {
		const symbol = new Symbol(name, dataType, this.nextAddress);
		this.symbols.set(name, symbol);
		this.nextAddress += size;
		return symbol;
	}

	lookup(name) {
		const symbol = this.symbols.get(name);
		if (symbol) symbol.useCount++;
		return symbol;
	}
}

export class ASTTransformer {
	constructor(symbolTable) {
		this.symbolTable = symbolTable;
		this.prunedVars = [];
	}

	transform(node) {
		if (node instanceof BinaryOpNode) {
			node.left = this.transform(node.left);
			node.right = this.transform(node.right);
			return this.optimizeBinary(node);
		}
		if (node instanceof Statements) {
			node.body = node.body.map((s) => this.transform(s));

			return node;
		}
		if (node instanceof VarDeclaration) {
			const sym = this.symbolTable.symbols.get(node.symbol);

			if (sym && sym.useCount === 0) {
				this.prunedVars.push(node.symbol);
				return null;
			}

			node.value = this.transform(node.value);
			return node;
		}
		return node;
	}

	optimizeBinary(node) {
		// x + 0 = x
		if (node.op.matches(TT.OP, "+") && node.right.value === 0)
			return node.left;
		if (node.op.matches(TT.OP, "+") && node.left.value === 0)
			return node.right;

		// x * 0 = 0
		if (node.op.matches(TT.OP, "*") && node.right.value === 0)
			return node.right;
		if (node.op.matches(TT.OP, "*") && node.left.value === 0)
			return node.left;

		// x * 1 = x
		if (node.op.matches(TT.OP, "*") && node.right.value === 1)
			return node.left;
		if (node.op.matches(TT.OP, "*") && node.left.value === 1)
			return node.right;

		return node;
	}
}

function analyzeLiveness(node, symbolTable) {
	if (node instanceof Statements) {
		node.body.forEach((stmt) => analyzeLiveness(stmt, symbolTable));
	} else if (node instanceof VarDeclaration) {
		symbolTable.define(node.symbol, node.dataType);
		analyzeLiveness(node.value, symbolTable);
	} else if (node instanceof Identifier) {
		const sym = symbolTable.lookup(node.value);
		if (!sym) throw new Error(`Undefined variable: ${node.value}`);
	} else if (node instanceof BinaryOpNode) {
		analyzeLiveness(node.left, symbolTable);
		analyzeLiveness(node.right, symbolTable);
	}
}

export function optimizeAST(ast) {
	const symbolTable = new SymbolTable();

	analyzeLiveness(ast, symbolTable);

	const transformer = new ASTTransformer(symbolTable);
	return {
		ast: transformer.transform(ast),
		prunedVars: transformer.prunedVars,
	};
}
