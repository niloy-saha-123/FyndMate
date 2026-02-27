import React from 'react';
import renderer from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { describe, it, expect } from 'vitest';
import { NeoCard } from '../../src/components/NeoCard';
import { COLORS } from '../../src/theme/colors';

function flattenStyle(style: any) {
  return StyleSheet.flatten(style);
}

describe('NeoCard', () => {
  it('renders children content', () => {
    const tree = renderer.create(
      <NeoCard>
        <View testID="child-content" />
      </NeoCard>
    );

    const child = tree.root.findByProps({ testID: 'child-content' });
    expect(child).toBeTruthy();
  });

  it('applies default card styles', () => {
    const tree = renderer.create(
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
    const tree = renderer.create(
      <NeoCard style={{ marginTop: 12 }}>
        <View />
      </NeoCard>
    );

    const card = tree.root.findByType(View);
    const style = flattenStyle(card.props.style);

    expect(style.marginTop).toBe(12);
  });
});
