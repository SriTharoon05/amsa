import type { Metadata } from 'next';
import './globals.css';
import './ingredients.css';
import './storefront.css';
import './product-model.css';
import './hero.css';
export const metadata: Metadata = { title: 'AMSA Ayurvedic — A return to your roots', description: 'Discover Keshya Hair Oil. A thoughtful hair ritual with a complete, transparent ingredient list.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><head><link rel="preload" href="/fonts/cormorant-garamond-latin-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" href="/fonts/manrope-latin-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body>{children}</body></html>; }
