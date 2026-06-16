"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AdCard, FeedVideo } from "@/lib/types";
import PrCard from "./PrCard";
import VideoCard from "./VideoCard";

type FeedItem =
  | { type: "video"; video: FeedVideo; key: string }
  | { type: "ad"; ad: AdCard | null; key: string };

type GenreRow = {
  name: string;
  slug: string | null;
};

type Props = {
  actressName?: string | null;
  showGenreChips?: boolean;
  titlePrefix?: string | null;
};

const PRIORITY_GENRES = ["巨乳", "新人", "制服", "人妻", "VR", "フェチ"];

function getSessionId() {
  if (typeof window === "undefined") return "server";
  const key = "sample_flow_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

function getInitialGenre() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("genre") ?? "";
}

function sortGenres(rows: GenreRow[]) {
  return [...rows].sort((a, b) => {
    const ai = PRIORITY_GENRES.indexOf(a.name);
    const bi = PRIORITY_GENRES.indexOf(b.name);

    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }

    return a.name.localeCompare(b.name, "ja");
  });
}

export default function Feed({
  actressName = null,
  showGenreChips = true,
  titlePrefix = null,
}: Props) {
  const sessionId = useMemo(() => getSessionId(), []);
  const genreTimerRef = useRef<number | null>(null);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [adCards, setAdCards] = useState<AdCard[]>([]);
  const [genres, setGenres] = useState<GenreRow[]>([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [showGenreMenu, setShowGenreMenu] = useState(true);
  const [loading, setLoading] = useState(true);

  function clearGenreTimer() {
    if (genreTimerRef.current !== null) {
      window.clearTimeout(genreTimerRef.current);
      genreTimerRef.current = null;
    }
  }

  function revealGenreMenu() {
    clearGenreTimer();
    setShowGenreMenu(true);
  }

  function hideGenreMenuAfterDelay(delay = 1200) {
    clearGenreTimer();
    genreTimerRef.current = window.setTimeout(() => {
      setShowGenreMenu(false);
      genreTimerRef.current = null;
    }, delay);
  }

  useEffect(() => {
    setSelectedGenre(getInitialGenre());
  }, []);

  useEffect(() => {
    return () => {
      clearGenreTimer();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadGenres() {
      const { data, error } = await supabase
        .from("genres")
        .select("name, slug")
        .eq("is_active", true);

      if (error) {
        console.error(error);
        return;
      }

      if (!mounted) return;
      setGenres(sortGenres((data ?? []) as GenreRow[]));
    }

    if (showGenreChips) {
      void loadGenres();
    }

    return () => {
      mounted = false;
    };
  }, [showGenreChips]);

  useEffect(() => {
    if (!showGenreChips) return;

    revealGenreMenu();
    const timer = window.setTimeout(() => {
      setShowGenreMenu(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [showGenreChips, selectedGenre, actressName]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      let query = supabase
        .from("feed_videos")
        .select("*")
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (selectedGenre) {
        query = query.contains("genres", [selectedGenre]);
      }

      if (actressName) {
        query = query.contains("actresses", [actressName]);
      }

      const { data: videoRows, error } = await query;

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

    void load();

    return () => {
      mounted = false;
    };
  }, [selectedGenre, actressName]);

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

  function selectGenre(genreName: string) {
    setSelectedGenre(genreName);
    revealGenreMenu();
    hideGenreMenuAfterDelay(1600);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (genreName) {
        url.searchParams.set("genre", genreName);
      } else {
        url.searchParams.delete("genre");
      }
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  return (
    <div className={`feed-shell ${showGenreChips ? "has-genre-chips" : ""}`}>
      <header className="topbar">
        <a href="/feed" className="logo">Sample Flow</a>
        <nav className="topbar-nav" aria-label="メインナビゲーション">
          {titlePrefix ? <span className="topbar-title">{titlePrefix}</span> : null}
          <a href="/actresses" className="topbar-link">女優一覧</a>
        </nav>
      </header>

      {showGenreChips ? (
        <>
          <button
            className="genre-chip-hover-zone"
            type="button"
            aria-label="ジャンルメニューを表示"
            onMouseEnter={revealGenreMenu}
            onFocus={revealGenreMenu}
            onTouchStart={revealGenreMenu}
            onClick={revealGenreMenu}
          />

          <nav
            className={`genre-chip-bar ${showGenreMenu ? "is-visible" : ""}`}
            aria-label="ジャンル切り替え"
            onMouseEnter={revealGenreMenu}
            onMouseLeave={() => hideGenreMenuAfterDelay()}
            onFocus={revealGenreMenu}
          >
            <button
              type="button"
              className={`genre-chip ${selectedGenre === "" ? "is-active" : ""}`}
              onClick={() => selectGenre("")}
            >
              すべて
            </button>
            {genres.map((genre) => (
              <button
                type="button"
                key={genre.name}
                className={`genre-chip ${selectedGenre === genre.name ? "is-active" : ""}`}
                onClick={() => selectGenre(genre.name)}
              >
                {genre.name}
              </button>
            ))}
          </nav>
        </>
      ) : null}

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
              <span className="pr-label">No results</span>
              <h2>動画が見つかりません</h2>
              <p>別のジャンル、または女優一覧から選び直してください。</p>
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
      <footer className="affiliate-footer" aria-label="アフィリエイトとクレジットに関するお知らせ">
        <span>当サイトはアフィリエイト広告を利用しています。</span>
        <span className="webservice-credit">
          Powered by <a href="https://affiliate.dmm.com/api/">FANZA Webサービス</a>
        </span>
      </footer>
    </div>
  );
}
