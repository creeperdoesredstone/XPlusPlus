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
		this.type = "int";
	}
}

export class FloatLiteral {
	constructor(startPos, endPos, value) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.value = value;
		this.type = "float";
	}
}

export class Identifier {
	constructor(startPos, endPos, value, type) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.value = value;
		this.type = type;
	}
}

export class BinaryOpNode {
	constructor(startPos, endPos, left, op, right) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.left = left;
		this.op = op;
		this.right = right;
		this.type = this.determineType();
	}

	determineType() {
		const leftType = this.left.type;
		const rightType = this.right.type;

		if (["==", "!=", "<", ">"].includes(this.op.value)) {
			return "bool";
		}

		if (leftType === "float" || rightType === "float") return "float";

		return leftType;
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

export class ForLoop {
	constructor(startPos, endPos, startExpr, endExpr, stepExpr, body) {
		this.startPos = startPos;
		this.endPos = endPos;
		this.startExpr = startExpr;
		this.endExpr = endExpr;
		this.stepExpr = stepExpr;
		this.body = body;
	}
}

export function parse(tokens) {
	let pos = -1;
	let currentTok;
	const symbolTable = new SymbolTable();

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

	function statements(terminate = undefined) {
		const res = new Result();
		const stmts = [];
		const startPos = currentTok.startPos.copy();

		while (currentTok.type === TT.NEWL) advance();

		if (
			currentTok.type === TT.EOF ||
			(terminate !== undefined && currentTok.type === terminate)
		)
			return res.success(
				new Statements(startPos, currentTok.endPos, stmts),
			);

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

			if (
				currentTok.type === TT.EOF ||
				(terminate !== undefined && currentTok.type === terminate)
			)
				moreStatements = false;

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
				case "for":
					return forLoop();
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

		if (symbolTable.symbols.has(iden))
			return res.fail(
				new Exception(
					currentTok.startPos,
					currentTok.endPos,
					"Symbol Error",
					`Symbol '${iden}' is already defined.`,
				),
			);

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

		if (dataType !== value.type)
			return res.fail(
				new Exception(
					value.startPos,
					value.endPos,
					"Type Error",
					`Cannot assign '${value.type}' to '${dataType}'.`,
				),
			);

		symbolTable.define(iden, dataType, 1);

		return res.success(
			new VarDeclaration(startPos, value.endPos, iden, dataType, value),
		);
	}

	function forLoop() {
		const res = new Result();
		const startPos = currentTok.startPos.copy();
		advance();

		if (currentTok.type !== TT.LPAREN)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected '(' after 'for'.",
				),
			);
		advance();

		const startExpr = res.register(statement());
		if (res.error) return res;

		if (currentTok.type !== TT.SEMI)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected ';' after start expression.",
				),
			);
		advance();

		const endExpr = res.register(statement());
		if (res.error) return res;

		if (currentTok.type !== TT.SEMI)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected ';' after end expression.",
				),
			);
		advance();

		const stepExpr = res.register(statement());
		if (res.error) return res;

		if (currentTok.type !== TT.RPAREN)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected ')' after step expression.",
				),
			);
		advance();

		if (currentTok.type !== TT.LBRACE)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected '{' after loop initialization.",
				),
			);
		advance();

		const body = res.register(statements(TT.RBRACE));
		if (res.error) return res;

		console.log(body);

		if (currentTok.type !== TT.RBRACE)
			return res.fail(
				new InvalidSyntax(
					currentTok.startPos,
					currentTok.endPos,
					"Expected '}' after loop body.",
				),
			);
		const endPos = currentTok.endPos.copy();
		advance();

		return res.success(
			new ForLoop(startPos, endPos, startExpr, endExpr, stepExpr, body),
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
		const left = res.register(comparison());
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
			const value = res.register(comparison());
			if (res.error) return res;

			return res.success(
				new Assignment(left.startPos, value.endPos, left.value, value),
			);
		}
		return res.success(left);
	}

	function comparison() {
		return binaryOp(["<", "<=", "==", "!=", ">", ">="], additive);
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
		if (tok.type === TT.IDENT) {
			if (!symbolTable.symbols.has(tok.value))
				return res.fail(
					new Exception(
						tok.startPos,
						tok.endPos,
						"Symbol Error",
						`Symbol '${tok.value}' is undefined.`,
					),
				);
			return res.success(
				new Identifier(
					tok.startPos,
					tok.endPos,
					tok.value,
					symbolTable.symbols.get(tok.value).dataType,
				),
			);
		}
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
		this.compilerActions = [];
	}

	transform(node) {
		if (node instanceof BinaryOpNode) {
			node.left = this.transform(node.left);
			node.right = this.transform(node.right);
			return this.optimizeBinary(node);
		}
		if (node instanceof Statements) {
			let newBody = [];
			for (let i = 0; i < node.body.length; i++) {
				let current = node.body[i];
				let next = node.body[i + 1];

				// Check if current is a VarDeclaration or Assignment to 'x'
				// and the next is an Assignment to the same 'x'
				if (
					this.isOverwritten(current, next) &&
					current.dataType === next.value.type
				) {
					this.compilerActions.push({
						type: "opt",
						subsystem: "liveness",
						message: `removed dead store to symbol '${current.symbol || current.left.value}'`,
					});

					// change next
					if (current instanceof VarDeclaration) {
						node.body[i + 1] = new VarDeclaration(
							next.startPos.copy(),
							next.endPos.copy(),
							next.symbol,
							current.dataType,
							next.value,
						);
					}

					continue;
				}

				const transformed = this.transform(current);
				if (transformed) newBody.push(transformed);
			}
			node.body = newBody;
			return node;
		}
		if (node instanceof VarDeclaration) {
			const sym = this.symbolTable.symbols.get(node.symbol);

			if (sym && sym.useCount === 0) {
				this.compilerActions.push({
					type: "warn",
					subsystem: "unused-symb",
					message: `unused symbol '${node.symbol}'`,
				});
				return null;
			}

			node.value = this.transform(node.value);
			return node;
		}
		return node;
	}

	isOverwritten(current, next) {
		if (!next) return false;

		// Case 1: var sym: int = v1 followed by sym = v2
		if (current instanceof VarDeclaration && next instanceof Assignment) {
			return current.symbol === next.symbol;
		}

		// Case 2: sym = v1 followed by sym = v2
		if (current instanceof Assignment && next instanceof Assignment) {
			return current.symbol === next.symbol;
		}

		return false;
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
	} else if (node instanceof UnaryOpNode) {
		analyzeLiveness(node.value, symbolTable);
	} else if (node instanceof Assignment) {
		const sym = symbolTable.lookup(node.symbol);
		if (!sym) throw new Error(`Undefined variable: ${node.value}`);
	}
}

export function optimizeAST(ast) {
	const symbolTable = new SymbolTable();

	analyzeLiveness(ast, symbolTable);

	const transformer = new ASTTransformer(symbolTable);
	return {
		ast: transformer.transform(ast),
		compilerActions: transformer.compilerActions,
	};
}
