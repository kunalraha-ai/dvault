import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { VaultSessionProvider } from "@/lib/client/vault-session";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "D-Vault — Your information. Every form. One voice.",
    template: "%s · D-Vault",
  },
  description:
    "D-Vault is your secure, voice-powered personal information vault and universal form-filling assistant. Store once, fill forms anywhere, and never lose track of an application again.",
  applicationName: "D-Vault",
};

export const viewport: Viewport = {
  themeColor: "#070B19",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <ToastProvider>
          <VaultSessionProvider>{children}</VaultSessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
