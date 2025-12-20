const operators = {
	USUB: {
		prec: 5,
		assoc: "right",
	},
	UADD: {
		prec: 5,
		assoc: "right",
	},
	POW: {
		prec: 4,
		assoc: "right",
	},
	MUL: {
		prec: 3,
		assoc: "left",
	},
	DIV: {
		prec: 3,
		assoc: "left",
	},
	MOD: {
		prec: 3,
		assoc: "left",
	},
	ADD: {
		prec: 2,
		assoc: "left",
	},
	SUB: {
		prec: 2,
		assoc: "left",
	},
	LT: {
		prec: 1,
		assoc: "left",
	},
	LE: {
		prec: 1,
		assoc: "left",
	},
	GT: {
		prec: 1,
		assoc: "left",
	},
	GE: {
		prec: 1,
		assoc: "left",
	},
	EQ: {
		prec: 1,
		assoc: "left",
	},
	NE: {
		prec: 1,
		assoc: "left",
	},
	ASGN: {
		prec: 0,
		assoc: "right",
	},
	ADDBY: {
		prec: 0,
		assoc: "right",
	},
	SUBBY: {
		prec: 0,
		assoc: "right",
	},
	MULBY: {
		prec: 0,
		assoc: "right",
	},
	DIVBY: {
		prec: 0,
		assoc: "right",
	},
	MODBY: {
		prec: 0,
		assoc: "right",
	},
	POWBY: {
		prec: 0,
		assoc: "right",
	},
};

const ttList = [
	"EOF",
	"END",
	"SEMI",
	"COMMA",
	"COL",
	"IDEN",
	"TOASSIGN",
	"KEYW",
	"INT",
	"FLOAT",
	"ADD",
	"UADD",
	"SUB",
	"USUB",
	"MUL",
	"DIV",
	"MOD",
	"POW",
	"ADDBY",
	"SUBBY",
	"MULBY",
	"DIVBY",
	"MODBY",
	"POWBY",
	"ASGN",
	"LT",
	"LE",
	"GT",
	"GE",
	"EQ",
	"NE",
	"LPR",
	"RPR",
	"LBR",
	"RBR",
	"LABEL",
	"JMP",
	"JMP_IF_FALSE",
	"PUSH",
	"POP",
	"RET",
	"CALL",
];

let labelCounter = 0;
const newLabel = (startPos, endPos) => {
	return new Token(TT.LABEL, `L${labelCounter++}`, startPos, endPos);
};

const KEYWORDS = ["var", "const", "for", "while", "sub", "return"];
const DATATYPES = ["int", "float"];
KEYWORDS.push(...DATATYPES);
const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const VALID_IDEN = LETTERS + DIGITS + "_";

const varOperators = ["ADDBY", "SUBBY", "MULBY", "DIVBY", "MODBY", "POWBY"];
const compOperators = ["LT", "LE", "GT", "GE", "EQ", "NE"];

const virtualFileSystem = {};
