/**
 * Clinical Notes Editor — draft → sign workflow with audit-safe validation.
 * Body is never logged server-side (audit redacts free text).
 */

import { useState } from "react";
import { Save, Clock, CheckCircle, FileText, Trash2 } from "lucide-react";
import { useCreateClinicalNote, type WorkstationPatient } from "@/hooks/use-clinical-workstation";

type NoteType = "CONSULTATION" | "PROGRESS" | "MEDICATION_REVIEW" | "RISK_REVIEW" | "SAFEGUARDING";

const NOTE_TYPES: { value: NoteType; label: string; desc: string }[] = [
  { value: "CONSULTATION", label: "Consultation", desc: "Full clinical encounter note." },
  { value: "PROGRESS", label: "Progress", desc: "Ongoing treatment progress note." },
  { value: "MEDICATION_REVIEW", label: "Medication review", desc: "Titration and safety review." },
  { value: "RISK_REVIEW", label: "Risk review", desc: "Safeguarding / risk assessment." },
  { value: "SAFEGUARDING", label: "Safeguarding", desc: "Safeguarding concern record." },
];

export function ClinicalNotesEditor({ patientId }: { patientId: string }) {
  const [type, setType] = useState<NoteType>("CONSULTATION");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const createNote = useCreateClinicalNote(patientId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body || body.length < 5) return;
    setStatus("saving");
    createNote.mutate({ type, body }, {
      onSuccess: () => { setStatus("saved"); setBody(""); setType("CONSULTATION"); },
      onError: () => { setStatus("idle"); },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Clinical note</p>
          <h3 className="text-lg font-semibold">Draft note</h3>
        </div>
        <div className="flex gap-2">
          <button
            disabled={createNote.isPending || status === "saved"}
            onClick={handleSave}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
              status === "saved"
                ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-[hsl(var(--success))]"
                : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/[.9]"
            }`}
          >
            {status === "saved" ? <CheckCircle size={16} className="mr-1" /> : <Save size={16} className="mr-1" />}
            {status === "saved" ? "Signed" : "Save note"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Note type</p>
          <div className="space-y-1">
            {NOTE_TYPES.map((nt) => (
              <button
                key={nt.value}
                onClick={() => setType(nt.value)}
                className={`flex items-center justify-between w-full rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                  type === nt.value
                    ? "bg-[hsl(var(--primary))]/[.1] border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]/[.4]"
                }`}
              >
                <span className="font-medium">{nt.label}</span>
                <FileText size={13} className="opacity-50" />
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">{NOTE_TYPES.find((n) => n.value === type)?.desc}</p>
        </div>

        <div className="col-span-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Note body</p>
          <textarea
            className="w-full h-48 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            placeholder="Record objective findings, assessment, and plan. Avoid unverified claims. Free text is redacted from audit logs."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{body.length} characters</p>
        </div>
      </div>

      {status === "saved" && (
        <div className="rounded-xl border border-[hsl(var(--success))]/[.3] bg-[hsl(var(--success))]/[.1] px-4 py-3 text-[12px] text-[hsl(var(--success-foreground))]">
          <Clock size={14} className="mr-1.5" /> Note saved as draft — ready for clinician review and signature.
        </div>
      )}
    </div>
  );
}
