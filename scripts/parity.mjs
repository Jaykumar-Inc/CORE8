import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";
mkdirSync("artifacts", { recursive: true });
buildSync({
  entryPoints: ["packages/cpu/src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "artifacts/cpu-engine.mjs",
});
const { CPU, assemble, createOLEDFrame } =
  await import("../artifacts/cpu-engine.mjs");
const zig = join(
  process.cwd(),
  ".tools",
  "zig-x86_64-windows-0.14.1",
  "zig.exe",
);
const compiler = process.env.CXX || (existsSync(zig) ? zig : "g++");
const prefix = compiler.endsWith("zig.exe") ? ["c++"] : [];
const exe = join(
  "artifacts",
  process.platform === "win32" ? "cpu-runner.exe" : "cpu-runner",
);
const build = spawnSync(
  compiler,
  [...prefix, "-std=c++17", "-O1", "scripts/cpu_runner.cpp", "-o", exe],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      ZIG_GLOBAL_CACHE_DIR: join(process.cwd(), ".tools", "zig-cache"),
      ZIG_LOCAL_CACHE_DIR: join(process.cwd(), ".tools", "zig-local-cache"),
    },
  },
);
if (build.status !== 0) {
  console.error(build.stderr || build.error);
  process.exit(1);
}
const sources = [
  "LDI 5\nADD 3\nSTA 20\nLDA 20\nOUT\nHLT",
  "LDI 3\nloop: OUT\nDEC\nJZ done\nJMP loop\ndone: OUT\nHLT",
  "LDI 5\nMOV ACC>A\nLDI 9\nMOV ACC>B\nMOV A>ACC\nMOV B>ACC\nOUT\nHLT",
];
const programs = sources.map((s) => assemble(s).bytes);
for (const op of ["ADD", "SUB", "MUL", "DIV", "AND", "OR", "XOR"])
  for (const a of [0, 1, 127, 128, 255])
    for (const b of [0, 1, 127, 128, 255])
      programs.push(assemble(`LDI ${a}\n${op} ${b}\nSTA 255\nOUT\nHLT`).bytes);
for (const op of ["INC", "DEC", "NOT", "SHL", "SHR"])
  for (const a of [0, 1, 127, 128, 255])
    programs.push(assemble(`LDI ${a}\n${op}\nHLT`).bytes);
programs.push(
  [0x99, 0],
  [0, 1],
  [4, 4],
  [48, 1],
  [49, 250],
  [0, 0],
  Array(254).fill(0).concat([255, 0]),
);
const run = spawnSync(exe, [], {
  input: programs.map((p) => p.join(" ")).join("\n") + "\n",
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (run.status !== 0) {
  console.error(run.stderr || run.error);
  process.exit(1);
}
const results = run.stdout.trim().split(/\r?\n/);
let stages = 0;
for (let i = 0; i < programs.length; i++) {
  const cpu = new CPU();
  cpu.load(programs[i]);
  const trace = cpu.run();
  const expected =
    trace
      .map((event, index) => {
        const s = event.state;
        return (
          [
            s.pc,
            s.ir,
            s.operand,
            s.acc,
            s.a,
            s.b,
            s.output,
            +s.flags.z,
            +s.flags.c,
            +s.flags.v,
            +s.flags.b,
            ["ready", "fetch", "decode", "execute", "writeback"].indexOf(
              s.stage,
            ),
            ["ready", "paused", "running", "halted", "error"].indexOf(s.status),
            s.cycles,
            s.instructionAddress,
            ...s.ram,
          ].join(",") +
          "|" +
          [
            event.transfers.length,
            ...event.transfers.flatMap((t) => [t.from, t.to, t.value, t.bus]),
          ].join(",") +
          "|" +
          (event.alu
            ? [
                1,
                event.alu.operation,
                event.alu.left,
                event.alu.right,
                event.alu.result,
                +event.alu.flags.z,
                +event.alu.flags.c,
                +event.alu.flags.v,
                +event.alu.flags.b,
              ].join(",")
            : "0") +
          "|" +
          (event.memory
            ? [
                1,
                event.memory.address,
                event.memory.before,
                event.memory.after,
                event.memory.kind,
              ].join(",")
            : "0") +
          (s.status === "error"
            ? ""
            : ["learning", "binary"]
                .map((page) => {
                  const frame = createOLEDFrame(s, trace.slice(0, index + 1), {
                    source: "hardware",
                    controller: "device",
                    page,
                    programBytes: programs[i].length,
                  });
                  return (
                    "|OLED~" +
                    page +
                    frame.screens
                      .map(
                        (screen) =>
                          "~" +
                          [screen.title, ...screen.lines, screen.emphasis].join(
                            "~",
                          ),
                      )
                      .join("")
                  );
                })
                .join(""))
        );
      })
      .join(";") + ";";
  if (results[i] !== expected) {
    console.error(`CPU parity failed on vector ${i}: ${programs[i].join(" ")}`);
    process.exit(1);
  }
  stages += trace.length;
}
console.log(
  `Firmware/demo parity passed: ${programs.length} programs, ${stages} stage snapshots, all registers, flags, RAM, transfers, ALU, memory events and OLED learning/binary views.`,
);
const jsonInclude = join(
  "firmware",
  ".pio",
  "libdeps",
  "esp32dev",
  "ArduinoJson",
  "src",
);
if (!existsSync(jsonInclude)) {
  console.error(
    "Build firmware first to install ArduinoJson for the native command tests.",
  );
  process.exit(1);
}
const unit = join(
  "artifacts",
  process.platform === "win32" ? "cpu-test.exe" : "cpu-test",
);
const unitBuild = spawnSync(
  compiler,
  [
    ...prefix,
    "-std=c++17",
    "-O1",
    "-Ifirmware/include",
    `-I${jsonInclude}`,
    "firmware/test/native/test_cpu.cpp",
    "-o",
    unit,
  ],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      ZIG_GLOBAL_CACHE_DIR: join(process.cwd(), ".tools", "zig-cache"),
      ZIG_LOCAL_CACHE_DIR: join(process.cwd(), ".tools", "zig-local-cache"),
    },
  },
);
if (unitBuild.status !== 0) {
  console.error(unitBuild.stderr || unitBuild.error);
  process.exit(1);
}
const unitRun = spawnSync(unit, [], { encoding: "utf8" });
if (unitRun.status !== 0) {
  console.error(
    unitRun.stderr ||
      unitRun.error ||
      "Native CPU/remote-command assertions failed.",
  );
  process.exit(1);
}
console.log(
  "Native firmware CPU, remote-command and keypad input/result regression assertions passed.",
);
