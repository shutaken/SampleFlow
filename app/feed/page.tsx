import type { Metadata } from "next";
import Feed from "@/components/Feed";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avsample-flow.com";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function paramToString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseGenres(searchParams: Record<string, string | string[] | undefined>) {
  const genres = paramToString(searchParams.genres)
    .split(/[、,]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const genre = paramToString(searchParams.genre).trim();

  return [...new Set([...genres, genre].filter(Boolean))];
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const genres = parseGenres(params);
  const canonical = genres.length === 1
    ? `${siteUrl}/feed?genre=${encodeURIComponent(genres[0])}`
    : `${siteUrl}/feed`;

  if (genres.length > 1) {
    return {
      title: `${genres.join(" × ")} のサンプル動画検索`,
      description: `${genres.join("、")}をすべて含むサンプル動画を検索できます。`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  if (genres.length === 1) {
    return {
      title: `${genres[0]}のサンプル動画`,
      description: `${genres[0]}ジャンルのサンプル動画をSample Flowで流し見できます。`,
      alternates: { canonical },
      robots: { index: true, follow: true },
    };
  }

  return {
    title: "サンプル動画フィード",
    description: "Sample Flowで新着サンプル動画を流し見できます。",
    alternates: { canonical },
    robots: { index: true, follow: true },
  };
}

export default function FeedPage() {
  return <Feed />;
}
