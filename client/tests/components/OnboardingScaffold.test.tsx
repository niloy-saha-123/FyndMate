import React from 'react';
import renderer from 'react-test-renderer';
import { View, Text } from 'react-native';
import { describe, it, expect } from 'vitest';
import { OnboardingScaffold } from '../../src/components/OnboardingScaffold';

function getTextContent(node: { props?: { children?: unknown } }): string {
  const c = node.props?.children;
  if (c == null) return '';
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : String(x))).join('');
  return String(c);
}

describe('OnboardingScaffold', () => {
  it('renders step number and title', () => {
    const tree = renderer.create(
      <OnboardingScaffold step={1} title="Your name" subtitle="How we'll show you">
        <View />
      </OnboardingScaffold>
    );

    const texts = tree.root.findAllByType(Text);
    const allText = texts.map(getTextContent);
    expect(allText.some((t) => t.includes('Step 1 of 3'))).toBe(true);
    expect(allText.some((t) => t.includes('Your name'))).toBe(true);
    expect(allText.some((t) => t.includes("How we'll show you"))).toBe(true);
  });

  it('renders without subtitle when not provided', () => {
    const tree = renderer.create(
      <OnboardingScaffold step={2} title="Birthdate">
        <View testID="child" />
      </OnboardingScaffold>
    );

    const texts = tree.root.findAllByType(Text);
    const allText = texts.map(getTextContent);
    expect(allText.some((t) => t.includes('Step 2 of 3'))).toBe(true);
    expect(allText.some((t) => t.includes('Birthdate'))).toBe(true);
  });

  it('renders children in body', () => {
    const tree = renderer.create(
      <OnboardingScaffold step={3} title="Done">
        <View testID="onboarding-child" />
      </OnboardingScaffold>
    );

    const child = tree.root.findByProps({ testID: 'onboarding-child' });
    expect(child).toBeTruthy();
  });
});
