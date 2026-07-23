const React = require('react')

function createComponent(name) {
  return function Component(props) {
    return React.createElement(name, props, props.children)
  }
}

function flattenStyle(style) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle))
  }
  return style || {}
}

module.exports = {
  View: createComponent('View'),
  Text: createComponent('Text'),
  Image: createComponent('Image'),
  ScrollView: createComponent('ScrollView'),
  FlatList: createComponent('FlatList'),
  TouchableOpacity: createComponent('TouchableOpacity'),
  TouchableWithoutFeedback: createComponent('TouchableWithoutFeedback'),
  TouchableHighlight: createComponent('TouchableHighlight'),
  TextInput: createComponent('TextInput'),
  ActivityIndicator: createComponent('ActivityIndicator'),
  Modal: createComponent('Modal'),
  Pressable: createComponent('Pressable'),
  Switch: createComponent('Switch'),
  SafeAreaView: createComponent('SafeAreaView'),
  StatusBar: createComponent('StatusBar'),
  Animated: {
    View: createComponent('Animated.View'),
    Text: createComponent('Animated.Text'),
    Image: createComponent('Animated.Image'),
    Value: function AnimatedValue() {
      this.setValue = () => {}
    },
    timing: () => ({ start: () => {} }),
    spring: () => ({ start: () => {} }),
    parallel: () => ({ start: () => {} }),
    sequence: () => ({ start: () => {} }),
    loop: () => ({ start: () => {} }),
    delay: () => ({ start: () => {} }),
  },
  StyleSheet: {
    create: (styles) => styles,
    flatten: flattenStyle,
    absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  },
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: () => ({ remove: () => {} }),
  },
  PixelRatio: {
    get: () => 2,
  },
  useColorScheme: () => 'light',
  useWindowDimensions: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  NativeModules: {},
  NativeEventEmitter: function NativeEventEmitter() {},
  findNodeHandle: () => null,
  AppRegistry: {
    registerComponent: () => {},
    runApplication: () => {},
  },
}
