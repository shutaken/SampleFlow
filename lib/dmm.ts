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

export function normalizeDmmItem(item: DmmItem): NormalizedDmmVideo | null {
  const providerContentId = item.content_id;
  const title = item.title;
  const affiliateUrl = item.affiliateURL;
  const sampleMovieUrl = pickSampleMovieUrl(item.sampleMovieURL);

  if (!providerContentId || !title || !affiliateUrl || !sampleMovieUrl) return null;

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
    hasSample: true,
    reviewAverage: item.review?.average ? Number(item.review.average) : null,
    reviewCount: item.review?.count ? Number(item.review.count) : 0,
    maker,
    genres: item.iteminfo?.genre?.map((g) => ({ id: g.id ?? null, name: g.name ?? "" })).filter((g) => g.name) ?? [],
    actresses: item.iteminfo?.actress?.map((a) => ({ id: a.id ?? null, name: a.name ?? "", ruby: a.ruby ?? null })).filter((a) => a.name) ?? [],
    raw: item,
  };
}

export async function fetchFanzaNewVideos() {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error("DMM_API_ID and DMM_AFFILIATE_ID are required.");
  }

  const url = new URL("https://api.dmm.com/affiliate/v3/ItemList");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", "FANZA");
  url.searchParams.set("service", "digital");
  url.searchParams.set("floor", "videoa");
  url.searchParams.set("hits", "100");
  url.searchParams.set("sort", "date");
  url.searchParams.set("keyword", "巨乳");
  url.searchParams.set("output", "json");

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`DMM API request failed: ${response.status}`);

  const json = await response.json();
  const items: DmmItem[] = json?.result?.items ?? [];

  return {
    requestUrl: url.toString().replace(apiId, "***").replace(affiliateId, "***"),
    items: items.map(normalizeDmmItem).filter(Boolean) as NormalizedDmmVideo[],
    rawCount: items.length,
  };
}
