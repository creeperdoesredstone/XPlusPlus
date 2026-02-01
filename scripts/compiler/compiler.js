import { Exception, Result } from "./helper.js";
import * as Nodes from "./parser.js";

class CompilationError extends Exception {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Compilation Error", details);
	}
}

function copyObjectWithPrototype(orig) {
	const copy = Object.create(Object.getPrototypeOf(orig));

	for (const propName of Object.getOwnPropertyNames(orig)) {
		const descriptor = Object.getOwnPropertyDescriptor(orig, propName);
		Object.defineProperty(copy, propName, descriptor);
	}

	return copy;
}

export class SymbolTable {
	constructor(parent = undefined) {
		this.parent = parent;
		this.symbols = {};
	}

	define(iden, dataType, offset = 0) {
		const res = new Result();

		if (this.symbols[iden.value])
			return res.fail(
				new Exception(
					iden.startPos,
					iden.endPos,
					"Symbol Error",
					`Symbol '${iden.value}' is already defined.`,
				),
			);
		this.symbols[iden.value] = {
			type: dataType,
			offset: offset,
		};
		return res.success(null);
	}

	get(iden) {
		console.log(this);
		const res = new Result();
		if (iden.value in this.symbols)
			return res.success(this.symbols[iden.value]);
		if (this.parent) return this.parent.get(iden);

		return res.fail(
			new Exception(
				iden.startPos,
				iden.endPos,
				"Symbol Error",
				`Symbol '${iden.value}' is undefined.`,
			),
		);
	}
}

export class Xenon124Compiler {
	constructor() {
		this.init();
	}

	init() {
		this.instructions = [];
		this.isCurrentlyFMod = false;
		this.isAccessingRAM = true;
		this.labelCount = 0;
		this.symbolTable = {};
		this.currentScope = this.symbolTable; // global scope
		this.canFoldVars = true;
		this.resetRegisters();
	}

	resetRegisters() {
		this.registers = {
			AX: null,
			BX: null,
			CX: null,
			DX: null,
			EX: null,
			HP: null,
			SP: null,
			BP: null,
		};
	}

	compile(ast) {
		this.init();
		const res = new Result();
		const symbolTable = new SymbolTable();

		ast.body.forEach((stmt) => {
			res.register(this.visit(stmt, symbolTable));
			if (res.error) return res;
		});

		this.instructions.push("HALT");

		ast.subDefs.forEach((sub) => {
			res.register(this.visit(sub, symbolTable));
			if (res.error) return res;
		});

		return res.success(this.instructions);
	}

	optimize(node) {
		if (node instanceof Nodes.BinaryOpNode) {
			node.left = this.optimize(node.left);
			node.right = this.optimize(node.right);

			if (
				node.left.constructor.name.includes("Literal") &&
				node.right.constructor.name.includes("Literal")
			) {
				const result = this.evaluate(
					node.left.value,
					node.op.value,
					node.right.value,
				);
				return Number.isInteger(result)
					? new Nodes.IntLiteral(node.startPos, node.endPos, result)
					: new Nodes.FloatLiteral(
							node.startPos,
							node.endPos,
							result,
						);
			}
		}

		if (node instanceof Nodes.UnaryOpNode) {
			if (
				node.value.constructor.name.includes("Literal") &&
				"+-".includes(node.op.value)
			) {
				const val = Number(node.value.value);
				const result = node.op.value === "-" ? -val : val;

				return Number.isInteger(result)
					? new Nodes.IntLiteral(node.startPos, node.endPos, result)
					: new Nodes.FloatLiteral(
							node.startPos,
							node.endPos,
							result,
						);
			}
		}

		if (node instanceof Nodes.IncrementNode) {
			node.value = this.optimize(node.value);

			if (node.value.constructor.name.includes("Literal")) {
				node.value.value++;
				return node.value;
			}
		}

		if (node instanceof Nodes.DecrementNode) {
			node.value = this.optimize(node.value);

			if (node.value.constructor.name.includes("Literal")) {
				node.value.value--;
				return node.value;
			}
		}

		if (node instanceof Nodes.Identifier) {
			const symbol = this.symbolTable[node.value];
			// Only fold if it's a known constant literal
			if (
				this.canFoldVars &&
				symbol?.value &&
				symbol.value.constructor.name.includes("Literal")
			) {
				const value = copyObjectWithPrototype(symbol.value);
				value.startPos = node.startPos;
				value.endPos = node.endPos;
				return value;
			}
		}
		return node;
	}

