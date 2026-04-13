import React from 'react';

type ShellVariant = 'base' | 'execution';
type RailWidth = 'standard' | 'wide';

interface StepWorkspaceShellProps {
  rail: React.ReactNode;
  children: React.ReactNode;
  mobileTabs?: React.ReactNode;
  desktopAside?: React.ReactNode;
  variant?: ShellVariant;
  railWidth?: RailWidth;
}

interface StepWorkspaceSplitPaneProps {
  children: React.ReactNode;
  aside: React.ReactNode;
}

const RAIL_WIDTH_CLASS: Record<RailWidth, string> = {
  standard: 'md:grid-cols-[220px_minmax(0,1fr)] min-[1440px]:grid-cols-[232px_minmax(0,1fr)] min-[1680px]:grid-cols-[240px_minmax(0,1fr)]',
  wide: 'md:grid-cols-[232px_minmax(0,1fr)] min-[1440px]:grid-cols-[244px_minmax(0,1fr)] min-[1680px]:grid-cols-[256px_minmax(0,1fr)]',
};

const SHELL_OUTER_CLASS: Record<ShellVariant, string> = {
  base: 'mx-auto w-full max-w-[1380px] px-5 py-6 min-[1440px]:max-w-[1500px] min-[1440px]:px-6 min-[1680px]:max-w-[1620px] min-[1680px]:px-8',
  execution: 'mx-auto w-full max-w-[1460px] px-5 py-6 min-[1440px]:max-w-[1560px] min-[1440px]:px-6 min-[1680px]:max-w-[1680px] min-[1680px]:px-8',
};

const MAIN_ONLY_GRID_CLASS: Record<ShellVariant, string> = {
  base: 'grid min-w-0 grid-cols-1 items-start gap-6 min-[1280px]:grid-cols-[minmax(0,940px)_minmax(0,1fr)] min-[1440px]:grid-cols-[minmax(0,1020px)_minmax(0,1fr)] min-[1680px]:grid-cols-[minmax(0,1100px)_minmax(120px,1fr)] min-[1680px]:gap-8',
  execution: 'grid min-w-0 grid-cols-1 items-start gap-6 min-[1280px]:grid-cols-[minmax(0,980px)_minmax(0,1fr)] min-[1440px]:grid-cols-[minmax(0,1040px)_minmax(0,1fr)] min-[1680px]:grid-cols-[minmax(0,1120px)_minmax(120px,1fr)] min-[1680px]:gap-8',
};

const MAIN_WITH_ASIDE_GRID_CLASS: Record<ShellVariant, string> = {
  base: 'grid min-w-0 grid-cols-1 items-start gap-6 min-[1280px]:grid-cols-[minmax(0,880px)_300px] min-[1440px]:grid-cols-[minmax(0,940px)_320px] min-[1680px]:grid-cols-[minmax(0,980px)_340px] min-[1680px]:gap-8',
  execution: 'grid min-w-0 grid-cols-1 items-start gap-6 min-[1280px]:grid-cols-[minmax(0,820px)_300px] min-[1440px]:grid-cols-[minmax(0,900px)_320px] min-[1680px]:grid-cols-[minmax(0,940px)_340px] min-[1680px]:gap-8',
};

export function StepWorkspaceShell({
  rail,
  children,
  mobileTabs,
  desktopAside,
  variant = 'base',
  railWidth = 'standard',
}: StepWorkspaceShellProps) {
  const desktopGridClass = desktopAside ? MAIN_WITH_ASIDE_GRID_CLASS[variant] : MAIN_ONLY_GRID_CLASS[variant];

  return (
    <div className={`h-full md:grid ${RAIL_WIDTH_CLASS[railWidth]}`}>
      <div className="hidden md:flex min-h-0 flex-col border-r border-slate-200 bg-white p-3 gap-1">
        {rail}
      </div>

      <div className="min-w-0 overflow-y-auto">
        <div className={SHELL_OUTER_CLASS[variant]}>
          <div className={desktopGridClass}>
            <div className="min-w-0">
              {mobileTabs}
              {children}
            </div>
            {desktopAside ? (
              <aside className="hidden min-[1280px]:block min-w-0">{desktopAside}</aside>
            ) : (
              <div className="hidden min-[1280px]:block" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StepWorkspaceSplitPane({ children, aside }: StepWorkspaceSplitPaneProps) {
  return (
    <div className="mx-auto w-full max-w-[1380px] px-5 py-6 min-[1440px]:max-w-[1480px] min-[1440px]:px-6 min-[1680px]:max-w-[1560px] min-[1680px]:px-8">
      <div className="grid items-start gap-6 min-[1280px]:grid-cols-[minmax(0,880px)_300px] min-[1440px]:grid-cols-[minmax(0,920px)_320px] min-[1680px]:grid-cols-[minmax(0,980px)_340px] min-[1680px]:gap-8">
        <div className="min-w-0">{children}</div>
        <aside className="hidden min-[1280px]:block min-w-0">{aside}</aside>
      </div>
    </div>
  );
}
