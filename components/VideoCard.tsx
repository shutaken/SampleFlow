"use client";

import type { FeedVideo } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Props = {
  video: FeedVideo;
  sessionId: string;
};

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
  const cid = video.provider_content_id || "";
  if (!cid) return video.affiliate_url;

  return `https://www.dmm.co.jp/litevideo/-/detail/=/cid=${encodeURIComponent(
    cid
  )}/`;
}

function getProductDestination(video: FeedVideo) {
  const rawUrl = video.affiliate_url?.trim();

  // Manual seed data may contain:
  // https://video.dmm.co.jp/av/content/?id=...
  // This can return 400 depending on environment/session.
  // Use the stable litevideo detail URL derived from cid.
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
  const [isActive, setIsActive] = useState(false);

  const imageUrl =
    video.thumbnail_url || video.package_image_url || video.list_image_url || "";

  const iframeSrc = extractIframeSrc(video.sample_embed_html);
  const destinationUrl = getProductDestination(video);

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

  function onProductClick() {
    void track("click_cta", sessionId, video.id, { destination: destinationUrl });
    void track("exit_to_fanza", sessionId, video.id, {
      reason: "click_cta",
      destination: destinationUrl,
    });
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
            scrolling="no"
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

      <div className="video-info">
        <div className="video-info-head">
          <span className="pr-label">PR</span>
          <a
            className="product-mini-button"
            href={destinationUrl}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={onProductClick}
          >
            商品詳細
          </a>
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
