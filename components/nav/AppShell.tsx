'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/workouts', label: 'Workouts' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Active workout runs and /login get a distraction-free, chrome-free layout.
  const isFocusMode = /^\/workout\/[^/]+\/run/.test(pathname) || pathname === '/login';

  if (isFocusMode) {
    return <main className="min-h-dvh bg-bg pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">{children}</main>;
  }

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:static md:h-dvh md:w-56 md:border-t-0 md:border-r md:p-0 md:pt-[env(safe-area-inset-top)] md:pl-[env(safe-area-inset-left)]"
      >
        <ul className="flex h-14 justify-around md:h-auto md:flex-col md:justify-start md:gap-1 md:p-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex flex-1 md:flex-none">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`focus-ring flex w-full flex-col items-center justify-center gap-1 rounded-md px-2 text-xs font-medium md:flex-row md:justify-start md:px-3 md:py-2.5 md:text-sm ${
                    active ? 'text-accent md:bg-surface-raised' : 'text-text-muted hover:text-text'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="min-h-dvh flex-1 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
    </div>
  );
}
