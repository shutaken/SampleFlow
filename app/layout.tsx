import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avsample-flow.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sample Flow",
    template: "%s | Sample Flow",
  },
  description: "片手で流し見できるサンプル動画フィード",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="rating" content="adult" />
        <meta name="rating" content="RTA-5042-1996-1400-1577-RTA" />
      </head>
      <body>{children}</body>
    </html>
  );
}
