import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Starteria Prototipo Step 3-4',
  description: 'Prototipo visual clickeable para Probar en pequeño y Demo Day',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
