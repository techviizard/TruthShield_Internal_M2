import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/components/locale-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TruthShield by CyArt - Cyber Defence & Information Integrity Console",
  description: "Deepfake detection, misinformation analysis, and digital media verification console for cyber defence analysts. Detect manipulated media, verify claims, and track disinformation campaigns.",
  keywords: ["TruthShield", "cyber defence", "deepfake detection", "misinformation", "fact-check", "digital forensics", "information warfare", "OSINT"],
  authors: [{ name: "CyArt" }],
  creator: "CyArt",
  publisher: "CyArt",
  icons: {
    icon: "/logo.svg",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TruthShield",
    statusBarStyle: "black-translucent",
  },
};

// Installable-app chrome: the theme colour drives the OS window frame when the
// console is launched standalone in the field.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            {children}
            <Toaster />
            <SonnerToaster />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
