import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../constants/theme';

interface Props {
  progress: number; // 0 to 1
  height?: number;
  color?: string;
  trackColor?: string;
}

export default function ProgressBar({
  progress,
  height = 8,
  color = colors.primary,
  trackColor = colors.line,
}: Props) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, height, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radii.full,
  },
});
