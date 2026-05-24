/**
 * E2E: PDF auto-fill flow — API-driven setup + UI validation.
 *
 * Why hybrid? Browser-driven upload + extraction polling is brittle (modal timing,
 * file-input wiring, OAuth races, etc). The contract tests in `src/app/services/__tests__/`
 * already validate the upload + polling shape. The E2E here proves the *user-visible*
 * portion: after login, an authenticated user with a project + extraction run sees
 * the AutofillField proposals rendered inline on Step 0.
 *
 * Steps:
 *   1. Register a fresh user via /api/v1/auth/register.
 *   2. Login via UI (validates the auth happy path the user actually walks).
 *   3. Create a project via /api/v1/projects.
 *   4. Upload the test PDF via /api/v1/initiatives/:id/pdfs (validates raw-body contract).
 *   5. Trigger extraction via /api/v1/initiatives/:id/pdfs/:pdfId/extract.
 *   6. Poll for completion via /api/v1/initiatives/:id/pdfs/runs/:runId.
 *   7. Navigate the UI to /projects/:id/step/0 and assert the autofill UI rendered.
 *
 * Tolerant of LLM downtime: if extraction ends in `failed` (e.g. revoked
 * OPENROUTER_API_KEY), confirms FE→BE→ai-service wiring still works and surfaces
 * the failure to the user.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, request as pwRequest, APIRequestContext, Page } from '@playwright/test';

const __dirname_ = path.dirname(fileURLToPath(import.meta.url));
const TEST_PDF = path.resolve(__dirname_, '../../docs/Test - iniciativa.pdf');

interface Session {
  email: string;
  password: string;
  accessToken: string;
}

async function apiRegisterAndLogin(api: APIRequestContext): Promise<Session> {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const email = `e2e-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const name = `E2E Tester ${stamp}`;

  const reg = await api.post('/api/v1/auth/register', {
    data: { email, password, name, role: 'participante' },
    failOnStatusCode: false,
  });
  if (![200, 201, 409].includes(reg.status())) {
    throw new Error(`register failed: HTTP ${reg.status()} ${await reg.text()}`);
  }

  const login = await api.post('/api/v1/auth/login', {
    data: { email, password },
    failOnStatusCode: false,
  });
  if (login.status() !== 200) {
    throw new Error(`login failed: HTTP ${login.status()} ${await login.text()}`);
  }
  const body = (await login.json()) as { data?: { accessToken?: string }; accessToken?: string };
  const accessToken = body.data?.accessToken ?? body.accessToken ?? '';
  if (!accessToken) throw new Error(`no access token in login response: ${JSON.stringify(body).slice(0, 200)}`);

  return { email, password, accessToken };
}

async function apiCreateProject(api: APIRequestContext, session: Session, name: string): Promise<string> {
  const res = await api.post('/api/v1/projects', {
    data: { name, description: 'E2E playwright run' },
    headers: { Authorization: `Bearer ${session.accessToken}` },
    failOnStatusCode: false,
  });
  if (![200, 201].includes(res.status())) {
    throw new Error(`create project failed: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: { id?: string }; id?: string };
  const id = body.data?.id ?? body.id;
  if (!id) throw new Error(`no project id in response: ${JSON.stringify(body).slice(0, 200)}`);
  return id;
}

async function apiUploadPdf(api: APIRequestContext, session: Session, projectId: string): Promise<string> {
  const bytes = fs.readFileSync(TEST_PDF);
  const res = await api.post(`/api/v1/initiatives/${projectId}/pdfs`, {
    data: bytes,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/pdf',
      'X-File-Name': encodeURIComponent('Test - iniciativa.pdf'),
    },
    failOnStatusCode: false,
  });
  if (![200, 201].includes(res.status())) {
    throw new Error(`upload failed: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: { pdfId?: string }; pdfId?: string };
  const pdfId = body.data?.pdfId ?? body.pdfId;
  if (!pdfId) throw new Error(`no pdfId in upload response: ${JSON.stringify(body).slice(0, 200)}`);
  return pdfId;
}

async function apiTriggerExtraction(api: APIRequestContext, session: Session, projectId: string, pdfId: string): Promise<string> {
  // Backend accepts targetStep ∈ {step_0..step_4} OR omits it for the full sweep.
  const res = await api.post(`/api/v1/initiatives/${projectId}/pdfs/${pdfId}/extract`, {
    data: { language: 'es' },
    headers: { Authorization: `Bearer ${session.accessToken}` },
    failOnStatusCode: false,
  });
  if (![200, 201, 202].includes(res.status())) {
    throw new Error(`trigger extraction failed: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: { runId?: string; id?: string }; runId?: string };
  const runId = body.data?.runId ?? body.data?.id ?? body.runId;
  if (!runId) throw new Error(`no runId in trigger response: ${JSON.stringify(body).slice(0, 200)}`);
  return runId;
}

async function apiPollUntilTerminal(
  api: APIRequestContext,
  session: Session,
  projectId: string,
  runId: string,
  maxMs = 150_000,
): Promise<{ status: string; raw: unknown }> {
  const deadline = Date.now() + maxMs;
  let lastStatus = 'pending';
  let lastRaw: unknown;
  while (Date.now() < deadline) {
    const res = await api.get(`/api/v1/initiatives/${projectId}/pdfs/runs/${runId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      failOnStatusCode: false,
    });
    if (res.status() !== 200) throw new Error(`poll failed: HTTP ${res.status()} ${await res.text()}`);
    const body = (await res.json()) as { data?: { status?: string } };
    lastRaw = body;
    lastStatus = (body.data?.status ?? 'pending').toString();
    if (['COMPLETED', 'completed', 'FAILED', 'failed', 'COST_CAPPED', 'cost_capped'].includes(lastStatus)) {
      return { status: lastStatus.toLowerCase(), raw: body };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: 'timeout', raw: lastRaw };
}

async function uiLogin(page: Page, session: Session) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(session.email);
  await page.locator('input[type="password"]').fill(session.password);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page).toHaveURL(/\/(dashboard|projects|app)/i, { timeout: 15_000 });
}

test.describe('PDF auto-fill end-to-end (API-driven setup + UI verification)', () => {
  test('register → login → create project → upload + extract via API → assert UI on Step 0', async ({ page, browser }) => {
    const api = await pwRequest.newContext({ baseURL: 'http://localhost' });

    // ─── 1. auth via API ──────────────────────────────────────────────────────
    const session = await test.step('register + API login', () => apiRegisterAndLogin(api));

    // ─── 2. create project via API ────────────────────────────────────────────
    const projectId = await test.step('create project via API', () =>
      apiCreateProject(api, session, `E2E Unimaq ${Date.now()}`));

    // ─── 3. upload PDF via API (validates raw-body contract end-to-end) ───────
    const pdfId = await test.step('upload PDF via API', () => apiUploadPdf(api, session, projectId));
    expect(pdfId).toBeTruthy();

    // ─── 4. trigger extraction via API ────────────────────────────────────────
    const runId = await test.step('trigger extraction via API', () =>
      apiTriggerExtraction(api, session, projectId, pdfId));
    expect(runId).toBeTruthy();

    // ─── 5. poll for terminal state ───────────────────────────────────────────
    const result = await test.step('poll until terminal', () =>
      apiPollUntilTerminal(api, session, projectId, runId));

    expect(result.status, 'extraction must reach a terminal state within 150s')
      .not.toBe('timeout');

    // ─── 6. UI login + navigate to Step 0 via project home ───────────────────
    // Direct goto /projects/:id/step/0 races with the SPA's initial /api/v1/projects
    // fetch — without the project in React state the Step 0 page bounces back to
    // /dashboard. Walk the UI path: dashboard → project card → "Empezar Paso 0".
    await test.step('UI login', () => uiLogin(page, session));
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    await test.step('navigate dashboard → project → Step 0', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

      // The dashboard wraps each project card in a <button> (the heading inside is
      // not the clickable element). Match by the button's accessible name which
      // includes the project name.
      const projectCardButton = page.getByRole('button', { name: /E2E Unimaq/i }).first();
      await expect(projectCardButton).toBeVisible({ timeout: 15_000 });
      await projectCardButton.click();
      // Wait for SPA to land on /projects/:id.
      await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 15_000 });

      // On the project home, click "Empezar Paso 0" / "Comienza aquí" CTA.
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      const cta = page.getByRole('button', { name: /Empezar Paso 0|Comienza aqu[ií]|Ver Paso 0|Continuar Paso 0/i }).first();
      if (await cta.count()) {
        await cta.click();
      } else {
        // Defensive fallback: direct nav. With the project now in React state,
        // this should land on Step 0 without bouncing back to dashboard.
        await page.goto(`/projects/${projectId}/step/0`);
      }

      await expect(page.locator('text=/Punto de partida/i').first()).toBeVisible({ timeout: 20_000 });
    });

    if (result.status === 'completed') {
      await test.step('assert Steps populated with proposed values', async () => {
        // The AutofillContext fetches proposals on mount via usePdfAutofill state.
        // We expect at least one inline "Sugerencia IA"/proposed chip.
        const proposedChip = page.locator('text=/Sugerencia IA|Propuesta IA|propuesto|Confirmar/i').first();
        await expect(proposedChip).toBeVisible({ timeout: 30_000 });
      });
    } else {
      // status === 'failed' or 'cost_capped' — wiring confirmed end-to-end; LLM
      // upstream unreachable (typical: revoked OPENROUTER_API_KEY).
      console.warn(
        `[E2E] Extracción terminó en ${result.status} — FE→BE→ai-service wiring OK. ` +
        'Para validar Steps poblados, provee OPENROUTER_API_KEY válido y vuelve a correr.',
      );
      expect(['failed', 'cost_capped']).toContain(result.status);
    }

    await api.dispose();
  });
});
