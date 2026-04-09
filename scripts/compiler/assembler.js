import { opcodes } from "./opdata.js";
import { Result, Exception, Position } from "./helper.js";

export class XenonAssembler {
	constructor() {
		this.opdata = opcodes;

		this.registers = {
			AX: 0,
			BX: 1,
			CX: 2,
			DX: 3,
			PC: 4,
			HP: 5,
			SP: 6,
			BP: 7,
		};

		this.flags = [
			"NV",
			"LT",
			"EQ",
			"LE",
			"GT",
			"NE",
			"GE",
			"ALNC",
			"CR",
			"CLT",
			"CEQ",
			"CLE",
			"CGT",
			"CNE",
			"CGE",
			"AL",
		];

		this.specialKeywords = {
			// CMOD
			int: 0,
			float: 1,

			// DISP
			update: 0,
			flip: 1,
			clear: 2,

			// SMEM
			DMEM: 0,
			PMEM: 1,

			// SHFT
			arith: 0,
			logic: 1,
			rotate: 2,
			crotate: 3,
		};
	}

	tokenize(line) {
		return line
			.split(";")[0]
			.replace(/,/g, " ")
			.trim()
			.split(/\s+/)
			.filter((t) => t !== "");
	}

	parseArgument(arg, symbolTable, bitWidth = 16) {
		if (arg.includes("+") || arg.includes("-")) {
			const operands = arg.includes("+")
				? arg.split("+")
				: arg.split("-");

			const regModifier =
				Math.pow(2, bitWidth + 1) *
				this.registers[operands[0].slice(1)];

			const value = parseInt(operands[1]);
			if (arg.includes("-")) value = Math.pow(2, bitWidth + 1) - value;

			return regModifier + value;
		}

		if (arg.startsWith("#")) return parseInt(arg.slice(1), 16);
		if (arg.startsWith(".") || arg.startsWith("$"))
			return symbolTable[arg.slice(1)];
		if (arg.startsWith("@")) return 8 + this.registers[arg.slice(1)];
		if (this.registers[arg] !== undefined) return this.registers[arg];
		if (this.flags.includes(arg)) return this.flags.indexOf(arg);
		if (this.specialKeywords[arg] !== undefined)
			return this.specialKeywords[arg];

		return arg;
	}

	getOpCode(instruction) {
		for (let i = 0; i < this.opcodes.length; i++) {
			if (this.opcodes[i].includes(instruction)) return i;
		}

		return -1;
	}

	assemble(source, fn) {
		const lines = source.split("\n");
		let machineCode = [];
		let address = 0;
		const res = new Result();

		let HP = 0x2000;

		this.symbolTable = {};

		lines.forEach((line) => {
			const tokens = this.tokenize(line);
			if (tokens.length === 0) return;
			if (tokens[0].endsWith(":")) {
				const label = tokens[0].slice(0, -1);
				this.symbolTable[label] = address;
				if (tokens.length > 1) tokens.shift();
				else return;
			}
			address++;
		});

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			const tokens = this.tokenize(line);
			if (tokens.length === 0) continue;

			if (tokens[0].endsWith(":")) continue;

			tokens.map((tok) => tok.toUpperCase());

			let result = 0;

			if (tokens[0].startsWith("$")) {
				this.symbolTable[tokens[0].slice(1)] = HP;
				continue;
			}

			const instData = this.opdata[tokens[0]];

			// initial check for special 'LDIR'
			if (instData.padded) result = 524288;
			else result = 8192 * instData.opcode;

			const multipliers = [1024, 128, 16, 1];

			for (let j = 1; j <= 4; j++) {
				if (instData[`m${j}`] !== undefined)
					result += multipliers[j - 1] * instData[`m${j}`];
			}

			if (tokens.length != instData.args.length + 1) {
				const pos = new Position(
					-1,
					i,
					line.indexOf(tokens[1]),
					fn,
					source,
				);
				return res.fail(
					new Exception(
						pos,
						pos,
						"ArgumentLengthError",
						`Expected ${instData.args.length} arguments for instruction ${tokens[0]}, found ${tokens.length - 1} arguments instead.`,
					),
				);
			}

			instData.args.forEach((argData, argIndex) => {
				const startPos = new Position(
					-1,
					i,
					line.indexOf(tokens[1]),
					fn,
					source,
				);
				const endPos = new Position(-1, i, line.length, fn, source);

				if (this.isValidArgument(tokens[argIndex + 1], argData)) {
					result +=
						Math.pow(2, instData.bits[argIndex]) *
						this.parseArgument(
							tokens[argIndex + 1],
							this.symbolTable,
							argData.startsWith("indoffset")
								? parseInt(argData.slice(9))
								: 16,
						);
				} else {
					return res.fail(
						new Exception(
							startPos,
							endPos,
							"ArgumentTypeError",
							`Expected argument type ${argData} at argument ${argIndex + 1}.`,
						),
					);
				}

				if (line.startsWith("LDIR HP, "))
					HP = this.parseArgument(tokens[2], this.symbolTable);
				if (line === "INCR HP") HP++;
				if (line === "DECR HP") HP--;
			});

			machineCode.push(result);
		}

		return res.success(machineCode);
	}

	isValidArgument(arg, pattern) {
		switch (true) {
			case pattern === "reg":
				return this.registers[arg] !== undefined;
			case pattern === "ind":
				return (
					arg[0] === "@" &&
					this.registers[arg.replace("@", "")] !== undefined
				);
			case pattern === "reg/ind":
				return this.registers[arg.replace("@", "")] !== undefined;
			case pattern === "mod":
				return pattern === "int" || pattern === "float";
			case pattern === "disp2":
				return ["update", "flip", "clear"].includes(pattern);
			case pattern === "mem1":
				return pattern.endsWith("MEM");
			case pattern === "sft2":
				return ["arith", "logic", "rotate", "crotate"].includes(
					pattern,
				);
			case pattern === "flg4":
				return this.flags.includes(arg);
			case pattern.startsWith("imm"):
				return (
					(arg[0] === "#" &&
						parseInt(arg.slice(1), 16) <
							Math.pow(2, parseInt(pattern.slice(3)))) ||
					arg[0] === "." ||
					arg[0] === "$"
				);
			case pattern.startsWith("indoffset"):
				let argToParse = arg;
				if (!arg.includes("+") && !arg.includes("-"))
					argToParse += "+0";

				const bitWidth = parseInt(pattern.slice(9));
				const operands = argToParse.includes("+")
					? argToParse.split("+")
					: argToParse.split("-");
				return (
					arg[0] === "@" &&
					this.registers[operands[0].replace("@", "")] !==
						undefined &&
					operands.length === 2 &&
					Math.abs(parseInt(operands[1])) < Math.pow(2, bitWidth)
				);
			default:
				return false;
		}
	}
}
