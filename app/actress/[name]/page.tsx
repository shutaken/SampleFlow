import Feed from "@/components/Feed";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    name: string;
  }>;
};

export default async function ActressFeedPage({ params }: PageProps) {
  const { name } = await params;
  const actressName = decodeURIComponent(name);

  return (
    <Feed
      actressName={actressName}
      showGenreChips
      titlePrefix={actressName}
    />
  );
}