	evaluate(left, op, right) {
		const l = Number(left);
		const r = Number(right);

		switch (op) {
			case "+":
				return l + r;
			case "-":
				return l - r;
			case "*":
				return l * r;
			case "/":
				if (r === 0) return 0; // Prevent division by zero errors during compilation
				return l / r;
			case "%":
				return l % r;
			case "**":
				return Math.pow(l, r);
			case "<":
				return -Number(l < r);
			case "<=":
				return -Number(l <= r);
			case ">":
				return -Number(l > r);
			case ">=":
				return -Number(l >= r);
			case "==":
				return -Number(l == r);
			case "!=":
				return -Number(l != r);
			default:
				return 0;
		}
	}

	load(reg, value) {
		if (this.registers[reg] !== value)
			this.instructions.push(`LDIR ${reg}, ${value}`);

		this.registers[reg] = value;
	}

	visit(node, symbolTable) {
		if (node === null) return new Result().success(null);

		const optimizedNode = this.optimize(node);
		const nodeType = optimizedNode.constructor.name;
		const method = this["visit" + nodeType] ?? this.undefinedVisit;
		return method.call(this, optimizedNode, symbolTable);
	}

	undefinedVisit(node, symbolTable) {
		return new Result().fail(
			new CompilationError(
				node.startPos,
				node.endPos,
				`Unknown visit method: visit${node.constructor.name}`,
			),
		);
	}

	toFP16(float32) {
		const buf = new ArrayBuffer(4);
		const view = new DataView(buf);
		view.setFloat32(0, float32);
		const f32 = view.getUint32(0);

		const s = (f32 >> 31) & 0x1;
		const e = (f32 >> 23) & 0xff;
		const m = f32 & 0x7fffff;

		let res;

		if (e === 0xff) {
			res = (s << 15) | 0x7c00 | (m ? 1 : 0);
		} else if (e === 0) {
			res = s << 15;
		} else {
			let newExp = e - 127 + 15;

			if (newExp >= 31) {
				res = (s << 15) | 0x7c00;
			} else if (newExp <= 0) {
				res = s << 15;
			} else {
				res = (s << 15) | (newExp << 10) | (m >> 13);
			}
		}

		return res;
	}

	visitStatements(node, symbolTable) {
		const res = new Result();

		node.body.forEach((stmt) => {
			res.register(this.visit(stmt, symbolTable));
			if (res.error) return res;
		});

		node.subDefs.forEach((sub) => {
			res.register(this.visit(sub, symbolTable));
			if (res.error) return res;
		});

		return res.success(null);
	}

	visitIntLiteral(node, symbolTable) {
		if (this.isCurrentlyFMod) this.instructions.push("CMOD int");
		const value = (Number(node.value) & 0xffff) >>> 0;
		const hexValue = value.toString(16).toUpperCase();
		this.load("AX", `#${hexValue.padStart(4, "0")}`);

		this.isCurrentlyFMod = false;

		return new Result().success(node);
	}

	visitFloatLiteral(node, symbolTable) {
		if (!this.isCurrentlyFMod) this.instructions.push("CMOD float");
		const value = this.toFP16(Number(node.value));
		const hexValue = value.toString(16);
		this.load("AX", `#${hexValue.padStart(4, "0")}`);

		this.isCurrentlyFMod = true;

		return new Result().success(node);
	}

