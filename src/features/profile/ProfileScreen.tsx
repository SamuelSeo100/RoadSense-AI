import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { SectionHeader } from '@/components/routly/SectionHeader';
import { cityInfo } from '@/constants/cities';
import { authService } from '@/features/auth/auth.service';
import { choose, confirm } from '@/lib/confirm';
import { bookingProviderNames, type BookingProvider } from '@/services/bookings';
import { historyService, tripLogService, type SavedPlace } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, fonts, modeColors, radius } from '@/theme/routly';

import { openHomeSearch } from '../routes/openRoutes';
import { SheetScrollView } from '../shell/SheetScrollView';
import { showToast } from '../shell/shellStore';
import { useMapContent, useTopBar } from '../shell/useScreenChrome';
import { useHistoryVersion } from '../trip/tripLog';

import { GroupedList, ListRow } from './components/GroupedList';
import { PreferencesCard } from './components/PreferencesCard';
import { QUICK_LAUNCH_COMBOS, QuickLaunchCard } from './components/QuickLaunchCard';

const LINKED_APPS: BookingProvider[] = ['uber', 'ola', 'puneMetro'];

const placeIcon = (label: string): { icon: IconName; bg: string; fg: string } =>
  label === 'College'
    ? { icon: 'college', bg: modeColors.bus.pillBg, fg: modeColors.bus.pillText }
    : { icon: 'home', bg: colors.primaryTint, fg: colors.primary };

