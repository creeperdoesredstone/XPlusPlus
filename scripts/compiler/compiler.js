import { Exception, Result } from "./helper.js";

class CompilationError extends Exception {
	constructor(startPos, endPos, details) {
		super(startPos, endPos, "Compilation Error", details);
	}
}

export class Xenon124Compiler {
	constructor() {
		this.instructions = [];
		this.isCurrentlyFMod = false;
	}

	compile(ast) {
		this.instructions = [];
		this.isCurrentlyFMod = false;
		const res = new Result();

		res.register(this.visit(ast));
		if (res.error) return res;

		this.instructions.push("HALT");

		return res.success(this.instructions);
	}

	visit(node) {
		const nodeType = node.constructor.name;
		const method = this["visit" + nodeType] ?? this.undefinedVisit;
		return method.call(this, node);
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

	visitIntLiteral(node) {
		if (this.isCurrentlyFMod) this.instructions.push("CMOD int");
		const value = Number(node.value);
		const hexValue = value.toString(16);
		this.instructions.push(`LDIR AX, #${hexValue.padStart(4, "0")}`);

		this.isCurrentlyFMod = false;

		return new Result().success(null);
	}

	visitFloatLiteral(node) {
		if (!this.isCurrentlyFMod) this.instructions.push("CMOD float");
		const value = this.toFP16(Number(node.value));
		const hexValue = value.toString(16);
		this.instructions.push(`LDIR AX, #${hexValue.padStart(4, "0")}`);

		this.isCurrentlyFMod = true;

		return new Result().success(null);
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
}
