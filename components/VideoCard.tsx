"use client";

import type { FeedVideo } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Props = {
  video: FeedVideo;
  sessionId: string;
};

function visibleItems(items: string[] | null | undefined) {
  if (!items || items.length === 0) return [];
  return items.filter(Boolean).slice(0, 5);
}

function hrefForActress(name: string) {
  return `/actress/${encodeURIComponent(name)}`;
}

function hrefForGenre(name: string) {
  return `/feed?genre=${encodeURIComponent(name)}`;
}

function extractIframeSrc(html: string | null | undefined) {
  if (!html) return null;
  const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
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
  const [showInfo, setShowInfo] = useState(false);

  const imageUrl =
    video.thumbnail_url || video.package_image_url || video.list_image_url || "";

  const iframeSrc = extractIframeSrc(video.sample_embed_html);
  const destinationUrl = video.affiliate_url || "#";

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
      setShowInfo(false);
      return;
    }

    setShowInfo(true);

    const timer = window.setTimeout(() => {
      setShowInfo(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isActive, video.id]);

  function revealInfo() {
    setShowInfo(true);
  }

  function hideInfoAfterDelay() {
    window.setTimeout(() => {
      setShowInfo(false);
    }, 1200);
  }

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
        {isActive && video.sample_movie_url ? (
          <video
            ref={videoRef}
            className="sample-video"
            src={video.sample_movie_url}
            poster={imageUrl}
            playsInline
            muted
            defaultMuted
            loop
            autoPlay
            preload="auto"
            onLoadedData={() => {
              videoRef.current?.play().catch(() => {
                // Browser autoplay restrictions can reject play(); ignore safely.
              });
            }}
            onEnded={() => void track("ended", sessionId, video.id)}
            controls
          />
        ) : isActive && iframeSrc ? (
          <iframe
            className="sample-iframe"
            src={iframeSrc}
            loading="eager"
            title={video.title}
            scrolling="no"
            allow="fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : imageUrl ? (
          <img className="poster-fallback" src={imageUrl} alt="" />
        ) : null}
      </div>

      <div className="video-gradient" />

      <button
        className="video-info-hover-zone"
        type="button"
        aria-label="商品詳細とタイトルを表示"
        onMouseEnter={revealInfo}
        onFocus={revealInfo}
        onTouchStart={revealInfo}
        onClick={revealInfo}
      />

      <div
        className={`video-info ${showInfo ? "is-visible" : ""}`}
        onMouseEnter={revealInfo}
        onMouseLeave={hideInfoAfterDelay}
        onFocus={revealInfo}
      >
        <div className="video-info-head">
          <a
            className="product-mini-button"
            href={destinationUrl}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={onProductClick}
          >
            続きを見る
          </a>
        </div>

        <h2 className="video-title">{video.title}</h2>

        <div className="meta meta-links" aria-label="女優名とジャンル">
          <div className="meta-link-row">
            {visibleItems(video.actresses).map((name) => (
              <a className="meta-link-chip" href={hrefForActress(name)} key={`actress-${name}`}>
                {name}
              </a>
            ))}
          </div>

          <div className="meta-link-row">
            {visibleItems(video.genres).map((name) => (
              <a className="meta-link-chip" href={hrefForGenre(name)} key={`genre-${name}`}>
                #{name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
