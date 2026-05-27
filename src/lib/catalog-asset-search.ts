import { prisma } from "@/lib/prisma";
import { isPrismaMissingTable } from "@/lib/prisma-errors";

export type CatalogAssetSearchHit = {
  id: string;
  name: string;
  slug: string;
  client: { id: string; companyName: string };
};

export type CatalogAssetSearchResult = {
  items: CatalogAssetSearchHit[];
  schemaGap: boolean;
};

export async function searchCatalogAssets(q: string): Promise<CatalogAssetSearchResult> {
  try {
    const items = await prisma.asset.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 25,
      orderBy: { name: "asc" },
      include: { client: { select: { id: true, companyName: true } } },
    });
    return { items, schemaGap: false };
  } catch (error) {
    if (isPrismaMissingTable(error, "Asset")) {
      return { items: [], schemaGap: true };
    }
    throw error;
  }
}
