import type { Metadata, Viewport } from "next";
import { Rajdhani, Roboto } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1D4ED8",
};

export const metadata: Metadata = {
  title: "Pelada App — Gerenciador de Peladas",
  description:
    "Gerencie suas peladas de futebol: sorteio de times, placar em tempo real, estatísticas e ranking de jogadores.",
  keywords: ["pelada", "futebol", "gerenciador", "sorteio de times", "placar"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pelada App",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${rajdhani.variable} ${roboto.variable}`}>
      <body className="font-body bg-background text-text-primary antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
