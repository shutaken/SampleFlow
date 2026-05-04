"use client";

import type { FeedVideo } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Props = { video: FeedVideo; sessionId: string };

function displayList(items: string[] | null | undefined, fallback: string) {
  if (!items || items.length === 0) return fallback;
  return items.slice(0, 3).join(" / ");
}

async function track(eventType: string, sessionId: string, videoId?: string, metadata?: Record<string, unknown>) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType, sessionId, videoId, metadata }),
    });
  } catch {}
}

export default function VideoCard({ video, sessionId }: Props) {
  const rootRef = useRef<article | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startX = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const imageUrl = video.thumbnail_url || video.package_image_url || video.list_image_url || "";

  useEffect(() => {
    if (!rootRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0.72;
        setIsVisible(visible);
        if (visible) {
          track("impression", sessionId, video.id);
          videoRef.current?.play().catch(() => {});
          track("play", sessionId, video.id);
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: [0, 0.72, 1] }
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [sessionId, video.id]);

  function openProduct(reason: "swipe_right" | "click_cta") {
    track(reason, sessionId, video.id);
    track("exit_to_fanza", sessionId, video.id, { reason });
    window.location.href = video.affiliate_url;
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX.current;
    const diff = endX - startX.current;
    if (diff > 84) openProduct("swipe_right");
    else if (diff < -84) track("skip", sessionId, video.id, { direction: "left" });
    startX.current = null;
  }

  return (
    <article ref={rootRef} className="video-card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-label={video.title}>
      <div className="media-area">
        {video.sample_embed_html ? (
          <iframe
            className="sample-iframe"
            srcDoc={video.sample_embed_html}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            loading={isVisible ? "eager" : "lazy"}
            title={video.title}
          />
        ) : video.sample_movie_url ? (
          <video
            ref={videoRef}
            className="sample-video"
            src={video.sample_movie_url}
            poster={imageUrl}
            playsInline
            muted
            loop
            preload={isVisible ? "auto" : "metadata"}
            onEnded={() => track("ended", sessionId, video.id)}
            controls={false}
          />
        ) : imageUrl ? <img className="poster-fallback" src={imageUrl} alt="" /> : null}
      </div>
      <div className="video-gradient" />
      <div className="swipe-hint">右スワイプで商品ページへ</div>
      <div className="video-info">
        <span className="pr-label">PR</span>
        <h2 className="video-title">{video.title}</h2>
        <div className="meta">
          {displayList(video.actresses, "出演者情報なし")}<br />
          {video.maker_name ?? "メーカー情報なし"} · {displayList(video.genres, "ジャンル")}
        </div>
        <div className="cta-row">
          <button className="cta" onClick={() => openProduct("click_cta")} type="button">公式商品ページへ</button>
          <span className="hint">片手操作</span>
        </div>
      </div>
    </article>
  );
}
