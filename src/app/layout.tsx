import type { Metadata, Viewport } from "next";
import "./globals.css";

// Sem marca no layout raiz: o cliente final só vê o estabelecimento (white-label).
export const metadata: Metadata = {
  title: "Cardápio",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content", // teclado do Android encolhe a tela em vez de cobrir o campo
  themeColor: "#F6F4EF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
