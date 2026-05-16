import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Locker",
  description: "Secure self-service locker system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${geist.className} min-h-full`}>
        {/* Same CDN build index.html uses — avoids webpack bundling issues with the mqtt npm package */}
        <Script src="https://unpkg.com/mqtt/dist/mqtt.min.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
