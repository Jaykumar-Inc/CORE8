// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { useLab } from "./store";
beforeEach(() => {
  useLab.setState({ oledSync: false });
  useLab.getState().setMode("demo");
  useLab.setState({ onboarded: true, page: "Overview" });
});
afterEach(() => {
  cleanup();
  useLab.getState().disconnect();
});
describe("dashboard route rendering and interactions", () => {
  const pages: Record<string, string> = {
    Overview: "Small CPU. Big discoveries",
    "CPU Explorer": "Get to know your processor",
    "Execution Studio": "One instruction. Every detail.",
    "ALU Playground": "A little logic goes a long way.",
    "Memory Explorer": "A place for every byte.",
    "Registers Inspector": "Small boxes. Precise values.",
    "Program Builder": "Write the instructions. Watch the story.",
    "Learning Academy": "Curiosity is your only prerequisite.",
    "Quiz & Challenges": "Put your understanding to work.",
    "Live Hardware Lab": "From silicon to screen.",
    "Execution History": "Every change has a story.",
  };
  for (const [page, heading] of Object.entries(pages)) {
    it(`navigates to ${page} and displays the page`, () => {
      render(<App />);
      fireEvent.click(
        screen.getByRole("button", {
          name: page === "Learning Academy" ? /Learning Academy/ : page,
        }),
      );
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
        heading,
      );
    });
  }
  it("labels hardware mode offline and omits made-up register values", () => {
    useLab.getState().setMode("hardware");
    const { container } = render(<App />);
    expect(container.textContent?.includes("Hardware offline.")).toBe(true);
    expect(container.textContent?.includes("Awaiting ESP32")).toBe(true);
    expect(container.textContent?.includes("No telemetry")).toBe(true);
  });
  it("loads a program, runs it and displays the genuine output", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Run to completion" }));
    expect(useLab.getState().state?.output).toBe(8);
    expect(
      screen.getByRole("button", { name: /Output Register: 8/ }),
    ).toBeDefined();
  });
  it("toggles a conversion bit and updates the actual number", () => {
    useLab.setState({ page: "ALU Playground" });
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle bit 7, value 128" }),
    );
    expect(
      (screen.getByLabelText("Decimal conversion") as HTMLInputElement).value,
    ).toBe("170");
  });
  it("lets learners answer a quiz and read its explanation", () => {
    useLab.setState({ page: "Quiz & Challenges", answers: {} });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "A Program Counter" }));
    expect(
      screen.getByText(/Exactly. The PC is the instruction bookmark/),
    ).toBeDefined();
    expect(useLab.getState().answers[0]).toBe(0);
  });
});
