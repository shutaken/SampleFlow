import { supabase } from "@/lib/supabaseClient";
import type { RankingVideo } from "@/lib/types";

type SearchParams = { period?: string };

const viewMap = {
  "24h": "video_ranking_24h",
  "7d": "video_ranking_7d",
  "30d": "video_ranking_30d",
  all: "video_ranking_all",
} as const;

export const dynamic = "force-dynamic";

export default async function RankingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const period = params.period && params.period in viewMap ? (params.period as keyof typeof viewMap) : "24h";
  const viewName = viewMap[period];
  const { data } = await supabase.from(viewName).select("*").limit(30);
  const videos = (data ?? []) as RankingVideo[];

  return (
    <main className="ranking-page">
      <header className="ranking-header">
        <a href="/feed" className="muted">← フィードへ</a>
        <h1 className="brand">Ranking</h1>
        <p className="muted">PR / 人気ランキング: {period}</p>
      </header>
      <section className="ranking-grid">
        {videos.map((item, index) => (
          <a className="ranking-card" key={item.video_id} href={item.affiliate_url} rel="sponsored nofollow">
            <img src={item.thumbnail_url || item.package_image_url || ""} alt="" />
            <div>
              <span className="pr-label">#{index + 1} PR</span>
              <h2 className="video-title">{item.title}</h2>
              <p className="meta">score: {item.score ?? 0} / exits: {item.exits ?? 0}</p>
            </div>
          </a>
        ))}
      </section>
    </main>
  );
}
