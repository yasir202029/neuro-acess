/**
 * AdminOperationalQueues — centre operational queues for the Admin Workstation.
 *
 * Each queue shows WHO, WHAT, STATUS, OWNER, NEXT ACTION without forcing
 * the administrator through unnecessary screens.
 */

const OPERATIONAL_QUEUES: Array<{
  id: string;
  title: string;
  count: number;
  items: Array<{ who: string; what: string; status: string; owner: string; nextAction: string }>;
}> = [
  {
    id: "new-referrals",
    title: "New Referrals",
    count: 3,
    items: [
      { who: "Maya Thompson", what: "ADHD referral", status: "NEW", owner: "Unassigned", nextAction: "Assign clinician" },
      { who: "Oliver Grant", what: "Autism referral", status: "NEW", owner: "Unassigned", nextAction: "Assign clinician" },
      { who: "Amelia Wright", what: "ADHD referral", status: "NEW", owner: "Unassigned", nextAction: "Assign clinician" },
    ],
  },
  {
    id: "waiting-for-forms",
    title: "Waiting for Forms",
    count: 1,
    items: [
      { who: "Maya Thompson", what: "Intake questionnaire", status: "PENDING", owner: "Patient", nextAction: "Send reminder" },
    ],
  },
  {
    id: "appointment-required",
    title: "Appointment Required",
    count: 2,
    items: [
      { who: "Oliver Grant", what: "Initial assessment", status: "SCHEDULED", owner: "Dr. Smith", nextAction: "Confirm booking" },
      { who: "Amelia Wright", what: "Follow-up", status: "REQUESTED", owner: "Reception", nextAction: "Schedule slot" },
    ],
  },
];

const STATUS_COLOURS: Record<string, string> = {
  NEW: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
  PENDING: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
  SCHEDULED: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  REQUESTED: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

export function AdminOperationalQueues() {
  return (
    <div className="space-y-4">
      {OPERATIONAL_QUEUES.map((queue) => (
        <div key={queue.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/[.5] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[.1em]">{queue.title}</p>
              <p className="text-[11px] font-bold text-[hsl(var(--foreground))]">{queue.count} item{queue.count !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/[.3]">
                  <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Who</th>
                  <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">What</th>
                  <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Status</th>
                  <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Owner</th>
                  <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {queue.items.map((item) => (
                  <tr key={`${queue.id}-${item.who}`} className="hover:bg-[hsl(var(--secondary))]/[.3] transition-colors">
                    <td className="px-4 py-2 text-[hsl(var(--foreground))] font-medium">{item.who}</td>
                    <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.what}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${STATUS_COLOURS[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.owner}</td>
                    <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
