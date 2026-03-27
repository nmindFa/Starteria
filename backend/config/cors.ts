import { CorsOptions } from 'cors';
import { config } from './index';

export const corsOptions: CorsOptions = {
  origin: config.corsOrigin.split(',').map(o => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400,
};