	visitArrayLiteral(node, symbolTable) {
		const res = new Result();
		this.load(
			"EX",
			"#" + node.elements.length.toString(16).padStart(4, "0"),
		);
		this.instructions.push("STRE @HP, EX");
		this.instructions.push("MOVE DX, HP");
		this.instructions.push("INCR HP");

		node.elements.forEach((elem) => {
			res.register(this.visit(elem, symbolTable));
			if (res.error) return res;
			this.instructions.push("STRE @HP, AX");
			this.instructions.push("INCR HP");
		});

		return res.success(null);
	}

	visitIdentifier(node, symbolTable) {
		const res = new Result();

		const symb = res.register(symbolTable.get(node));
		if (res.error) return res;

		if (symb.offset === 0) {
			// regular variable
			this.load("BX", "$" + node.value);
			this.instructions.push("LOAD AX, @BX");
		} else {
			this.instructions.push(
				`LOAD AX, @BP+${symb.offset} ; ${node.value}`,
			);
		}

		return res.success(null);
	}

	visitBinaryOpNode(node, symbolTable) {
		const res = new Result();

		res.register(this.visit(node.left, symbolTable));
		if (res.error) return res;
		const leftMod = this.isCurrentlyFMod;
		this.instructions.push("PUSH AX");

		res.register(this.visit(node.right, symbolTable));
		if (res.error) return res;
		const rightMod = this.isCurrentlyFMod;
		this.instructions.push("POP DX");

		if (leftMod !== rightMod) {
			this.instructions.push(leftMod ? "CAST AX, AX" : "CAST DX, DX"); // allows for int + fp16 or vice versa
		}

		const cmpOp = ["<", "<=", ">", ">=", "==", "!="];

		if (cmpOp.includes(node.op.value)) {
			this.instructions.push("COMP DX, AX");
			return res.success(null);
		}

		const opMap = {
			"+": "ADD",
			"-": "SUB",
			"*": "MUL",
			"/": "DIV",
			"%": "MOD",
			"**": "POW",
		};

		this.resetRegisters();
		this.instructions.push(`${opMap[node.op.value]} DX, AX, AX`);
		return res.success(null);
	}

	visitUnaryOpNode(node, symbolTable) {
		const res = new Result();

		if (node.op.value === "+") return res.success(null);

		res.register(this.visit(node.value, symbolTable));
		if (res.error) return res;

		if (node.op.value === "-") {
			this.load("DX", "#0000");
			this.instructions.push("SUB DX, AX, AX");
		} else if (node.op.value === "++") {
			this.instructions.push("INCR AX");
			this.instructions.push("STRE @BX, AX");
		} else if (node.op.value === "--") {
			this.instructions.push("DECR AX");
			this.instructions.push("STRE @BX, AX");
		}

		return res.success(null);
	}

	visitIncrementNode(node, symbolTable) {
		const res = new Result();

		res.register(this.visit(node.value, symbolTable));
		if (res.error) return res;

		this.instructions.push("INCR AX");
		return res.success(null);
	}

	visitDecrementNode(node, symbolTable) {
		const res = new Result();

		res.register(this.visit(node.value, symbolTable));
		if (res.error) return res;

		this.instructions.push("DECR AX");
		return res.success(null);
	}

	visitVarDeclaration(node, symbolTable) {
		const res = new Result();

		if (node.dimensions > 0) this.instructions.push("MOVE DX, HP");
		console.log(node.symbol);

		res.register(this.visit(node.value, symbolTable));
		if (res.error) return res;

		res.register(
			symbolTable.define(
				new Nodes.Identifier(
					node.startPos,
					node.endPos,
					node.symbol,
					node.dataType,
				),
				node.dataType,
			),
		);
		if (res.error) return res;

		if (node.dimensions === 0)
			this.symbolTable[node.symbol] = {
				value: node.value,
				type: node.dataType,
				size: 1,
			};
		else {
			this.symbolTable[node.symbol] = {
				value: null,
				type: "ptr",
				size: node.value.elements.length,
			};
		}
		this.load("BX", "$" + node.symbol);
		this.instructions.push(
			node.dimensions > 0 ? "STRE @BX, DX" : "STRE @BX, AX",
		);

		return res.success(null);
	}

