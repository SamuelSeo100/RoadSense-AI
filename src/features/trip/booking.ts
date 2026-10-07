import { choose } from '@/lib/confirm';
import { openBooking, type BookingProvider, type BookingTrip } from '@/services/bookings';

import { showToast } from '../shell/shellStore';

/** What the user wants to book or buy a ticket for. */
export type BookingKind = 'metro' | 'bus' | 'cab' | 'auto' | 'bikeTaxi';

/** Providers per kind; several = the user picks one in an action sheet. */
const providers: Record<BookingKind, { value: BookingProvider; label: string }[]> = {
  metro: [{ value: 'puneMetro', label: 'Pune Metro' }],
  bus: [{ value: 'pmpml', label: 'PMPML' }],
  cab: [
    { value: 'uber', label: 'Uber' },
    { value: 'ola', label: 'Ola' },
  ],
  auto: [
    { value: 'uber', label: 'Uber' },
    { value: 'ola', label: 'Ola' },
    { value: 'rapido', label: 'Rapido' },
  ],
  bikeTaxi: [{ value: 'rapido', label: 'Rapido' }],
};

const titles: Record<BookingKind, string> = {
  metro: 'Metro tickets',
  bus: 'Bus tickets',
  cab: 'Book a cab with',
  auto: 'Book an auto with',
  bikeTaxi: 'Book a bike taxi with',
};

/** Redirects to the partner app/site (Home tickets grid, route step actions). */
export async function book(kind: BookingKind, trip: BookingTrip = {}) {
  const options = providers[kind];
  const provider =
    options.length === 1 ? (options[0]?.value ?? null) : await choose(titles[kind], options);
  if (provider && !(await openBooking(provider, trip))) showToast('Couldn’t open the partner app');
}
