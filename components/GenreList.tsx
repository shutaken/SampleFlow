"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FeedGenreRow = {
  id: string;
  genres: string[] | null;
};

type GenreSummary = {
  name: string;
  count: number;
};

const PRIORITY_GENRES = ["巨乳", "新人", "制服", "人妻", "VR", "フェチ"];

function normalize(text: string) {
  return text.trim().toLocaleLowerCase("ja");
}

function sortGenres(a: GenreSummary, b: GenreSummary) {
  const ai = PRIORITY_GENRES.indexOf(a.name);
  const bi = PRIORITY_GENRES.indexOf(b.name);

  if (ai !== -1 || bi !== -1) {
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }

  return b.count - a.count || a.name.localeCompare(b.name, "ja");
}

export default function GenreList() {
  const [genres, setGenres] = useState<GenreSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("feed_videos")
        .select("id, genres")
        .limit(1000);

      if (error) {
        console.error(error);
      }

      const counts = new Map<string, number>();

      ((data ?? []) as FeedGenreRow[]).forEach((row) => {
        const uniqueNames = new Set((row.genres ?? []).filter(Boolean));
        uniqueNames.forEach((name) => {
          counts.set(name, (counts.get(name) ?? 0) + 1);
        });
      });

      const rows = [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort(sortGenres);

      if (!mounted) return;
      setGenres(rows);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return genres;
    return genres.filter((genre) => normalize(genre.name).includes(q));
  }, [genres, query]);

  return (
    <main className="list-page">
      <header className="list-header">
        <div className="list-nav-links">
          <a href="/feed" className="back-link">← フィードへ</a>
          <a href="/actresses" className="back-link">女優一覧</a>
        </div>
        <h1>ジャンル一覧</h1>
        <p>ジャンルを選び、該当ジャンルを含む専用フィードに移動できます。</p>
      </header>

      <div className="search-panel">
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ジャンル名で検索"
          aria-label="ジャンル名で検索"
        />
      </div>

      {loading ? (
        <div className="list-empty">読み込み中です。</div>
      ) : filtered.length === 0 ? (
        <div className="list-empty">該当するジャンルが見つかりません。</div>
      ) : (
        <div className="actress-grid">
          {filtered.map((genre) => (
            <a
              href={`/feed?genre=${encodeURIComponent(genre.name)}`}
              className="actress-card"
              key={genre.name}
            >
              <span className="actress-name">#{genre.name}</span>
              <span className="actress-count">{genre.count}作品</span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
