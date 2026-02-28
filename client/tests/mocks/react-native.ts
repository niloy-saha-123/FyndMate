import React from 'react';

function makePrimitive(displayName: string) {
  const Component = React.forwardRef<any, any>((props, ref) =>
    React.createElement(displayName, { ...props, ref, testID: displayName, ...props.testID ? { 'data-testid': props.testID } : {} }, props.children)
  );
  Component.displayName = displayName;
  return Component;
}

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

export const View = makePrimitive('View');
export const Text = makePrimitive('Text');
export const TouchableOpacity = makePrimitive('TouchableOpacity');
export const ScrollView = makePrimitive('ScrollView');
export const Pressable = makePrimitive('Pressable');
export const TextInput = makePrimitive('TextInput');
export const Image = makePrimitive('Image');
export const Modal = makePrimitive('Modal');
export const ActivityIndicator = makePrimitive('ActivityIndicator');
export const Switch = makePrimitive('Switch');
export const FlatList = makePrimitive('FlatList');

export const Alert = {
  alert: () => {},
};

export const Platform = {
  OS: 'ios',
  select: (options: Record<string, any>) => options?.ios ?? options?.default,
};

export const Dimensions = {
  get: () => ({ width: 390, height: 844 }),
};

export const NativeModules: any = {
  BlobModule: { BLOB_URI_SCHEME: 'blob', BLOB_URI_HOST: 'localhost' },
};

export const AppState = {
  currentState: 'active',
  addEventListener: (_: string, cb: any) => {
    return { remove: () => {} , callback: cb };
  },
};

export const StyleSheetStub = StyleSheet;
export { StyleSheet };

export default {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Switch,
  FlatList,
  Alert,
  StyleSheet,
  Platform,
  Dimensions,
  NativeModules,
  AppState,
};
