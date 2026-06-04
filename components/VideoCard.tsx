"use client";

import type { FeedVideo } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  video: FeedVideo;
  sessionId: string;
};

function displayList(items: string[] | null | undefined, fallback: string) {
  if (!items || items.length === 0) return fallback;
  return items.slice(0, 3).join(" / ");
}

function extractTrustedDmmEmbedSrc(embedHtml: string | null | undefined) {
  if (!embedHtml) return null;

  const match = embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const src = match?.[1];

  if (!src) return null;

  try {
    const url = new URL(src);

    const isDmmLiteVideo =
      url.protocol === "https:" &&
      url.hostname === "www.dmm.co.jp" &&
      url.pathname.startsWith("/litevideo/");

    if (!isDmmLiteVideo) return null;

    // Best-effort only: if DMM's player ignores these parameters, they are harmless.
    // The reliable stop mechanism is unmounting the iframe when the card leaves view.
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("muted", "1");
    url.searchParams.set("mute", "1");
    url.searchParams.set("playsinline", "1");

    return url.toString();
  } catch {
    return null;
  }
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
    // Tracking failure should not block the user experience.
  }
}

export default function VideoCard({ video, sessionId }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const [isActive, setIsActive] = useState(false);

  const imageUrl =
    video.thumbnail_url || video.package_image_url || video.list_image_url || "";

  const embedSrc = useMemo(
    () => extractTrustedDmmEmbedSrc(video.sample_embed_html),
    [video.sample_embed_html]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRatio > 0.72;
        setIsActive(active);

        if (active) {
          void track("impression", sessionId, video.id, {
            mediaType: embedSrc ? "official_embed" : "direct_video",
          });

          if (!embedSrc) {
            videoRef.current?.play().catch(() => {
              // Browser autoplay restrictions can reject play(); ignore safely.
            });
            void track("play", sessionId, video.id);
          }
        } else {
          // Direct video can be paused. Official iframe cannot be controlled cross-origin,
          // so it is unmounted by render when inactive.
          videoRef.current?.pause();
        }
      },
      { threshold: [0, 0.72, 1] }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [sessionId, video.id, embedSrc]);

  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.muted = true;

    if (isActive && !embedSrc) {
      videoRef.current.play().catch(() => {
        // no-op
      });
    } else {
      videoRef.current.pause();
    }
  }, [isActive, embedSrc]);

  function openProduct() {
    void track("swipe_right", sessionId, video.id);
    void track("exit_to_fanza", sessionId, video.id, { reason: "swipe_right" });
    window.location.href = video.affiliate_url;
  }

  function onTouchStart(e: React.TouchEvent<HTMLElement>) {
    startX.current = e.touches[0]?.clientX ?? null;
    startY.current = e.touches[0]?.clientY ?? null;
  }

  function onTouchEnd(e: React.TouchEvent<HTMLElement>) {
    if (startX.current === null || startY.current === null) return;

    const endX = e.changedTouches[0]?.clientX ?? startX.current;
    const endY = e.changedTouches[0]?.clientY ?? startY.current;
    const diffX = endX - startX.current;
    const diffY = endY - startY.current;

    // Prevent accidental transitions during normal vertical scrolling.
    const isIntentionalRightSwipe = diffX > 92 && Math.abs(diffX) > Math.abs(diffY) * 1.3;
    const isIntentionalLeftSwipe = diffX < -92 && Math.abs(diffX) > Math.abs(diffY) * 1.3;

    if (isIntentionalRightSwipe) {
      openProduct();
    } else if (isIntentionalLeftSwipe) {
      void track("skip", sessionId, video.id, { direction: "left" });
    }

    startX.current = null;
    startY.current = null;
  }

  return (
    <article
      ref={rootRef}
      className={`video-card ${isActive ? "is-active" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label={video.title}
    >
      <div className="media-area">
        {embedSrc ? (
          isActive ? (
            <iframe
              key={`${video.id}-active`}
              className="sample-iframe"
              src={embedSrc}
              title={video.title}
              scrolling="no"
              frameBorder="0"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : imageUrl ? (
            <img className="poster-fallback" src={imageUrl} alt="" />
          ) : null
        ) : video.sample_movie_url ? (
          <video
            ref={videoRef}
            className="sample-video"
            src={video.sample_movie_url}
            poster={imageUrl}
            playsInline
            muted
            autoPlay={isActive}
            loop
            preload={isActive ? "auto" : "metadata"}
            onEnded={() => void track("ended", sessionId, video.id)}
            controls={false}
          />
        ) : imageUrl ? (
          <img className="poster-fallback" src={imageUrl} alt="" />
        ) : null}
      </div>

      <div className="video-gradient" />
      <div className="swipe-hint" aria-hidden="true">→ 公式ページ</div>

      <div className="video-info">
        <div className="info-topline">
          <span className="pr-label">PR</span>
          <span className="gesture-copy">右スワイプで商品ページへ</span>
        </div>
        <h2 className="video-title">{video.title}</h2>
        <div className="meta">
          {displayList(video.actresses, "出演者情報なし")}
          <br />
          {video.maker_name ?? "メーカー情報なし"} · {displayList(video.genres, "ジャンル")}
        </div>
      </div>
    </article>
  );
}
