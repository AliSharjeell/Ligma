import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}