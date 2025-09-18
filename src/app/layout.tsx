import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppProvider } from "@/contexts/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { AppOptimizer } from "@/components/AppOptimizer";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thoughts to Text | Voice recording and AI transcription",
  description: "Voice recording and AI transcription app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Thoughts to Text",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Thoughts to Text",
    title: "Thoughts to Text",
    description: "Voice recording and AI transcription app",
  },
  twitter: {
    card: "summary",
    title: "Thoughts to Text",
    description: "Voice recording and AI transcription app",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon_192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Thoughts to Text" />
        <meta name="mobile-web-app-capable" content="yes" />
        
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen min-h-0 overflow-hidden`}
      >
        <Script id="pwa-init" strategy="afterInteractive">
{`
  // Initialize PWA features
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async function() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('SW registered: ', registration);

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', function(event) {
          const { data } = event;
          if (data.type === 'PROCESS_TRANSCRIPTION_QUEUE' || data.type === 'PROCESS_REWRITE_QUEUE') {
            // Dispatch custom event for the app to handle
            window.dispatchEvent(new CustomEvent('sw-sync-request', { detail: data }));
          }
        });

        // Register for background sync if supported
        if ('sync' in window.ServiceWorkerRegistration.prototype) {
          console.log('Background sync supported');
        }

      } catch (error) {
        console.log('SW registration failed: ', error);
      }
    });
  }

  // Setup PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    // Dispatch event for app to handle
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  window.addEventListener('appinstalled', function() {
    console.log('PWA installed');
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
`}
        </Script>
        <ErrorBoundary showErrorDetails={process.env.NODE_ENV === 'development'}>
          <ThemeProvider>
            <AppProvider>
              <GlobalErrorHandler>
                <AppOptimizer>
                  {children}
                </AppOptimizer>
              </GlobalErrorHandler>
            </AppProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
