import Svg, { Rect, Path } from 'react-native-svg'

interface UbuntuLogoProps {
  size?: number
}

/**
 * The UbuntuFund mark: two interlocked chain links — a sharp-cornered gold
 * diamond woven through a rounded sage one ("One chain. Many hands. Ubuntu.").
 * Mirrors packages/ui BrandLogo so every surface shares one identity.
 */
export function UbuntuLogo({ size = 64 }: UbuntuLogoProps) {
  const width = size * 1.375
  return (
    <Svg width={width} height={size} viewBox="0 0 66 48">
      {/* Rounded sage link (back) */}
      <Rect
        x={30}
        y={10}
        width={28}
        height={28}
        rx={11}
        transform="rotate(45 44 24)"
        fill="none"
        stroke="#A8B5A0"
        strokeWidth={4}
      />
      {/* Sharp gold link (front) */}
      <Rect
        x={8}
        y={10}
        width={28}
        height={28}
        rx={3}
        transform="rotate(45 22 24)"
        fill="none"
        stroke="#C7A24A"
        strokeWidth={4}
      />
      {/* Weave: short sage arc redrawn over the gold link */}
      <Path
        d="M 33.5 13.5 A 11 11 0 0 1 38 11.2"
        fill="none"
        stroke="#A8B5A0"
        strokeWidth={4}
        strokeLinecap="round"
        transform="rotate(45 44 24)"
      />
    </Svg>
  )
}
