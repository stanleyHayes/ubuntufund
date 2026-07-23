import { View, StyleSheet } from 'react-native'
import { brandColors } from '../theme'

interface ProgressBarProps {
  progress: number
  height?: number
  backgroundColor?: string
  fillColor?: string
}

export function ProgressBar({
  progress,
  height = 8,
  backgroundColor = '#E0E0E0',
  fillColor = brandColors.primary,
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1)

  return (
    <View style={[styles.track, { height, backgroundColor, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress * 100}%`,
            height,
            backgroundColor: clampedProgress >= 1 ? brandColors.secondary : fillColor,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0 },
})
