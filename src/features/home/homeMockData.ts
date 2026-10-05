import type { IconName } from '@/components/ui/Icon';
import type { ColorToken } from '@/theme/tokens';

/**
 * Static content for the Home screen (design/home.png) until the backend lands.
 * Class strings are literal so Tailwind can find them.
 */

export const currentLocation = { area: 'Deccan', label: 'FC Road, Deccan Gymkhana' };

export type HomePriority =
  'balanced' | 'fastest' | 'cheapest' | 'least_walking' | 'fewest_transfers';

export const priorities: { value: HomePriority; label: string; icon: IconName; badge?: string }[] =
  [
    { value: 'balanced', label: 'Balanced (AI)', icon: 'stars', badge: 'Best' },
    { value: 'fastest', label: 'Fastest', icon: 'bolt' },
    { value: 'cheapest', label: 'Cheapest', icon: 'currency-rupee' },
    { value: 'least_walking', label: 'Least Walking', icon: 'directions-walk' },
    { value: 'fewest_transfers', label: 'Fewest Transfers', icon: 'sync-alt' },
  ];

export interface ModeFilter {
  id: string;
  label: string;
  icon: IconName;
  container: string;
  iconTone: ColorToken;
  textTone: ColorToken;
  checkTone: ColorToken;
  bold?: boolean;
}

export const modeFilters: ModeFilter[] = [
  {
    id: 'walk',
    label: 'Walk',
    icon: 'directions-walk',
    container: 'bg-surface-container-high',
    iconTone: 'secondary',
    textTone: 'on-surface',
    checkTone: 'primary',
  },
  {
    id: 'bus',
    label: 'PMPML',
    icon: 'directions-bus',
    container: 'bg-error-container',
    iconTone: 'tertiary',
    textTone: 'on-error-container',
    checkTone: 'tertiary',
    bold: true,
  },
  {
    id: 'metro',
    label: 'Metro',
    icon: 'subway',
    container: 'bg-secondary-container',
    iconTone: 'primary',
    textTone: 'on-secondary-container',
    checkTone: 'primary',
    bold: true,
  },
  {
    id: 'train',
    label: 'Local',
    icon: 'train',
    container: 'bg-surface-container-high',
    iconTone: 'secondary',
    textTone: 'on-surface',
    checkTone: 'primary',
  },
  {
    id: 'auto',
    label: 'Auto',
    icon: 'electric-rickshaw',
    container: 'bg-primary-fixed',
    iconTone: 'primary',
    textTone: 'on-primary-fixed',
    checkTone: 'primary',
  },
  {
    id: 'cab',
    label: 'Cab',
    icon: 'local-taxi',
    container: 'bg-surface-container-high',
    iconTone: 'on-surface',
    textTone: 'on-surface',
    checkTone: 'primary',
  },
  {
    id: 'bike',
    label: 'Bike',
    icon: 'two-wheeler',
    container: 'bg-surface-container-high',
    iconTone: 'secondary',
    textTone: 'on-surface',
    checkTone: 'primary',
  },
];

export const savedPlaces: {
  id: string;
  name: string;
  area: string;
  eta: string;
  icon: IconName;
  iconContainer: string;
  iconTone: ColorToken;
}[] = [
  {
    id: 'home',
    name: 'Home',
    area: 'Kothrud',
    eta: '22 min',
    icon: 'home',
    iconContainer: 'bg-primary-fixed-dim/30',
    iconTone: 'primary',
  },
  {
    id: 'college',
    name: 'College',
    area: 'COEP',
    eta: '18 min',
    icon: 'school',
    iconContainer: 'bg-secondary-container',
    iconTone: 'secondary',
  },
  {
    id: 'work',
    name: 'Work',
    area: 'Hinjawadi',
    eta: '45 min',
    icon: 'work',
    iconContainer: 'bg-surface-variant',
    iconTone: 'on-surface-variant',
  },
];

export type LegKind = 'metro' | 'walk' | 'bus' | 'auto';

export const legStyles: Record<LegKind, { icon: IconName; container: string; tone: ColorToken }> = {
  metro: { icon: 'subway', container: 'bg-secondary-container', tone: 'on-secondary-container' },
  walk: {
    icon: 'directions-walk',
    container: 'bg-surface-container-high',
    tone: 'on-surface-variant',
  },
  bus: { icon: 'directions-bus', container: 'bg-error-container', tone: 'on-error-container' },
  auto: { icon: 'electric-rickshaw', container: 'bg-primary-fixed', tone: 'on-primary-fixed' },
};

export interface RecentTrip {
  id: string;
  from: string;
  to: string;
  legs: { kind: LegKind; label: string }[];
  duration: string;
  fare: string;
  note: { text: string; tone: ColorToken };
  tag: { label: string; highlight: boolean };
}

export const recentTrips: RecentTrip[] = [
  {
    id: 'pimpri-shivajinagar',
    from: 'Pimpri',
    to: 'Shivajinagar',
    legs: [
      { kind: 'metro', label: 'Metro Purple' },
      { kind: 'walk', label: '4m walk' },
    ],
    duration: '32 min',
    fare: '₹30',
    note: { text: 'Every 10 min', tone: 'secondary' },
    tag: { label: 'Fastest', highlight: true },
  },
  {
    id: 'swargate-viman-nagar',
    from: 'Swargate',
    to: 'Viman Nagar',
    legs: [
      { kind: 'bus', label: 'Bus 103' },
      { kind: 'auto', label: 'Auto' },
    ],
    duration: '44 min',
    fare: '₹65',
    note: { text: 'Heavy rush', tone: 'error' },
    tag: { label: '1 transfer', highlight: false },
  },
  {
    id: 'kothrud-pune-station',
    from: 'Kothrud Depot',
    to: 'Pune Station',
    legs: [{ kind: 'bus', label: 'Bus 148 Direct' }],
    duration: '38 min',
    fare: '₹25',
    note: { text: 'On time', tone: 'primary' },
    tag: { label: 'Direct', highlight: true },
  },
];

export const livePulse = {
  updated: 'Updated 1m ago',
  traffic: {
    title: 'Old Mumbai-Pune Highway',
    body: 'Heavy slowdown near Dapodi-Khadki stretch (+15m delay). Divert via Aundh recommended.',
  },
  metro: {
    station: 'Deccan Gymkhana Station',
    platform: 'Platform 2',
    line: 'Line 2 toward Ramwadi',
    next: '4 mins',
    following: '14 mins',
  },
  banner: { caption: 'Pune Metro Aqua & Purple Lines active', stat: '99.2% on-schedule' },
};
