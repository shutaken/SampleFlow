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

    return isDmmLiteVideo ? url.toString() : null;
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

  const [isActive, setIsActive] = useState(false);
  const [shouldMountMedia, setShouldMountMedia] = useState(false);

  const imageUrl =
    video.thumbnail_url || video.package_image_url || video.list_image_url || "";

  const embedSrc = useMemo(
    () => extractTrustedDmmEmbedSrc(video.sample_embed_html),
    [video.sample_embed_html]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const activeObserver = new IntersectionObserver(
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
          videoRef.current?.pause();
        }
      },
      { threshold: [0, 0.72, 1] }
    );

    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        // Mount the iframe/video slightly before it reaches the center.
        // This keeps vertical scrolling smooth while avoiding loading every embed at once.
        if (entry.isIntersecting) {
          setShouldMountMedia(true);
        }
      },
      {
        root: null,
        rootMargin: "720px 0px",
        threshold: 0.01,
      }
    );

    activeObserver.observe(root);
    preloadObserver.observe(root);

    return () => {
      activeObserver.disconnect();
      preloadObserver.disconnect();
    };
  }, [sessionId, video.id, embedSrc]);

  function openProduct(reason: "swipe_right" | "click_cta") {
    void track(reason, sessionId, video.id);
    void track("exit_to_fanza", sessionId, video.id, { reason });
    window.location.href = video.affiliate_url;
  }

  function onTouchStart(e: React.TouchEvent<HTMLElement>) {
    startX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent<HTMLElement>) {
    if (startX.current === null) return;

    const endX = e.changedTouches[0]?.clientX ?? startX.current;
    const diff = endX - startX.current;

    if (diff > 84) {
      openProduct("swipe_right");
    } else if (diff < -84) {
      void track("skip", sessionId, video.id, { direction: "left" });
    }

    startX.current = null;
  }

  return (
    <article
      ref={rootRef}
      className="video-card"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label={video.title}
    >
      <div className="media-area">
        {embedSrc ? (
          shouldMountMedia ? (
            <iframe
              className="sample-iframe"
              src={embedSrc}
              title={video.title}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              loading={isActive ? "eager" : "lazy"}
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
      <div className="swipe-hint">右スワイプで商品ページへ</div>

      <div className="video-info">
        <span className="pr-label">PR</span>
        <h2 className="video-title">{video.title}</h2>
        <div className="meta">
          {displayList(video.actresses, "出演者情報なし")}
          <br />
          {video.maker_name ?? "メーカー情報なし"} ·{" "}
          {displayList(video.genres, "ジャンル")}
        </div>

        <div className="cta-row">
          <button
            className="cta"
            onClick={() => openProduct("click_cta")}
            type="button"
          >
            公式商品ページへ
          </button>
          <span className="hint">片手操作</span>
        </div>
      </div>
    </article>
  );
}
