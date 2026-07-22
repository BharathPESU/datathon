import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MosaicMove - AI Surveillance Analytics",
  description: "Next-gen intelligent predictive analytics platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
