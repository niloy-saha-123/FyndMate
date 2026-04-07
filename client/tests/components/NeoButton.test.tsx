/**
 * @file tests/components/NeoButton.test.tsx
 * @description Unit tests for the NeoButton UI component.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { describe, it, expect, vi } from 'vitest';
import { NeoButton } from '../../src/components/NeoButton';

function flattenStyle(style: any) {
  return StyleSheet.flatten(style);
}

function createTree(element: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree!;
}

describe('NeoButton', () => {
  it('renders title text', () => {
    const tree = createTree(
      <NeoButton title="Request" onPress={() => undefined} />
    );

    const textNode = tree.root.findByProps({ children: 'Request' });
    expect(textNode).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = vi.fn();
    const tree = createTree(
      <NeoButton title="Send" onPress={onPress} />
    );

    const touchable = tree.root.findByType(TouchableOpacity);

    act(() => {
      touchable.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses gradient wrapper for primary variant', () => {
    const tree = createTree(
      <NeoButton title="Primary" onPress={() => undefined} variant="primary" />
    );

    const gradientNodes = tree.root.findAll((node: any) => node.type === 'LinearGradient');
    expect(gradientNodes.length).toBe(1);
  });

  it('does not render gradient for secondary variant', () => {
    const tree = createTree(
      <NeoButton title="Secondary" onPress={() => undefined} variant="secondary" />
    );

    const gradientNodes = tree.root.findAll((node: any) => node.type === 'LinearGradient');
    expect(gradientNodes.length).toBe(0);
  });

  it('applies full width style when enabled', () => {
    const tree = createTree(
      <NeoButton title="Wide" onPress={() => undefined} fullWidth />
    );

    const touchable = tree.root.findByType(TouchableOpacity);
    const style = flattenStyle(touchable.props.style);

    expect(style.flex).toBe(1);
  });
});