/** Profile shows no routes on the map, only the location dot. */
const NO_ROUTES = { routes: [], selection: 'none', focused: false };

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const city = usePreferencesStore((s) => s.city);
  const prefs = useRoutlyPrefs((s) => s.prefs);
  const update = useRoutlyPrefs((s) => s.update);

  useTopBar('profile', {
    title: 'Profile',
    subtitle: 'Settings & Quick Launch',
    searchLabel: 'Plan a route',
    onSearch: openHomeSearch,
  });
  useMapContent(
    'profile',
    useMemo(() => NO_ROUTES, []),
  );

  const name = user?.name || 'Routly rider';
  // TODO(profile): show the phone number once the profile service exposes it.
  const details = [cityInfo[city].label, user?.email].filter(Boolean).join(' · ');

  const changeCombo = async () => {
    // Stub picker: stores the preference; nothing listens for the buttons yet.
    const combo = await choose('Quick Launch button combo', QUICK_LAUNCH_COMBOS);
    if (combo) update({ quickLaunchCombo: combo });
  };

  const toggleLinked = (provider: BookingProvider) => {
    if (!prefs) return;
    const linked = prefs.linkedApps.includes(provider);
    // TODO(linked-apps): connect through the provider's OAuth / deep link instead of a local flag.
    update({
      linkedApps: linked
        ? prefs.linkedApps.filter((p) => p !== provider)
        : [...prefs.linkedApps, provider],
    });
    showToast(
      linked
        ? `${bookingProviderNames[provider]} disconnected`
        : `${bookingProviderNames[provider]} connected`,
    );
  };

  const clearHistory = async () => {
    const ok = await confirm(
      'Clear trip history?',
      'This deletes your trips, route searches and choices from Routly. It can’t be undone.',
      'Clear',
    );
    if (!ok) return;
    try {
      // Unsent writes first, so nothing queued re-creates rows after the delete.
      tripLogService.clearPending();
      await historyService.clearHistory();
      useHistoryVersion.getState().bump();
      showToast('Trip history cleared');
    } catch {
      showToast('Couldn’t clear history. Try again.');
    }
  };

  const logOut = async () => {
    if (!(await confirm('Log out?', 'You’ll need to log in again to plan routes.', 'Log out')))
      return;
    try {
      // The root auth gate returns to the login screen once the session clears.
      await authService.signOut();
    } catch (e) {
      Alert.alert('Log out failed', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const comingSoon = (what: string) => () => showToast(`${what} is coming soon`);

  return (
    <SheetScrollView gap={18}>
      <View style={styles.identity}>
        <View
          style={styles.avatar}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <RText variant="bigNumber" size={24} color={colors.textOnPrimary}>
            {name.charAt(0).toUpperCase()}
          </RText>
        </View>
        <View style={styles.identityText}>
          <RText variant="screenTitle" numberOfLines={1}>
            {name}
          </RText>
          <RText variant="caption" size={13} numberOfLines={1}>
            {details}
          </RText>
        </View>
        <Pressable
          onPress={comingSoon('Editing your profile')}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          hitSlop={4}
          style={styles.editPill}
        >
          <RText variant="body" size={13}>
            Edit
          </RText>
        </Pressable>
      </View>

      {prefs && (
        <QuickLaunchCard
          enabled={prefs.quickLaunchEnabled}
          combo={prefs.quickLaunchCombo}
          onToggle={(quickLaunchEnabled) => update({ quickLaunchEnabled })}
          onChangeCombo={changeCombo}
        />
      )}

      <View style={styles.section}>
        <SectionHeader title="Saved places" size={16} />
        <GroupedList>
          {(prefs?.savedPlaces ?? []).map((sp: SavedPlace) => {
            const { icon, bg, fg } = placeIcon(sp.label);
            return (
              <ListRow
                key={sp.id}
                // TODO(saved-places): address picker.
                onPress={comingSoon('Setting an address')}
                accessibilityLabel={`${sp.label}, ${sp.place?.name ?? 'set address'}`}
              >
                <View style={[styles.placeIcon, { backgroundColor: bg }]}>
                  <Icon name={icon} size={18} color={fg} />
                </View>
                <View style={styles.flex}>
                  <RText variant="body" family={fonts.extrabold}>
                    {sp.label}
                  </RText>
                  <RText variant="caption">{sp.place?.name ?? 'Set address'}</RText>
                </View>
              </ListRow>
            );
          })}
          <ListRow onPress={comingSoon('Adding places')} accessibilityLabel="Add a place">
            <RText variant="body" family={fonts.extrabold} color={colors.primary}>
              + Add a place
            </RText>
          </ListRow>
        </GroupedList>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Travel preferences" size={16} />
        {prefs && <PreferencesCard prefs={prefs} onChange={update} />}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Linked apps for booking" size={16} />
        <GroupedList>
          {LINKED_APPS.map((provider) => {
            const linked = prefs?.linkedApps.includes(provider) ?? false;
            const label = bookingProviderNames[provider];
            return (
              <ListRow key={provider} minHeight={56}>
                <RText variant="body" family={fonts.extrabold} style={styles.flex}>
                  {label}
                </RText>
                <Pressable
                  onPress={() => toggleLinked(provider)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    linked ? `${label} connected. Disconnect` : `Connect ${label}`
                  }
                  hitSlop={5}
                  style={[styles.connect, linked && styles.connected]}
                >
                  <RText
                    variant="body"
                    size={12}
                    family={fonts.extrabold}
                    color={linked ? colors.textOnPrimary : colors.primary}
                  >
                    {linked ? 'Connected ✓' : 'Connect'}
                  </RText>
                </Pressable>
              </ListRow>
            );
          })}
        </GroupedList>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Settings" size={16} />
        <GroupedList>
          <ListRow minHeight={52} onPress={comingSoon('Notification settings')}>
            <RText variant="body">Notifications</RText>
          </ListRow>
          <ListRow
            minHeight={52}
            onPress={comingSoon('Language settings')}
            accessibilityLabel="Language, English"
          >
            <RText variant="body" style={styles.flex}>
              Language
            </RText>
            <RText variant="caption" size={14}>
              English
            </RText>
          </ListRow>
          <ListRow minHeight={52} onPress={comingSoon('Help & feedback')}>
            <RText variant="body">Help & feedback</RText>
          </ListRow>
          <ListRow minHeight={52} onPress={clearHistory}>
            <RText variant="body" color={colors.danger}>
              Clear my trip history
            </RText>
          </ListRow>
          <ListRow minHeight={52} onPress={logOut}>
            <RText variant="body" family={fonts.extrabold} color={colors.danger}>
              Log out
            </RText>
          </ListRow>
        </GroupedList>
      </View>
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  editPill: {
    height: 40,
    minWidth: 64,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: 10 },
  flex: { flex: 1 },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.logo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connect: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connected: { backgroundColor: colors.primary },
});
