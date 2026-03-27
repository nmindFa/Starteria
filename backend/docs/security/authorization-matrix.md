# Authorization Matrix - Dashboard Starteria

## Role Definitions

| Role | Description | Scope |
|------|-------------|-------|
| `owner` | Project creator/participant | Own projects only |
| `mentor` | Assigned expert reviewer | Assigned projects only |
| `admin` | Platform administrator | All resources |
| `leader` | Organizational leader | Assigned projects (read-only) |

## API Endpoint Authorization Matrix

### Authentication Endpoints (Public)

| Endpoint | Method | owner | mentor | admin | leader | Auth Required | Notes |
|----------|--------|-------|--------|-------|--------|---------------|-------|
| `/api/auth/login` | POST | * | * | * | * | No | Rate limited: 5/min per IP |
| `/api/auth/register` | POST | * | - | - | - | No | Only owner role can self-register |
| `/api/auth/refresh` | POST | * | * | * | * | Cookie only | Refresh token in HTTP-only cookie |
| `/api/auth/logout` | POST | * | * | * | * | Yes | Revokes refresh token |
| `/api/auth/forgot-password` | POST | * | * | * | * | No | Rate limited: 3/min per email |
| `/api/auth/reset-password` | POST | * | * | * | * | No | Requires valid reset token |

### Dashboard Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/dashboard` | GET | READ | READ | READ | READ | Returns role-specific dashboard data |
| `/api/dashboard/stats` | GET | OWN | ASSIGNED | ALL | ASSIGNED | Aggregated statistics |

### Project Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/projects` | GET | OWN | ASSIGNED | ALL | ASSIGNED | List projects visible to user |
| `/api/projects` | POST | CREATE | - | CREATE | - | Only owner/admin can create projects |
| `/api/projects/:id` | GET | OWN | ASSIGNED | ALL | ASSIGNED | Single project detail |
| `/api/projects/:id` | PATCH | OWN | - | ALL | - | Update project metadata |
| `/api/projects/:id` | DELETE | - | - | ALL | - | Soft delete, admin only |
| `/api/projects/:id/team` | GET | OWN | ASSIGNED | ALL | ASSIGNED | List team members |
| `/api/projects/:id/team` | POST | OWN | - | ALL | - | Invite team member |
| `/api/projects/:id/team/:memberId` | DELETE | OWN | - | ALL | - | Remove team member |

### Step Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/projects/:id/step/0` | GET | OWN | ASSIGNED | ALL | ASSIGNED | Step 0 data |
| `/api/projects/:id/step/0` | PUT | OWN | - | ALL | - | Update Step 0 (project owner only) |
| `/api/projects/:id/step/:n` | GET | OWN | ASSIGNED | ALL | ASSIGNED | Step data (n=1-4) |
| `/api/projects/:id/step/:n` | PUT | OWN | - | ALL | - | Update step content |
| `/api/projects/:id/step/:n/submit` | POST | OWN | - | - | - | Submit step for AI review |
| `/api/projects/:id/step/:n/modules` | GET | OWN | ASSIGNED | ALL | ASSIGNED | List modules in step |
| `/api/projects/:id/step/:n/modules/:moduleId` | PUT | OWN | - | ALL | - | Update module content |

### Evidence Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/projects/:id/evidencias` | GET | OWN | ASSIGNED | ALL | - | List all evidence |
| `/api/projects/:id/evidencias` | POST | OWN | - | ALL | - | Upload evidence file |
| `/api/projects/:id/evidencias/:evidenceId` | GET | OWN | ASSIGNED | ALL | - | Download/view single evidence |
| `/api/projects/:id/evidencias/:evidenceId` | DELETE | OWN | - | ALL | - | Remove evidence |
| `/api/projects/:id/evidencias/:evidenceId/verify` | POST | - | ASSIGNED | ALL | - | Verify/reject evidence |

### AI Feedback Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/projects/:id/step/:n/feedback-ia` | GET | OWN | ASSIGNED | ALL | ASSIGNED | View AI feedback |
| `/api/projects/:id/step/:n/feedback-ia` | POST | OWN | - | - | - | Request AI feedback |

### Mentor Session Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/projects/:id/step/:n/mentor-session` | GET | OWN | ASSIGNED | ALL | ASSIGNED | View session details |
| `/api/projects/:id/step/:n/mentor-session` | POST | OWN | - | ALL | - | Request mentor session (uses credits) |
| `/api/projects/:id/step/:n/mentor-session/:sessionId` | PATCH | - | ASSIGNED | ALL | - | Update session (schedule, result) |

### Mentor Panel Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/mentor/projects` | GET | - | READ | ALL | - | Mentor's assigned projects |
| `/api/mentor/sessions` | GET | - | READ | ALL | - | Mentor's upcoming sessions |
| `/api/mentor/sessions/:id/feedback` | POST | - | WRITE | ALL | - | Submit session feedback |

