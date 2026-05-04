"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const AGE_GATE_KEY = "sample_flow_age_verified";

export default function AgeGate() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const verified = window.localStorage.getItem(AGE_GATE_KEY);
    if (verified === "true") router.replace("/feed");
    else setChecked(true);
  }, [router]);

  async function sendEvent(eventType: "age_gate_accept" | "age_gate_reject") {
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType, metadata: { page: "age_gate" } }),
      });
    } catch {}
  }

  async function accept() {
    window.localStorage.setItem(AGE_GATE_KEY, "true");
    await sendEvent("age_gate_accept");
    router.push("/feed");
  }

  async function reject() {
    await sendEvent("age_gate_reject");
    window.location.href = "https://www.google.co.jp/";
  }

  if (!checked) return null;

  return (
    <main className="age-page">
      <section className="age-card">
        <p className="pr-label">PR / Affiliate</p>
        <h1 className="brand">Sample Flow</h1>
        <p className="muted">
          このサイトは成人向けコンテンツを扱うアフィリエイトサイトです。
          18歳未満の方は利用できません。
        </p>
        <div className="button-stack">
          <button className="primary-button" onClick={accept}>18歳以上です</button>
          <button className="secondary-button" onClick={reject}>退出する</button>
        </div>
        <p className="footer-note">
          当サイトはアフィリエイト広告を利用しています。掲載情報は公式提供情報をもとにし、
          動画ファイルの保存・編集・再配信は行いません。
        </p>
      </section>
    </main>
  );
}
