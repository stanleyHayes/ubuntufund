import Svg, { Circle, Path, G } from 'react-native-svg'

interface UbuntuLogoProps {
  size?: number
}

export function UbuntuLogo({ size = 64 }: UbuntuLogoProps) {
  const scale = size / 64
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="30" fill="#2E7D32" />
      <Circle cx="32" cy="32" r="20" fill="none" stroke="#4CAF50" strokeWidth="0.8" opacity="0.3" />
      <G
        translate="32, 32"
        fill="none"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M0,-12 C4.5,-10.5 9,-6 9,-0.8 C9,1.5 7.5,3 5.2,3" />
        <Path d="M0,-12 C4.5,-10.5 9,-6 9,-0.8 C9,1.5 7.5,3 5.2,3" rotation="120" origin="0, 0" />
        <Path d="M0,-12 C4.5,-10.5 9,-6 9,-0.8 C9,1.5 7.5,3 5.2,3" rotation="240" origin="0, 0" />
      </G>
      <Circle cx={32 + 5.2} cy={32 + 3} r="2.8" fill="#F9A825" />
      <Circle cx={32 - 4.2} cy={32 - 5.2} r="2.8" fill="#F9A825" />
      <Circle cx={32 - 1} cy={32 + 5.3} r="2.8" fill="#F9A825" />
    </Svg>
  )
}
