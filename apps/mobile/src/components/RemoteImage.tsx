import { useState } from 'react'
import { View, Image, StyleSheet } from 'react-native'
import type { ImageResizeMode, StyleProp, ViewStyle } from 'react-native'
import { Icon } from 'react-native-paper'
import { brandColors } from '@/theme'

interface RemoteImageProps {
  uri?: string | null
  /** Layout style for the frame (width/height/borderRadius/position). */
  style?: StyleProp<ViewStyle>
  resizeMode?: ImageResizeMode
  /** Icon shown on the placeholder tile (while loading and on error). */
  placeholderIcon?: string
}

/**
 * Remote image with a graceful forest/sage placeholder tile that shows while
 * the image loads and stays put if the URL fails — never an endless spinner
 * or a blank box. The frame owns the layout; the image and placeholder fill it.
 */
export function RemoteImage({
  uri,
  style,
  resizeMode = 'cover',
  placeholderIcon = 'image-outline',
}: RemoteImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const showPlaceholder = !uri || failed || !loaded

  return (
    <View style={[styles.frame, style]}>
      {showPlaceholder && (
        <View style={styles.placeholder}>
          <Icon source={placeholderIcon} size={22} color="rgba(46,61,47,0.35)" />
        </View>
      )}
      {uri && !failed && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: 'rgba(168,181,160,0.28)' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,181,160,0.28)',
  },
})