	visitAssignment(node, symbolTable) {
		const res = new Result();

		const opMap = {
			"+=": "ADD",
			"-=": "SUB",
			"*=": "MUL",
			"/=": "DIV",
			"%=": "MOD",
			"**=": "POW",
		};

		res.register(this.visit(node.value, symbolTable));
		if (res.error) return res;

		res.register(
			symbolTable.get(
				new Nodes.Identifier(
					node.startPos,
					node.endPos,
					node.symbol,
					"any",
				),
			),
		);
		if (res.error) return res;

		if (this.symbolTable[node.symbol].type !== node.value.type)
			return res.fail(
				new Exception(
					node.value.startPos,
					node.value.endPos,
					"Type Error",
					`Cannot assign '${node.value.type}' to '${this.symbolTable[node.symbol].type}'.`,
				),
			);

		this.symbolTable[node.symbol].value = node.value;
		this.load("BX", "$" + node.symbol);

		if (node.op !== "=") {
			this.instructions.push("LOAD DX, @BX");
			this.instructions.push(`${opMap[node.op]} DX, AX, AX`);
		}
		this.instructions.push("STRE @BX, AX");

		return res.success(null);
	}

	visitForLoop(node, symbolTable) {
		const endMap = {
			"<": "GE",
			">": "LE",
			"==": "NE",
			"<=": "GT",
			">=": "LT",
			"!=": "EQ",
		};

		const res = new Result();
		res.register(this.visit(node.startExpr, symbolTable));
		if (res.error) return res;

		const startLabel = this.labelCount++;
		const endLabel = this.labelCount++;

		this.canFoldVars = false;
		this.instructions.push(`F${startLabel}:`);

		this.resetRegisters();
		res.register(this.visit(node.endExpr, symbolTable));
		if (res.error) return res;
		this.instructions.push(
			`JUMP ${endMap[node.endExpr.op.value]}, .F${endLabel}`,
		);

		res.register(this.visit(node.body, symbolTable));
		if (res.error) return res;

		res.register(this.visit(node.stepExpr, symbolTable));
		if (res.error) return res;
		this.instructions.push(`JUMP AL, .F${startLabel}`);
		this.instructions.push(`F${endLabel}:`);

		this.canFoldVars = true;
		this.resetRegisters();
		return res.success(null);
	}

	visitWhileLoop(node, symbolTable) {
		const res = new Result();

		const endMap = {
			"<": "GE",
			">": "LE",
			"==": "NE",
			"<=": "GT",
			">=": "LT",
			"!=": "EQ",
		};

		const startLabel = this.labelCount++;
		const endLabel = this.labelCount++;

		this.canFoldVars = false;
		this.instructions.push(`W${startLabel}:`);
		this.resetRegisters();

		res.register(this.visit(node.condition, symbolTable));
		if (res.error) return res;

		this.instructions.push(
			`JUMP ${endMap[node.condition.op.value]}, .W${endLabel}`,
		);

		res.register(this.visit(node.body, symbolTable));
		if (res.error) return res;
		this.instructions.push(`JUMP AL, .W${startLabel}`);
		this.instructions.push(`W${endLabel}:`);

		this.canFoldVars = true;
		this.resetRegisters();
		return res.success(null);
	}

