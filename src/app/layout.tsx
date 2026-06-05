import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "You Can't Beat Wellington on a Good Day — Can You Beat Wellington?",
  description: "Daily verdict on Wellington, NZ's weather.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
