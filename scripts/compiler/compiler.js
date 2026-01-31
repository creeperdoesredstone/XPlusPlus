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
	}

	compile(ast) {
		this.init();
		const res = new Result();

		res.register(this.visit(ast));
		if (res.error) return res;

		this.instructions.push("HALT");

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
			if (node.value.constructor.name.includes("Literal")) {
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

		if (node instanceof Nodes.Identifier) {
			if (this.symbolTable[node.value]?.value) {
				const value = this.optimize(
					copyObjectWithPrototype(
						this.symbolTable[node.value]?.value,
					),
				);
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
			default:
				return 0;
		}
	}

	visit(node) {
		if (node === null) return new Result().success(null);

		const optimizedNode = this.optimize(node);
		const nodeType = optimizedNode.constructor.name;
		const method = this["visit" + nodeType] ?? this.undefinedVisit;
		return method.call(this, optimizedNode);
	}

	undefinedVisit(node) {
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

	visitStatements(node) {
		const res = new Result();

		node.body.forEach((stmt) => {
			res.register(this.visit(stmt));
			if (res.error) return res;
		});

		return res.success(null);
	}

	visitIntLiteral(node) {
		if (this.isCurrentlyFMod) this.instructions.push("CMOD int");
		const value = (Number(node.value) & 0xffff) >>> 0;
		const hexValue = value.toString(16).toUpperCase();
		this.instructions.push(`LDIR AX, #${hexValue.padStart(4, "0")}`);

		this.isCurrentlyFMod = false;

		return new Result().success(node);
	}

	visitFloatLiteral(node) {
		if (!this.isCurrentlyFMod) this.instructions.push("CMOD float");
		const value = this.toFP16(Number(node.value));
		const hexValue = value.toString(16);
		this.instructions.push(`LDIR AX, #${hexValue.padStart(4, "0")}`);

		this.isCurrentlyFMod = true;

		return new Result().success(node);
	}

	visitIdentifier(node) {
		const res = new Result();
		if (res.error) return res;

		if (!this.symbolTable[node.value])
			return res.fail(
				new Exception(
					node.startPos,
					node.endPos,
					"SymbolError",
					`Symbol '${node.value}' is undefined.`,
				),
			);

		this.instructions.push("LDIR BX, $" + node.value);
		this.instructions.push("LOAD AX, @BX");

		return res.success(null);
	}

	visitBinaryOpNode(node) {
		const res = new Result();

		res.register(this.visit(node.left));
		if (res.error) return res;
		const leftMod = this.isCurrentlyFMod;
		this.instructions.push("PUSH AX");

		res.register(this.visit(node.right));
		if (res.error) return res;
		const rightMod = this.isCurrentlyFMod;
		this.instructions.push("POP DX");

		if (leftMod !== rightMod) {
			this.instructions.push(leftMod ? "CAST AX, AX" : "CAST DX, DX"); // allows for int + fp16 or vice versa
		}

		const opMap = {
			"+": "ADD",
			"-": "SUB",
			"*": "MUL",
			"/": "DIV",
			"%": "MOD",
			"**": "POW",
		};

		this.instructions.push(`${opMap[node.op.value]} DX, AX, AX`);
		return res.success(null);
	}

	visitUnaryOpNode(node) {
		const res = new Result();

		if (node.op.value === "+") return res.success(null);

		res.register(this.visit(node.value));
		if (res.error) return res;

		this.instructions.push(`LDIR DX, #0000`);
		this.instructions.push("CALC SUB DX, AX, AX");

		return res.success(null);
	}

	visitVarDeclaration(node) {
		const res = new Result();

		res.register(this.visit(node.value));
		if (res.error) return res;

		if (this.symbolTable[node.symbol])
			return res.fail(
				new Exception(
					node.startPos,
					node.endPos,
					"SymbolError",
					`Symbol '${node.symbol}' is already defined.`,
				),
			);

		this.symbolTable[node.symbol] = {
			value: node.value,
			type: node.dataType,
			size: 1,
		};
		this.instructions.push("LDIR BX, $" + node.symbol);
		this.instructions.push("STRE @BX, AX");

		return res.success(null);
	}

	visitAssignment(node) {
		const res = new Result();

		res.register(this.visit(node.value));
		if (res.error) return res;

		console.log(this.symbolTable)

		if (!this.symbolTable[node.symbol])
			return res.fail(
				new Exception(
					node.startPos,
					node.endPos,
					"SymbolError",
					`Symbol '${node.symbol}' is undefined.`,
				),
			);

		this.symbolTable[node.symbol] = {
			value: node.value,
			type: node.dataType,
			size: 1,
		};
		this.instructions.push("LDIR BX, $" + node.symbol);
		this.instructions.push("STRE @BX, AX");

		return res.success(null);
	}
}
