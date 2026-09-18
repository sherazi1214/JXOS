import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jasonex OS',
  description: 'Internal Business Operating System for Jasonex Technologies',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">{children}</body>
    </html>
  );
}
