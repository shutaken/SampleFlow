type DmmItem = {
  content_id?: string;
  product_id?: string;
  title?: string;
  URL?: string;
  affiliateURL?: string;
  date?: string;
  volume?: string;
  review?: { average?: string; count?: string };
  imageURL?: { large?: string; small?: string; list?: string };
  sampleMovieURL?: Record<string, string>;
  iteminfo?: {
    genre?: Array<{ id?: string; name?: string }>;
    actress?: Array<{ id?: string; name?: string; ruby?: string }>;
    maker?: Array<{ id?: string; name?: string }>;
  };
};

type DmmItemListResponse = {
  result?: {
    status?: number;
    result_count?: number;
    total_count?: number;
    first_position?: number;
    items?: DmmItem[];
  };
};

export type NormalizedDmmVideo = {
  providerContentId: string;
  productId: string | null;
  title: string;
  affiliateUrl: string;
  productUrl: string | null;
  releaseDate: string | null;
  packageImageUrl: string | null;
  thumbnailUrl: string | null;
  listImageUrl: string | null;
  sampleMovieUrl: string | null;
  hasSample: boolean;
  reviewAverage: number | null;
  reviewCount: number;
  maker: { id: string | null; name: string } | null;
  genres: Array<{ id: string | null; name: string }>;
  actresses: Array<{ id: string | null; name: string; ruby: string | null }>;
  raw: DmmItem;
};

export type FanzaFetchParams = {
  keyword?: string;
  cid?: string;
  hits?: number;
  offset?: number;
  sort?: "date" | "rank" | "price" | "review";
};

export type FanzaFetchResult = {
  requestUrl: string;
  responseStatus: number;
  responseMs: number;
  rawCount: number;
  totalCount: number;
  items: NormalizedDmmVideo[];
};

function clampHits(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 100;
  return Math.min(Math.max(Math.floor(value), 1), 100);
}

function pickSampleMovieUrl(sampleMovieURL?: Record<string, string>) {
  if (!sampleMovieURL) return null;
  return (
    sampleMovieURL.size_720_480 ||
    sampleMovieURL.size_644_414 ||
    sampleMovieURL.size_560_360 ||
    sampleMovieURL.size_476_306 ||
    Object.values(sampleMovieURL).find(Boolean) ||
    null
  );
}

function toNumber(value: string | undefined) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function maskUrl(url: URL, apiId: string, affiliateId: string) {
  return url.toString().replace(apiId, "***").replace(affiliateId, "***");
}

export function normalizeDmmItem(item: DmmItem): NormalizedDmmVideo | null {
  const providerContentId = item.content_id;
  const title = item.title;
  const affiliateUrl = item.affiliateURL;
  const sampleMovieUrl = pickSampleMovieUrl(item.sampleMovieURL);

  if (!providerContentId || !title || !affiliateUrl) return null;

  const maker = item.iteminfo?.maker?.[0]?.name
    ? { id: item.iteminfo.maker[0].id ?? null, name: item.iteminfo.maker[0].name! }
    : null;

  return {
    providerContentId,
    productId: item.product_id ?? null,
    title,
    affiliateUrl,
    productUrl: item.URL ?? null,
    releaseDate: item.date ? item.date.slice(0, 10) : null,
    packageImageUrl: item.imageURL?.large ?? null,
    thumbnailUrl: item.imageURL?.small ?? null,
    listImageUrl: item.imageURL?.list ?? null,
    sampleMovieUrl,
    hasSample: Boolean(sampleMovieUrl),
    reviewAverage: toNumber(item.review?.average),
    reviewCount: toNumber(item.review?.count) ?? 0,
    maker,
    genres:
      item.iteminfo?.genre
        ?.map((g) => ({ id: g.id ?? null, name: g.name ?? "" }))
        .filter((g) => g.name) ?? [],
    actresses:
      item.iteminfo?.actress
        ?.map((a) => ({ id: a.id ?? null, name: a.name ?? "", ruby: a.ruby ?? null }))
        .filter((a) => a.name) ?? [],
    raw: item,
  };
}

export function getDailyFetchGenres() {
  const raw = process.env.DMM_DAILY_FETCH_GENRES || "巨乳,新人,制服,人妻,VR,フェチ";
  return raw
    .split(/[、,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function fetchFanzaItemList(params: FanzaFetchParams = {}): Promise<FanzaFetchResult> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error("DMM_API_ID and DMM_AFFILIATE_ID are required.");
  }

  const started = Date.now();
  const url = new URL("https://api.dmm.com/affiliate/v3/ItemList");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", "FANZA");
  url.searchParams.set("service", "digital");
  url.searchParams.set("floor", "videoa");
  url.searchParams.set("hits", String(clampHits(params.hits)));
  url.searchParams.set("sort", params.sort ?? "date");
  url.searchParams.set("output", "json");

  if (params.offset && params.offset > 1) {
    url.searchParams.set("offset", String(Math.floor(params.offset)));
  }

  if (params.keyword) {
    url.searchParams.set("keyword", params.keyword);
  }

  if (params.cid) {
    url.searchParams.set("cid", params.cid);
  }

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const responseMs = Date.now() - started;

  if (!response.ok) {
    throw new Error(`DMM API request failed: ${response.status}`);
  }

  const json = (await response.json()) as DmmItemListResponse;
  const items = json?.result?.items ?? [];

  return {
    requestUrl: maskUrl(url, apiId, affiliateId),
    responseStatus: json?.result?.status ?? response.status,
    responseMs,
    rawCount: items.length,
    totalCount: json?.result?.total_count ?? items.length,
    items: items.map(normalizeDmmItem).filter(Boolean) as NormalizedDmmVideo[],
  };
}

export async function fetchFanzaNewVideos(keyword = "巨乳", hits = 100) {
  return fetchFanzaItemList({ keyword, hits, sort: "date" });
}

export async function fetchFanzaVideoByCid(cid: string) {
  return fetchFanzaItemList({ cid, hits: 1, sort: "date" });
}
