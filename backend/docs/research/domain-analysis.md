# Domain Analysis - Dashboard Starteria

## 1. Entities and Their Fields

### 1.1 User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: Role;           // 'owner' | 'mentor' | 'admin' | 'leader'
  initials: string;
  skills: string[];
  cohort?: string;
}
```

### 1.2 Project (Aggregate Root)
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  currentStep: number;        // 0-4, tracks which step is active
  step0Status: Step0Status;
  step0Data?: Partial<Step0Data>;
  mentorCredits: number;      // Default: 3. Used for mentor sessions.
  steps: Step[];              // Always 4 steps (1-4)
  team: TeamMember[];
  evidence: Evidence[];
  createdAt: string;          // ISO date (YYYY-MM-DD)
  lastModified: string;       // ISO datetime
  cohort?: string;
  riskLevel?: 'Bajo' | 'Medio' | 'Alto';
}
```

### 1.3 Step0Data (Value Object - embedded in Project)
```typescript
interface Step0Data {
  nombreParticipante: string;
  rolArea: string;
  origen: '' | 'problema' | 'oportunidad' | 'idea' | 'explorando' | 'otra';
  quePasaQueQuieres: string;
  impacta: string[];          // Multi-select from: 'Clientes externos', 'Operaciones', 'Ventas', 'Postventa', 'Finanzas', 'TI', 'Gerencias', 'Otros'
  parteProceso: '' | 'antes' | 'durante' | 'despues' | 'transversal' | 'otra';
  impacto3meses: '' | 'ingresos' | 'costos' | 'riesgo' | 'cliente' | 'productividad' | 'no_claro' | 'otro';
  respaldo: '' | 'datos' | 'testimonios' | 'benchmark' | 'hipotesis' | 'otro';
  quienEscuchar: string;
  siMinimo: string[];         // Multi-select from predefined options
}
```

### 1.4 Step (Entity - child of Project)
```typescript
interface Step {
  number: 1 | 2 | 3 | 4;
  name: string;
  status: StepStatus;
  progress: number;           // 0-100
  modules: Module[];
  feedbackIA?: FeedbackIA | null;
  mentorSession?: MentorSession | null;
  runs?: Run[];               // Only used in Step 3
}
```

Step names (fixed):
- Step 1: "Claridad en el desafio"
- Step 2: "Disenar solucion"
- Step 3: "Probar en pequeno"
- Step 4: "Contar la historia"

### 1.5 Module (Value Object - child of Step)
```typescript
interface Module {
  id: string;     // Letter identifier: 'A', 'B', 'C', 'D', 'S', 'R', 'L', 'O', 'P'
  name: string;
  status: ModuleStatus;
}
```

Modules per Step (fixed structure):
- **Step 1**: A (Proceso actual), B (Medicion e impacto), C (Restricciones), D (Actores y entrevistas), S (Sintesis y revision de rumbo)
- **Step 2**: A (Como podriamos?), B (Explorar ideas), C (Elegir la mejor opcion), D (Tarjetas de solucion y prueba)
- **Step 3**: R (Experimentos), L (Tarjeta de aprendizaje)
- **Step 4**: S (Construccion del relato), O (Resumen ejecutivo), P (Presentacion final)

### 1.6 FeedbackIA (Value Object)
```typescript
interface FeedbackIA {
  status: 'Aprobado' | 'Iterar' | 'Bloqueado';
  summary: string;
  goodPoints: string[];
  missing: string[];
  actions: string[];
  questions: string[];
  contradictions?: string[];
  timestamp: string;          // ISO datetime
}
```

### 1.7 MentorSession (Entity)
```typescript
interface MentorSession {
  id: string;
  mentor: string;             // Mentor name
  date?: string;
  status: 'Pendiente agendar' | 'Agendada' | 'Realizada';
  result?: 'Aprobado' | 'Iterar' | 'Bloqueado';
  comments?: string;
}
```

### 1.8 Evidence (Entity - child of Project)
```typescript
interface Evidence {
  id: string;
  name: string;
  type: 'Imagen' | 'PDF' | 'Video' | 'Link' | 'Otro';
  size?: string;
  url?: string;
  stepRef: number;            // Which step this evidence belongs to
  moduleRef?: string;         // Optional module reference
  owner: string;              // Owner name
  date: string;               // ISO date
  status: EvidenceStatus;
}
```

