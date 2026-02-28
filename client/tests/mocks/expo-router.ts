import React from 'react';

export const router = {
  replace: (_: string) => {},
  push: (_: any) => {},
  back: () => {},
};

export const Redirect = ({ href }: { href: string }) => React.createElement('Redirect', { href });
export const Stack = (props: any) => React.createElement('Stack', props, props.children);
Stack.Screen = (props: any) => React.createElement('Stack.Screen', props, props.children);
export const Tabs = (props: any) => React.createElement('Tabs', props, props.children);
Tabs.Screen = (props: any) => React.createElement('Tabs.Screen', props, props.children);

export default { router, Redirect, Stack, Tabs };
