import type { Metadata } from 'next';
import './globals.css';
import './hero.css';
import './ingredients.css';
export const metadata: Metadata = { title: 'AMSA Ayurvedic — A return to your roots', description: 'Discover Keshya Hair Oil. A thoughtful hair ritual with a complete, transparent ingredient list.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
