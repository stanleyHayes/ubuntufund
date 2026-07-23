import React from 'react'
import { vi } from 'vitest'

// Install Expo global polyfill before any Expo modules load
import { installExpoGlobalPolyfill } from 'expo-modules-core/src/polyfill/dangerous-internal'
installExpoGlobalPolyfill()

// Define React Native globals
vi.stubGlobal('__DEV__', false)

// Mock expo-router
vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  useLocalSearchParams: vi.fn(() => ({})),
}))

// Mock expo
vi.mock('expo', () => ({}))

// Mock expo-notifications
vi.mock('expo-notifications', () => ({}))

// Mock expo-device
vi.mock('expo-device', () => ({
  isDevice: true,
  brand: null,
  manufacturer: null,
  modelName: null,
  modelId: null,
  designName: null,
  productName: null,
  deviceYearClass: null,
  totalMemory: null,
  supportedCpuArchitectures: null,
  osName: null,
  osVersion: null,
  osBuildId: null,
  osInternalBuildId: null,
  osBuildFingerprint: null,
  platformApiLevel: null,
  deviceName: null,
}))

// Mock @/lib/api to prevent expo-constants loading
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  loginApi: vi.fn(),
  registerApi: vi.fn(),
  refreshTokenApi: vi.fn(),
}))

// Mock react-native-paper
function MockView({ children }: { children?: React.ReactNode }) {
  return React.createElement('div', {}, children)
}

const MockCard = Object.assign(
  function Card({ children }: { children?: React.ReactNode }) {
    return React.createElement('div', {}, children)
  },
  {
    Content: function CardContent({ children }: { children?: React.ReactNode }) {
      return React.createElement('div', {}, children)
    },
    Cover: function CardCover() {
      return React.createElement('div', {})
    },
  }
)

function MockText({ children }: { children?: React.ReactNode }) {
  return React.createElement('span', {}, children)
}

vi.mock('react-native-paper', () => ({
  MD3LightTheme: {},
  MD3DarkTheme: {},
  configureFonts: () => ({}),
  Card: MockCard,
  Text: MockText,
  Chip: function Chip({ children }: { children?: React.ReactNode }) {
    return React.createElement('div', {}, children)
  },
  Icon: function Icon() {
    return React.createElement('span', {})
  },
  ActivityIndicator: function ActivityIndicator() {
    return React.createElement('span', {})
  },
  Button: function Button({ children }: { children?: React.ReactNode }) {
    return React.createElement('button', {}, children)
  },
  Provider: ({ children }: { children?: React.ReactNode }) => children,
}))

// Mock react-native-svg
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Path: 'Path',
  G: 'G',
  Rect: 'Rect',
  Line: 'Line',
  Polyline: 'Polyline',
  Polygon: 'Polygon',
  Text: 'Text',
  TSpan: 'TSpan',
  Defs: 'Defs',
  ClipPath: 'ClipPath',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
  Use: 'Use',
  Symbol: 'Symbol',
  Image: 'Image',
}))

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}))

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

// Mock expo-constants
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { hostUri: 'localhost:8081' },
  },
}))

// Mock react-native-vector-icons (used internally by react-native-paper)
vi.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon')

// Mock @/services/notifications
vi.mock('@/services/notifications', () => ({
  registerForPushNotificationsAsync: vi.fn(() => Promise.resolve(null)),
  registerPushTokenWithApi: vi.fn(() => Promise.resolve()),
}))
