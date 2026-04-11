import {
  PrismaClient,
  Role,
  ProjectStatus,
  StepStatus,
  ModuleStatus,
  Step0Status,
  EvidenceStatus,
  EvidenceType,
  TeamRole,
  TeamMemberStatus,
  SessionStatus,
  SessionResult,
  FeedbackStatus,
  RiskLevel,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Cohort ─────────────────────────────────────────────────────────────

  const cohort = await prisma.cohort.upsert({
    where: { name: 'Cohorte 2025-A' },
    update: {},
    create: {
      name: 'Cohorte 2025-A',
      description: 'Primera cohorte del programa Starteria 2025',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-06-30'),
      isActive: true,
    },
  });

  // ─── Users ──────────────────────────────────────────────────────────────
  // Password: demo123 — bcrypt 12 rounds
  const DEMO_HASH = '$2b$12$kbkpUcaftAa.43pNHcFSoO24/pHvJAJSixTO1gTlR0pzovdD8beZG';

  const ana = await prisma.user.upsert({
    where: { email: 'participante@starteria.io' },
    update: {},
    create: {
      email: 'participante@starteria.io',
      name: 'Ana Rodriguez',
      passwordHash: DEMO_HASH,
      role: Role.participante,
      initials: 'AR',
      skills: ['Design Thinking', 'Facilitacion', 'Investigacion UX'],
    },
  });

  const carlos = await prisma.user.upsert({
    where: { email: 'mentor@starteria.io' },
    update: {},
    create: {
      email: 'mentor@starteria.io',
      name: 'Carlos Mendez',
      passwordHash: DEMO_HASH,
      role: Role.mentor,
      initials: 'CM',
      skills: ['Estrategia', 'Innovacion', 'Gestion de producto'],
    },
  });

  const laura = await prisma.user.upsert({
    where: { email: 'admin@starteria.io' },
    update: {},
    create: {
      email: 'admin@starteria.io',
      name: 'Laura Perez',
      passwordHash: DEMO_HASH,
      role: Role.admin,
      initials: 'LP',
      skills: ['Gestion de programas', 'Coaching', 'Facilitacion'],
    },
  });

  const roberto = await prisma.user.upsert({
    where: { email: 'lider@starteria.io' },
    update: {},
    create: {
      email: 'lider@starteria.io',
      name: 'Roberto Jimenez',
      passwordHash: DEMO_HASH,
      role: Role.colaborador,
      initials: 'RJ',
      skills: ['Liderazgo', 'Transformacion digital'],
    },
  });

  // ─── Project 1: Onboarding Digital ──────────────────────────────────────

  const p1 = await prisma.project.create({
    data: {
      name: 'Onboarding Digital',
      description:
        'Reducir el tiempo de incorporacion de nuevos empleados de 3 semanas a 5 dias.',
      status: ProjectStatus.IN_PROGRESS,
      currentStep: 1,
      step0Status: Step0Status.COMPLETED,
      step0Data: {
        nombreParticipante: 'Ana Rodriguez',
        rolArea: 'Gerente de Recursos Humanos - Talento',
        origen: 'problema',
        quePasaQueQuieres:
          'El proceso de incorporacion de empleados nuevos tarda entre 15 y 21 dias. Mientras tanto, la persona no puede trabajar porque no tiene accesos ni herramientas.',
        impacta: ['Operaciones', 'TI', 'Gerencias'],
        parteProceso: 'durante',
        impacto3meses: 'productividad',
        respaldo: 'datos',
        quienEscuchar:
          'La Directora de Operaciones, porque aprueba cambios que afectan a mas de un area.',
        siMinimo: ['Reunion 30 min con el decisor correcto', 'Acceso a datos'],
      },
      mentorCredits: 3,
      riskLevel: RiskLevel.MEDIUM,
      ownerId: ana.id,
      cohortId: cohort.id,
    },
  });

  // P1 Steps
  const p1Step1 = await prisma.step.create({
    data: {
      projectId: p1.id,
      number: 1,
      name: 'Claridad en el desafio',
      status: StepStatus.IN_PROGRESS,
      progress: 65,
    },
  });

  const p1Step2 = await prisma.step.create({
    data: {
      projectId: p1.id,
      number: 2,
      name: 'Disenar solucion',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  const p1Step3 = await prisma.step.create({
    data: {
      projectId: p1.id,
      number: 3,
      name: 'Probar en pequeno',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  const p1Step4 = await prisma.step.create({
    data: {
      projectId: p1.id,
      number: 4,
      name: 'Contar la historia',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  // P1 Step1 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p1Step1.id, moduleId: 'A', name: 'Proceso actual', status: ModuleStatus.COMPLETED },
      { stepId: p1Step1.id, moduleId: 'B', name: 'Medicion e impacto', status: ModuleStatus.COMPLETED },
      { stepId: p1Step1.id, moduleId: 'C', name: 'Restricciones', status: ModuleStatus.IN_PROGRESS },
      { stepId: p1Step1.id, moduleId: 'D', name: 'Actores y entrevistas', status: ModuleStatus.BLOCKED },
      { stepId: p1Step1.id, moduleId: 'S', name: 'Sintesis y revision de rumbo', status: ModuleStatus.BLOCKED },
    ],
  });

  // P1 Step2 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p1Step2.id, moduleId: 'A', name: 'Como podriamos...?', status: ModuleStatus.BLOCKED },
      { stepId: p1Step2.id, moduleId: 'B', name: 'Explorar ideas', status: ModuleStatus.BLOCKED },
      { stepId: p1Step2.id, moduleId: 'C', name: 'Elegir la mejor opcion', status: ModuleStatus.BLOCKED },
      { stepId: p1Step2.id, moduleId: 'D', name: 'Tarjetas de solucion y prueba', status: ModuleStatus.BLOCKED },
    ],
  });

  // P1 Step3 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p1Step3.id, moduleId: 'R', name: 'Experimentos', status: ModuleStatus.BLOCKED },
      { stepId: p1Step3.id, moduleId: 'L', name: 'Tarjeta de aprendizaje', status: ModuleStatus.BLOCKED },
    ],
  });

  // P1 Step4 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p1Step4.id, moduleId: 'S', name: 'Construccion del relato', status: ModuleStatus.BLOCKED },
      { stepId: p1Step4.id, moduleId: 'O', name: 'Resumen ejecutivo', status: ModuleStatus.BLOCKED },
      { stepId: p1Step4.id, moduleId: 'P', name: 'Presentacion final', status: ModuleStatus.BLOCKED },
    ],
  });

  // P1 Team members
  await prisma.teamMember.create({
    data: {
      projectId: p1.id,
      userId: ana.id,
      role: TeamRole.OWNER,
      status: TeamMemberStatus.ACTIVE,
      joinedAt: new Date('2025-02-01'),
    },
  });

  // P1 Evidence
  await prisma.evidence.createMany({
    data: [
      {
        projectId: p1.id,
        name: 'Mapa_proceso_actual.pdf',
        type: EvidenceType.PDF,
        size: '2.4 MB',
        stepRef: 1,
        moduleRef: 'A',
        ownerId: ana.id,
        status: EvidenceStatus.VERIFIED,
      },
      {
        projectId: p1.id,
        name: 'Entrevista_RRHH_video.mp4',
        type: EvidenceType.VIDEO,
        size: '45 MB',
        stepRef: 1,
        moduleRef: 'A',
        ownerId: ana.id,
        status: EvidenceStatus.UPLOADED,
      },
      {
        projectId: p1.id,
        name: 'Dashboard_metricas.png',
        type: EvidenceType.IMAGE,
        size: '890 KB',
        stepRef: 1,
        moduleRef: 'B',
        ownerId: ana.id,
        status: EvidenceStatus.VERIFIED,
      },
    ],
  });

  // ─── Project 2: Portal de Reportes Automaticos ─────────────────────────

  const p2 = await prisma.project.create({
    data: {
      name: 'Portal de Reportes Automaticos',
      description:
        'Automatizar la generacion de reportes operativos que hoy toma 8 horas semanales.',
      status: ProjectStatus.EXPERT_SESSION_PENDING,
      currentStep: 2,
      step0Status: Step0Status.COMPLETED,
      step0Data: {
        nombreParticipante: 'Pedro Alvarado',
        rolArea: 'Jefe de Analisis - Finanzas',
        origen: 'problema',
        quePasaQueQuieres:
          'Generamos reportes operativos manualmente cada semana. Eso toma 8 horas de un analista y retrasa la toma de decisiones del directorio.',
        impacta: ['Gerencias', 'Finanzas'],
        parteProceso: 'durante',
        impacto3meses: 'productividad',
        respaldo: 'datos',
        quienEscuchar:
          'El Director Financiero, quien lidera la iniciativa de eficiencia operativa.',
        siMinimo: ['Reunion 30 min con el decisor correcto', 'Acceso a datos'],
      },
      mentorCredits: 2,
      riskLevel: RiskLevel.LOW,
      ownerId: ana.id,
      cohortId: cohort.id,
    },
  });

  // P2 Steps
  const p2Step1 = await prisma.step.create({
    data: {
      projectId: p2.id,
      number: 1,
      name: 'Claridad en el desafio',
      status: StepStatus.APPROVED,
      progress: 100,
    },
  });

  const p2Step2 = await prisma.step.create({
    data: {
      projectId: p2.id,
      number: 2,
      name: 'Disenar solucion',
      status: StepStatus.EXPERT_SESSION_PENDING,
      progress: 85,
    },
  });

  const p2Step3 = await prisma.step.create({
    data: {
      projectId: p2.id,
      number: 3,
      name: 'Probar en pequeno',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  const p2Step4 = await prisma.step.create({
    data: {
      projectId: p2.id,
      number: 4,
      name: 'Contar la historia',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  // P2 Step1 Modules (all approved)
  await prisma.module.createMany({
    data: [
      { stepId: p2Step1.id, moduleId: 'A', name: 'Proceso actual', status: ModuleStatus.APPROVED },
      { stepId: p2Step1.id, moduleId: 'B', name: 'Medicion e impacto', status: ModuleStatus.APPROVED },
      { stepId: p2Step1.id, moduleId: 'C', name: 'Restricciones', status: ModuleStatus.APPROVED },
      { stepId: p2Step1.id, moduleId: 'D', name: 'Actores y entrevistas', status: ModuleStatus.APPROVED },
      { stepId: p2Step1.id, moduleId: 'S', name: 'Sintesis y revision de rumbo', status: ModuleStatus.APPROVED },
    ],
  });

  // P2 Step2 Modules (all approved)
  await prisma.module.createMany({
    data: [
      { stepId: p2Step2.id, moduleId: 'A', name: 'Como podriamos...?', status: ModuleStatus.APPROVED },
      { stepId: p2Step2.id, moduleId: 'B', name: 'Explorar ideas', status: ModuleStatus.APPROVED },
      { stepId: p2Step2.id, moduleId: 'C', name: 'Elegir la mejor opcion', status: ModuleStatus.APPROVED },
      { stepId: p2Step2.id, moduleId: 'D', name: 'Tarjetas de solucion y prueba', status: ModuleStatus.APPROVED },
    ],
  });

  // P2 Step3 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p2Step3.id, moduleId: 'R', name: 'Experimentos', status: ModuleStatus.BLOCKED },
      { stepId: p2Step3.id, moduleId: 'L', name: 'Tarjeta de aprendizaje', status: ModuleStatus.BLOCKED },
    ],
  });

  // P2 Step4 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p2Step4.id, moduleId: 'S', name: 'Construccion del relato', status: ModuleStatus.BLOCKED },
      { stepId: p2Step4.id, moduleId: 'O', name: 'Resumen ejecutivo', status: ModuleStatus.BLOCKED },
      { stepId: p2Step4.id, moduleId: 'P', name: 'Presentacion final', status: ModuleStatus.BLOCKED },
    ],
  });

  // P2 Step1 FeedbackIA
  await prisma.feedbackIA.create({
    data: {
      stepId: p2Step1.id,
      status: FeedbackStatus.APPROVED,
      summary:
        'El analisis del proceso actual esta bien documentado. Las metricas son solidas y tienen contexto real.',
      goodPoints: [
        'Caso real bien contextualizado con recorrido completo',
        'Metrica operativa con linea base definida (8 horas semanales)',
        'Restricciones identificadas con claridad',
      ],
      missing: [],
      actions: [],
      questions: [],
      contradictions: [],
    },
  });

  // P2 Step2 FeedbackIA
  await prisma.feedbackIA.create({
    data: {
      stepId: p2Step2.id,
      status: FeedbackStatus.APPROVED,
      summary: 'La solucion propuesta es coherente con el desafio identificado.',
      goodPoints: [
        'Pregunta "Como podriamos...?" bien alineada al reto',
        '12 ideas generadas y bien agrupadas',
        'Matriz de decision completa',
      ],
      missing: [],
      actions: [],
      questions: [
        'Como validaran la hipotesis con usuarios reales antes del experimento?',
      ],
      contradictions: [],
    },
  });

  // P2 Step1 MentorSession (completed)
  await prisma.mentorSession.create({
    data: {
      projectId: p2.id,
      stepId: p2Step1.id,
      stepNumber: 1,
      mentorId: carlos.id,
      date: new Date('2025-02-12'),
      status: SessionStatus.COMPLETED,
      result: SessionResult.APPROVED,
      comments: 'Excelente claridad del problema. Avanzar.',
    },
  });

  // P2 Step2 MentorSession (pending schedule)
  await prisma.mentorSession.create({
    data: {
      projectId: p2.id,
      stepId: p2Step2.id,
      stepNumber: 2,
      mentorId: carlos.id,
      status: SessionStatus.PENDING_SCHEDULE,
    },
  });

  // ─── Project 3: Reducir Tiempo de Cierre Mensual ───────────────────────

  const p3 = await prisma.project.create({
    data: {
      name: 'Reducir Tiempo de Cierre Mensual',
      description:
        'El cierre contable tarda 10 dias habiles. El objetivo es reducirlo a 3 dias.',
      status: ProjectStatus.DRAFT,
      currentStep: 1,
      step0Status: Step0Status.NOT_STARTED,
      mentorCredits: 3,
      riskLevel: RiskLevel.HIGH,
      ownerId: ana.id,
      cohortId: cohort.id,
    },
  });

  // P3 Steps
  const p3Step1 = await prisma.step.create({
    data: {
      projectId: p3.id,
      number: 1,
      name: 'Claridad en el desafio',
      status: StepStatus.NOT_STARTED,
      progress: 0,
    },
  });

  const p3Step2 = await prisma.step.create({
    data: {
      projectId: p3.id,
      number: 2,
      name: 'Disenar solucion',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  const p3Step3 = await prisma.step.create({
    data: {
      projectId: p3.id,
      number: 3,
      name: 'Probar en pequeno',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  const p3Step4 = await prisma.step.create({
    data: {
      projectId: p3.id,
      number: 4,
      name: 'Contar la historia',
      status: StepStatus.BLOCKED,
      progress: 0,
    },
  });

  // P3 Step1 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p3Step1.id, moduleId: 'A', name: 'Proceso actual', status: ModuleStatus.DRAFT },
      { stepId: p3Step1.id, moduleId: 'B', name: 'Medicion e impacto', status: ModuleStatus.BLOCKED },
      { stepId: p3Step1.id, moduleId: 'C', name: 'Restricciones', status: ModuleStatus.BLOCKED },
      { stepId: p3Step1.id, moduleId: 'D', name: 'Actores y entrevistas', status: ModuleStatus.BLOCKED },
      { stepId: p3Step1.id, moduleId: 'S', name: 'Sintesis y revision de rumbo', status: ModuleStatus.BLOCKED },
    ],
  });

  // P3 Step2 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p3Step2.id, moduleId: 'A', name: 'Como podriamos...?', status: ModuleStatus.BLOCKED },
      { stepId: p3Step2.id, moduleId: 'B', name: 'Explorar ideas', status: ModuleStatus.BLOCKED },
      { stepId: p3Step2.id, moduleId: 'C', name: 'Elegir la mejor opcion', status: ModuleStatus.BLOCKED },
      { stepId: p3Step2.id, moduleId: 'D', name: 'Tarjetas de solucion y prueba', status: ModuleStatus.BLOCKED },
    ],
  });

  // P3 Step3 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p3Step3.id, moduleId: 'R', name: 'Experimentos', status: ModuleStatus.BLOCKED },
      { stepId: p3Step3.id, moduleId: 'L', name: 'Tarjeta de aprendizaje', status: ModuleStatus.BLOCKED },
    ],
  });

  // P3 Step4 Modules
  await prisma.module.createMany({
    data: [
      { stepId: p3Step4.id, moduleId: 'S', name: 'Construccion del relato', status: ModuleStatus.BLOCKED },
      { stepId: p3Step4.id, moduleId: 'O', name: 'Resumen ejecutivo', status: ModuleStatus.BLOCKED },
      { stepId: p3Step4.id, moduleId: 'P', name: 'Presentacion final', status: ModuleStatus.BLOCKED },
    ],
  });

  // P3 Team member
  await prisma.teamMember.create({
    data: {
      projectId: p3.id,
      userId: ana.id,
      role: TeamRole.OWNER,
      status: TeamMemberStatus.ACTIVE,
      joinedAt: new Date('2025-02-19'),
    },
  });

  console.log('Seed completed successfully.');
  console.log(`  Cohort: ${cohort.name} (${cohort.id})`);
  console.log(`  Users: ${ana.name}, ${carlos.name}, ${laura.name}, ${roberto.name}`);
  console.log(`  Projects: ${p1.name}, ${p2.name}, ${p3.name}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
