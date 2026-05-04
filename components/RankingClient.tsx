"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RankingVideo } from "@/lib/types";

const viewMap = {
  "24h": "video_ranking_24h",
  "7d": "video_ranking_7d",
  "30d": "video_ranking_30d",
  all: "video_ranking_all",
} as const;

type Period = keyof typeof viewMap;

function getPeriod(): Period {
  if (typeof window === "undefined") return "24h";
  const value = new URLSearchParams(window.location.search).get("period");
  return value && value in viewMap ? (value as Period) : "24h";
}

export default function RankingClient() {
  const period = useMemo(() => getPeriod(), []);
  const [videos, setVideos] = useState<RankingVideo[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error } = await supabase.from(viewMap[period]).select("*").limit(30);
      if (error) console.error(error);
      if (mounted) setVideos((data ?? []) as RankingVideo[]);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [period]);

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
