/**
 * Synthetic demo dataset — clearly-fake UK dev data for local testing ONLY.
 * Never run against staging/production. Contains no real patient information.
 */
import { PrismaClient, Role, TeamType, AppointmentStatus, AppointmentMode, AssessmentType, AssessmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('DemoPassw0rdLocal', 12);

  const clinicianUser = await prisma.user.upsert({
    where: { email: 'demo.clinician@neuroassess.test' },
    update: { passwordHash, status: 'ACTIVE' },
    create: { email: 'demo.clinician@neuroassess.test', passwordHash, firstName: 'Farah', lastName: 'Okafor', roles: [Role.PSYCHIATRIST], status: 'ACTIVE', roleAssignments: { create: { role: Role.PSYCHIATRIST } } },
  });
  const adminUser = await prisma.user.upsert({
    where: { email: 'demo.admin@neuroassess.test' },
    update: { passwordHash, status: 'ACTIVE' },
    create: { email: 'demo.admin@neuroassess.test', passwordHash, firstName: 'Sam', lastName: 'Whitmore', roles: [Role.ADMIN], status: 'ACTIVE', roleAssignments: { create: { role: Role.ADMIN } } },
  });
  const patientUser = await prisma.user.upsert({
    where: { email: 'demo.patient@neuroassess.test' },
    update: { passwordHash, status: 'ACTIVE' },
    create: { email: 'demo.patient@neuroassess.test', passwordHash, firstName: 'Maya', lastName: 'Ellison', roles: [Role.PATIENT], status: 'ACTIVE', roleAssignments: { create: { role: Role.PATIENT } }, patient: { create: {} } },
  });
  const patient2User = await prisma.user.upsert({
    where: { email: 'demo.patient2@neuroassess.test' },
    update: { passwordHash, status: 'ACTIVE' },
    create: { email: 'demo.patient2@neuroassess.test', passwordHash, firstName: 'Rory', lastName: 'Whitfield', roles: [Role.PATIENT], status: 'ACTIVE', roleAssignments: { create: { role: Role.PATIENT } }, patient: { create: {} } },
  });

  const team = await prisma.team.upsert({
    where: { id: 'demo-team' },
    update: {},
    create: { id: 'demo-team', code: 'DEMO-TEAM', name: 'ADHD & ASD Assessment Team (demo)', type: TeamType.ASSESSMENT },
  });

  const clinician = await prisma.clinician.upsert({
    where: { userId: clinicianUser.id },
    update: {},
    create: { userId: clinicianUser.id, registrationBody: 'GMC', registrationNumber: 'DEMO-000000', specialisms: ['Adult ADHD', 'Adult Autism'] },
  });
  await prisma.clinician.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id, registrationBody: 'GMC', registrationNumber: 'DEMO-ADMIN', specialisms: ['Administration'] },
  });
  const patient = await prisma.patient.findUniqueOrThrow({ where: { userId: patientUser.id } });
  const patient2 = await prisma.patient.findUniqueOrThrow({ where: { userId: patient2User.id } });

  await prisma.patientAssignment.upsert({
    where: { id: 'demo-assignment-maya' },
    update: { active: true },
    create: { id: 'demo-assignment-maya', patientId: patient.id, userId: clinicianUser.id, teamId: team.id, role: 'LEAD_CLINICIAN', isPrimary: true, active: true },
  });

  const existingAppt = await prisma.appointment.findFirst({ where: { patientId: patient.id } });
  if (!existingAppt) {
    const start1 = new Date(Date.now() + 36 * 3600e3);
    const end1 = new Date(start1.getTime() + 50 * 60e3);
    const start2 = new Date(Date.now() - 7 * 24 * 3600e3);
    const end2 = new Date(start2.getTime() + 50 * 60e3);
    await prisma.appointment.createMany({
      data: [
        { patientId: patient.id, clinicianId: clinician.id, type: AssessmentType.ADHD, startsAt: start1, endsAt: end1, mode: AppointmentMode.VIDEO, status: AppointmentStatus.CONFIRMED },
        { patientId: patient.id, clinicianId: clinician.id, type: AssessmentType.ADHD, startsAt: start2, endsAt: end2, mode: AppointmentMode.VIDEO, status: AppointmentStatus.COMPLETED },
      ],
    });
  }

  const existingAssessment = await prisma.assessment.findFirst({ where: { patientId: patient.id } });
  if (!existingAssessment) {
    await prisma.assessment.create({
      data: { patientId: patient.id, clinicianId: clinician.id, type: AssessmentType.ADHD, status: AssessmentStatus.SCREENING, adhd: { create: {} } },
    });
    await prisma.assessment.create({
      data: { patientId: patient2.id, clinicianId: clinician.id, type: AssessmentType.AUTISM, status: AssessmentStatus.INTAKE, autism: { create: {} } },
    });
  }

  const thread = await prisma.messageThread.findFirst({ where: { patientId: patient.id } });
  if (!thread) {
    await prisma.messageThread.create({
      data: { patientId: patient.id, subject: 'Welcome to NeuroAssess (demo)', messages: { create: { senderId: clinicianUser.id, body: 'Synthetic demo message: your assessment portal is ready. No real clinical data is present in this environment.', channel: 'IN_APP', status: 'SENT', sentAt: new Date() } } },
    });
  }

  console.log('Demo data ready: demo.clinician@neuroassess.test / demo.patient@neuroassess.test / demo.admin@neuroassess.test — password DemoPassw0rdLocal (LOCAL ONLY)');
}

main().finally(() => prisma.$disconnect());
