import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Chip } from '@/components/routly/Chip';
import { PrimaryButton } from '@/components/routly/PrimaryButton';
import { RText } from '@/components/routly/RText';
import { SectionHeader } from '@/components/routly/SectionHeader';
import { confirm } from '@/lib/confirm';
import {
  energyPrices,
  fuelsFor,
  mileageWarning,
  priceUnitLabel,
  unitFor,
  unitLabel,
  type FuelType,
  type UserVehicle,
  type VehicleType,
} from '@/services';
import { colors, fonts, radius } from '@/theme/routly';

import { GroupedList, ListRow } from '../profile/components/GroupedList';
import { showToast } from '../shell/shellStore';

import { useVehicleStore } from './vehicleStore';

const TYPE_NAMES: Record<VehicleType, string> = { car: 'Car', scooter: 'Scooty' };
const FUEL_NAMES: Record<FuelType, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
  electric: 'Electric',
};

/** "Petrol · 45 km/L" */
const summary = (v: UserVehicle) =>
  `${FUEL_NAMES[v.fuelType]} · ${v.efficiency} ${unitLabel[v.efficiencyUnit]}`;

/** Opened from the one-time "Have a car or scooty?" prompt on Routes. */
export const useVehicleEditorRequest = (() => {
  let open: ((type?: VehicleType) => void) | null = null;
  return {
    register: (fn: ((type?: VehicleType) => void) | null) => {
      open = fn;
    },
    request: (type?: VehicleType) => open?.(type),
  };
})();