### 1.9 TeamMember (Value Object)
```typescript
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  status: 'Activo' | 'Pendiente';
  initials: string;
}
```

### 1.10 Run (Entity - child of Step 3)
```typescript
interface Run {
  id: string;
  name: string;
  status: RunStatus;
  createdAt: string;
  metrics?: { name: string; expected: string; actual?: string; passed?: boolean }[];
  learningCard?: { what: string; learned: string; decision: 'Iterar' | 'Pivot' | 'Kill' | null };
}
```

### 1.11 MentorVirtualFeedback (Value Object - AI generated)
```typescript
interface MentorVirtualFeedback {
  claro: string[];
  faltaPrecisar: string[];
  preguntas: string[];
  siguienteAccion: string;
}
```

### 1.12 ReviewItem (used in MentorPanel)
```typescript
interface ReviewItem {
  id: string;
  projectName: string;
  team: string;
  stepNumber: number;
  stepName: string;
  submittedAt: string;
  priority: 'Alta' | 'Media' | 'Baja';
  iaStatus?: 'Aprobado' | 'Iterar' | 'Bloqueado';
  sessionStatus: 'Pendiente agendar' | 'Agendada' | 'Realizada';
  sessionDate?: string;
}
```

### 1.13 Rubric (used in MentorPanel for evaluation)
```typescript
interface RubricItem {
  id: string;       // 'evidencia' | 'consistencia' | 'claridad' | 'accionabilidad' | 'riesgos'
  label: string;
  desc: string;
  maxScore: 5;      // Always 1-5 scale
}
```

---

## 2. Step-Specific Data Models (Form Data)

### 2.1 Step 1 Module Data

#### Module A (Proceso actual / AS-IS)
```typescript
interface ModuleASISData {
  casoReal: string;
  pasos: string[];
  quiebreIndex: number | null;
  quiebreDetalle: string;
  quiebre: string;
  consecuencia: string;
  causaInmediata: string;
  evidenciaTipo: '' | 'dato' | 'ticket' | 'testimonio' | 'benchmark';
  evidenciaNota: string;
  alcance: '' | 'antes' | 'durante' | 'despues' | 'transversal';
  corteAlcance: string;
}
```

#### Module A - Card del Reto
```typescript
interface CardRetoData {
  retoFrase: string;
  alcanceEtapa: 'antes' | 'durante' | 'despues' | '';
  alcanceLimites: string;
  senalObservable: string;
  evidenciaTexto: string;
}
```

#### Module B (Medicion e impacto)
```typescript
interface MetricaB {
  id: string;
  nombre: string;
  tipo: '' | 'tiempo' | 'cantidad' | 'costo' | 'calidad' | 'riesgo' | 'otro';
  baseline: string;
  baselineNoDisponible: boolean;
  fuente: string;
  frecuencia: string;
  senalMejora: string;
  esProxy: boolean;
}

interface ModuleBData {
  cadenaImpacto: string;
  estadoMedicion: '' | 'si' | 'parcial' | 'no';
  mFuente: string;
  mFrecuencia: string;
  queMideHoy: string;
  queFaltaMedir: string;
  porQueNo: '' | 'no_prioridad' | 'no_herramienta' | 'no_responsable' | 'otro';
  datoMinimo: string;
  metricas: MetricaB[];
  planMetrica: string;
  planComoObtener: '' | 'entrevista' | 'sistema' | 'observacion' | 'documento' | 'otro';
  planQuienDa: string;
  planPlazo: '' | '24_72h' | '1_semana' | '2_semanas';
}
```

#### Module C (Restricciones)
```typescript
interface ModuleCData {
  limitesChips: string[];     // From: 'Datos sensibles', 'Legal / regulatorio', etc.
  limitesTexto: string;
  dependencia: string;
  dependenciaDueno: string;
  dependenciaProbabilidad: '' | 'baja' | 'media' | 'alta';
  alternativaPiloto: string;
  vistoBueno: string;
  capacidadReal: string;
}
```

