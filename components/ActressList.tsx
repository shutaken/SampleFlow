"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FeedActressRow = {
  id: string;
  actresses: string[] | null;
};

type ActressSummary = {
  name: string;
  count: number;
};

function normalize(text: string) {
  return text.trim().toLocaleLowerCase("ja");
}

export default function ActressList() {
  const [actresses, setActresses] = useState<ActressSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("feed_videos")
        .select("id, actresses")
        .limit(1000);

      if (error) {
        console.error(error);
      }

      const counts = new Map<string, number>();

      ((data ?? []) as FeedActressRow[]).forEach((row) => {
        const uniqueNames = new Set((row.actresses ?? []).filter(Boolean));
        uniqueNames.forEach((name) => {
          counts.set(name, (counts.get(name) ?? 0) + 1);
        });
      });

      const rows = [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));

      if (!mounted) return;
      setActresses(rows);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return actresses;
    return actresses.filter((actress) => normalize(actress.name).includes(q));
  }, [actresses, query]);

  return (
    <main className="list-page">
      <header className="list-header">
        <a href="/feed" className="back-link">← フィードへ</a>
        <h1>女優一覧</h1>
        <p>掲載作品数から女優を選び、専用フィードに移動できます。</p>
      </header>

      <div className="search-panel">
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="女優名で検索"
          aria-label="女優名で検索"
        />
      </div>

      {loading ? (
        <div className="list-empty">読み込み中です。</div>
      ) : filtered.length === 0 ? (
        <div className="list-empty">該当する女優が見つかりません。</div>
      ) : (
        <div className="actress-grid">
          {filtered.map((actress) => (
            <a
              href={`/actress/${encodeURIComponent(actress.name)}`}
              className="actress-card"
              key={actress.name}
            >
              <span className="actress-name">{actress.name}</span>
              <span className="actress-count">{actress.count}作品</span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
