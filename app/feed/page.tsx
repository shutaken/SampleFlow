import Feed from "@/components/Feed";
import { supabase } from "@/lib/supabaseClient";
import type { AdCard, FeedVideo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const { data: videos, error } = await supabase
    .from("feed_videos")
    .select("*")
    .contains("genres", ["巨乳"])
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(70);

  if (error) console.error(error);

  const { data: adCards } = await supabase
    .from("ad_cards")
    .select("*")
    .eq("placement", "feed_every_7")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .limit(10);

  return <Feed videos={(videos ?? []) as FeedVideo[]} adCards={(adCards ?? []) as AdCard[]} />;
}
