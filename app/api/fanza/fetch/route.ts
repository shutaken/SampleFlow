import { NextRequest, NextResponse } from "next/server";
import {
  fetchFanzaItemList,
  fetchFanzaVideoByCid,
  getDailyFetchGenres,
  type NormalizedDmmVideo,
} from "@/lib/dmm";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type JobStats = {
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  requestCount: number;
  missingCount: number;
  hiddenCount: number;
  responseMsTotal: number;
};

type ExistingVideo = {
  id: string;
  fetched_at: string | null;
  api_missing_count: number | null;
};

const DEFAULT_REFRESH_LIMIT = 50;

function getHideAfterMissingCount() {
  const parsed = Number.parseInt(process.env.DMM_MISSING_HIDE_THRESHOLD ?? "3", 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 1) : 3;
}

function slugifyGenre(name: string) {
  const fixed: Record<string, string> = {
    巨乳: "big-bust",
    新人: "newcomer",
    制服: "uniform",
    人妻: "married-woman",
    VR: "vr",
    フェチ: "fetish",
    単体作品: "solo",
    美少女: "pretty-girl",
    熟女: "mature",
    コスプレ: "cosplay",
    企画: "planning",
    素人: "amateur",
  };

  return fixed[name] ?? `genre-${Buffer.from(name).toString("hex").slice(0, 24)}`;
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  return headerSecret === expected || querySecret === expected || bearer === expected;
}

