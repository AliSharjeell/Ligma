import type { Metadata } from "next";
import { Poppins, Dancing_Script, Lora } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-poppins",
});

const dancingScript = Dancing_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dancing-script",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
});

export const metadata: Metadata = {
  title: "Ligma - Collaborative Canvas",
  description: "Real-time collaborative workspace for hackathons",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${dancingScript.variable} ${lora.variable} font-normal antialiased`} style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
