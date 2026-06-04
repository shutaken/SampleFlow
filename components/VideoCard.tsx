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

function extractIframeSrc(html: string | null | undefined) {
  if (!html) return null;
  const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function getLiteVideoDetailUrl(video: FeedVideo) {
  const cid = video.provider_content_id || video.product_id || "";
  if (!cid) return video.affiliate_url;

  return `https://www.dmm.co.jp/litevideo/-/detail/=/cid=${encodeURIComponent(
    cid
  )}/`;
}

function getProductDestination(video: FeedVideo) {
  const rawUrl = video.affiliate_url?.trim();

  // The manually seeded URL format
  // https://video.dmm.co.jp/av/content/?id=...
  // can return 400 depending on environment/referrer/session.
  // For manual seed data, use the stable litevideo detail URL derived from cid.
  if (!rawUrl || rawUrl.includes("video.dmm.co.jp/av/content/")) {
    return getLiteVideoDetailUrl(video);
  }

  return rawUrl;
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

  const touchStart = useRef<{
    x: number;
    y: number;
    t: number;
  } | null>(null);

  const mouseStart = useRef<{
    x: number;
    y: number;
    t: number;
  } | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const imageUrl =
    video.thumbnail_url || video.package_image_url || video.list_image_url || "";

  const iframeSrc = extractIframeSrc(video.sample_embed_html);

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

  useEffect(() => {
    if (!isActive) {
      setShowSwipeHint(false);
      return;
    }

    setShowSwipeHint(true);
    const timer = window.setTimeout(() => {
      setShowSwipeHint(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isActive, video.id]);

  function openProduct(reason: SwipeReason) {
    const destination = getProductDestination(video);

    void track(reason, sessionId, video.id, { destination });
    void track("exit_to_fanza", sessionId, video.id, { reason, destination });

    window.location.assign(destination);
  }

  function finishSwipe(
    start: { x: number; y: number; t: number } | null,
    endX: number,
    endY: number
  ) {
    if (!start) return;

    const dx = endX - start.x;
    const dy = endY - start.y;
    const elapsed = Date.now() - start.t;

    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.05;
    const isRightSwipe = dx > 58 && isHorizontal;
    const isLeftSwipe = dx < -72 && isHorizontal;
    const isQuickEnough = elapsed < 1600;

    if (isRightSwipe && isQuickEnough) {
      openProduct("swipe_right");
      return;
    }

    if (isLeftSwipe && isQuickEnough) {
      void track("skip", sessionId, video.id, { direction: "left" });
    }
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;

    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      t: Date.now(),
    };
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.changedTouches[0];
    if (!touch) return;

    finishSwipe(touchStart.current, touch.clientX, touch.clientY);
    touchStart.current = null;
  }

  function onTouchCancel() {
    touchStart.current = null;
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    mouseStart.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
    };
  }

  function onMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    finishSwipe(mouseStart.current, e.clientX, e.clientY);
    mouseStart.current = null;
  }

  function onMouseLeave() {
    mouseStart.current = null;
  }

  return (
    <article ref={rootRef} className="video-card" aria-label={video.title}>
      <div className="media-area">
        {isActive && iframeSrc ? (
          <iframe
            className="sample-iframe"
            src={iframeSrc}
            loading="eager"
            title={video.title}
            allow="fullscreen; encrypted-media; picture-in-picture"
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
        aria-label="右スワイプで公式ページへ"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

      <div className={`swipe-hint ${showSwipeHint ? "is-visible" : ""}`}>
        右スワイプで公式ページへ
      </div>

      <div className="video-info">
        <div className="video-info-head">
          <span className="pr-label">PR</span>
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
