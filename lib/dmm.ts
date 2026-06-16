type DmmItemInfoValue = {
  id?: number | string;
  name?: string;
  ruby?: string;
};

type DmmItem = {
  content_id?: string;
  product_id?: string;
  title?: string;
  URL?: string;
  affiliateURL?: string;
  date?: string;
  review?: {
    average?: string;
    count?: number;
  };
  imageURL?: {
    list?: string;
    small?: string;
    large?: string;
  };
  sampleImageURL?: {
    sample_s?: {
      image?: string[];
    };
  };
  sampleMovieURL?: {
    size_476_306?: string;
    size_560_360?: string;
    size_644_414?: string;
    size_720_480?: string;
    pc_flag?: number;
    sp_flag?: number;
  };
  iteminfo?: {
    actress?: DmmItemInfoValue[];
    genre?: DmmItemInfoValue[];
    maker?: DmmItemInfoValue[];
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
  productUrl: string | null;
  affiliateUrl: string;
  releaseDate: string | null;
  packageImageUrl: string | null;
  thumbnailUrl: string | null;
  listImageUrl: string | null;
  sampleMovieUrl: string | null;
  hasSample: boolean;
  reviewAverage: number | null;
  reviewCount: number;
  maker: { id: string | null; name: string } | null;
  actresses: Array<{ id: string | null; name: string; ruby: string | null }>;
  genres: Array<{ id: string | null; name: string }>;
  raw: DmmItem;
};

type FetchItemListOptions = {
  keyword?: string;
  cid?: string;
  hits?: number;
  sort?: "date" | "rank" | "review";
};

const API_BASE = "https://api.dmm.com/affiliate/v3/ItemList";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function getApiAffiliateId() {
  return optionalEnv("DMM_API_AFFILIATE_ID") ?? requiredEnv("DMM_AFFILIATE_ID");
}

function getDisplayAffiliateId() {
  return optionalEnv("DMM_DISPLAY_AFFILIATE_ID") ?? getApiAffiliateId();
}

function normalizeAffiliateUrl(url: string | undefined | null) {
  if (!url) return "";

  const apiAffiliateId = getApiAffiliateId();
  const displayAffiliateId = getDisplayAffiliateId();

  if (!displayAffiliateId || apiAffiliateId === displayAffiliateId) return url;

  return url.split(apiAffiliateId).join(displayAffiliateId);
}

function normalizeDate(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function normalizeItem(item: DmmItem): NormalizedDmmVideo | null {
  const providerContentId = item.content_id;
  if (!providerContentId || !item.title) return null;

  const movie =
    item.sampleMovieURL?.size_720_480 ??
    item.sampleMovieURL?.size_644_414 ??
    item.sampleMovieURL?.size_560_360 ??
    item.sampleMovieURL?.size_476_306 ??
    null;

  const maker = item.iteminfo?.maker?.[0]?.name
    ? {
        id: item.iteminfo.maker[0].id ? String(item.iteminfo.maker[0].id) : null,
        name: item.iteminfo.maker[0].name,
      }
    : null;

  return {
    providerContentId,
    productId: item.product_id ?? providerContentId,
    title: item.title,
    productUrl: item.URL ?? null,
    affiliateUrl: normalizeAffiliateUrl(item.affiliateURL) || item.URL || "",
    releaseDate: normalizeDate(item.date),
    packageImageUrl: item.imageURL?.large ?? null,
    thumbnailUrl: item.imageURL?.small ?? item.imageURL?.list ?? null,
    listImageUrl: item.imageURL?.list ?? null,
    sampleMovieUrl: movie,
    hasSample: Boolean(movie),
    reviewAverage: item.review?.average ? Number(item.review.average) : null,
    reviewCount: item.review?.count ?? 0,
    maker,
    actresses:
      item.iteminfo?.actress
        ?.filter((a) => a.name)
        .map((a) => ({
          id: a.id ? String(a.id) : null,
          name: a.name as string,
          ruby: a.ruby ?? null,
        })) ?? [],
    genres:
      item.iteminfo?.genre
        ?.filter((g) => g.name)
        .map((g) => ({
          id: g.id ? String(g.id) : null,
          name: g.name as string,
        })) ?? [],
    raw: item,
  };
}

export function getDailyFetchGenres() {
  const raw = process.env.DMM_DAILY_FETCH_GENRES ?? "巨乳,新人,制服,人妻,VR,フェチ";
  return raw
    .split(/[、,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function fetchFanzaItemList(options: FetchItemListOptions = {}) {
  const started = Date.now();
  const apiId = requiredEnv("DMM_API_ID");
  const affiliateId = getApiAffiliateId();

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    site: "FANZA",
    service: "digital",
    floor: "videoa",
    output: "json",
    sort: options.sort ?? "date",
    hits: String(Math.min(Math.max(options.hits ?? 50, 1), 100)),
  });

  if (options.keyword) params.set("keyword", options.keyword);
  if (options.cid) params.set("cid", options.cid);

  const response = await fetch(`${API_BASE}?${params.toString()}`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const responseMs = Date.now() - started;
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`DMM API error ${response.status}: ${text.slice(0, 500)}`);
  }

  const json = JSON.parse(text) as DmmItemListResponse;
  const items = (json.result?.items ?? [])
    .map(normalizeItem)
    .filter((item): item is NormalizedDmmVideo => item !== null);

  return {
    responseMs,
    rawCount: json.result?.result_count ?? items.length,
    totalCount: json.result?.total_count ?? items.length,
    items,
  };
}

export function fetchFanzaVideoByCid(cid: string) {
  return fetchFanzaItemList({ cid, hits: 1, sort: "date" });
}