	visitIfStatement(node, symbolTable) {
		const res = new Result();

		const endMap = {
			"<": "GE",
			">": "LE",
			"==": "NE",
			"<=": "GT",
			">=": "LT",
			"!=": "EQ",
		};

		const endIfLabel = this.labelCount++;

		for (let i = 0; i < node.cases.length; i++) {
			const _case = node.cases[i];
			_case.condition = this.optimize(_case.condition);

			if (_case.condition.constructor.name.includes("Literal")) {
				if (_case.condition.value === 0) continue;

				res.register(this.visit(_case.body, symbolTable));
				if (res.error) return res;
				return res.success(null);
			}

			const nextIfLabel = this.labelCount++;

			res.register(this.visit(_case.condition, symbolTable));
			if (res.error) return res;
			if (_case.condition instanceof Nodes.BinaryOpNode)
				this.instructions.push(
					`JUMP ${endMap[_case.condition.op.value]}, .I${nextIfLabel}`,
				);
			else this.instructions.push(`JUMP EQ, .I${nextIfLabel}`);

			res.register(this.visit(_case.body, symbolTable));
			if (res.error) return res;
			this.instructions.push(`JUMP AL, .I${endIfLabel}`);
			this.instructions.push(`I${nextIfLabel}:`);
		}

		this.instructions.push(`I${endIfLabel}:`);

		if (node.elseCase) {
			res.register(this.visit(node.elseCase, symbolTable));
			if (res.error) return res;
		}

		return res.success(null);
	}

	visitArrayAccess(node, symbolTable) {
		const res = new Result();
		let indexIsZero = false;

		res.register(this.visit(node.index, symbolTable));
		if (res.error) return res;

		if (this.instructions.at(-1) === "LDIR AX, #0000") {
			this.instructions.pop();
			indexIsZero = true;
		}

		res.register(this.visit(node.array, symbolTable));
		if (res.error) return res;
		this.instructions.pop();

		if (!indexIsZero) this.instructions.push("ADD AX, BX, BX");
		this.instructions.push("INCR BX");
		this.instructions.push("LOAD AX, @BX");

		return res.success(null);
	}

	visitArraySet(node, symbolTable) {
		const res = new Result();

		const opMap = {
			"+=": "ADD",
			"-=": "SUB",
			"*=": "MUL",
			"/=": "DIV",
			"%=": "MOD",
			"**=": "POW",
		};

		res.register(this.visit(node.value, symbolTable));
		if (res.error) return res;
		this.instructions.push("PUSH AX");

		res.register(this.visit(node.accessor, symbolTable));
		if (res.error) return res;

		if (node.op === "=") {
			this.instructions.pop();
			this.instructions.push("POP @BX");
		} else {
			this.instructions.push("POP DX");
			this.instructions.push(`${opMap[node.op]} DX, AX, AX`);
			this.instructions.push("STRE @BX, AX");
		}

		return res.success(null);
	}

	visitSubroutineDef(node, symbolTable) {
		const res = new Result();
		const subLabel = `sub_${node.name}`;

		if (this.symbolTable[node.symbol])
			return res.fail(
				new Exception(
					node.startPos,
					node.endPos,
					"Symbol Error",
					`Symbol '${node.symbol}' is already defined.`,
				),
			);

		const subSymbolTable = new SymbolTable(symbolTable);

		node.params.forEach((param, index) => {
			subSymbolTable.define(
				new Nodes.Identifier(
					node.startPos,
					node.endPos,
					param.name,
					param.type,
				),
				param.type,
				index + 1,
			);
		});

		this.instructions.push(`${subLabel}:`);
		this.resetRegisters();
		this.canFoldVars = false;
		this.instructions.push("PUSH BP");
		this.instructions.push("MOVE BP, SP");

		res.register(this.visit(node.body, subSymbolTable));
		if (res.error) return res;

		this.instructions.push("MOVE SP, BP");
		this.instructions.push("POP BP");
		this.instructions.push("RETN AL");

		this.resetRegisters();
		this.canFoldVars = true;
		return res.success(null);
	}
}
