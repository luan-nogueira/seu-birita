import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SCRIPT_TEMA } from "@/components/TemaBotao";
import { DadosProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seu Birita — Sistema",
  description:
    "Controle de pedidos, estoque, clientes e financeiro da Seu Birita Distribuidora.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Seu Birita",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b1b0e",
  // Sem isso, o iOS dá zoom sozinho ao focar num input de quantidade.
  maximumScale: 1,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
      </head>
      <body className={inter.variable}>
        <Script id="tema-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        <AuthProvider>
          <DadosProvider>
            {children}
          </DadosProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
