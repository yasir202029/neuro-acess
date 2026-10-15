import { useState } from "react";
import { ClipboardList, Save, AlertTriangle } from "lucide-react";
import { useSubmitAssessment } from "@/hooks/use-clinical-workstation";

const INSTRUMENTS = [
  { value: "ASRS", label: "ASRS (ADHD)", items: 18 },
  { value: "AQ50", label: "AQ-50 (Autism)", items: 50 },
  { value: "PHQ9", label: "PHQ-9 (Depression)", items: 9 },
  { value: "GAD7", label: "GAD-7 (Anxiety)", items: 7 },
] as const;

export function AssessmentBuilder({ patientId }: { patientId: string }) {
  const [instrument, setInstrument] = useState<string>("ASRS");
  const [answers, setAnswers] = useState<number[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const submit = useSubmitAssessment(patientId);

  const inst = INSTRUMENTS.find((i) => i.value === instrument)!;
  const answerCount = answers.length;
  const instClass = instrument === "ASRS"
    ? "bg-[hsl(var(--primary))]/[.1] border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]";
  const saveClass = status === "saved"
    ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-[hsl(var(--success))]"
    : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answerCount === 0 || answerCount > inst.items || !interpretation.trim()) return;
    setStatus("saving");
    submit.mutate({ instrument, answers, interpretation: interpretation.trim() }, {
      onSuccess: () => { setStatus("saved"); setAnswers([]); setInterpretation(""); },
      onError: () => { setStatus("idle"); },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Structured assessment</p>
          <h3 className="text-lg font-semibold">{inst.label}</h3>
        </div>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{inst.items} scored items &middot; 0-8 per item</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Instrument</p>
          <div className="space-y-1">
            {INSTRUMENTS.map((i) => (
              <button key={i.value} onClick={() => { setInstrument(i.value); setAnswers([]); }}
                className={instClass}>
                <span>{i.label}</span>
                <ClipboardList size={13} className="opacity-50" />
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Answers (0 = never, 8 = very often)</p>
          <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            {Array.from({ length: inst.items }, (_, i) => (
              <button key={i}
                className={answers[i] !== undefined ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}>
                {answers[i] ?? "—"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">Tap a cell to cycle 0 to 8. Fill all {inst.items} items before submitting.</p>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
        <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Clinical interpretation</p>
        <textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)} className="w-full h-24 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]" />
      </div>

      <div className="flex items-center justify-between">
        <button disabled={status === "saved" || answerCount !== inst.items || !interpretation.trim()}
          onClick={handleSubmit}
          className={saveClass}>
          {status === "saved" ? "Recorded" : "Submit assessment"}
        </button>
      </div>
    </div>
  );
}
