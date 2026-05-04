"use client";

import type { AdCard } from "@/lib/types";

type Props = { ad?: AdCard | null; sessionId: string };

export default function PrCard({ ad, sessionId }: Props) {
  async function click() {
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "ad_click", sessionId, metadata: { adId: ad?.id ?? null } }),
      });
    } catch {}
    if (ad?.target_url) window.location.href = ad.target_url;
  }

  return (
    <section className="pr-card">
      <span className="pr-label">PR / Sponsored</span>
      <h2>{ad?.title ?? "PR"}</h2>
      <p>{ad?.body ?? "Sample Flowはアフィリエイト広告を利用しています。掲載情報は公式提供情報をもとに表示しています。"}</p>
      {ad?.target_url ? <button className="primary-button" onClick={click}>{ad.cta_label}</button> : null}
      <p className="footer-note">動画ファイルの保存・編集・再配信は行わず、公式情報・公式リンクを利用します。</p>
    </section>
  );
}