### Experiment/Run Endpoints (Step 3)

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/projects/:id/step/3/runs` | GET | OWN | ASSIGNED | ALL | ASSIGNED | List experiment runs |
| `/api/projects/:id/step/3/runs` | POST | OWN | - | ALL | - | Create new run |
| `/api/projects/:id/step/3/runs/:runId` | PATCH | OWN | - | ALL | - | Update run data |
| `/api/projects/:id/step/3/runs/:runId/learning` | PUT | OWN | - | ALL | - | Update learning card |

### Admin Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/admin/users` | GET | - | - | ALL | - | List all users |
| `/api/admin/users` | POST | - | - | ALL | - | Create user (any role) |
| `/api/admin/users/:id` | PATCH | - | - | ALL | - | Update user (role, status) |
| `/api/admin/users/:id` | DELETE | - | - | ALL | - | Deactivate user |
| `/api/admin/cohorts` | GET | - | - | ALL | - | List cohorts |
| `/api/admin/cohorts` | POST | - | - | ALL | - | Create cohort |
| `/api/admin/cohorts/:id` | PATCH | - | - | ALL | - | Update cohort |
| `/api/admin/cohorts/:id/projects` | GET | - | - | ALL | - | Projects in cohort |
| `/api/admin/cohorts/:id/assign-mentor` | POST | - | - | ALL | - | Assign mentor to project |
| `/api/admin/cohorts/:id/assign-leader` | POST | - | - | ALL | - | Assign leader to project |
| `/api/admin/audit-log` | GET | - | - | ALL | - | View audit trail |

### Profile Endpoints

| Endpoint | Method | owner | mentor | admin | leader | Notes |
|----------|--------|-------|--------|-------|--------|-------|
| `/api/profile` | GET | SELF | SELF | SELF | SELF | Own profile |
| `/api/profile` | PATCH | SELF | SELF | SELF | SELF | Update own profile |
| `/api/profile/password` | PUT | SELF | SELF | SELF | SELF | Change password |

## Legend

| Symbol | Meaning |
|--------|---------|
| `*` | Any user (no auth required) |
| `-` | Denied |
| `OWN` | Only if user is the project owner |
| `ASSIGNED` | Only if user is assigned to the project (mentor/leader) |
| `ALL` | All resources of this type |
| `SELF` | Only the user's own resource |
| `CREATE` | Can create new resources |
| `READ` | Read-only access |
| `WRITE` | Read and write access |

## Resource-Level Access Rules

### Project Access Resolution

The following logic determines if a user can access a specific project:

```typescript
type AccessLevel = 'none' | 'read' | 'write' | 'admin';

function resolveProjectAccess(user: User, project: Project): AccessLevel {
  // Admin has full access to all projects
  if (user.role === 'admin') return 'admin';

  // Owner has write access to own projects
  if (user.role === 'owner' && project.ownerId === user.id) return 'write';

  // Mentor has read access to assigned projects
  if (user.role === 'mentor' && project.assignedMentorId === user.id) return 'read';

  // Leader has read access to assigned projects
  if (user.role === 'leader' && project.assignedLeaderId === user.id) return 'read';

  // Team members (Editor/Viewer) have read access
  if (project.team.some(m => m.userId === user.id)) return 'read';

  return 'none';
}
```

### Mentor Assignment Rules

- A mentor can only be assigned to a project by an admin via `/api/admin/cohorts/:id/assign-mentor`
- The assignment is stored in `project_assignments` table with `role = 'mentor'`
- A mentor can view all projects they are assigned to
- A mentor can submit feedback only for sessions on their assigned projects

### Leader Assignment Rules

- A leader is assigned by an admin via `/api/admin/cohorts/:id/assign-leader`
- Leaders have read-only access to assigned projects
- Leaders cannot modify project data, steps, or evidence

### Evidence Access Rules

- `owner`: Full CRUD on own project's evidence
- `mentor`: Can view and verify/reject evidence on assigned projects
- `admin`: Full access to all evidence
- `leader`: No access to evidence (not listed in their view scope)

## Frontend Route-to-API Mapping

| Frontend Route | API Endpoints Used | Required Role |
|----------------|-------------------|---------------|
| `/auth` | `/api/auth/login`, `/api/auth/register` | Public |
| `/dashboard` | `/api/dashboard`, `/api/dashboard/stats` | Any authenticated |
| `/projects/new` | `POST /api/projects` | owner, admin |
| `/projects/:id` | `GET /api/projects/:id`, team, steps | owner(own), mentor(assigned), admin, leader(assigned) |
| `/projects/:id/step/:n` | `GET/PUT /api/projects/:id/step/:n` | owner(own) for write; others for read |
| `/projects/:id/evidencias` | `/api/projects/:id/evidencias` | owner(own), mentor(assigned), admin |
| `/mentor` | `/api/mentor/*` | mentor, admin |
| `/admin` | `/api/admin/*` | admin |
| `/perfil` | `/api/profile` | Any authenticated |

## Database Support Tables

### project_assignments

```sql
CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('mentor', 'leader')),
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, role)  -- One mentor and one leader per project
);
```

### audit_log

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```
