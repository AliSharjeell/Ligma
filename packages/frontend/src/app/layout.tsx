import type { Metadata } from "next";
import { Architects_Daughter } from "next/font/google";
import "./globals.css";

const architectsDaughter = Architects_Daughter({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-handwritten",
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
      <body className={`${architectsDaughter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
