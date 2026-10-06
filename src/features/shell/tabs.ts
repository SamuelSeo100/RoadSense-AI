import type { IconName } from '@/components/routly/Icon';

export const TABS = ['home', 'routes', 'history', 'profile'] as const;
export type TabName = (typeof TABS)[number];

export const tabInfo: Record<TabName, { label: string; icon: IconName; href: `/${TabName}` }> = {
  home: { label: 'Home', icon: 'home', href: '/home' },
  routes: { label: 'Routes', icon: 'routes', href: '/routes' },
  history: { label: 'History', icon: 'history', href: '/history' },
  profile: { label: 'Profile', icon: 'profile', href: '/profile' },
};

/** Tab for a pathname like "/routes"; Home for anything else. */
export function tabFromPath(pathname: string): TabName {
  const segment = pathname.split('/').filter(Boolean)[0];
  return TABS.find((t) => t === segment) ?? 'home';
}
