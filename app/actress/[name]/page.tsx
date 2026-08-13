import type { Metadata } from "next";
import Feed from "@/components/Feed";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avsample-flow.com";

type PageProps = {
  params: Promise<{
    name: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const actressName = decodeURIComponent(name);
  const query = searchParams ? await searchParams : {};
  const genres = parseGenres(query);
  const encodedName = encodeURIComponent(actressName);
  const canonical = genres.length === 1
    ? `${siteUrl}/actress/${encodedName}?genre=${encodeURIComponent(genres[0])}`
    : `${siteUrl}/actress/${encodedName}`;

  if (genres.length > 1) {
    return {
      title: `${actressName} × ${genres.join(" × ")} のサンプル動画検索`,
      description: `${actressName}の動画から、${genres.join("、")}をすべて含む作品を検索できます。`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  if (genres.length === 1) {
    return {
      title: `${actressName} × ${genres[0]} のサンプル動画`,
      description: `${actressName}の${genres[0]}ジャンルのサンプル動画をSample Flowで探せます。`,
      alternates: { canonical },
      robots: { index: true, follow: true },
    };
  }

  return {
    title: `${actressName}のサンプル動画一覧`,
    description: `${actressName}の掲載サンプル動画をジャンル別に探せます。`,
    alternates: { canonical },
    robots: { index: true, follow: true },
  };
}

export default async function ActressFeedPage({ params }: PageProps) {
  const { name } = await params;
  const actressName = decodeURIComponent(name);

  return (
    <Feed
      actressName={actressName}
      showGenreChips
      titlePrefix={actressName}
    />
  );
}
