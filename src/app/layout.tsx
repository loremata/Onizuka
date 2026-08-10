import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Onizuka",
  description: "Sistema operativo intelligente personale e aziendale",
  applicationName: "Onizuka",
  /** iOS < 16.4 apre a schermo pieno solo con questi meta, non col manifest. */
  appleWebApp: {
    capable: true,
    title: "Onizuka",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="scroll-smooth">
      <body className={`${inter.className} min-h-screen antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
