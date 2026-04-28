import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "LIGMA - Collaborative Canvas",
  description: "Real-time collaborative workspace for hackathons",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-normal antialiased`} style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
