"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AdCard, FeedVideo } from "@/lib/types";
import PrCard from "./PrCard";
import VideoCard from "./VideoCard";

type FeedItem =
  | { type: "video"; video: FeedVideo; key: string }
  | { type: "ad"; ad: AdCard | null; key: string };

function getSessionId() {
  if (typeof window === "undefined") return "server";
  const key = "sample_flow_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

export default function Feed() {
  const sessionId = useMemo(() => getSessionId(), []);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [adCards, setAdCards] = useState<AdCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data: videoRows, error } = await supabase
        .from("feed_videos")
        .select("*")
        .contains("genres", ["巨乳"])
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(70);

      if (error) console.error(error);

      const { data: adRows } = await supabase
        .from("ad_cards")
        .select("*")
        .eq("placement", "feed_every_7")
        .eq("is_active", true)
        .order("priority", { ascending: true })
        .limit(10);

      if (!mounted) return;
      setVideos((videoRows ?? []) as FeedVideo[]);
      setAdCards((adRows ?? []) as AdCard[]);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => {
    const result: FeedItem[] = [];

    videos.forEach((video, index) => {
      result.push({ type: "video", video, key: `video-${video.id}` });
      if ((index + 1) % 7 === 0) {
        const ad = adCards[index % Math.max(adCards.length, 1)] ?? null;
        result.push({ type: "ad", ad, key: `ad-${index}` });
      }
    });

    return result;
  }, [videos, adCards]);

  return (
    <div className="feed-shell">
      <header className="topbar">
        <a href="/feed" className="logo">Sample Flow</a>
        <span className="pr-label">PR / 巨乳・新着</span>
      </header>

      <main className="feed">
        {loading ? (
          <section className="feed-item">
            <div className="pr-card">
              <span className="pr-label">Loading</span>
              <h2>Sample Flow</h2>
              <p>新着サンプルを読み込んでいます。</p>
            </div>
          </section>
        ) : items.length === 0 ? (
          <section className="feed-item">
            <div className="pr-card">
              <span className="pr-label">PR</span>
              <h2>動画データがまだありません</h2>
              <p>DMM/FANZA API ID発行後に取得バッチを実行すると、ここに新着サンプルが表示されます。</p>
            </div>
          </section>
        ) : (
          items.map((item) => (
            <section className="feed-item" key={item.key}>
              {item.type === "video" ? (
                <VideoCard video={item.video} sessionId={sessionId} />
              ) : (
                <PrCard ad={item.ad} sessionId={sessionId} />
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
