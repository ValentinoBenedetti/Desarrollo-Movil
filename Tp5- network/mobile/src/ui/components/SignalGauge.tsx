import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface SignalGaugeProps {
  level: number; // 0 a 4
  dbm: number | null;
  carrier: string;
  generation: string;
}

export const SignalGauge: React.FC<SignalGaugeProps> = ({
  level,
  dbm,
  carrier,
  generation,
}) => {
  const bars = [1, 2, 3, 4];

  const getSignalColor = () => {
    if (level >= 3) {
      return theme.colors.success;
    }
    if (level === 2) {
      return theme.colors.warning;
    }
    return theme.colors.danger;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.carrier}>{carrier}</Text>
          <Text style={styles.techBadge}>{generation}</Text>
        </View>
        <View style={styles.barsContainer}>
          {bars.map((bar) => {
            const isActive = bar <= level;
            return (
              <View
                key={bar}
                style={[
                  styles.bar,
                  { height: bar * 6 + 6 },
                  isActive
                    ? { backgroundColor: getSignalColor() }
                    : styles.barInactive,
                ]}
              />
            );
          })}
        </View>
      </View>
      <View style={styles.readout}>
        <Text style={styles.dbmText}>
          {dbm !== null ? `${dbm} dBm` : 'Nivel ' + level + ' / 4'}
        </Text>
        <Text style={styles.statusText}>
          {level >= 3 ? 'Excelente Cobertura' : level === 2 ? 'Cobertura Regular' : 'Baja Señal'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  carrier: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  techBadge: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 32,
    gap: 4,
  },
  bar: {
    width: 6,
    borderRadius: 2,
  },
  barInactive: {
    backgroundColor: theme.colors.surfaceBorder,
  },
  readout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopColor: theme.colors.surfaceBorder,
    borderTopWidth: 1,
  },
  dbmText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
