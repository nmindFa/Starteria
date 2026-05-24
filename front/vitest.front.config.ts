import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest config for the React front (jsdom environment).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, '../tests'),
    },
  },
  test: {
    name: 'front',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '../backend/**',
      '../ai-service/**',
    ],
    setupFiles: ['./tests/setup-jsdom.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Coverage is scoped to modules we deem stable for F0-F2.
      // Step1/Step2/Step3 pages, AI panels (FeedbackIA, MentorVirtual, MentorSupport,
      // MentorPanelPage), AppContext, and AI hooks/services are deliberately
      // excluded because they are scheduled for rewrite in F3-F6 of the AI roadmap
      // (see ADR-011). Once those modules stabilise we extend `include` here.
      include: [
        'src/app/services/api.ts',
        'src/app/services/auth.service.ts',
        'src/app/services/cohortService.ts',
        'src/app/services/mentorService.ts',
        'src/app/services/projectService.ts',
        'src/app/services/stepService.ts',
        'src/app/services/portfolioService.ts',
        'src/app/services/project.adapter.ts',
        'src/app/hooks/useAutosave.ts',
        'src/app/hooks/useStepData.ts',
        'src/app/hooks/usePortfolioData.ts',
        'src/app/components/ui/button.tsx',
        'src/app/components/ui/badge.tsx',
        'src/app/components/ui/input.tsx',
        'src/app/components/ui/label.tsx',
        'src/app/components/ui/utils.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/*.{test,spec}.{ts,tsx}',
        '**/__tests__/**',
        'src/main.tsx',
        'src/imports/**',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
