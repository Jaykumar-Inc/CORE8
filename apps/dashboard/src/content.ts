export const reference = "LDI 5\nADD 3\nSTA 20\nLDA 20\nOUT\nHLT";
export const examples: Record<string, string> = {
  "First addition": reference,
  "Countdown loop": "LDI 3\nloop: OUT\nDEC\nJZ done\nJMP loop\ndone: OUT\nHLT",
  "Memory round trip": "LDI 42\nSTA 20\nLDI 0\nLDA 20\nOUT\nHLT",
  "Carry & overflow": "LDI 127\nADD 1\nOUT\nLDI 255\nADD 1\nOUT\nHLT",
  "Register transfers":
    "LDI 25\nMOV ACC>A\nLDI 9\nMOV ACC>B\nMOV A>ACC\nOUT\nHLT",
  "Logic gates": "LDI 204\nAND 170\nOUT\nHLT",
};
export const components = {
  pc: {
    name: "Program Counter",
    short: "PC",
    analogy: "A bookmark showing which instruction comes next.",
    technical:
      "A 9-bit position in the 256-byte program space. Instructions start at even addresses; 256 is the end sentinel.",
  },
  program: {
    name: "Program Memory",
    short: "PROGRAM",
    analogy: "The recipe book holding the CPU’s instructions.",
    technical:
      "Separate, immutable instruction memory: up to 128 fixed-width two-byte instructions.",
  },
  ir: {
    name: "Instruction Register",
    short: "IR",
    analogy: "A small note holding the instruction being processed.",
    technical:
      "The 8-bit opcode latch, with a separate 8-bit operand latch loaded at Fetch.",
  },
  control: {
    name: "Control Unit",
    short: "CONTROL UNIT",
    analogy: "The coordinator telling each part what to do.",
    technical:
      "A four-stage state machine: Fetch → Decode → Execute → Write-back. Validates opcodes and selects transfers.",
  },
  a: {
    name: "Register A",
    short: "REGISTER A",
    analogy: "The ALU’s first small input box.",
    technical:
      "ALU input latch. ALU instructions copy ACC into A at Execute. MOV can also access A.",
  },
  b: {
    name: "Register B",
    short: "REGISTER B",
    analogy: "The ALU’s second input box.",
    technical:
      "Immediate operand latch for binary ALU operations; 1 for INC/DEC, 0 for unary operations.",
  },
  alu: {
    name: "Arithmetic Logic Unit",
    short: "ALU",
    analogy: "The calculator inside the CPU.",
    technical:
      "Computes arithmetic, bitwise and shift operations. Its pending result is committed at Write-back.",
  },
  acc: {
    name: "Accumulator",
    short: "ACCUMULATOR",
    analogy: "A small storage box holding calculation results.",
    technical:
      "The primary 8-bit working register. Arithmetic and logic read ACC; results wrap modulo 256.",
  },
  flags: {
    name: "Flags Register",
    short: "FLAGS",
    analogy: "Tiny signal lights telling you about a result.",
    technical:
      "Z: zero; C: unsigned carry or shifted-out bit; V: signed overflow; B: subtraction borrow. Updated only by ALU instructions.",
  },
  ram: {
    name: "Data Memory",
    short: "DATA RAM",
    analogy: "256 numbered drawers for saving numbers.",
    technical:
      "256 independent bytes. STA writes ACC, LDA reads into ACC. Separate from program memory.",
  },
  output: {
    name: "Output Register",
    short: "OUTPUT",
    analogy: "The CPU’s display window. OUT puts a number here.",
    technical:
      "An 8-bit latch updated only by OUT. Retains its value across other instructions until reset.",
  },
};
export type Experiment = {
  title: string;
  category: string;
  objective: string;
  explanation: string;
  program: string;
  expected: string;
  question: string;
  answer: string;
  op?: string;
};
export const experiments: Experiment[] = [
  {
    title: "Your first addition",
    category: "ARITHMETIC",
    objective: "Follow two numbers through the ALU.",
    explanation:
      "Load a number into ACC, add another, then reveal the answer with OUT.",
    program: "LDI 5\nADD 3\nOUT\nHLT",
    expected: "ACC = 8, output = 8",
    question: "Where is the sum stored before OUT?",
    answer: "The accumulator (ACC).",
    op: "ADD",
  },
  {
    title: "When zero goes backwards",
    category: "ARITHMETIC",
    objective: "Understand borrow and 8-bit wraparound.",
    explanation:
      "An 8-bit register cannot hold −1 as an unsigned number. Subtracting 1 from 0 wraps around to 255.",
    program: "LDI 0\nSUB 1\nOUT\nHLT",
    expected: "ACC = 255, Borrow = 1",
    question: "Why does 0 − 1 become 255?",
    answer: "Only the lowest eight bits are kept; −1 is 11111111.",
    op: "SUB",
  },
  {
    title: "Think in logic gates",
    category: "BINARY LOGIC",
    objective: "Compare each pair of bits.",
    explanation:
      "AND produces 1 only when both input bits are 1. OR needs either bit; XOR needs different bits.",
    program: "LDI 204\nAND 170\nOUT\nHLT",
    expected: "10001000 = 136",
    question: "What is 1 AND 0?",
    answer: "0. Both inputs must be 1.",
    op: "AND",
  },
  {
    title: "The language of eight bits",
    category: "NUMBER SYSTEMS",
    objective: "Connect decimal, binary and hex.",
    explanation:
      "Each bit is a switch worth a power of two. Add the values of the switches that are on.",
    program: "LDI 42\nOUT\nHLT",
    expected: "42 = 00101010 = 0x2A",
    question: "What is the value of the leftmost bit?",
    answer: "128, which is 2 to the power of 7.",
  },
  {
    title: "A trip to memory",
    category: "DATA & MEMORY",
    objective: "Save and retrieve a number.",
    explanation:
      "STA puts ACC into a numbered RAM drawer. LDA opens that drawer and copies the number back.",
    program: examples["Memory round trip"],
    expected: "RAM[20] = 42, ACC = 42, output = 42",
    question: "Does changing ACC erase RAM[20]?",
    answer: "No. RAM retains the saved value until a write or reset.",
  },
  {
    title: "One instruction, four moments",
    category: "INSTRUCTION CYCLE",
    objective: "Separate Fetch, Decode, Execute and Write-back.",
    explanation:
      "The CPU reads an instruction, understands it, calculates, then stores its result. Use Next stage to watch each moment.",
    program: "LDI 5\nADD 3\nOUT\nHLT",
    expected: "Four stage events per completed instruction",
    question: "When is an ALU result committed to ACC?",
    answer: "At Write-back.",
  },
  {
    title: "Meet the registers",
    category: "DATA & MEMORY",
    objective: "Move values between small storage boxes.",
    explanation:
      "MOV can copy ACC into A or B and copy either register back to ACC. Copying preserves the source.",
    program: examples["Register transfers"],
    expected: "A = 25, B = 9, output = 25",
    question: "Does MOV A>ACC clear A?",
    answer: "No. It copies the value; A remains 25.",
  },
  {
    title: "Give the CPU a detour",
    category: "CONTROL FLOW",
    objective: "Build a countdown with a conditional branch.",
    explanation:
      "DEC sets Zero when the count reaches zero. JZ jumps to done; JMP returns to the loop otherwise.",
    program: examples["Countdown loop"],
    expected: "Output sequence: 3 → 2 → 1 → 0",
    question: "What does JZ check?",
    answer: "The Zero flag from the most recent ALU operation.",
  },
  {
    title: "Read the signal lights",
    category: "CPU FLAGS",
    objective: "Distinguish signed overflow from unsigned carry.",
    explanation:
      "127 + 1 overflows signed eight-bit range. 255 + 1 carries out of unsigned eight-bit range and gives zero.",
    program: examples["Carry & overflow"],
    expected: "First ADD: V = 1. Second ADD: Z = 1, C = 1.",
    question: "Does Carry always mean signed overflow?",
    answer:
      "No. Carry describes unsigned range; Overflow describes signed range.",
  },
  {
    title: "Write your own story",
    category: "PROGRAMMING",
    objective: "Assemble and run a complete mini program.",
    explanation:
      "Choose instructions, give them operands, and finish with HLT. Labels name branch destinations.",
    program: reference,
    expected: "ACC = 8, RAM[20] = 8, output = 8",
    question: "Why should a program end with HLT?",
    answer: "To stop deliberately before PC runs outside program memory.",
  },
];
export const quiz = [
  {
    q: "Which part remembers the address of the next instruction?",
    options: ["Program Counter", "ALU", "Output register"],
    answer: 0,
    why: "The PC is the instruction bookmark. Fetch advances it by two bytes.",
  },
  {
    q: "After LDI 255 and ADD 1, what is ACC?",
    options: ["256", "0", "1"],
    answer: 1,
    why: "Eight bits wrap modulo 256. The Zero and Carry flags become 1.",
  },
  {
    q: "Which instruction saves ACC to data RAM?",
    options: ["LDA", "MOV", "STA"],
    answer: 2,
    why: "STA stores ACC at a RAM address. LDA loads it back.",
  },
  {
    q: "Does replaying a recorded stage change the ESP32?",
    options: ["Yes", "No", "Only when paused"],
    answer: 1,
    why: "Replay uses saved snapshots. The real CPU continues independently.",
  },
  {
    q: "What is 11001100 AND 10101010?",
    options: ["11101110", "10001000", "01100110"],
    answer: 1,
    why: "Only positions with a 1 in both inputs remain on.",
  },
  {
    q: "When does JZ take its branch?",
    options: [
      "When PC is zero",
      "When the Zero flag is set",
      "After every OUT",
    ],
    answer: 1,
    why: "JZ reads the Zero flag last written by an ALU instruction.",
  },
];
