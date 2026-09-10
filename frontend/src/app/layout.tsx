import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const roboto = Roboto({ 
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap"
});

export const metadata: Metadata = {
  title: "BreachGuard - External Cyber Risk & Perimeter Monitoring",
  description: "Continuous external attack surface management, email security posture, and threat intelligence monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${roboto.variable} ${roboto.className} bg-gray-950 text-gray-100 min-h-screen antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
