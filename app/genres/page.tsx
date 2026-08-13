import type { Metadata } from "next";
import GenreList from "@/components/GenreList";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avsample-flow.com";

export const metadata: Metadata = {
  title: "ジャンル一覧 | Sample Flow",
  description: "Sample Flowで掲載中のサンプル動画をジャンル別に探せます。",
  alternates: {
    canonical: `${siteUrl}/genres`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function GenresPage() {
  return <GenreList />;
}
