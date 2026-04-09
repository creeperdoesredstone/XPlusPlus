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

		this.symbols[iden.value] = {
			value: null,
			type: dataType,
			offset: offset,
		};
		return res.success(null);
	}

	get(iden) {
		const res = new Result();
		if (iden.value in this.symbols)
			return res.success(this.symbols[iden.value]);
		if (this.parent) return this.parent.get(iden.value);

		return res.fail(
			new Exception(
				iden.startPos,
				iden.endPos,
				"Symbol Error",
				`Symbol '${iden.value}' is undefined.`,
			),
		);
	}

	assign(iden, value) {
		this.symbols[iden].value = value;
	}

	invalidate(iden) {
		if (this.symbols[iden]) this.symbols[iden].value = null;
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
		this.canFoldVars = true;
		this.resetRegisters();
	}

	resetRegisters() {
		this.registers = {
			AX: null,
			BX: null,
			CX: null,
			DX: null,
			PC: null,
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

		return res.success(this.optimizeAsm(this.instructions));
	}

	optimizeNode(node, symbolTable) {
		if (node instanceof Nodes.BinaryOpNode) {
			node.left = this.optimizeNode(node.left, symbolTable);
			node.right = this.optimizeNode(node.right, symbolTable);

			if (!this.checkLeftRightTypes(node.left, node.right)) return node;

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
					? new Nodes.IntLiteral(
							node.startPos,
							node.endPos,
							Math.floor(result),
						)
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
			node.value = this.optimizeNode(node.value, symbolTable);

			if (node.value.constructor.name.includes("Literal")) {
				node.value.value++;
				return node.value;
			}
		}

		if (node instanceof Nodes.DecrementNode) {
			node.value = this.optimizeNode(node.value, symbolTable);

			if (node.value.constructor.name.includes("Literal")) {
				node.value.value--;
				return node.value;
			}
		}

		if (node instanceof Nodes.Identifier) {
			const symbol = symbolTable.get(node).value;
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

	optimizeAsm(instructions) {
		let optimizedInstructions = [...instructions];
		let changesMade = false;

		function getInstructionData(line) {
			if (!line || line.endsWith(":") || !line.includes(" ")) {
				return { instruction: line, data: [] };
			}
			const parts = line.split(" ");
			const instruction = parts[0];
			const data = parts.slice(1).join(" ").split(", ");
			return { instruction, data };
		}

		do {
			changesMade = false;
			for (let i = 0; i < optimizedInstructions.length - 1; i++) {
				const current = optimizedInstructions[i];
				const next = optimizedInstructions[i + 1];

				const c = getInstructionData(current);
				const n = getInstructionData(next);

				// redundant LOAD/STRE
				if (c.instruction === "LOAD" && n.instruction === "STRE") {
					if (c.data[0] === n.data[1] && c.data[1] === n.data[0]) {
						optimizedInstructions.splice(i + 1, 1);
						changesMade = true;
						break;
					}
				}

				// redundant MOVE AX, AX
				if (c.instruction === "MOVE" && c.data[0] === c.data[1]) {
					optimizedInstructions.splice(i, 1);
					changesMade = true;
					break;
				}

				// dead MOVE: MOVE AX, BX followed by MOVE BX, AX
				if (c.instruction === "MOVE" && n.instruction === "MOVE") {
					if (c.data[0] === n.data[1] && c.data[1] === n.data[0]) {
						optimizedInstructions.splice(i + 1, 1);
						changesMade = true;
						break;
					}
				}

				// redundant STRE/LOAD
				if (c.instruction === "STRE" && n.instruction === "LOAD") {
					if (c.data[0] === n.data[1] && c.data[1] === n.data[0]) {
						optimizedInstructions.splice(i + 1, 1);
						changesMade = true;
						break;
					}
				}

				// double register clear: LDIR AX, #0000 followed by LDIR AX, #0000
				if (c.instruction === "LDIR" && n.instruction === "LDIR") {
					if (c.data[0] === n.data[0] && c.data[1] === n.data[1]) {
						optimizedInstructions.splice(i + 1, 1);
						changesMade = true;
						break;
					}
				}
			}
		} while (changesMade);

		return optimizedInstructions;
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

	getModifiedVariables(node) {
		const modified = new Set();

		const walk = (n) => {
			console.log(n);
			if (!n) return;

			if (n instanceof Nodes.Assignment) {
				modified.add(n.symbol);
			}

			if (
				(n instanceof Nodes.IncrementNode ||
					n instanceof Nodes.DecrementNode ||
					n instanceof Nodes.UnaryOpNode) &&
				n.value instanceof Nodes.Identifier
			) {
				modified.add(n.value.value);
			}

			if (
				n instanceof Nodes.ForLoop &&
				n.startExpr instanceof Nodes.VarDeclaration
			) {
				modified.add(n.startExpr.symbol);
			}

			const children =
				n.body ||
				n.cases ||
				[n.left, n.right, n.value, n.condition].filter(Boolean);
			if (Array.isArray(children)) {
				children.forEach(walk);
			} else if (children && typeof children === "object") {
				Object.values(children).forEach(walk);
			}
		};

		walk(node);
		return Array.from(modified);
	}

	checkLeftRightTypes(leftNode, rightNode) {
		if (leftNode.type === "float" && rightNode.type === "int") return true;
		if (leftNode.type === "int" && rightNode.type === "float") return true;

		return leftNode.type === rightNode.type;
	}

	visit(node, symbolTable) {
		if (node === null) return new Result().success(null);

		const optimizedNode = this.optimizeNode(node, symbolTable);
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

	visitBoolLiteral(node, symbolTable) {
		if (this.isCurrentlyFMod) this.instructions.push("CMOD int");
		const value = node.value ? "#FFFF" : "#0000";
		this.load("AX", `${value}`);

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
			"CX",
			"#" + node.elements.length.toString(16).padStart(4, "0"),
		);
		this.instructions.push("STRE @HP, CX");
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

		if (!this.checkLeftRightTypes(node.left, node.right))
			return res.fail(
				new Exception(
					node.left.startPos,
					node.right.endPos,
					"Type Error",
					`Cannot perform operation '${node.op.value}' between '${node.left.type}' and '${node.right.type}'.`,
				),
			);

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
		const cmpOpMap = {
			"<": "LT",
			"<=": "LE",
			">": "GT",
			">=": "GE",
			"==": "EQ",
			"!=": "NE",
		};

		if (cmpOp.includes(node.op.value)) {
			this.instructions.push("COMP DX, AX");
			this.instructions.push(`BOOL ${cmpOpMap[node.op.value]}, AX`);
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

		this.instructions.push("$" + `${node.symbol}`);

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

		if (node.dimensions === 0) {
			symbolTable.define(node.symbol, node.dataType);
			symbolTable.assign(node.symbol, node.value);
		} else {
			symbolTable.define(node.symbol, "ptr");
		}

		this.instructions.push("INCR HP");
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

		if (symbolTable.symbols[node.symbol].type !== node.value.type)
			return res.fail(
				new Exception(
					node.value.startPos,
					node.value.endPos,
					"Type Error",
					`Cannot assign '${node.value.type}' to '${symbolTable.symbols[node.symbol].type}'.`,
				),
			);

		symbolTable.assign(node.symbol, node.value);
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

		const varName = node.startExpr?.symbol;
		symbolTable.invalidate(varName);

		const startLabel = this.labelCount++;
		const endLabel = this.labelCount++;

		this.canFoldVars = false;
		this.instructions.push(`F${startLabel}:`);

		this.resetRegisters();
		res.register(this.visit(node.endExpr, symbolTable));
		if (res.error) return res;

		if (this.instructions.at(-1).startsWith("BOOL "))
			this.instructions.pop();

		this.instructions.push(`LDIR CX, .F${endLabel}`);
		this.instructions.push(`JUMP CX, ${endMap[node.endExpr.op.value]}`);

		res.register(this.visit(node.body, symbolTable));
		if (res.error) return res;

		res.register(this.visit(node.stepExpr, symbolTable));
		if (res.error) return res;
		this.instructions.push(`LDIR CX, .F${startLabel}`);
		this.instructions.push(`JUMP CX, AL`);
		this.instructions.push(`F${endLabel}:`);

		const modifiedVars = this.getModifiedVariables(node.body);
		modifiedVars.forEach((varName) => symbolTable.invalidate(varName));

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

		if (this.instructions.at(-1).startsWith("BOOL "))
			this.instructions.pop();

		this.instructions.push(`LDIR CX, .W${endLabel}`);
		this.instructions.push(
			`JUMP CX, ${endMap[node.condition.op.value] ?? "EQ"}`,
		);

		res.register(this.visit(node.body, symbolTable));
		if (res.error) return res;
		this.instructions.push(`LDIR CX, .W${startLabel}`);
		this.instructions.push(`JUMP CX, AL`);
		this.instructions.push(`W${endLabel}:`);

		const modifiedVars = this.getModifiedVariables(node.body);
		console.log(modifiedVars);
		modifiedVars.forEach((varName) => symbolTable.invalidate(varName));

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
			_case.condition = this.optimizeNode(_case.condition);

			const modified = this.getModifiedVariables(_case.body);
			modified.forEach((varName) => symbolTable.invalidate(varName));

			if (_case.condition.constructor.name.includes("Literal")) {
				if (_case.condition.value === 0) continue;

				res.register(this.visit(_case.body, symbolTable));
				if (res.error) return res;
				return res.success(null);
			}

			const nextIfLabel = this.labelCount++;

			res.register(this.visit(_case.condition, symbolTable));
			if (res.error) return res;

			if (this.instructions.at(-1).startsWith("BOOL ")) {
				this.instructions.pop();
				this.instructions.push(`LDIR CX, .I${nextIfLabel}`);
				this.instructions.push(
					`JUMP CX, ${endMap[_case.condition.op.value]}`,
				);
			} else {
				this.instructions.push(`LDIR CX, .I${nextIfLabel}`);
				this.instructions.push(`JUMP CX, EQ`);
			}

			res.register(this.visit(_case.body, symbolTable));
			if (res.error) return res;
			this.instructions.push(`LDIR CX, .I${nextIfLabel}`);
			this.instructions.push(`JUMP CX, AL`);
			this.instructions.push(`I${nextIfLabel}:`);
		}

		this.instructions.push(`I${endIfLabel}:`);

		if (node.elseCase) {
			res.register(this.visit(node.elseCase, symbolTable));
			if (res.error) return res;

			const modifiedElse = this.getModifiedVariables(node.elseCase);
			modifiedElse.forEach((varName) => symbolTable.invalidate(varName));
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

		subSymbolTable.subType = node.returnType;
		console.log(node.returnType);

		this.instructions.push(`${subLabel}:`);
		this.resetRegisters();
		this.canFoldVars = false;
		this.instructions.push("PUSH BP");
		this.instructions.push("MOVE BP, SP");

		res.register(this.visit(node.body, subSymbolTable));
		if (res.error) return res;

		const hasTopLevelReturn = node.body.body.some(
			(stmt) => stmt instanceof Nodes.ReturnNode,
		);

		// Only push these instructions if the subroutine hasn't already
		// returned at the top level of the block.
		if (!hasTopLevelReturn) {
			this.instructions.push("MOVE SP, BP");
			this.instructions.push("POP BP");
			this.instructions.push("LDIR AX, #0000");
			this.instructions.push("RETN AL");
		}

		this.resetRegisters();
		this.canFoldVars = true;
		return res.success(null);
	}

	visitCallNode(node, symbolTable) {
		const res = new Result();

		node.args.toReversed().forEach((arg) => {
			res.register(this.visit(arg, symbolTable));
			if (res.error) return res;

			this.instructions.push("PUSH AX");
		});

		console.log(node);

		this.instructions.push(`LDIR CX, .sub_${node.symbol}`);
		this.instructions.push("CALL CX, AL");

		return res.success(null);
	}

	visitReturnNode(node, symbolTable) {
		const res = new Result();

		const writeReturn = () => {
			this.instructions.push("MOVE SP, BP");
			this.instructions.push("POP BP");
			this.instructions.push("RETN AL");
		};

		if (!symbolTable.subType)
			return res.fail(
				new Exception(
					node.startPos,
					node.endPos,
					"ReturnError",
					"Cannot return outside of a subroutine.",
				),
			);

		if (symbolTable.subType === "void") {
			if (node.value !== null)
				return res.fail(
					new Exception(
						node.startPos,
						node.endPos,
						"ReturnError",
						"Cannot return a value in a 'void' subroutine.",
					),
				);
			writeReturn();
			return res.success(null);
		}

		if (node.value === null)
			return res.fail(
				new Exception(
					node.startPos,
					node.endPos,
					"ReturnError",
					`Cannot return void in a '${symbolTable.subType}' subroutine.`,
				),
			);

		res.register(this.visit(node.value, symbolTable));
		if (res.error) return res;

		if (this.isCurrentlyFMod === (symbolTable.subType !== "float")) {
			console.log("passed checkpoint");
			return res.fail(
				new Exception(
					node.startPos,
					node.endPos,
					"ReturnError",
					`Cannot return a ${this.isCurrentlyFMod ? "float" : "int"} in a '${symbolTable.subType}' subroutine.`,
				),
			);
		}
		writeReturn();
		return res.success(null);
	}
}