Semaphore logic:
- GREEN: All 3 MUSTs complete (limites + dependencia + alternativa) and risk controlled
- YELLOW: Dependency probability high, or missing owner, or limits empty
- RED: Dependency exists but no pilot alternative defined

#### Module D (Actores y entrevistas)
```typescript
interface FuenteD {
  id: string;
  tipo: '' | 'persona' | 'datos' | 'documento';
  rolNombre: string;
  porQue: string;
  queConfirmar: string;
}

interface EvidenciaD {
  id: string;
  tipo: '' | 'nota' | 'audio' | 'captura' | 'link' | 'reporte';
  nombre: string;
  queDemuestra: string;
}

interface ModuleDData {
  objetivos: string[];
  fuentes: FuenteD[];
  guiasGeneradas: boolean;
  evidencias: EvidenciaD[];
  decisionReto: '' | 'mantiene' | 'ajusta' | 'cambia';
  nuevaVersionReto: string;
  queAjusto: string[];
}
```

#### Module S (Sintesis)
```typescript
interface SintesisData {
  resumen: string;
  pivotCheck: '' | 'mantener' | 'acotar' | 'reformular' | 'cambiar';
  razonPivot: string;
  version: number;
}
```

### 2.2 Step 2 Module Data

#### Module A (HMW - How Might We)
- `hmw: string` -- The HMW question
- Live validation checks (starts with "Como podriamos", no solution words, has restriction)

#### Module B (Explore Ideas)
```typescript
interface Idea {
  id: string;
  text: string;
  cluster?: string;     // Group name for clustering
}
```
- Minimum: 10 ideas, 3 clusters
- AI can suggest "disparadores" (trigger questions)

#### Module C (Choose Best Option)
```typescript
interface Finalista {
  id: string;
  ideaId: string;
  text: string;
  cluster: string;
  deseable: number;     // 1-5 DVF scoring
  viable: number;       // 1-5
  factible: number;     // 1-5
  impacto: number;      // 1-5
  esfuerzo: number;     // 1-5
  razon: string;
  checks: { hmw: boolean; pronto: boolean; diferente: boolean };
}
```
- Max 5 finalists
- DVF Matrix (Deseable, Viable, Factible) scoring

#### Module D (Solution & Test Cards)
```typescript
interface SolutionCard {
  problema: string;
  usuario: string;
  propuesta: string;
  diferenciador: string;
  hipotesis: string;
  supuestos: string;
}

interface TestCard {
  hipotesis: string;
  queTestan: string;
  conQuien: string;
  dondeCuando: string;
  metodo: string;
  metrica: string;
  pasos: string[];
  riesgos: string;
  evidencia: string;
}
```

### 2.3 Step 3 Module Data

#### Module A (Experiment Plan)
```typescript
interface Componente {
  id: string; nombre: string; proposito: string; canal: string;
  owner: string; link: string; dod: string; estado: 'Pendiente' | 'Listo';
}

interface InstrumentacionRow {
  id: string; dato: string; fuente: string; responsable: string; evidencia: string;
}

// Logistics
interface Logistica {
  donde: string;
  cuando: string;
  duracion: string;
  quienDispara: string;
  contingencia: string;
}
```

#### Module B (Execute & Capture)
```typescript
interface EventoBitacora {
  id: string; fecha: string; hora: string; accion: string; responsable: string; nota: string;
}

interface MallaItem {
  id: string;
  tipo: 'idea' | 'critica' | 'pregunta' | 'hipotesis';
  descripcion: string;
  evidencia: string;
  severidad: 'bajo' | 'medio' | 'alto' | '';
}
```

#### Module C (Results & Decision)
```typescript
type GoNoGoDecision = 'Go' | 'Iterar' | 'No-Go' | 'Pivote' | null;

interface Diagnostico {
  senales: string[];
  riesgos: string[];
  queFalta: string[];
}
```

### 2.4 Step 4 Module Data

#### Module A (Narrativa / Story Outline)
```typescript
interface Narrativa {
  problema: string;
  hipotesis: string;
  experimento: string;
  resultados: string;
  decision: string;
  aprendizajes: string;
  proximoPaso: string;
}
```

