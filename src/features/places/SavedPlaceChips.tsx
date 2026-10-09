import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/routly/Chip';
import { Icon } from '@/components/routly/Icon';
import type { Place } from '@/services';

import { placeIcon } from './placeIcon';
import { SavedPlacePicker, type PickerTarget } from './SavedPlacePicker';
import { isFixedLabel, useSavedPlaces } from './savedPlaces';

interface SavedPlaceChipsProps {
  /** Plan from the current location to `place` (Home → Routes). */
  onGo: (place: Place) => void;
}

/** One-tap Home · College · Work. An unset label says "Set Home" and opens the picker. */
export function SavedPlaceChips({ onGo }: SavedPlaceChipsProps) {
  const places = useSavedPlaces().filter((p) => isFixedLabel(p.label));
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  return (
    <View style={styles.row}>
      {places.map((sp) => {
        const { icon, fg } = placeIcon(sp.label);
        const place = sp.place;
        return (
          <Chip
            key={sp.label}
            label={place ? sp.label : `Set ${sp.label}`}
            height={36}
            leading={<Icon name={icon} size={16} color={fg} />}
            accessibilityLabel={
              place ? `Routes to ${sp.label}, ${place.name}` : `Set your ${sp.label} address`
            }
            onPress={() => (place ? onGo(place) : setPicker({ kind: 'edit', entry: sp }))}
          />
        );
      })}
      <SavedPlacePicker
        target={picker}
        onClose={() => setPicker(null)}
        onSaved={(_label, place) => onGo(place)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
