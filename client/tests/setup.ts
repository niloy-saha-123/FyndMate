import React from 'react';
import { vi } from 'vitest';

(globalThis as any).__DEV__ = false;

function makePrimitive(displayName: string) {
  const Component = React.forwardRef<any, any>((props, ref) =>
    React.createElement(displayName, { ...props, ref }, props.children)
  );
  Component.displayName = displayName;
  return Component;
}

vi.mock('react-native', () => {
  const StyleSheet = {
    create: (styles: Record<string, any>) => styles,
    flatten: (style: any) => {
      if (!style) return {};
      if (Array.isArray(style)) {
        return style.filter(Boolean).reduce((acc, item) => ({ ...acc, ...item }), {});
      }
      return style;
    },
    absoluteFillObject: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  };

  class MockAnimatedValue {
    constructor(public _val: number) {}
    interpolate = () => '100%';
  }
  const mockTiming = { start: () => {} };

  return {
    View: makePrimitive('View'),
    Text: makePrimitive('Text'),
    TouchableOpacity: makePrimitive('TouchableOpacity'),
    ScrollView: makePrimitive('ScrollView'),
    Pressable: makePrimitive('Pressable'),
    TextInput: makePrimitive('TextInput'),
    Image: makePrimitive('Image'),
    Modal: makePrimitive('Modal'),
    ActivityIndicator: makePrimitive('ActivityIndicator'),
    Switch: makePrimitive('Switch'),
    StyleSheet,
    Platform: {
      OS: 'ios',
      select: (options: Record<string, any>) => options?.ios ?? options?.default,
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
    },
    Animated: {
      Value: MockAnimatedValue,
      View: makePrimitive('Animated.View'),
      timing: () => mockTiming,
    },
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: makePrimitive('Ionicons'),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: makePrimitive('LinearGradient'),
}));
