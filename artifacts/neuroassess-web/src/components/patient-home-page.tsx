/**
 * PatientHomePage — public website home page for NeuroCare Apex.
 * Premium healthcare website communicating specialist ADHD and Autism care.
 */

import { Link } from 'wouter';
import { ArrowRight, CalendarDays, CheckCircle, Clock, HeartPulse, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { ApexButton } from './apex-ui/ApexButton';
import { ApexCard } from './apex-ui/ApexCard';

export function PatientHomePage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--apex-surface-l0))] text-[hsl(var(--apex-neutral-slate))]">
      <nav className="sticky top-0 z-50 border-b border-[hsl(var(--apex-surface-l2))] bg-[hsl(var(--apex-surface-l0))/90] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--apex-clinical-blue))] text-white flex items-center justify-center text-sm font-bold">NC</div>
              <span className="font-semibold text-lg tracking-tight">NeuroCare Apex</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link href="/" className="text-[hsl(var(--apex-clinical-blue))]">Home</Link>
              <Link href="#pathways" className="hover:text-[hsl(var(--apex-clinical-blue))] transition-colors">Pathways</Link>
              <Link href="#how-it-works" className="hover:text-[hsl(var(--apex-clinical-blue))] transition-colors">How it works</Link>
              <Link href="#treatment" className="hover:text-[hsl(var(--apex-clinical-blue))] transition-colors">Treatment</Link>
              <Link href="#pricing" className="hover:text-[hsl(var(--apex-clinical-blue))] transition-colors">Pricing</Link>
              <Link href="#faqs" className="hover:text-[hsl(var(--apex-clinical-blue))] transition-colors">FAQs</Link>
              <ApexButton variant="secondary" className="text-sm px-3 py-1.5" onClick={() => {}}>Sign in</ApexButton>
            </div>
            <div className="md:hidden">
              <ApexButton variant="primary" className="w-full text-sm" onClick={() => {}}>Start ADHD Assessment</ApexButton>
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--apex-success-green))/10] text-[hsl(var(--apex-success-green))] text-xs font-semibold mb-6">
            <CheckCircle size={12} /> NHS-aligned assessment pathways
          </div>
          <h1 className="text-4xl lg:text-6xl font-display font-bold text-[hsl(var(--apex-neutral-slate))] tracking-tight mb-6 leading-[1.1]">Specialist ADHD and Autism Care</h1>
          <p className="text-lg lg:text-xl text-[hsl(var(--apex-neutral-slate))/80] mb-10 max-w-2xl mx-auto leading-relaxed">Evidence-based neurodevelopmental assessment, titration and shared-care pathways for adults and children. From first contact to ongoing care — every step connected, every decision documented.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <ApexButton variant="primary" className="w-full sm:w-auto" onClick={() => {}}>
              <ArrowRight size={18} className="mr-2" /> Start ADHD Assessment
            </ApexButton>
            <ApexButton variant="secondary" className="w-full sm:w-auto" onClick={() => {}}>
              <ArrowRight size={18} className="mr-2" /> Start Autism Assessment
            </ApexButton>
            <ApexButton variant="secondary" className="w-full sm:w-auto" onClick={() => {}}>
              <CalendarDays size={18} className="mr-2" /> Book Consultation
            </ApexButton>
          </div>
        </div>
      </section>

      <section id="pathways" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">Assessment Pathways</h2>
          <p className="text-[hsl(var(--apex-neutral-slate))/70]">Choose the pathway that matches your needs.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'ADHD Assessment', description: 'Comprehensive ADHD assessment using DIVA, ASRS and WURS instruments with clinician review.', icon: <HeartPulse size={24} />, color: '--apex-clinical-blue' },
            { title: 'Autism Assessment', description: 'Autism spectrum assessment using ADOS, AQ-50 and RAADS-R with multidisciplinary team review.', icon: <Stethoscope size={24} />, color: '--apex-operational-teal' },
            { title: 'Combined Assessment', description: 'Combined ADHD and Autism assessment for overlapping neurodevelopmental presentations.', icon: <UserRound size={24} />, color: '--apex-review-purple' },
          ].map((pathway) => (
            <ApexCard key={pathway.title} className="p-6 hover:border-[hsl(var(--apex-clinical-blue))]/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--apex-clinical-blue))]/10 text-[hsl(var(--apex-clinical-blue))] flex items-center justify-center mb-4">
                {pathway.icon}
              </div>
              <h3 className="text-xl font-bold text-[hsl(var(--apex-neutral-slate))] mb-2">{pathway.title}</h3>
              <p className="text-[hsl(var(--apex-neutral-slate))/70] text-sm leading-relaxed">{pathway.description}</p>
              <Link href="#onboarding" className="mt-4 inline-flex items-center text-sm font-semibold text-[hsl(var(--apex-clinical-blue))] hover:underline">
                Start {pathway.title} <ArrowRight size={14} className="ml-1" />
              </Link>
            </ApexCard>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 bg-[hsl(var(--apex-surface-l2))]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">How assessment works</h2>
          <p className="text-[hsl(var(--apex-neutral-slate))/70]">A clear, step-by-step journey from first contact to ongoing care.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Sign up & verify', description: 'Create your account and verify your email address.' },
            { step: '2', title: 'Safety screening', description: 'Complete a clinical suitability screen — triage, never diagnosis.' },
            { step: '3', title: 'Book appointment', description: 'Choose your clinician, date and appointment type.' },
            { step: '4', title: 'Payment', description: 'Secure payment with clear pricing — no hidden fees.' },
            { step: '5', title: 'Pre-assessment', description: 'Complete questionnaires and upload documents before your appointment.' },
            { step: '6', title: 'Clinical session', description: 'Attend your assessment with APEX Live documentation support.' },
          ].map((step) => (
            <div key={step.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--apex-clinical-blue))] text-white flex items-center justify-center mx-auto mb-4 text-sm font-bold">
                {step.step}
              </div>
              <h4 className="text-lg font-bold text-[hsl(var(--apex-neutral-slate))] mb-2">{step.title}</h4>
              <p className="text-[hsl(var(--apex-neutral-slate))/70] text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="treatment" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">Treatment & titration pathway</h2>
          <p className="text-[hsl(var(--apex-neutral-slate))/70]">From assessment through titration to maintenance and shared care.</p>
        </div>
        <div className="flex flex-col lg:flex-row items-start gap-8">
          <div className="lg:w-1/3 space-y-4">
            {[
              { title: 'Assessment', status: 'COMPLETED', label: 'Completed' },
              { title: 'Diagnosis', status: 'COMPLETED', label: 'Confirmed' },
              { title: 'Treatment plan', status: 'ACTIVE', label: 'Active' },
              { title: 'Titration', status: 'WAITING', label: 'Awaiting start' },
              { title: 'Maintenance', status: 'BLOCKED', label: 'Pending titration' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg border bg-[hsl(var(--apex-surface-l1))]">
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: `hsl(var(${getStatusColor(item.status)}))` }}></div>
                <div>
                  <div className="text-sm font-semibold text-[hsl(var(--apex-neutral-slate))]">{item.title}</div>
                  <div className="text-xs text-[hsl(var(--apex-neutral-slate))/60]">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="lg:w-2/3">
            <ApexCard className="p-6">
              <h3 className="text-lg font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">What happens after assessment</h3>
              <p className="text-[hsl(var(--apex-neutral-slate))/70] mb-4">
                If treatment is appropriate, your clinician will discuss medication options,
                start titration at the right dose for you, and schedule regular reviews.
                Vitals monitoring and patient-reported outcomes track your progress
                throughout the titration phase.
              </p>
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--apex-success-green))/10]">
                  <CheckCircle size={16} className="text-[hsl(var(--apex-success-green))]" />
                  <div>
                    <div className="text-sm font-semibold text-[hsl(var(--apex-neutral-slate))]">Titration reviews</div>
                    <div className="text-xs text-[hsl(var(--apex-neutral-slate))/60]">Weekly to fortnightly dose adjustment</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--apex-information-cyan))/10]">
                  <Clock size={16} className="text-[hsl(var(--apex-information-cyan))]" />
                  <div>
                    <div className="text-sm font-semibold text-[hsl(var(--apex-neutral-slate))]">Vitals monitoring</div>
                    <div className="text-xs text-[hsl(var(--apex-neutral-slate))/60]">Blood pressure, pulse, weight tracking</div>
                  </div>
                </div>
              </div>
            </ApexCard>
          </div>
        </div>
      </section>
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 bg-[hsl(var(--apex-surface-l2))]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">Transparent pricing</h2>
          <p className="text-[hsl(var(--apex-neutral-slate))/70]">No hidden fees. Payment required before appointment confirmation.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { name: 'ADHD Assessment', price: '£650', description: 'Full ADHD assessment with DIVA, ASRS, WURS and clinician report.', features: ['90-minute clinical session', 'Comprehensive written report', 'Treatment plan if appropriate'] },
            { name: 'Autism Assessment', price: '£750', description: 'Full autism assessment with ADOS, AQ-50, RAADS-R and MDT review.', features: ['Multidisciplinary team review', 'Comprehensive written report', 'Support recommendations'] },
            { name: 'Combined Assessment', price: '£1,200', description: 'Combined ADHD and Autism assessment for overlapping presentations.', features: ['Single combined session', 'Unified clinical report', 'Integrated treatment plan'] },
          ].map((plan) => (
            <ApexCard key={plan.name} className="p-6 flex flex-col">
              <h3 className="text-xl font-bold text-[hsl(var(--apex-neutral-slate))] mb-2">{plan.name}</h3>
              <div className="text-2xl font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">{plan.price}</div>
              <p className="text-[hsl(var(--apex-neutral-slate))/70] text-sm mb-6">{plan.description}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[hsl(var(--apex-neutral-slate))/80]">
                    <CheckCircle size={14} className="text-[hsl(var(--apex-success-green))] mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <ApexButton variant="primary" className="w-full" onClick={() => {}}>
                Book {plan.name}
              </ApexButton>
            </ApexCard>
          ))}
        </div>
      </section>
      <section id="security" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">Security & privacy</h2>
          <p className="text-[hsl(var(--apex-neutral-slate))/70]">Your clinical data is protected at every step.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: 'Encrypted in transit', icon: <ShieldCheck size={24} />, description: 'All data transmitted over TLS 1.3.' },
            { title: 'Role-based access', icon: <UserRound size={24} />, description: 'Clinicians see only what they need to provide care.' },
            { title: 'Audit trail', icon: <Clock size={24} />, description: 'Every clinical action is logged and reviewable.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-4 rounded-lg border bg-[hsl(var(--apex-surface-l1))]">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--apex-clinical-blue))]/10 text-[hsl(var(--apex-clinical-blue))] flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[hsl(var(--apex-neutral-slate))]">{item.title}</h4>
                <p className="text-xs text-[hsl(var(--apex-neutral-slate))/60] mt-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section id="onboarding" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="text-center">
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--apex-neutral-slate))] mb-4">Ready to start?</h2>
          <p className="text-[hsl(var(--apex-neutral-slate))/70] mb-8">Begin your assessment journey today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <ApexButton variant="primary" className="w-full sm:w-auto" onClick={() => {}}>
              <ArrowRight size={18} className="mr-2" /> Start ADHD Assessment
            </ApexButton>
            <ApexButton variant="secondary" className="w-full sm:w-auto" onClick={() => {}}>
              <ArrowRight size={18} className="mr-2" /> Start Autism Assessment
            </ApexButton>
          </div>
        </div>
      </section>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'COMPLETED': return '--apex-success-green';
    case 'ACTIVE': return '--apex-operational-teal';
    case 'WAITING': return '--apex-waiting-grey';
    case 'BLOCKED': return '--apex-critical-red';
    default: return '--apex-neutral-slate';
  }
}
