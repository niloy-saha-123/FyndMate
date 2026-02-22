import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

function Thrower() {
  throw new Error('Test error');
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const tree = renderer.create(
      <ErrorBoundary>
        <Text>Child content</Text>
      </ErrorBoundary>
    );
    const text = tree.root.findByProps({ children: 'Child content' });
    expect(text).toBeTruthy();
  });

  it('renders fallback UI when child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const tree = renderer.create(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    );

    const title = tree.root.findByProps({ children: "Something went wrong" });
    expect(title).toBeTruthy();

    const subtitle = tree.root.findAllByProps({
      children: "We're sorry, but something unexpected happened. Please try again.",
    });
    expect(subtitle.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  it('calls onError callback when child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    renderer.create(
      <ErrorBoundary onError={onError}>
        <Thrower />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('Test error');

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const tree = renderer.create(
      <ErrorBoundary fallback={<Text>Custom fallback</Text>}>
        <Thrower />
      </ErrorBoundary>
    );

    const custom = tree.root.findByProps({ children: 'Custom fallback' });
    expect(custom).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('retry button resets state and re-renders children', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let shouldThrow = true;
    function ConditionalThrower() {
      if (shouldThrow) throw new Error('First render');
      return <Text>Recovered</Text>;
    }

    const tree = renderer.create(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(tree.root.findByProps({ children: "Something went wrong" })).toBeTruthy();

    shouldThrow = false;

    const retryButton = tree.root.findByType(TouchableOpacity);
    act(() => {
      retryButton.props.onPress();
    });

    const recovered = tree.root.findByProps({ children: 'Recovered' });
    expect(recovered).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
