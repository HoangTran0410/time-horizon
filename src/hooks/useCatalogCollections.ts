import { useEffect, useState } from "react";
import type { EventCollectionMeta } from "../constants/types";

// const DATA_BASE_URL = "https://hoangtran99.is-a.dev/time-horizon-data";
const DATA_BASE_URL = "http://localhost:5500/data"; // live server dev mode

/** Load catalog collection metadata (works in both dev and production). */
export const useCatalogCollections = () => {
  const [catalogCollections, setCatalogCollections] = useState<
    EventCollectionMeta[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(
          `${DATA_BASE_URL}/collections-metadata.json`,
        );
        if (!response.ok) {
          throw new Error(
            `Failed to load catalog metadata: ${response.status}`,
          );
        }
        const data = (await response.json()) as EventCollectionMeta[];
        if (!cancelled) setCatalogCollections(data);
      } catch (error) {
        console.error("[useCatalogCollections]", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogCollections, isCatalogLoading: isLoading };
};

/** Load events for a catalog collection by dataUrl string. */
export const loadCatalogByUrl = async (dataUrl: string): Promise<unknown> => {
  // dataUrl is a relative path like "/collections/cosmic.json"
  const url = dataUrl.startsWith("/")
    ? `${DATA_BASE_URL}${dataUrl}`
    : `${DATA_BASE_URL}/${dataUrl}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load collection: ${url}`);
  }
  return response.json();
};
