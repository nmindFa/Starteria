import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';

// AppProvider lives inside the router tree (RootLayout) so the context
// object is always co-located with its consumers — this prevents HMR
// from creating a mismatch between the Provider's context reference and
// the one used by useApp() in page components.
export default function App() {
  return <RouterProvider router={router} />;
}
