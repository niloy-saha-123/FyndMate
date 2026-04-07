/**
 * @file tests/components/NeoChip.test.tsx
 * @description Unit tests for the NeoChip UI component.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { describe, it, expect, vi } from 'vitest';
import { NeoChip } from '../../src/components/NeoChip';
import { COLORS } from '../../src/theme/colors';

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

describe('NeoChip', () => {
  it('renders plain chip without press handler', () => {
    const tree = createTree(<NeoChip label="React" variant="skill" />);
    const textNode = tree.root.findByProps({ children: 'React' });

    expect(textNode).toBeTruthy();
  });

  it('renders touchable chip when onPress is provided', () => {
    const onPress = vi.fn();
    const tree = createTree(
      <NeoChip label="Open Source" variant="looking" onPress={onPress} />
    );

    const touchable = tree.root.findByType(TouchableOpacity);

    act(() => {
      touchable.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses selected colors for looking variant', () => {
    const tree = createTree(
      <NeoChip label="Startups" variant="looking" selected />
    );

    const textNode = tree.root.findByProps({ children: 'Startups' });
    const container = textNode.parent;
    if (!container) {
      throw new Error('Expected NeoChip text to have a parent container');
    }

    const containerStyle = flattenStyle(container.props.style);
    const textStyle = flattenStyle(textNode.props.style);

    expect(containerStyle.backgroundColor).toBe(COLORS.accent);
    expect(textStyle.color).toBe(COLORS.surface);
  });
});
