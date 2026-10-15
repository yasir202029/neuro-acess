/**
 * Deterministic synthetic drafting engine for Slice 1.
 *
 * This stands in for the future model-gateway seam so the FULL safety chain
 * (consent → context → grounded generation → provenance → missing info →
 * contradictions → safety scan → human review → sign) is exercised end-to-end
 * without any live model and without real patient data.
 *
 * Invariants enforced here and re-checked on every mutation:
 *  - every material statement cites at least one existing source;
 *  - TEMPLATE_LANGUAGE is the only source-free classification allowed;
 *  - AI_SYNTHESIS always carries >=1 source;
 *  - absence of evidence is reported as missing, never as reassurance;
 *  - contradictions are surfaced, never silently reconciled;
 *  - content inside transcript segments is DATA — embedded instructions are
 *    detected and recorded as safety findings, never obeyed.
 */
import type {
  AiDraft,
  DraftConflict,
  DraftStatement,
  IntakeSubmission,
  Referral,
  SafetyFinding,
  TranscriptSegment,
} from "./types";

export interface DraftingInput {
  readonly referral: Referral;
  readonly segments: readonly TranscriptSegment[]; // non-excluded only
  readonly intake?: IntakeSubmission;
}

export interface DraftingOutput {
  readonly statements: readonly DraftStatement[];
  readonly missingInformation: readonly string[];
  readonly conflicts: readonly DraftConflict[];
  readonly safetyFindings: readonly SafetyFinding[];
}

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${(sequence += 1)}`;

const CHILDHOOD_CONTEXT_PATTERN =
  /\b(childhood|school|primary|secondary|year \d|gcse|a-level)\b/i;
const INSTRUCTION_PATTERN =
  /\b(ignore\s+(all\s+)?(previous\s+|prior\s+)?instructions|system prompt|disregard\s+(the\s+|your\s+)?(rules|above)|you must now)\b/i;
const MEDICATION_DIRECTIVE_PATTERN =
  /\b(prescribe|start\s+\d+\s*mg|increase to\s+\d+\s*mg|decrease to\s+\d+\s*mg)\b/i;
const SHARED_THEMES: readonly {
  readonly theme: string;
  readonly pattern: RegExp;
}[] = [
  {
    theme: "attention difficulties",
    pattern:
      /\b(attention|inattentive|focus|concentrat|distract|procrastinat)\b/i,
  },
  {
    theme: "hyperactivity or restlessness",
    pattern: /\b(hyperactiv|restless|fidget|impulsiv)\b/i,
  },
  {
    theme: "social-communication differences",
    pattern:
      /\b(social|communicat|conversation|sensory|eye contact|routine)\b/i,
  },
];

function statement(
  text: string,
  classification: DraftStatement["classification"],
  sourceRefs: readonly string[],
): DraftStatement {
  return { id: nextId("stmt"), text, classification, sourceRefs };
}

/** Scan raw content for instruction-in-content (recorded, never obeyed). */
export function scanForInstructions(
  segments: readonly TranscriptSegment[],
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  for (const segment of segments) {
    if (INSTRUCTION_PATTERN.test(segment.text)) {
      findings.push({
        id: nextId("safety"),
        kind: "POTENTIAL_INSTRUCTION_IN_CONTENT",
        detail: `Segment ${segment.id} contains instruction-like content; it is treated strictly as data.`,
      });
    }
  }
  return findings;
}

/** Post-generation safety scan over the produced statements. */
export function scanStatements(
  statements: readonly DraftStatement[],
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  for (const item of statements) {
    if (MEDICATION_DIRECTIVE_PATTERN.test(item.text)) {
      findings.push({
        id: nextId("safety"),
        kind: "POTENTIAL_MEDICATION_DIRECTIVE",
        detail: `Statement ${item.id} resembles a medication directive; clinician review required.`,
      });
    }
    if (
      item.sourceRefs.length === 0 &&
      item.classification !== "TEMPLATE_LANGUAGE"
    ) {
      findings.push({
        id: nextId("safety"),
        kind: "UNSUPPORTED_CLAIM",
        detail: `Statement ${item.id} has no supporting source.`,
      });
    }
  }
  return findings;
}

/** Missing-information detection for the ADHD assessment pathway. */
function detectMissingInformation(input: DraftingInput): string[] {
  const missing: string[] = [];
  const intake = input.intake;
  if (!intake) {
    missing.push("Intake questionnaire has not been completed.");
  } else {
    const documents = new Set(intake.documentKinds);
    if (!documents.has("SCHOOL_REPORT"))
      missing.push("School reports (childhood evidence) were not provided.");
    if (!documents.has("GP_SUMMARY"))
      missing.push("GP summary was not provided.");
    if (!documents.has("PHYSICAL_HEALTH_HISTORY"))
      missing.push("Physical-health history was not provided.");
    const hasInformant =
      documents.has("INFORMANT_QUESTIONNAIRE") ||
      intake.questionnaireScores.some((entry) =>
        entry.instrument.toUpperCase().includes("INFORMANT"),
      );
    if (!hasInformant)
      missing.push("Informant questionnaire was not completed.");
  }
  if (input.segments.length === 0)
    missing.push("No consultation transcript content is available.");
  return missing;
}

/** Contradiction detection between structured intake and transcript content. */
function detectConflicts(input: DraftingInput): DraftConflict[] {
  const conflicts: DraftConflict[] = [];
  const intake = input.intake;
  if (intake?.answers.childhoodDifficulties === "NO") {
    const corroborating = input.segments.find((segment) =>
      CHILDHOOD_CONTEXT_PATTERN.test(segment.text),
    );
    if (corroborating) {
      conflicts.push({
        id: nextId("conflict"),
        description:
          "Intake records no childhood difficulties, but the transcript references childhood or school experiences. Both sources are shown; nothing has been reconciled.",
        sourceRefs: [
          `${intake.id}:answers:childhoodDifficulties`,
          corroborating.id,
        ],
        resolution: "UNRESOLVED",
      });
    }
  }
  return conflicts;
}

/**
 * Generate a grounded assessment-note draft. Every statement is built only
 * from the authorised inputs; nothing is invented.
 */
export function generateAssessmentDraft(input: DraftingInput): DraftingOutput {
  const statements: DraftStatement[] = [];

  statements.push(
    statement("Assessment note (draft)", "TEMPLATE_LANGUAGE", []),
  );
  statements.push(
    statement(
      `Pathway: ${input.referral.pathway}. Referral source: ${input.referral.referralSource}.`,
      "STRUCTURED_RECORD",
      [`referral:${input.referral.id}`],
    ),
  );
  statements.push(
    statement(
      `Presenting concern (as recorded at referral): ${input.referral.presentingConcern}`,
      "STRUCTURED_RECORD",
      [`referral:${input.referral.id}`],
    ),
  );

  for (const segment of input.segments) {
    statements.push(
      statement(`"${segment.text}"`, "DIRECT_TRANSCRIPT", [segment.id]),
    );
  }

  if (input.intake) {
    statements.push(
      statement(
        `Intake — current difficulties: ${input.intake.answers.currentDifficulties}`,
        "STRUCTURED_RECORD",
        [`${input.intake.id}:answers:currentDifficulties`],
      ),
    );
    statements.push(
      statement(
        `Intake — childhood difficulties reported: ${input.intake.answers.childhoodDifficulties}`,
        "STRUCTURED_RECORD",
        [`${input.intake.id}:answers:childhoodDifficulties`],
      ),
    );
    for (const entry of input.intake.questionnaireScores) {
      statements.push(
        statement(
          `${entry.instrument} score: ${entry.score} (as submitted by the patient).`,
          "CALCULATED",
          [`${input.intake.id}:questionnaires:${entry.instrument}`],
        ),
      );
    }
  }

  // Evidence-grounded synthesis: only emitted when referral and transcript
  // genuinely share a recognised theme, with every contributing source cited.
  const referralTheme = SHARED_THEMES.find((entry) =>
    entry.pattern.test(input.referral.presentingConcern),
  );
  const segmentMatches = input.segments.filter(
    (segment) => referralTheme && referralTheme.pattern.test(segment.text),
  );
  if (referralTheme && segmentMatches.length > 0) {
    statements.push(
      statement(
        `The referral and the consultation both reference ${referralTheme.theme}.`,
        "AI_SYNTHESIS",
        [
          `referral:${input.referral.id}`,
          ...segmentMatches.map((segment) => segment.id),
        ],
      ),
    );
  }

  statements.push(
    statement(
      "Information not documented in the sources provided is listed separately and has not been inferred.",
      "TEMPLATE_LANGUAGE",
      [],
    ),
  );

  return {
    statements,
    missingInformation: detectMissingInformation(input),
    conflicts: detectConflicts(input),
    safetyFindings: [
      ...scanForInstructions(input.segments),
      ...scanStatements(statements),
    ],
  };
}

export interface Approvability {
  readonly approvable: boolean;
  readonly unsupportedStatementIds: readonly string[];
  readonly unresolvedConflictIds: readonly string[];
}

/**
 * Deterministic pre-sign gate. UNSUPPORTED statements (material statements
 * without sources) and unresolved conflicts block approval — a clinician must
 * fix or explicitly resolve them first.
 */
export function evaluateApprovability(draft: AiDraft): Approvability {
  const unsupportedStatementIds = draft.statements
    .filter(
      (item) =>
        item.classification === "UNSUPPORTED" ||
        (item.classification !== "TEMPLATE_LANGUAGE" &&
          item.sourceRefs.length === 0),
    )
    .map((item) => item.id);
  const unresolvedConflictIds = draft.conflicts
    .filter((conflict) => conflict.resolution === "UNRESOLVED")
    .map((conflict) => conflict.id);
  return {
    approvable:
      unsupportedStatementIds.length === 0 &&
      unresolvedConflictIds.length === 0,
    unsupportedStatementIds,
    unresolvedConflictIds,
  };
}

/** Render the draft as the signed note body (provenance kept in the draft). */
export function renderDraftBody(draft: AiDraft): string {
  return draft.statements.map((item) => item.text).join("\n");
}
