import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-xl w-full space-y-4">
        <h1 className="text-xl font-bold">Starteria Prototipo</h1>
        <p className="text-sm text-slate-600">Navega directo a los pasos de validación y narrativa.</p>
        <div className="flex gap-3">
          <Link href="/step-3" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Ir a Step 3
          </Link>
          <Link href="/step-4" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Ir a Step 4
          </Link>
        </div>
      </div>
    </main>
  );
}
