import { createBrowserRouter, redirect } from 'react-router';
import { RootLayout } from './layout/RootLayout';
import { AppLayout } from './layout/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { ProjectHomePage } from './pages/ProjectHomePage';
import { Step0Page } from './pages/Step0Page';
import { Step1Page } from './pages/Step1Page';
import { Step2Page } from './pages/Step2Page';
import { Step3Page } from './pages/Step3Page';
import { Step4Page } from './pages/Step4Page';
import { EvidenciasPage } from './pages/EvidenciasPage';
import { MentorPanelPage } from './pages/MentorPanelPage';
import { AdminCohorte } from './pages/AdminCohorte';
import { PerfilPage } from './pages/PerfilPage';

export const router = createBrowserRouter([
  {
    // RootLayout provides AppProvider for every route in the tree,
    // keeping context inside the React Router rendering context.
    Component: RootLayout,
    children: [
      {
        path: '/auth',
        Component: AuthPage,
      },
      {
        path: '/',
        Component: AppLayout,
        children: [
          { index: true, loader: () => redirect('/dashboard') },
          { path: 'dashboard', Component: DashboardPage },
          { path: 'projects/new', Component: CreateProjectPage },
          { path: 'projects/:projectId', Component: ProjectHomePage },
          { path: 'projects/:projectId/step/0', Component: Step0Page },
          { path: 'projects/:projectId/step/1', Component: Step1Page },
          { path: 'projects/:projectId/step/2', Component: Step2Page },
          { path: 'projects/:projectId/step/3', Component: Step3Page },
          { path: 'projects/:projectId/step/4', Component: Step4Page },
          { path: 'projects/:projectId/evidencias', Component: EvidenciasPage },
          { path: 'mentor', Component: MentorPanelPage },
          { path: 'admin', Component: AdminCohorte },
          { path: 'perfil', Component: PerfilPage },
        ],
      },
    ],
  },
]);
