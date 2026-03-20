import { Step1ModuleDefinition } from './step1Architecture.types';

export const STEP1_MODULES: Step1ModuleDefinition[] = [
  {
    id: 'A',
    key: 'analysis',
    label: 'Modulo A: Analisis inicial',
    shortName: 'A · Analisis inicial',
    order: 1,
  },
  {
    id: 'B',
    key: 'research',
    label: 'Modulo B: Investigacion de campo',
    shortName: 'B · Investigacion',
    order: 2,
  },
  {
    id: 'C',
    key: 'capture_synthesis',
    label: 'Modulo C: Captura de informacion y sintesis',
    shortName: 'C · Captura y sintesis',
    order: 3,
  },
];
