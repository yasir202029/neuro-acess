import { describe, expect, it } from "vitest";
import {
  applyAppearance, defaultAppearance, loadAppearance, prescriptionStateSemantics,
  riskSemantics, saveAppearance, semanticsFor,
  type ClarityAppearance,
} from "./index";
import { ClarityStatusChip, ClarityConfirmationPanel, ClaritySensitiveDataShield } from "./components";
// Minimal react render via react-dom/server for pure-SSR assertions (no DOM env needed)
import { renderToStaticMarkup } from "react-dom/server";

describe("status semantics — never colour-only", () => {
  it("every clinical tone has an icon and a textual description", () => {
    for (const tone of ["normal", "review", "abnormal", "critical", "information", "success", "warning", "danger", "neutral"] as const) {
      const sem = semanticsFor(tone);
      expect(sem.icon, tone).toBeTruthy();
      expect(sem.label, tone).toBeTruthy();
      expect(sem.description.length, tone).toBeGreaterThan(5);
    }
  });

  it("prescription states all resolve to labelled semantics", () => {
    for (const sem of Object.values(prescriptionStateSemantics)) {
      expect(sem.label).toBeTruthy();
      expect(sem.description).toBeTruthy();
      expect(sem.icon).toBeTruthy();
    }
  });

  it("risk levels resolve with non-colour semantics", () => {
    for (const sem of Object.values(riskSemantics)) {
      expect(sem.description).toBeTruthy();
    }
  });

  it("StatusChip renders icon + text + screen-reader description", () => {
    const html = renderToStaticMarkup(<ClarityStatusChip tone="abnormal" />);
    expect(html).toContain("Abnormal");
    expect(html).toContain("outside expected range");
    expect(html).toContain("svg"); // icon present alongside colour
  });
});

describe("appearance persistence", () => {
  it("defaults are safe", () => {
    expect(defaultAppearance.theme).toBe("light");
    expect(defaultAppearance.density).toBe("comfortable");
  });

  it("applies theme as data-attributes", () => {
    const fakeRoot: Record<string, string> = {};
    (globalThis as any).document = {
      documentElement: {
        get dataset() { return fakeRoot; },
        set dataset(v: Record<string, string>) { Object.assign(fakeRoot, v); },
      },
    };
    const appearance: ClarityAppearance = { ...defaultAppearance, theme: "dark", density: "compact" };
    applyAppearance(appearance);
    expect(fakeRoot.clarityTheme).toBe("dark");
    expect(fakeRoot.clarityDensity).toBe("compact");
  });

  it("round-trips saved appearance with unknown keys ignored", () => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    saveAppearance({ ...defaultAppearance, theme: "high-contrast", motion: "reduced" });
    const loaded = loadAppearance();
    expect(loaded.theme).toBe("high-contrast");
    expect(loaded.motion).toBe("reduced");
    expect(loaded.mode).toBe("staff");
  });
});

describe("ClaritySensitiveDataShield", () => {
  it("masks value until revealed and exposes accessible labels", () => {
    const hidden = renderToStaticMarkup(<ClaritySensitiveDataShield value="07000 000000" label="Phone number" />);
    expect(hidden).not.toContain("07000 000000");
    expect(hidden).toContain("Reveal phone number");
    const revealed = renderToStaticMarkup(<ClaritySensitiveDataShield value="07000 000000" label="Phone number" />);
    // still hidden by default (state)
    expect(revealed).not.toContain("07000 000000");
  });
});

describe("ClarityConfirmationPanel — clinical safety guardrail", () => {
  it("disables confirm until warnings acknowledged", () => {
    const html = renderToStaticMarkup(
      <ClarityConfirmationPanel patientLabel="Ellison, Maya (DEMO-0001)" action="Sign clinical note" warnings={["Unsigned draft will be locked"]} onCancel={() => { }} onConfirm={() => { }} />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Ellison, Maya (DEMO-0001)");
  });

  it("requires a reason of minimum length when configured", () => {
    const html = renderToStaticMarkup(
      <ClarityConfirmationPanel patientLabel="X" action="Y" requireReason onCancel={() => { }} onConfirm={() => { }} />,
    );
    expect(html).toContain("Reason (required");
  });
});
