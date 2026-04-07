/**
 * @file tests/components/NeoCard.test.tsx
 * @description Unit tests for the NeoCard UI component.
 */
import React from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { describe, it, expect } from 'vitest';
import { NeoCard } from '../../src/components/NeoCard';
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

describe('NeoCard', () => {
  it('renders children content', () => {
    const tree = createTree(
      <NeoCard>
        <View testID="child-content" />
      </NeoCard>
    );

    const child = tree.root.findByProps({ testID: 'child-content' });
    expect(child).toBeTruthy();
  });

  it('applies default card styles', () => {
    const tree = createTree(
      <NeoCard>
        <View />
      </NeoCard>
    );

    const card = tree.root.findByType(View);
    const style = flattenStyle(card.props.style);

    expect(style.backgroundColor).toBe(COLORS.surface);
    expect(style.overflow).toBe('hidden');
  });

  it('applies custom style override', () => {
    const tree = createTree(
      <NeoCard style={{ marginTop: 12 }}>
        <View />
      </NeoCard>
    );

    const card = tree.root.findByType(View);
    const style = flattenStyle(card.props.style);

    expect(style.marginTop).toBe(12);
  });
});
