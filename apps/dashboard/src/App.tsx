import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Boxes,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  CircuitBoard,
  Code2,
  Cpu,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  History as HistoryIcon,
  Menu,
  Moon,
  Radio,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import { createOLEDFrame } from "@core8/cpu";
import {
  Academy,
  ALU,
  Explorer,
  Hardware,
  History,
  Memory,
  Overview,
  PageHeading,
  ProgramPanel,
  Quiz,
  Studio,
} from "./pages";
import { Controls, Registers } from "./components/LabPanels";
import { Button } from "./components/ui/button";
import { setTheme, useEvent, useLab } from "./store";
const nav = [
  { label: "Overview", icon: Boxes },
  { label: "CPU Explorer", icon: Cpu },
  { label: "Execution Studio", icon: Activity },
  { label: "ALU Playground", icon: FlaskConical },
  { label: "Memory Explorer", icon: CircuitBoard },
  { label: "Registers Inspector", icon: Boxes },
  { label: "Program Builder", icon: Code2 },
  { label: "Learning Academy", icon: GraduationCap },
  { label: "Quiz & Challenges", icon: BrainCircuit },
  { label: "Live Hardware Lab", icon: Radio },
  { label: "Execution History", icon: HistoryIcon },
];
function App() {
  const lab = useLab(),
    event = useEvent();
  const [mobile, setMobile] = useState(false),
    [tour, setTour] = useState(0);
  const tourDialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (lab.mode !== "demo" || !lab.state) return;
    const selected =
      lab.cursor < lab.events.length - 1
        ? (lab.events[lab.cursor]?.state ?? lab.state)
        : lab.state;
    const history = lab.events.slice(0, lab.cursor + 1);
    lab.syncOLED(
      createOLEDFrame(selected, history, {
        source: "demo",
        page: lab.oledPage,
        programBytes: lab.programBytes,
      }),
      { state: selected, events: history, programBytes: lab.programBytes },
    );
  }, [lab.mode, lab.state, lab.events, lab.cursor, lab.programBytes]);
  useEffect(() => {
    if (lab.onboarded) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = tourDialog.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button,input,select,[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        useLab.getState().dismissOnboarding();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [lab.onboarded]);
  useEffect(() => {
    document.documentElement.dataset.theme = lab.theme;
  }, [lab.theme]);
  useEffect(() => {
    const t = setInterval(() => useLab.getState().checkConnection(), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (lab.narration && event && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(event.explanation));
    }
    return () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, [lab.narration, event]);
  const navigate = (page: string) => {
    useLab.setState({ page });
    setMobile(false);
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <aside
          className={`sidebar ${mobile ? "mobile-open" : ""}`}
          inert={!lab.onboarded}
        >
          <div className="brand">
            <a
              href="#"
              className="brand-home"
              onClick={(e) => {
                e.preventDefault();
                navigate("Overview");
              }}
            >
              <div className="brand-mark">
                <Cpu size={24} />
              </div>
              <div>
                CORE<span>8</span>
                <small>INTERACTIVE CPU LAB</small>
              </div>
            </a>
            <button
              className="mobile-close icon-button"
              aria-label="Close navigation"
              onClick={(e) => {
                e.preventDefault();
                setMobile(false);
              }}
            >
              <X size={19} />
            </button>
          </div>
          <div className="workspace-label">
            <span className="workspace-avatar">C8</span>
            <div>
              Learning workspace<small>Personal laboratory</small>
            </div>
            <ChevronDown size={13} />
          </div>
          <div className="nav-section">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {nav.map((item, i) => (
              <div key={item.label}>
                {i === 7 && <div className="nav-section">LEARN & EXPLORE</div>}
                {i === 9 && <div className="nav-section">CONNECTED LAB</div>}
                <button
                  className={
                    lab.page === item.label ? "nav-item active" : "nav-item"
                  }
                  onClick={() => navigate(item.label)}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  {item.label === "Learning Academy" && (
                    <span className="nav-count">10</span>
                  )}
                  {lab.page === item.label && (
                    <span className="nav-active-dot" />
                  )}
                </button>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="progress-card">
              <div>
                <Sparkles size={15} />
                <span>Your learning journey</span>
              </div>
              <strong>
                {lab.completed.length} <span>/ 10 experiments</span>
              </strong>
              <progress value={lab.completed.length} max="10" />
              <button onClick={() => navigate("Learning Academy")}>
                Keep discovering <ArrowRight size={13} />
              </button>
            </div>
            <button
              className="help-button"
              onClick={() => {
                setTour(0);
                useLab.setState({ onboarded: false });
              }}
            >
              <HelpCircle size={17} /> Getting started{" "}
              <ChevronRight size={14} />
            </button>
            <span className="sidebar-version">
              CORE8 v2.0 <span>Built for curious minds.</span>
            </span>
          </div>
        </aside>
        {mobile && (
          <button
            className="mobile-backdrop"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          />
        )}
        <div className="main-shell" inert={!lab.onboarded}>
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button menu-button"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{lab.page}</strong>
            </div>
            <div className="topbar-actions">
              <label className="mode-switch">
                <span
                  className={`status-dot ${lab.mode === "demo" ? "blue" : lab.connected ? "" : "muted"}`}
                />
                <select
                  aria-label="CPU data source"
                  value={lab.mode}
                  onChange={(e) =>
                    lab.setMode(e.target.value as "demo" | "hardware")
                  }
                >
                  <option value="demo">Demo Simulator</option>
                  <option value="hardware">Real Hardware</option>
                </select>
              </label>
              <span
                className={`connection-pill ${lab.mode === "hardware" && !lab.connected ? "offline" : ""}`}
              >
                {lab.mode === "demo"
                  ? "LOCAL"
                  : lab.connected
                    ? "CONNECTED"
                    : "OFFLINE"}
              </span>
              <button
                className="icon-button theme-button"
                aria-label={`Switch to ${lab.theme === "dark" ? "light" : "dark"} theme`}
                onClick={() =>
                  setTheme(lab.theme === "dark" ? "light" : "dark")
                }
              >
                {lab.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <div className="profile-avatar" title="Local learner">
                CL
              </div>
            </div>
          </header>
          <main>
            <div className="context-row">
              <div>
                <span className="lab-label">THE CORE8 LEARNING LAB</span>
                <span className="context-separator">/</span>
                <span>Explore. Execute. Understand.</span>
              </div>
              <label className="learning-level">
                <GraduationCap size={14} />
                <select
                  aria-label="Explanation level"
                  value={lab.level}
                  onChange={(e) =>
                    useLab.setState({
                      level: e.target.value as typeof lab.level,
                    })
                  }
                >
                  <option value="beginner">Beginner mode</option>
                  <option value="student">Student mode</option>
                  <option value="advanced">Advanced mode</option>
                </select>
              </label>
            </div>
            {lab.error && (
              <div className="error-banner" role="alert">
                <span>{lab.error}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => useLab.setState({ error: "" })}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {lab.mode === "hardware" && !lab.connected && (
              <div className="offline-banner">
                <Radio size={17} />
                <span>
                  <strong>Hardware offline.</strong>{" "}
                  {lab.state
                    ? "Displaying the last received snapshot."
                    : "Connect your ESP32 to receive CPU state."}
                </span>
                <button onClick={() => navigate("Live Hardware Lab")}>
                  Connection settings <ArrowRight size={13} />
                </button>
              </div>
            )}
            {lab.page === "Overview" ? (
              <Overview />
            ) : lab.page === "CPU Explorer" ? (
              <Explorer />
            ) : lab.page === "Execution Studio" ? (
              <Studio />
            ) : lab.page === "ALU Playground" ? (
              <ALU />
            ) : lab.page === "Memory Explorer" ? (
              <Memory />
            ) : lab.page === "Registers Inspector" ? (
              <>
                <PageHeading
                  kicker="REGISTERS INSPECTOR"
                  title="Small boxes. Precise values."
                  description="Inspect every register in decimal, hexadecimal and binary. Amber marks a change in this recorded stage."
                />
                <Registers />
                <Controls />
              </>
            ) : lab.page === "Program Builder" ? (
              <>
                <PageHeading
                  kicker="PROGRAM BUILDER"
                  title="Write the instructions. Watch the story."
                  description="A compact assembly studio, with validation, example programs and live instruction highlighting."
                />
                <ProgramPanel full />
                <Controls />
              </>
            ) : lab.page === "Learning Academy" ? (
              <Academy />
            ) : lab.page === "Quiz & Challenges" ? (
              <Quiz />
            ) : lab.page === "Live Hardware Lab" ? (
              <Hardware />
            ) : (
              <History />
            )}
            <footer>
              <span>
                <Cpu size={13} /> CORE8 <span>—</span> See every instruction.
                Understand every operation.
              </span>
              <span>
                {lab.mode === "demo"
                  ? "Software-defined educational CPU"
                  : "ESP32 educational CPU"}{" "}
                · v2.0
              </span>
            </footer>
          </main>
        </div>
        {!lab.onboarded && (
          <div className="modal-backdrop">
            <section
              ref={tourDialog}
              className="onboarding"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tour-title"
            >
              <button
                className="icon-button tour-close"
                aria-label="Skip onboarding"
                onClick={lab.dismissOnboarding}
              >
                <X size={18} />
              </button>
              <div className="tour-icon">
                {tour === 0 ? (
                  <Cpu size={34} />
                ) : tour === 1 ? (
                  <Boxes size={34} />
                ) : tour === 2 ? (
                  <Code2 size={34} />
                ) : tour === 3 ? (
                  <CircuitBoard size={34} />
                ) : (
                  <BookOpen size={34} />
                )}
              </div>
              <div className="eyebrow">WELCOME TO CORE8 · {tour + 1} / 5</div>
              <h2 id="tour-title">
                {
                  [
                    "Meet the computer inside the computer.",
                    "Registers are tiny storage boxes.",
                    "An instruction is one small job.",
                    "Your keypad is the local controller.",
                    "Ready for your first discovery?",
                  ][tour]
                }
              </h2>
              <p>
                {
                  [
                    "A CPU follows instructions one at a time. CORE8 lets you watch each part read, understand and execute those instructions. No prior knowledge needed.",
                    "ACC holds calculation results. A and B feed the calculator, called the ALU. PC is a bookmark, and IR holds the current instruction.",
                    "LDI 5 puts 5 into ACC. ADD 3 adds 3. OUT shows the answer. HLT stops. Each instruction has four stages you can pause and inspect.",
                    "A opens arithmetic, B opens logic, C opens memory and registers, D opens programs. Digits select options, # confirms, and * goes back. Hold * then # to reset.",
                    "Start in Demo Simulator. Press Next stage to watch a single moment, or Run program to follow the whole journey. Open Learning Academy for ten guided experiments.",
                  ][tour]
                }
              </p>
              <div className="tour-dots">
                {[0, 1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    className={i === tour ? "active" : ""}
                    aria-label={`Onboarding step ${i + 1}`}
                    onClick={() => setTour(i)}
                  />
                ))}
              </div>
              <div className="button-row">
                <Button variant="ghost" onClick={lab.dismissOnboarding}>
                  Skip tour
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    if (tour < 4) setTour(tour + 1);
                    else lab.dismissOnboarding();
                  }}
                >
                  {tour === 4 ? "Start exploring" : "Next"}{" "}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
export default App;