#### Module B (Evidence selection)
```typescript
interface EvidenciaS4 {
  id: string; tipo: string; descripcion: string; fecha: string;
  incluir: boolean;
  queDemuesta: string;
}
```

#### Module C (Deck & Rehearsal)
- Deck variants: 'ejecutivo' (6 slides) | 'completo' (8 slides)
- Talk track: string (60-90 second script)
- Rehearsal checklist: 4 boolean items

---

## 3. Enums and Status Types

### 3.1 Role
```typescript
type Role = 'owner' | 'mentor' | 'admin' | 'leader';
```

### 3.2 ProjectStatus (7 values)
```typescript
type ProjectStatus =
  | 'Draft'
  | 'En progreso'
  | 'En revision IA'
  | 'Iteracion'
  | 'Sesion experto pendiente'
  | 'Paso aprobado'
  | 'Finalizado';
```

### 3.3 StepStatus (8 values)
```typescript
type StepStatus =
  | 'No iniciado'
  | 'En progreso'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Sesion experto pendiente'
  | 'Aprobado'
  | 'Bloqueado';
```

### 3.4 ModuleStatus (8 values)
```typescript
type ModuleStatus =
  | 'Draft'
  | 'En progreso'
  | 'Completado'
  | 'Bloqueado'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Aprobado';
```

### 3.5 Step0Status (3 values)
```typescript
type Step0Status = 'No iniciado' | 'En progreso' | 'Completado';
```

### 3.6 RunStatus (4 values)
```typescript
type RunStatus = 'Draft' | 'En ejecucion' | 'Cerrado' | 'Revisar cambios';
```

### 3.7 EvidenceStatus (3 values)
```typescript
type EvidenceStatus = 'Subida' | 'Verificada' | 'Rechazada';
```

### 3.8 EvidenceType (5 values)
```typescript
type EvidenceType = 'Imagen' | 'PDF' | 'Video' | 'Link' | 'Otro';
```

### 3.9 TeamMemberRole (3 values)
```typescript
type TeamMemberRole = 'Owner' | 'Editor' | 'Viewer';
```

### 3.10 TeamMemberStatus (2 values)
```typescript
type TeamMemberStatus = 'Activo' | 'Pendiente';
```

### 3.11 MentorSessionStatus (3 values)
```typescript
type MentorSessionStatus = 'Pendiente agendar' | 'Agendada' | 'Realizada';
```

### 3.12 MentorSessionResult (3 values)
```typescript
type MentorSessionResult = 'Aprobado' | 'Iterar' | 'Bloqueado';
```

### 3.13 FeedbackIAStatus (3 values)
```typescript
type FeedbackIAStatus = 'Aprobado' | 'Iterar' | 'Bloqueado';
```

### 3.14 RiskLevel (3 values)
```typescript
type RiskLevel = 'Bajo' | 'Medio' | 'Alto';
```

### 3.15 ReviewPriority (3 values)
```typescript
type ReviewPriority = 'Alta' | 'Media' | 'Baja';
```

---

## 4. Business Rules

### 4.1 Step Progression (Critical Path)
1. **Step 0 must be completed before Step 1 is accessible.** (`canAccessStep(1) => step0Status === 'Completado'`)
2. **Each subsequent step requires previous step to be 'Aprobado'.** (`canAccessStep(n) => steps[n-1].status === 'Aprobado'`)
3. **Step approval requires mentor session.** Without a completed mentor session, the step cannot be approved and the next step remains blocked.
4. **AI review happens before mentor review.** The flow is: Complete modules -> Submit to AI -> Get AI feedback -> Iterate if needed -> Request mentor session -> Mentor approves/iterates/blocks.

### 4.2 Module Progression within Steps
1. **Step 1**: Module A always unlocked. Modules B-D unlock sequentially based on completion. Module S (Synthesis) unlocks last.
2. **Step 1 Module C**: Uses a semaphore (verde/amarillo/rojo) based on constraints completeness. Module D is blocked when semaphore is red.
3. **Step 2**: All 4 modules (A-D) are accessible when step is unlocked. Module A (HMW) has live validation.
4. **Step 2 Module B**: Minimum 10 ideas and 3 clusters required.
5. **Step 2 Module C**: Maximum 5 finalists. DVF scoring (Deseable, Viable, Factible) 1-5 scale.
6. **Step 3**: 3 modules (A-Plan, B-Execute, C-Results). Module C has Go/No-Go/Iterar/Pivote decision.
7. **Step 4**: Overview + 3 modules (A-Narrativa, B-Evidencias, C-Deck). Checklist-driven.