function parseCsv(value: string | null) {
  if (!value) return [];
  return value
    .split(/[、,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntParam(value: string | null, fallback: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

function createStats(): JobStats {
  return {
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    requestCount: 0,
    missingCount: 0,
    hiddenCount: 0,
    responseMsTotal: 0,
  };
}

async function upsertVideo(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, item: NormalizedDmmVideo) {
  if (!item.hasSample || !item.sampleMovieUrl) {
    return { status: "skipped" as const, reason: "no_sample" };
  }

  const now = new Date().toISOString();

  const existingResult = await supabaseAdmin
    .from("videos")
    .select("id, fetched_at, api_missing_count")
    .eq("provider", "fanza")
    .eq("provider_content_id", item.providerContentId)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;

  const existing = existingResult.data as ExistingVideo | null;

  let makerId: string | null = null;
  if (item.maker?.name) {
    const makerUpsert = await supabaseAdmin
      .from("makers")
      .upsert(
        {
          provider: "fanza",
          provider_maker_id: item.maker.id,
          name: item.maker.name,
          is_active: true,
        },
        { onConflict: "provider,name" }
      )
      .select("id")
      .single();

    if (makerUpsert.error) throw makerUpsert.error;
    makerId = (makerUpsert.data?.id as string | undefined) ?? null;
  }

  const videoUpsert = await supabaseAdmin
    .from("videos")
    .upsert(
      {
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
        compliance_checked: true,
        last_api_checked_at: now,
        api_missing_count: 0,
        source_type: existing ? "api_updated" : "api",
        fetched_at: existing?.fetched_at ?? now,
      },
      { onConflict: "provider,provider_content_id" }
    )
    .select("id")
    .single();

  if (videoUpsert.error) throw videoUpsert.error;

  const videoId = videoUpsert.data?.id as string | undefined;
  if (!videoId) return { status: "skipped" as const, reason: "no_video_id" };

  await supabaseAdmin.from("video_genres").delete().eq("video_id", videoId);
  await supabaseAdmin.from("video_actresses").delete().eq("video_id", videoId);

  for (const genre of item.genres) {
    if (!genre.name) continue;
    const genreUpsert = await supabaseAdmin
      .from("genres")
      .upsert(
        {
          provider: "fanza",
          provider_genre_id: genre.id,
          name: genre.name,
          slug: slugifyGenre(genre.name),
          is_active: true,
          is_mvp: ["巨乳", "新人", "制服", "人妻", "VR", "フェチ"].includes(genre.name),
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (genreUpsert.error) throw genreUpsert.error;
    const genreId = genreUpsert.data?.id as string | undefined;
    if (genreId) {
      const relation = await supabaseAdmin
        .from("video_genres")
        .upsert({ video_id: videoId, genre_id: genreId });
      if (relation.error) throw relation.error;
    }
  }

  for (const actress of item.actresses) {
    if (!actress.name) continue;
    const actressUpsert = await supabaseAdmin
      .from("actresses")
      .upsert(
        {
          provider: "fanza",
          provider_actress_id: actress.id,
          name: actress.name,
          name_kana: actress.ruby,
          is_active: true,
        },
        { onConflict: "provider,name" }
      )
      .select("id")
      .single();

    if (actressUpsert.error) throw actressUpsert.error;
    const actressId = actressUpsert.data?.id as string | undefined;
    if (actressId) {
      const relation = await supabaseAdmin
        .from("video_actresses")
        .upsert({ video_id: videoId, actress_id: actressId });
      if (relation.error) throw relation.error;
    }
  }

  return { status: existing ? ("updated" as const) : ("inserted" as const), videoId };
}

async function fetchNewArrivals(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  stats: JobStats,
  genres: string[],
  hitsPerGenre: number
) {
  const seen = new Set<string>();

  for (const genre of genres) {
    const result = await fetchFanzaItemList({ keyword: genre, hits: hitsPerGenre, sort: "date" });
    stats.requestCount += 1;
    stats.fetchedCount += result.rawCount;
    stats.responseMsTotal += result.responseMs;

    for (const item of result.items) {
      if (seen.has(item.providerContentId)) continue;
      seen.add(item.providerContentId);

      const upserted = await upsertVideo(supabaseAdmin, item);
      if (upserted.status === "inserted") stats.insertedCount += 1;
      if (upserted.status === "updated") stats.updatedCount += 1;
      if (upserted.status === "skipped") stats.skippedCount += 1;
    }
  }
}

async function refreshExistingVideos(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  stats: JobStats,
  limit: number
) {
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("id, provider_content_id, api_missing_count")
    .eq("provider", "fanza")
    .eq("is_active", true)
    .order("last_api_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw error;

  for (const row of data ?? []) {
    const cid = row.provider_content_id as string;
    const result = await fetchFanzaVideoByCid(cid);
    stats.requestCount += 1;
    stats.responseMsTotal += result.responseMs;

    const item = result.items.find((v) => v.providerContentId === cid);

    if (item) {
      const upserted = await upsertVideo(supabaseAdmin, item);
      if (upserted.status === "inserted") stats.insertedCount += 1;
      if (upserted.status === "updated") stats.updatedCount += 1;
      if (upserted.status === "skipped") stats.skippedCount += 1;
      continue;
    }

    stats.missingCount += 1;
    const nextMissingCount = ((row.api_missing_count as number | null) ?? 0) + 1;
    const shouldHide = nextMissingCount >= getHideAfterMissingCount();
    const updatePayload: Record<string, unknown> = {
      last_api_checked_at: new Date().toISOString(),
      api_missing_count: nextMissingCount,
    };

    if (shouldHide) updatePayload.is_hidden = true;

    const updateResult = await supabaseAdmin
      .from("videos")
      .update(updatePayload)
      .eq("id", row.id);

    if (updateResult.error) throw updateResult.error;
    if (shouldHide) stats.hiddenCount += 1;
  }
}

async function runFetchJob(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const stats = createStats();
  const mode = request.nextUrl.searchParams.get("mode") ?? "daily";
  const allowedModes = new Set(["daily", "new", "refresh"]);

  if (!allowedModes.has(mode)) {
    return NextResponse.json({ error: "Invalid mode. Use daily, new, or refresh." }, { status: 400 });
  }

  const genres = parseCsv(request.nextUrl.searchParams.get("genres"));
  const targetGenres = genres.length ? genres : getDailyFetchGenres();
  const hitsPerGenre = parseIntParam(
    request.nextUrl.searchParams.get("hitsPerGenre"),
    Number.parseInt(process.env.DMM_DAILY_HITS_PER_GENRE ?? "50", 10),
    100
  );
  const refreshLimit = parseIntParam(
    request.nextUrl.searchParams.get("refreshLimit"),
    Number.parseInt(process.env.DMM_DAILY_REFRESH_LIMIT ?? String(DEFAULT_REFRESH_LIMIT), 10),
    100
  );

  const requestParams = {
    mode,
    site: "FANZA",
    service: "digital",
    floor: "videoa",
    sort: "date",
    genres: targetGenres,
    hitsPerGenre,
    refreshLimit,
  };

  const logInsert = await supabaseAdmin
    .from("api_fetch_logs")
    .insert({
      provider: "fanza",
      job_name: "fanza_daily_api_sync",
      job_mode: mode,
      status: "running",
      request_params: requestParams,
      started_by: request.headers.get("user-agent") ?? "unknown",
    })
    .select("id")
    .single();

  const logId = logInsert.data?.id as string | undefined;

  try {
    if (mode === "new" || mode === "daily") {
      await fetchNewArrivals(supabaseAdmin, stats, targetGenres, hitsPerGenre);
    }

    if (mode === "refresh" || mode === "daily") {
      await refreshExistingVideos(supabaseAdmin, stats, refreshLimit);
    }

    if (logId) {
      await supabaseAdmin
        .from("api_fetch_logs")
        .update({
          status: "success",
          fetched_count: stats.fetchedCount,
          inserted_count: stats.insertedCount,
          updated_count: stats.updatedCount,
          skipped_count: stats.skippedCount,
          request_count: stats.requestCount,
          missing_count: stats.missingCount,
          hidden_count: stats.hiddenCount,
          response_ms: stats.responseMsTotal,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return NextResponse.json({ ok: true, mode, genres: targetGenres, ...stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (logId) {
      await supabaseAdmin
        .from("api_fetch_logs")
        .update({
          status: "error",
          fetched_count: stats.fetchedCount,
          inserted_count: stats.insertedCount,
          updated_count: stats.updatedCount,
          skipped_count: stats.skippedCount,
          request_count: stats.requestCount,
          missing_count: stats.missingCount,
          hidden_count: stats.hiddenCount,
          response_ms: stats.responseMsTotal,
          error_message: message,
          error_detail: {
            name: error instanceof Error ? error.name : "UnknownError",
            stack: error instanceof Error ? error.stack : null,
          },
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    console.error(error);
    return NextResponse.json({ error: message, ...stats }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return runFetchJob(request);
}

export async function GET(request: NextRequest) {
  return runFetchJob(request);
}