/** Profile › My vehicles: one car and one scooty, for "Your scooty · ₹X fuel" route costs. */
export function MyVehicles() {
  const vehicles = useVehicleStore((s) => s.vehicles);
  const [editing, setEditing] = useState<{ type: VehicleType | null } | null>(null);

  useEffect(() => {
    useVehicleEditorRequest.register((type) => setEditing({ type: type ?? null }));
    return () => useVehicleEditorRequest.register(null);
  }, []);

  const missing = (['car', 'scooter'] as const).filter((t) => !vehicles.some((v) => v.type === t));
  return (
    <View style={styles.section}>
      <SectionHeader title="My vehicles" size={16} />
      <GroupedList>
        {vehicles.map((v) => (
          <ListRow
            key={v.type}
            onPress={() => setEditing({ type: v.type })}
            accessibilityLabel={`${v.nickname ?? TYPE_NAMES[v.type]}, ${summary(v)}. Edit`}
          >
            <View style={styles.flex}>
              <RText variant="body" family={fonts.extrabold}>
                {v.nickname ?? TYPE_NAMES[v.type]}
              </RText>
              <RText variant="caption">{summary(v)}</RText>
            </View>
          </ListRow>
        ))}
        {missing.length > 0 && (
          <ListRow
            onPress={() => setEditing({ type: missing.length === 1 ? missing[0]! : null })}
            accessibilityLabel="Add a vehicle"
          >
            <View style={styles.flex}>
              <RText variant="body" family={fonts.extrabold} color={colors.primary}>
                + Add{' '}
                {missing.length === 1 ? TYPE_NAMES[missing[0]!].toLowerCase() : 'car or scooty'}
              </RText>
              <RText variant="caption">
                For accurate fuel / charge cost on your own-vehicle routes
              </RText>
            </View>
          </ListRow>
        )}
      </GroupedList>
      {editing && (
        <VehicleEditor
          key={editing.type ?? 'new'}
          target={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

function VehicleEditor({
  target,
  onClose,
}: {
  target: { type: VehicleType | null };
  onClose: () => void;
}) {
  const vehicles = useVehicleStore((s) => s.vehicles);
  const existing = target.type ? vehicles.find((v) => v.type === target.type) : undefined;
  // Mounted per open (keyed), so the form starts from the vehicle being edited.
  const [type, setType] = useState<VehicleType | null>(target.type);
  const [fuel, setFuel] = useState<FuelType | null>(existing?.fuelType ?? null);
  const [mileage, setMileage] = useState(existing ? String(existing.efficiency) : '');
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [price, setPrice] = useState(existing?.priceOverride ? String(existing.priceOverride) : '');
  const [saving, setSaving] = useState(false);

  const efficiency = Number(mileage.replace(',', '.'));
  const priceValue = price.trim() ? Number(price.replace(',', '.')) : null;
  const warning = type && fuel && mileage.trim() ? mileageWarning(type, fuel, efficiency) : null;
  const valid =
    type !== null &&
    fuel !== null &&
    Number.isFinite(efficiency) &&
    efficiency > 0 &&
    (priceValue === null || (Number.isFinite(priceValue) && priceValue > 0));

  const save = async () => {
    if (!valid || !type || !fuel) return;
    setSaving(true);
    try {
      await useVehicleStore.getState().save({
        type,
        fuelType: fuel,
        efficiency,
        nickname: nickname.trim() || null,
        priceOverride: priceValue,
      });
      onClose();
    } catch {
      showToast('Saved on this phone; couldn’t sync to your account');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm(
      `Delete your ${TYPE_NAMES[existing.type].toLowerCase()}?`,
      'Its routes go back to the general cost estimate.',
      'Delete',
    );
    if (!ok) return;
    await useVehicleStore
      .getState()
      .remove(existing.type)
      .catch(() => showToast('Deleted on this phone; couldn’t sync to your account'));
    onClose();
  };

  const unit = fuel ? unitFor(fuel) : null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <RText variant="sectionTitle" size={20} accessibilityRole="header">
              {existing ? `Edit ${TYPE_NAMES[existing.type].toLowerCase()}` : 'Add a vehicle'}
            </RText>

            <RText variant="sectionLabel">Vehicle</RText>
            <View style={styles.chips}>
              {(['car', 'scooter'] as const).map((t) => (
                <Chip
                  key={t}
                  label={TYPE_NAMES[t]}
                  selected={type === t}
                  onPress={() => {
                    if (existing) return; // one of each: edit keeps the type
                    setType(t);
                    if (fuel && !fuelsFor(t).includes(fuel)) setFuel(null);
                  }}
                />
              ))}
            </View>

            {type && (
              <>
                <RText variant="sectionLabel">Fuel</RText>
                <View style={styles.chips}>
                  {fuelsFor(type).map((f) => (
                    <Chip
                      key={f}
                      label={FUEL_NAMES[f]}
                      selected={fuel === f}
                      onPress={() => setFuel(f)}
                    />
                  ))}
                </View>
              </>
            )}

            {fuel && unit && (
              <>
                <RText variant="sectionLabel">Mileage ({unitLabel[unit]})</RText>
                <TextInput
                  value={mileage}
                  onChangeText={setMileage}
                  keyboardType="decimal-pad"
                  placeholder={`e.g. ${type === 'car' ? (fuel === 'electric' ? 7 : 15) : fuel === 'electric' ? 30 : 45}`}
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  accessibilityLabel={`Mileage in ${unitLabel[unit]}`}
                />
                {warning && (
                  <RText variant="caption" color={colors.traffic.textModerate}>
                    {warning}
                  </RText>
                )}

                <RText variant="sectionLabel">Nickname (optional)</RText>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  maxLength={40}
                  placeholder={type === 'car' ? 'Your car' : 'Your scooty'}
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  accessibilityLabel="Nickname"
                />

                <RText variant="sectionLabel">Price ({priceUnitLabel[unit]}, optional)</RText>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder={`${energyPrices[fuel]} (Pune default)`}
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  accessibilityLabel={`Price in ${priceUnitLabel[unit]}`}
                />
              </>
            )}

            <View style={!valid && styles.dim} pointerEvents={valid && !saving ? 'auto' : 'none'}>
              <PrimaryButton
                label={saving ? 'Saving…' : 'Save'}
                height={48}
                onPress={() => void save()}
              />
            </View>
            {existing && (
              <Pressable
                onPress={() => void remove()}
                accessibilityRole="button"
                style={styles.delete}
              >
                <RText variant="body" family={fonts.extrabold} color={colors.danger}>
                  Delete {TYPE_NAMES[existing.type].toLowerCase()}
                </RText>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    maxHeight: '85%',
  },
  form: { padding: 20, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  delete: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.4 },
});
