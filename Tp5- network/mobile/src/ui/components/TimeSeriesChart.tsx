import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { theme } from '../theme';

interface TimeSeriesDataPoint {
  x: number; // timestamp o índice
  y: number; // valor
}

interface TimeSeriesChartProps {
  title: string;
  data: TimeSeriesDataPoint[];
  unit: string;
  color?: string;
  height?: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  data,
  unit,
  color = theme.colors.primary,
  height = 140,
}) => {
  if (data.length < 2) {
    return (
      <View style={[styles.card, { height }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Muestras insuficientes para graficar</Text>
        </View>
      </View>
    );
  }

  const chartWidth = 300;
  const chartHeight = height - 50;
  const padding = 20;

  const yValues = data.map((d) => d.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY === 0 ? 1 : maxY - minY;

  // Normalización a coordenadas SVG
  const points = data
    .map((point, index) => {
      const x = padding + (index / (data.length - 1)) * (chartWidth - padding * 2);
      const normalizedY = (point.y - minY) / yRange;
      const y = chartHeight - padding - normalizedY * (chartHeight - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const latestVal = data[data.length - 1].y;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.latestValue, { color }]}>
          {latestVal.toFixed(1)} {unit}
        </Text>
      </View>

      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Líneas guía de fondo */}
        <Line
          x1={padding}
          y1={padding}
          x2={chartWidth - padding}
          y2={padding}
          stroke={theme.colors.surfaceBorder}
          strokeDasharray="4,4"
          strokeWidth="1"
        />
        <Line
          x1={padding}
          y1={chartHeight - padding}
          x2={chartWidth - padding}
          y2={chartHeight - padding}
          stroke={theme.colors.surfaceBorder}
          strokeWidth="1"
        />

        {/* Curva de la serie temporal */}
        <Polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          points={points}
        />

        {/* Punto más reciente */}
        {data.length > 0 ? (
          <Circle
            cx={chartWidth - padding}
            cy={
              chartHeight -
              padding -
              ((latestVal - minY) / yRange) * (chartHeight - padding * 2)
            }
            r="4"
            fill={color}
          />
        ) : null}

        {/* Etiquetas de valores min/max */}
        <SvgText
          x={padding}
          y={padding - 4}
          fill={theme.colors.textMuted}
          fontSize="10"
        >
          {maxY.toFixed(0)} {unit}
        </SvgText>
        <SvgText
          x={padding}
          y={chartHeight - 4}
          fill={theme.colors.textMuted}
          fontSize="10"
        >
          {minY.toFixed(0)} {unit}
        </SvgText>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
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
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  latestValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
