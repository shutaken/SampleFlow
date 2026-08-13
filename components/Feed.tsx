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

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseGenreParams(searchParams: URLSearchParams) {
  const multi = searchParams.get("genres") ?? "";
  const single = searchParams.get("genre") ?? "";
  return unique([...multi.split(/[、,]/), single]);
}

function sortSelectedGenres(values: string[]) {
  return [...values].sort((a, b) => {
    const ai = PRIORITY_GENRES.indexOf(a);
    const bi = PRIORITY_GENRES.indexOf(b);

    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }

    return a.localeCompare(b, "ja");
  });
}

function getInitialGenres() {
  if (typeof window === "undefined") return [];
  return sortSelectedGenres(parseGenreParams(new URLSearchParams(window.location.search)));
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
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
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
    setSelectedGenres(getInitialGenres());
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
  }, [showGenreChips, selectedGenres, actressName]);

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

      if (selectedGenres.length > 0) {
        // AND条件: 指定した全ジャンルを含む動画のみ表示。
        query = query.contains("genres", selectedGenres);
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
  }, [selectedGenres, actressName]);

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

  function updateUrl(nextGenres: string[]) {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("genre");
    url.searchParams.delete("genres");

    if (nextGenres.length === 1) {
      url.searchParams.set("genre", nextGenres[0]);
    } else if (nextGenres.length > 1) {
      url.searchParams.set("genres", nextGenres.join(","));
    }

    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function setGenresSelection(nextGenres: string[]) {
    const normalized = sortSelectedGenres(unique(nextGenres));
    setSelectedGenres(normalized);
    updateUrl(normalized);
    revealGenreMenu();
    hideGenreMenuAfterDelay(1600);
  }

  function toggleGenre(genreName: string) {
    if (!genreName) {
      setGenresSelection([]);
      return;
    }

    const nextGenres = selectedGenres.includes(genreName)
      ? selectedGenres.filter((name) => name !== genreName)
      : [...selectedGenres, genreName];

    setGenresSelection(nextGenres);
  }

  return (
    <div className={`feed-shell ${showGenreChips ? "has-genre-chips" : ""}`}>
      <header className="topbar">
        <a href="/feed" className="logo">Sample Flow</a>
        <nav className="topbar-nav" aria-label="メインナビゲーション">
          {titlePrefix ? <span className="topbar-title">{titlePrefix}</span> : null}
          <a href="/actresses" className="topbar-link">女優一覧</a>
          <a href="/genres" className="topbar-link">ジャンル一覧</a>
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
              className={`genre-chip ${selectedGenres.length === 0 ? "is-active" : ""}`}
              onClick={() => toggleGenre("")}
            >
              すべて
            </button>
            {genres.map((genre) => (
              <button
                type="button"
                key={genre.name}
                className={`genre-chip ${selectedGenres.includes(genre.name) ? "is-active" : ""}`}
                onClick={() => toggleGenre(genre.name)}
                aria-pressed={selectedGenres.includes(genre.name)}
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
              <p>ジャンルを減らす、または女優一覧から選び直してください。</p>
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
