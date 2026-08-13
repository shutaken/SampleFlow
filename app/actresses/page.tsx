import type { Metadata } from "next";
import ActressList from "@/components/ActressList";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avsample-flow.com";

export const metadata: Metadata = {
  title: "女優一覧 | Sample Flow",
  description: "Sample Flowで掲載中のサンプル動画を女優別に探せます。",
  alternates: {
    canonical: `${siteUrl}/actresses`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ActressesPage() {
  return <ActressList />;
}
