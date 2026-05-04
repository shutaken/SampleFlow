import { NextRequest, NextResponse } from "next/server";
import { fetchFanzaNewVideos } from "@/lib/dmm";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function slugifyGenre(name: string) {
  if (name === "巨乳") return "big-bust";
  return encodeURIComponent(name).toLowerCase();
}

function isAuthorized(request: NextRequest) {
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return headerSecret === process.env.CRON_SECRET || querySecret === process.env.CRON_SECRET;
}

async function runFetchJob(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();

  const logInsert = await supabaseAdmin.from("api_fetch_logs").insert({
    provider: "fanza",
    job_name: "fanza_new_big_bust_sample_fetch",
    status: "running",
    request_params: { site: "FANZA", service: "digital", floor: "videoa", sort: "date", keyword: "巨乳", has_sample: true },
  }).select("id").single();

  const logId = logInsert.data?.id as string | undefined;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    const result = await fetchFanzaNewVideos();

    for (const item of result.items) {
      if (!item.hasSample || !item.sampleMovieUrl) { skippedCount++; continue; }

      let makerId: string | null = null;
      if (item.maker?.name) {
        const makerUpsert = await supabaseAdmin.from("makers").upsert({
          provider: "fanza", provider_maker_id: item.maker.id, name: item.maker.name, is_active: true,
        }, { onConflict: "provider,name" }).select("id").single();
        makerId = (makerUpsert.data?.id as string | undefined) ?? null;
      }

      const videoUpsert = await supabaseAdmin.from("videos").upsert({
        provider: "fanza",
        provider_content_id: item.providerContentId,
        product_id: item.productId,
        content_id: item.providerContentId,
        floor: "videoa",
        title: item.title,
        maker_id: makerId,
        package_image_url: item.packageImageUrl,
        thumbnail_url: item.thumbnailUrl,
        list_image_url: item.listImageUrl,
        sample_movie_url: item.sampleMovieUrl,
        sample_embed_html: null,
        has_sample: true,
        affiliate_url: item.affiliateUrl,
        product_url: item.productUrl,
        release_date: item.releaseDate,
        review_average: item.reviewAverage,
        review_count: item.reviewCount,
        raw_json: item.raw,
        is_active: true,
        is_hidden: false,
        compliance_checked: false,
      }, { onConflict: "provider,provider_content_id" }).select("id").single();

      const videoId = videoUpsert.data?.id as string | undefined;
      if (!videoId) { skippedCount++; continue; }

      const genres = [...item.genres, { id: null, name: "巨乳" }].filter((g, index, arr) => g.name && arr.findIndex((x) => x.name === g.name) === index);
      for (const genre of genres) {
        const genreUpsert = await supabaseAdmin.from("genres").upsert({
          provider: "fanza", provider_genre_id: genre.id, name: genre.name, slug: slugifyGenre(genre.name), is_active: true, is_mvp: genre.name === "巨乳",
        }, { onConflict: "slug" }).select("id").single();
        const genreId = genreUpsert.data?.id as string | undefined;
        if (genreId) await supabaseAdmin.from("video_genres").upsert({ video_id: videoId, genre_id: genreId });
      }

      for (const actress of item.actresses) {
        const actressUpsert = await supabaseAdmin.from("actresses").upsert({
          provider: "fanza", provider_actress_id: actress.id, name: actress.name, name_kana: actress.ruby, is_active: true,
        }, { onConflict: "provider,name" }).select("id").single();
        const actressId = actressUpsert.data?.id as string | undefined;
        if (actressId) await supabaseAdmin.from("video_actresses").upsert({ video_id: videoId, actress_id: actressId });
      }
      updatedCount++;
    }

    if (logId) await supabaseAdmin.from("api_fetch_logs").update({
      status: "success", request_url: result.requestUrl, fetched_count: result.rawCount, updated_count: updatedCount, skipped_count: skippedCount, finished_at: new Date().toISOString(),
    }).eq("id", logId);

    return NextResponse.json({ ok: true, fetched: result.rawCount, updated: updatedCount, skipped: skippedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (logId) await supabaseAdmin.from("api_fetch_logs").update({ status: "error", error_message: message, updated_count: updatedCount, skipped_count: skippedCount, finished_at: new Date().toISOString() }).eq("id", logId);
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) { return runFetchJob(request); }
export async function GET(request: NextRequest) { return runFetchJob(request); }
