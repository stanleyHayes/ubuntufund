import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, Easing, View } from 'react-native'
/** Small ballistic burst. Decorative only; never invokes a payment action. */
export function DonationCelebration() {
  const [progress] = useState(() => new Animated.Value(0)); const [visible, setVisible] = useState(false)
  useEffect(() => {
    let alive = true; let animation: Animated.CompositeAnimation | undefined
    const stop = () => { animation?.stop(); if (alive) setVisible(false) }
    const start = (reduced: boolean) => {
      if (!alive) return
      stop(); if (reduced || AppState.currentState !== 'active') return
      setVisible(true); progress.setValue(0)
      animation = Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
      animation.start(({finished}) => { if (alive && finished) setVisible(false) })
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(start)
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', start)
    const app = AppState.addEventListener('change', state => { if (state !== 'active') stop() })
    return () => { alive = false; animation?.stop(); motion.remove(); app.remove() }
  }, [progress])
  if (!visible) return null
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 110, overflow: 'hidden' }}>
    {Array.from({length:24}, (_,i) => {
      const vx = Math.cos(i * 2.4) * (60 + i * 3); const vy = -100 - (i % 5) * 18
      const times = [0,.2,.4,.6,.8,1]
      return <Animated.View key={i} style={{ position:'absolute',left:'50%',top:65,width:6,height:10,borderRadius:i%3===0?5:1,backgroundColor:i%2?'#C7A24A':'#A8B5A0',opacity:progress.interpolate({inputRange:[0,.7,1],outputRange:[1,1,0]}),transform:[{translateX:progress.interpolate({inputRange:[0,1],outputRange:[0,vx]})},{translateY:progress.interpolate({inputRange:times,outputRange:times.map(t=>vy*t+220*t*t)})},{rotate:progress.interpolate({inputRange:[0,1],outputRange:['0deg',`${i%2?540:-540}deg`]})}]}}/>
    })}
  </View>
}
