import type { Metadata } from 'next';
import './globals.css';
import './ingredients.css';
export const metadata:Metadata={title:'AMSA Ayurvedic — Good roots. Great rituals.',description:'Meet Keshya Hair Oil. 52 ingredients, coconut oil, and a little time for yourself. Discover the complete formulation and your everyday hair ritual.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><link rel="preload" href="/fonts/cormorant-garamond-latin-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" href="/fonts/manrope-latin-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body>{children}</body></html>;}
