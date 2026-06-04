"use client";

import type { FeedVideo } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Props = {
  video: FeedVideo;
  sessionId: string;
};

type SwipeReason = "swipe_right" | "click_cta";

function displayList(items: string[] | null | undefined, fallback: string) {
  if (!items || items.length === 0) return fallback;
  return items.slice(0, 3).join(" / ");
}

function withPlaybackHints(html: string) {
  // Best-effort only. Cross-origin iframe players cannot be muted/controlled
  // reliably from the parent page.
  return html.replace(
    /src="([^"]+)"/,
    (_match, src: string) => {
      try {
        const url = new URL(src);
        url.searchParams.set("autoplay", "1");
        url.searchParams.set("mute", "1");
        url.searchParams.set("muted", "1");
        url.searchParams.set("playsinline", "1");
        return `src="${url.toString()}"`;
      } catch {
        const separator = src.includes("?") ? "&" : "?";
        return `src="${src}${separator}autoplay=1&mute=1&muted=1&playsinline=1"`;
      }
    }
  );
}

async function track(
  eventType: string,
  sessionId: string,
  videoId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType,
        sessionId,
        videoId,
        metadata,
      }),
    });
  } catch {
    // Tracking failure should never block playback or navigation.
  }
}

export default function VideoCard({ video, sessionId }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const pointerStart = useRef<{
    x: number;
    y: number;
    t: number;
  } | null>(null);

  const [isActive, setIsActive] = useState(false);

  const imageUrl =
    video.thumbnail_url || video.package_image_url || video.list_image_url || "";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRatio > 0.72;
        setIsActive(active);

        if (active) {
          void track("impression", sessionId, video.id);
          videoRef.current?.play().catch(() => {
            // Browser autoplay restrictions can reject play(); ignore safely.
          });
          void track("play", sessionId, video.id);
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: [0, 0.72, 1] }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [sessionId, video.id]);

  function openProduct(reason: SwipeReason) {
    void track(reason, sessionId, video.id);
    void track("exit_to_fanza", sessionId, video.id, { reason });

    // Use assign to keep normal browser history behavior.
    window.location.assign(video.affiliate_url);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    pointerStart.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
    };
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const elapsed = Date.now() - start.t;

    pointerStart.current = null;

    const isRightSwipe = dx > 76 && Math.abs(dx) > Math.abs(dy) * 1.15;
    const isLeftSwipe = dx < -76 && Math.abs(dx) > Math.abs(dy) * 1.15;
    const isQuickEnough = elapsed < 1300;

    if (isRightSwipe && isQuickEnough) {
      openProduct("swipe_right");
      return;
    }

    if (isLeftSwipe && isQuickEnough) {
      void track("skip", sessionId, video.id, { direction: "left" });
    }
  }

  function onPointerCancel() {
    pointerStart.current = null;
  }

  const activeEmbedHtml =
    isActive && video.sample_embed_html
      ? withPlaybackHints(video.sample_embed_html)
      : null;

  return (
    <article ref={rootRef} className="video-card" aria-label={video.title}>
      <div className="media-area">
        {activeEmbedHtml ? (
          <iframe
            className="sample-iframe"
            srcDoc={activeEmbedHtml}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            loading="eager"
            title={video.title}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : isActive && video.sample_movie_url ? (
          <video
            ref={videoRef}
            className="sample-video"
            src={video.sample_movie_url}
            poster={imageUrl}
            playsInline
            muted
            loop
            autoPlay
            preload="auto"
            onEnded={() => void track("ended", sessionId, video.id)}
            controls={false}
          />
        ) : imageUrl ? (
          <img className="poster-fallback" src={imageUrl} alt="" />
        ) : null}
      </div>

      <div className="video-gradient" />

      <div
        className="gesture-layer"
        aria-label="右スワイプで公式商品ページへ移動"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />

      <div className="swipe-hint">→ 公式ページ</div>

      <div className="video-info">
        <div className="video-info-head">
          <span className="pr-label">PR</span>
          <span className="hint">右スワイプで商品ページへ</span>
        </div>

        <h2 className="video-title">{video.title}</h2>

        <div className="meta">
          {displayList(video.actresses, "出演者情報なし")}
          <br />
          {video.maker_name ?? "メーカー情報なし"} ·{" "}
          {displayList(video.genres, "ジャンル")}
        </div>
      </div>
    </article>
  );
}
