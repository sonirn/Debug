import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'APK Debug Mode Converter',
  description: 'Convert any APK file to debug mode with all debugging features enabled. Perfect for developers, security researchers, and reverse engineers.',
  keywords: 'APK, debug mode, android, developer tools, reverse engineering, security research',
  authors: [{ name: 'APK Debug Converter' }],
  creator: 'APK Debug Converter',
  publisher: 'APK Debug Converter',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'APK Debug Mode Converter',
    description: 'Convert any APK file to debug mode with all debugging features enabled',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'APK Debug Mode Converter',
    description: 'Convert any APK file to debug mode with all debugging features enabled',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="antialiased">
          {children}
        </main>
      </body>
    </html>
  );
}