import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import {
  colors,
  modeColors,
  radii,
  spacing,
  typography,
  type ColorToken,
  type ModeColorKey,
  type TypographyToken,
} from '@/theme/tokens';

/**
 * Throwaway token preview (/dev/tokens) for checking DESIGN.md against the build.
 * Class names are written out in full because Tailwind only compiles classes it
 * can find as literal strings.
 */
const typeClassNames: Record<TypographyToken, string> = {
  'display-lg': 'font-display-lg text-display-lg',
  'headline-lg': 'font-headline-lg text-headline-lg',
  'headline-md': 'font-headline-md text-headline-md',
  'headline-sm': 'font-headline-sm text-headline-sm',
  'title-md': 'font-title-md text-title-md',
  'body-lg': 'font-body-lg text-body-lg',
  'body-md': 'font-body-md text-body-md',
  'body-sm': 'font-body-sm text-body-sm',
  'label-lg': 'font-label-lg text-label-lg',
  'label-md': 'font-label-md text-label-md',
  'label-sm': 'font-label-sm text-label-sm',
  'data-metric': 'font-data-metric text-data-metric tabular-nums',
  'data-time': 'font-data-time text-data-time tabular-nums',
};

const modeLabels: Record<ModeColorKey, string> = {
  'metro-purple': 'Metro · Purple Line',
  'metro-aqua': 'Metro · Aqua Line',
  bus: 'PMPML Bus',
  auto: 'Auto-rickshaw',
  cab: 'Cab',
  walk: 'Walk',
  train: 'Suburban train *',
  bike: 'Bike *',
};

/** Pick a readable label color for an arbitrary swatch. */
function labelColorFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? colors['on-surface'] : colors['on-primary'];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-space-md">
      <Text
        className="font-label-sm text-label-sm uppercase text-on-surface-variant"
        role="heading"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Swatch({ name }: { name: ColorToken }) {
  const value = colors[name];
  return (
    <View className="flex-row items-center gap-space-md" accessibilityLabel={`${name} ${value}`}>
      <View
        className="h-12 w-12 items-center justify-center rounded-xl border border-outline-variant"
        style={{ backgroundColor: value }}
      >
        <Text className="font-label-sm text-label-sm" style={{ color: labelColorFor(value) }}>
          Aa
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-label-md text-label-md text-on-surface">{name}</Text>
        <Text className="font-body-sm text-body-sm tabular-nums text-on-surface-variant">
          {value}
        </Text>
      </View>
    </View>
  );
}

function ModeRow({ mode }: { mode: ModeColorKey }) {
  const c = modeColors[mode];
  return (
    <View className="flex-row items-center gap-space-sm">
      <View
        className="h-7 justify-center rounded-pill px-space-sm"
        style={{ backgroundColor: c.fg }}
      >
        <Text className="font-label-md text-label-md uppercase" style={{ color: c.on }}>
          {mode}
        </Text>
      </View>
      <View
        className="h-7 justify-center rounded-pill px-space-sm"
        style={{ backgroundColor: c.bg }}
      >
        <Text className="font-label-md text-label-md uppercase" style={{ color: c.fg }}>
          {mode}
        </Text>
      </View>
      <Text className="flex-1 font-body-sm text-body-sm text-on-surface-variant">
        {modeLabels[mode]}
      </Text>
    </View>
  );
}

export function TokensScreen() {
  return (
    <Screen contentClassName="gap-space-xl">
      <View>
        <Text className="font-headline-lg text-headline-lg text-on-surface" role="heading">
          Design tokens
        </Text>
        <Text className="font-body-md text-body-md text-on-surface-variant">
          Source: design/DESIGN.md → src/theme/tokens.ts
        </Text>
      </View>

      <Section title="Typography">
        {(Object.keys(typography) as TypographyToken[]).map((name) => {
          const t = typography[name];
          return (
            <View key={name} className="border-b border-surface-container-high pb-space-sm">
              <Text className={`${typeClassNames[name]} text-on-surface`}>
                {name.startsWith('data') ? '₹1,110 · 08:45 → 09:32' : 'Swargate → Shivajinagar'}
              </Text>
              <Text className="font-body-sm text-body-sm tabular-nums text-outline">
                {name} · {t.fontSize}/{t.lineHeight} · {t.weight} · ls {t.letterSpacing}
              </Text>
            </View>
          );
        })}
        <Text className="font-data-time text-data-time tabular-nums text-on-surface">
          tabular: 111 · 888 · ₹40 · 114A
        </Text>
        <Text className="font-bold text-body-md text-primary">
          font-bold override on body-md (Inter 700)
        </Text>
      </Section>

      <Section title="Transit modes (* not in DESIGN.md — provisional)">
        {(Object.keys(modeColors) as ModeColorKey[]).map((mode) => (
          <ModeRow key={mode} mode={mode} />
        ))}
      </Section>

      <Section title="Color roles">
        <View className="gap-space-sm">
          {(Object.keys(colors) as ColorToken[]).map((name) => (
            <Swatch key={name} name={name} />
          ))}
        </View>
      </Section>

      <Section title="Radii">
        <View className="flex-row flex-wrap gap-space-md">
          {(['control', 'card', 'sheet', 'pill'] as const).map((r) => (
            <View
              key={r}
              className="h-20 w-20 items-center justify-center border border-primary bg-surface-container-lowest"
              style={{ borderRadius: radii[r] }}
            >
              <Text className="font-label-md text-label-md text-on-surface">
                {r} {radii[r] === radii.full ? 'full' : radii[r]}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Spacing">
        {(Object.keys(spacing) as (keyof typeof spacing)[]).map((s) => (
          <View key={s} className="flex-row items-center gap-space-md">
            <View className="w-10">
              <View className="h-3 rounded-sm bg-primary" style={{ width: spacing[s] }} />
            </View>
            <Text className="font-body-sm text-body-sm tabular-nums text-on-surface-variant">
              {s} · {spacing[s]}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="className pipeline check">
        <View className="gap-space-sm rounded-card border border-surface-container-high bg-surface-container-lowest p-space-lg">
          <View className="h-12 items-center justify-center rounded-control bg-primary">
            <Text className="font-label-lg text-label-lg text-on-primary">
              bg-primary rounded-control
            </Text>
          </View>
          <View className="h-7 items-center justify-center self-start rounded-pill bg-mode-bus-bg px-space-sm">
            <Text className="font-label-md text-label-md text-mode-bus">
              BUS 148 · bg-mode-bus-bg
            </Text>
          </View>
          <View className="h-7 items-center justify-center self-start rounded-pill bg-mode-auto-bg px-space-sm">
            <Text className="font-label-md text-label-md text-mode-auto-on">
              AUTO · text-mode-auto-on
            </Text>
          </View>
        </View>
      </Section>
    </Screen>
  );
}