### 4.3 Mentor Credits
- Each project starts with 3 mentor credits (default).
- **Mentor sessions (validation)** consume 1 credit each.
- **Asking for help (async)** does NOT consume credits.
- **AI mentor (virtual)** does NOT consume credits.
- OPEN QUESTION: Credit recharge policy, transferability between projects.

### 4.4 Evidence Management
- **Allowed file types**: PDF, JPG, JPEG, PNG, GIF, WEBP, MP4
- **Max file size**: 50 MB
- **Link evidence**: Must start with http:// or https://
- **Status flow**: Subida -> Verificada (by mentor) or Rechazada
- **Access control**: Only active team members can view/download evidence. Removed members lose access.
- OPEN QUESTION: Deletion policy (permanent, archive, or mark inactive).

### 4.5 Team Management
- **Owner**: Can create project, invite members, edit all content.
- **Editor**: Can edit modules and upload evidence.
- **Viewer**: Read-only access to project progress.
- Invitations sent by email, status starts as 'Pendiente'.
- Only owners can invite new members.

### 4.6 AI Features
- **Mentor Virtual (AI panel)**: Provides structured feedback (what's clear, what needs precision, reflective questions, suggested next action). Does not consume credits.
- **AI Review (FeedbackIA)**: Analyzes step completion and provides structured feedback with status (Aprobado/Iterar/Bloqueado), good points, missing items, action items, questions, and cross-module contradictions.
- **AI suggestions**: Available in multiple steps for auto-filling content, generating ideas, suggesting improvements.

### 4.7 Mentor Review Rubric
5 criteria, each scored 1-5:
1. Evidencia: Is it documented with real, verifiable evidence?
2. Consistencia: Are modules coherent with each other and the challenge?
3. Claridad: Is the analysis clear for an external reader?
4. Accionabilidad: Do conclusions lead to concrete actions?
5. Riesgos: Are risks and constraints identified and addressed?

Mentor decision options: Aprobado (unlocks next step), Iterar (needs changes), Bloqueado (does not meet minimums).

### 4.8 Autosave
- All step pages implement autosave functionality.
- State indicator shows: saving, saved, error states.

### 4.9 Dashboard Visibility
- **Owner (participante)**: Sees only projects where they are a team member.
- **Mentor**: Sees projects assigned for review.
- **Admin**: Sees all projects across the cohort.
- **Leader**: Sees assigned projects.

### 4.10 Cohort Management (Admin)
- Admin panel shows KPIs: active projects, high risk count, approved steps, pending sessions.
- Funnel visualization: Projects per step with completion rates.
- Filters: All, with risk, blocked.
- Export to CSV functionality.

---

## 5. API Endpoints Needed

### 5.1 Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/login | Login with email/password | Public |
| POST | /api/auth/register | Register new user | Public |
| POST | /api/auth/refresh | Refresh access token | Authenticated |
| POST | /api/auth/logout | Logout and invalidate token | Authenticated |
| GET | /api/auth/me | Get current user profile | Authenticated |

### 5.2 Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/users/profile | Get own profile | Authenticated |
| PATCH | /api/users/profile | Update own profile (bio, skills) | Authenticated |
| GET | /api/users?role=mentor | List users by role | Admin |

### 5.3 Projects
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/projects | List projects (filtered by role) | Authenticated |
| POST | /api/projects | Create new project | Owner |
| GET | /api/projects/:id | Get project details | Team member |
| PATCH | /api/projects/:id | Update project metadata | Owner/Editor |
| DELETE | /api/projects/:id | Delete/archive project | Owner |

### 5.4 Step 0
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/projects/:id/step0 | Get Step 0 data | Team member |
| PATCH | /api/projects/:id/step0 | Update Step 0 data and status | Owner/Editor |

### 5.5 Steps (1-4)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/projects/:id/steps | Get all steps | Team member |
| GET | /api/projects/:id/steps/:number | Get specific step | Team member |
| PATCH | /api/projects/:id/steps/:number | Update step status/progress | Owner/Editor |
| GET | /api/projects/:id/steps/:number/modules | Get modules for step | Team member |
| PATCH | /api/projects/:id/steps/:number/modules/:moduleId | Update module status | Owner/Editor |

### 5.6 Step Module Data (Form Data)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/projects/:id/steps/:number/data | Get step form data | Team member |
| PUT | /api/projects/:id/steps/:number/data | Save step form data (autosave) | Owner/Editor |
| PATCH | /api/projects/:id/steps/:number/data | Partial update (autosave) | Owner/Editor |

### 5.7 Evidence
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/projects/:id/evidence | List evidence (with filters) | Team member |
| POST | /api/projects/:id/evidence | Upload evidence | Owner/Editor |
| GET | /api/projects/:id/evidence/:evidenceId | Get evidence details | Team member |
| PATCH | /api/projects/:id/evidence/:evidenceId | Update evidence status | Mentor |
| DELETE | /api/projects/:id/evidence/:evidenceId | Delete evidence | Owner |
| GET | /api/projects/:id/evidence/:evidenceId/download | Download file | Team member |
| GET | /api/projects/:id/evidence/:evidenceId/audit | Get audit log | Team member |

### 5.8 AI / Feedback
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/projects/:id/steps/:number/ai-review | Submit step for AI review | Owner/Editor |
| GET | /api/projects/:id/steps/:number/ai-review | Get AI review result | Team member |
| POST | /api/projects/:id/steps/:number/ai-mentor | Get AI mentor feedback | Owner/Editor |
| POST | /api/projects/:id/steps/:number/ai-suggest | Get AI suggestions (various) | Owner/Editor |

### 5.9 Mentor Sessions
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/projects/:id/steps/:number/session | Request mentor session | Owner |
| GET | /api/projects/:id/steps/:number/session | Get session details | Team member/Mentor |
| PATCH | /api/projects/:id/steps/:number/session | Update session (schedule, complete) | Mentor |

### 5.10 Mentor Panel (Reviews)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/mentor/reviews | List pending reviews | Mentor |
| GET | /api/mentor/reviews/:reviewId | Get review details | Mentor |
| POST | /api/mentor/reviews/:reviewId | Submit review (rubric + decision) | Mentor |

### 5.11 Mentor Help (Async)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/projects/:id/help | Send help request to mentor | Owner/Editor |
| GET | /api/projects/:id/help | List help requests | Team member/Mentor |

### 5.12 Team Management
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/projects/:id/team | List team members | Team member |
| POST | /api/projects/:id/team/invite | Invite team member | Owner |
| PATCH | /api/projects/:id/team/:memberId | Update member role | Owner |
| DELETE | /api/projects/:id/team/:memberId | Remove team member | Owner |

### 5.13 Cohort Management (Admin)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/admin/cohorts | List cohorts | Admin |
| GET | /api/admin/cohorts/:id | Get cohort details with KPIs | Admin |
| GET | /api/admin/cohorts/:id/projects | List projects in cohort | Admin |
| GET | /api/admin/cohorts/:id/funnel | Get funnel analytics | Admin |
| GET | /api/admin/cohorts/:id/export | Export cohort data to CSV | Admin |

### 5.14 Profile / CV
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/users/contributions | Get contribution log | Authenticated |
| GET | /api/users/skills | Get skills scoreboard | Authenticated |
| GET | /api/users/cv-export | Generate CV text | Authenticated |
| GET | /api/users/cv-export/pdf | Generate CV PDF | Authenticated |

---

## 6. Role-Based Access Patterns

### 6.1 Owner (Participante)
- Create, edit, delete own projects
- Manage team (invite, change roles, remove)
- Complete Step 0-4 modules
- Upload evidence
- Request AI review and AI mentor
- Request mentor help (async, free)
- Request mentor session (consumes credit)
- View own profile and contributions

### 6.2 Mentor
- View assigned projects for review
- See AI review results as context
- Score rubric (5 criteria x 5 points)
- Make decision (Aprobar/Iterar/Bloquear)
- Provide written feedback
- Verify/reject evidence
- Schedule and complete validation sessions

### 6.3 Admin
- View all projects across cohort
- Access KPI dashboard (active projects, risk, approved steps, pending sessions)
- View funnel analytics
- Filter by risk level and blocked status
- Export cohort data to CSV
- Full read access to all projects

### 6.4 Leader (Lider)
- View assigned/relevant projects
- Read-only dashboard access
- Limited permissions (exact scope TBD)

---

## 7. State Machine Diagrams

### 7.1 Project Status Flow
```
Draft --> En progreso (when Step 0 started or Step 1 work begins)
En progreso --> En revision IA (when step submitted to AI)
En revision IA --> Iteracion (when AI feedback requires changes)
Iteracion --> En revision IA (re-submitted after changes)
En revision IA --> Sesion experto pendiente (AI approved, mentor session needed)
Sesion experto pendiente --> Paso aprobado (mentor approves)
Sesion experto pendiente --> Iteracion (mentor requests changes)
Paso aprobado --> En progreso (next step work begins)
Paso aprobado --> Finalizado (Step 4 approved)
```

### 7.2 Step Status Flow
```
No iniciado --> En progreso (user starts working)
En progreso --> Enviado (user submits for review)
Enviado --> Feedback IA (AI review completed)
Feedback IA --> Ajustado (user makes changes based on AI feedback)
Ajustado --> Enviado (re-submitted)
Feedback IA --> Sesion experto pendiente (AI approved, mentor session needed)
Ajustado --> Sesion experto pendiente (adjusted and ready for mentor)
Sesion experto pendiente --> Aprobado (mentor approves)
Sesion experto pendiente --> En progreso (mentor requests iteration)
Bloqueado (locked until previous step approved)
```

### 7.3 Module Status Flow
```
Draft --> En progreso (user starts editing)
Bloqueado (locked, previous module not complete)
En progreso --> Completado (module requirements met)
Completado --> Enviado (submitted as part of step)
Enviado --> Feedback IA (AI reviewed)
Feedback IA --> Ajustado (user adjusted)
Ajustado --> Aprobado (mentor approved)
```

### 7.4 Evidence Status Flow
```
Subida --> Verificada (mentor verifies)
Subida --> Rechazada (mentor rejects)
```

### 7.5 MentorSession Status Flow
```
Pendiente agendar --> Agendada (date/time set)
Agendada --> Realizada (session completed)
```

---

## 8. Data Flow Diagrams

### 8.1 Project Lifecycle
```
[Create Project] --> [Complete Step 0] --> [Work on Step 1]
  |                                           |
  v                                           v
[Draft status]                     [Complete modules A-D-S]
                                              |
                                              v
                                   [Submit to AI review]
                                              |
                                              v
                                   [Get FeedbackIA] --[Iterar]--> [Adjust] --> [Re-submit]
                                              |
                                              v (Aprobado)
                                   [Request mentor session]
                                              |
                                              v
                                   [Mentor reviews with rubric]
                                              |
                              [Aprobado]  [Iterar]  [Bloqueado]
                                  |           |          |
                                  v           v          v
                         [Unlock Step 2]  [Adjust]  [Major revision needed]
                                  |
                                  v
                         [...repeat for Steps 2-4...]
                                  |
                                  v
                         [Step 4 approved = Project Finalizado]
```

### 8.2 AI Integration Points
```
Step Pages:
  [Module content] --autosave--> [Backend stores draft]

  [Submit step] --> POST /ai-review --> [AI analyzes all modules]
                                            |
                                            v
                                    [FeedbackIA response]
                                    - status: Aprobado/Iterar/Bloqueado
                                    - structured feedback

  [Click "Mejorar con IA"] --> POST /ai-mentor --> [AI mentoring panel]
                                                   - what's clear
                                                   - what needs precision
                                                   - reflective questions
                                                   - suggested action

  [Click AI suggestions] --> POST /ai-suggest --> [Context-specific AI help]
    - Step 1: Auto-fill card reto, improve phrase, suggest impact chain
    - Step 2: HMW validation, idea triggers, DVF pre-scoring
    - Step 3: Next iteration suggestions, diagnostic
    - Step 4: Narrative versions (ejecutiva/storytelling/tecnica), evidence recommendations, deck generation
```

### 8.3 Mentor Review Flow
```
[Owner submits step] --> [Step status: Enviado]
         |
         v
[AI auto-review] --> [FeedbackIA attached to step]
         |
         v
[Step status: Feedback IA / Sesion experto pendiente]
         |
         v
[Review appears in Mentor Panel]
         |
         v
[Mentor opens review]
  - Sees AI feedback as context
  - Scores 5 rubric criteria (1-5)
  - Writes comments
  - Makes decision: Aprobar/Iterar/Bloquear
         |
         v
[Decision applied]
  - Aprobado: Step marked approved, next step unlocked
  - Iterar: Step back to En progreso, owner notified
  - Bloqueado: Step stays blocked, owner must revise
```

---

## 9. File Upload Requirements

- **Accepted formats**: .pdf, .jpg, .jpeg, .png, .gif, .webp, .mp4
- **MIME types**: image/jpeg, image/png, image/gif, image/webp, application/pdf, video/mp4
- **Max file size**: 50 MB (configurable via maxSizeMB prop)
- **Upload modes**: File upload (drag & drop or click) OR Link (URL starting with http/https)
- **Progress tracking**: Simulated in frontend (real implementation needs server progress)
- **Evidence metadata**: name, type, size, stepRef, moduleRef, owner, date, status

---

## 10. Open Questions / "POR DEFINIR" Items

These are items explicitly marked as undefined in the frontend code:

1. **Mentor credit policy**: How many credits per participant? When do they recharge? What consumes a credit? Can credits transfer between projects?
2. **Evidence deletion policy**: Permanent delete, archive, or mark inactive? Who can delete (owner only or mentor too)?
3. **Admin reporting**: What additional metrics should the cohort panel include? Average time per step? Approval rate by mentor? Cohort comparison?
4. **Leader role scope**: Exact permissions and dashboard view for the "leader" role.
5. **Registration flow**: Currently disabled ("El registro estara disponible pronto"). Full registration requirements TBD.
6. **Notification system**: No notification system exists yet. Needed for: session requests, help requests, feedback received, step approved, team invitations.
7. **Real-time collaboration**: No real-time features yet. Consider: autosave sync, team member activity, mentor availability.

---

## 11. Authentication Details

### Current Mock Implementation
- Email/password authentication
- 4 demo accounts (participante, mentor, admin, lider) all with password "demo123"
- Login returns success/error, sets user in React context
- No token-based auth, no session persistence

### Required for Backend
- JWT-based authentication (access + refresh tokens)
- Password hashing (bcrypt)
- Email validation
- Session management
- Role-based middleware guards
- Token refresh mechanism

---

## 12. Routes and Protection Requirements

| Route | Component | Protection | Roles |
|-------|-----------|------------|-------|
| /auth | AuthPage | Public (redirect if authenticated) | All |
| /dashboard | DashboardPage | Authenticated | All |
| /projects/new | CreateProjectPage | Authenticated | Owner |
| /projects/:projectId | ProjectHomePage | Authenticated + Team member | All |
| /projects/:projectId/step/0 | Step0Page | Authenticated + Team member | Owner/Editor |
| /projects/:projectId/step/1 | Step1Page | Authenticated + Team member + Step 0 complete | Owner/Editor |
| /projects/:projectId/step/2 | Step2Page | Authenticated + Team member + Step 1 approved | Owner/Editor |
| /projects/:projectId/step/3 | Step3Page | Authenticated + Team member + Step 2 approved | Owner/Editor |
| /projects/:projectId/step/4 | Step4Page | Authenticated + Team member + Step 3 approved | Owner/Editor |
| /projects/:projectId/evidencias | EvidenciasPage | Authenticated + Team member | All (upload: Owner/Editor) |
| /mentor | MentorPanelPage | Authenticated | Mentor |
| /admin | AdminCohorte | Authenticated | Admin |
| /perfil | PerfilPage | Authenticated | All |
