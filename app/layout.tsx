import type { Metadata } from 'next';
import './globals.css';
import './hero.css';
export const metadata: Metadata = { title: 'AMSA Ayurvedic — A return to your roots', description: 'Discover Keshya Hair Oil. A thoughtful hair ritual infused with 18 Ayurvedic herbs and fresh coconut oil.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
