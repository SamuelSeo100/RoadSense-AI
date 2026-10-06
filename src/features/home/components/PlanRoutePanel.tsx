import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/routly/Chip';
import { IconButton } from '@/components/routly/IconButton';
import { PrimaryButton } from '@/components/routly/PrimaryButton';
import { RouteRail } from '@/components/routly/RouteRail';
import { RText } from '@/components/routly/RText';
import { routingService, type Place, type SavedPlace } from '@/services';
import { colors, fonts, radius, shadows } from '@/theme/routly';

type Field = 'from' | 'to';

interface PlanRoutePanelProps {
  /** "Current location · Pimpri" */
  currentLocationLabel: string;
  savedPlaces: SavedPlace[];
  onClose: () => void;
  /** `from` is undefined for the current location. */
  onFind: (from: string | undefined, to: string) => void;
}

/** Plan-a-route card: From/To with autocomplete, swap, quick chips, Find routes. */
export function PlanRoutePanel({
  currentLocationLabel,
  savedPlaces,
  onClose,
  onFind,
}: PlanRoutePanelProps) {
  const [from, setFrom] = useState<string | null>(null); // null = current location
  const [to, setTo] = useState('');
  const [active, setActive] = useState<Field | null>(null);
  const [results, setResults] = useState<{ query: string; places: Place[] }>({
    query: '',
    places: [],
  });
  const [error, setError] = useState(false);

  const query = active === 'from' ? (from ?? '') : active === 'to' ? to : '';
  useEffect(() => {
    if (!query.trim()) return;
    let live = true;
    routingService.searchPlaces(query).then((places) => {
      if (live) setResults({ query, places: places.slice(0, 4) });
    });
    return () => {
      live = false;
    };
  }, [query]);
  const suggestions = active && query.trim() && results.query === query ? results.places : [];

  const pick = (place: Place) => {
    if (active === 'from') setFrom(place.name);
    else setTo(place.name);
    setActive(null);
  };

  const swap = () => {
    // Current location can sit in either slot: an empty `to` means "Where to?".
    setFrom(to || null);
    setTo(from ?? '');
  };

  const find = () => {
    if (!to.trim()) {
      setError(true);
      return;
    }
    onFind(from?.trim() || undefined, to.trim());
  };

  return (
    <View style={[styles.card, shadows.selectedCard]}>
      <View style={styles.header}>
        <RText variant="cardTitle" accessibilityRole="header">
          Plan a route
        </RText>
        <IconButton
          icon="close"
          shape="close"
          accessibilityLabel="Close search"
          onPress={onClose}
        />
      </View>

      <View style={styles.body}>
        <RouteRail />
        <View style={styles.fields}>
          <View style={styles.field}>
            <RText variant="fieldLabel">From</RText>
            <BottomSheetTextInput
              value={from ?? currentLocationLabel}
              onChangeText={(t) => setFrom(t)}
              onFocus={() => {
                setActive('from');
                if (from === null) setFrom('');
              }}
              onBlur={() => from === '' && setFrom(null)}
              accessibilityLabel="From"
              selectTextOnFocus
              style={styles.input}
            />
          </View>
          <View style={[styles.field, error && styles.fieldError]}>
            <RText variant="fieldLabel" color={error ? colors.danger : undefined}>
              To
            </RText>
            <BottomSheetTextInput
              value={to}
              onChangeText={(t) => {
                setTo(t);
                setError(false);
              }}
              onFocus={() => setActive('to')}
              placeholder="Where to?"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="To"
              returnKeyType="search"
              onSubmitEditing={find}
              style={styles.input}
            />
          </View>
        </View>
        <IconButton icon="swap" accessibilityLabel="Swap From and To" onPress={swap} />
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestions} accessibilityRole="list">
          {suggestions.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => pick(p)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}${p.area ? `, ${p.area}` : ''}`}
              style={styles.suggestion}
            >
              <RText variant="body">{p.name}</RText>
              {p.area && p.area !== p.name && <RText variant="caption">{p.area}</RText>}
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.chips}>
        <Chip label="◎ Use my location" height={36} onPress={() => setFrom(null)} />
        {savedPlaces.map((sp) => (
          <Chip
            key={sp.id}
            label={sp.label}
            height={36}
            onPress={() => {
              setTo(sp.place?.name ?? sp.label);
              setError(false);
            }}
          />
        ))}
      </View>

      <PrimaryButton label="Find routes" leadingIcon="search" height={48} onPress={find} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.card,
    padding: 16,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fields: { flex: 1, gap: 8 },
  field: {
    backgroundColor: colors.background,
    borderRadius: radius.tileSm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.background,
  },
  fieldError: { borderColor: colors.danger },
  input: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 22,
  },
  suggestions: {
    borderRadius: radius.tileSm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestion: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
