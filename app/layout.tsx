import type { Metadata } from "next";
import { gameStructuredData, siteMetadata } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = siteMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(gameStructuredData).replace(/</g, '\\u003c') }} />
        {children}
      </body>
    </html>
  );
}
