import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/providers/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Project Manager', template: '%s | Project Manager' },
  description: 'Manage projects and tasks.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
