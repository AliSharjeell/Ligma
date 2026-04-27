import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LIGMA - Real-time Collaborative Workspace',
  description: 'Let\'s Integrate Groups, Manage Anything - A real-time collaborative workspace that bridges ideation and execution.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
