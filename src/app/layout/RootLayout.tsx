import React from 'react';
import { Outlet } from 'react-router';
import { AppProvider } from '../context/AppContext';

/**
 * RootLayout wraps every route with AppProvider so that React context
 * and route components always share the same React tree — avoiding HMR
 * mismatches where a reloaded context module creates a new Context object
 * that doesn't match the one used by the Provider sitting outside the router.
 */
export function RootLayout() {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  );
}
