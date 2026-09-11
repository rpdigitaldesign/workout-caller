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
    return <main className="min-h-dvh bg-bg">{children}</main>;
  }

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface md:static md:h-dvh md:w-56 md:border-t-0 md:border-r"
      >
        <ul className="flex justify-around md:flex-col md:justify-start md:gap-1 md:p-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1 md:flex-none">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`focus-ring flex flex-col items-center gap-1 rounded-md px-2 py-3 text-xs font-medium md:flex-row md:justify-start md:px-3 md:py-2.5 md:text-sm ${
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
      <main className="min-h-dvh flex-1 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
