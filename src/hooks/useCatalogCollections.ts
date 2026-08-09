import { useEffect, useState } from "react";
import type {
  CollectionGroupDefinition,
  EventCollectionMeta,
} from "../constants/types";
import { sanitizeCollectionGroupDefinitions } from "../helpers/collectionGroups";

const DATA_BASE_URL =
  // @ts-ignore — `env` is injected by Vite; guard so the module can also be
  // imported outside a Vite build (scripts, tests).
  import.meta.env?.DEV
    ? "http://localhost:5500/data"
    : "https://hoangtran99.is-a.dev/time-horizon-data";

/** Load catalog collection metadata (works in both dev and production). */
export const useCatalogCollections = () => {
  const [catalogCollections, setCatalogCollections] = useState<
    EventCollectionMeta[]
  >([]);
  const [catalogGroups, setCatalogGroups] = useState<
    CollectionGroupDefinition[]
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

    /**
     * Topical folders for the catalog. Optional by design: a data repo that
     * does not ship the file (or a failed fetch) just means no grouping, so
     * this must never gate `isLoading`.
     */
    const loadGroups = async () => {
      try {
        const response = await fetch(`${DATA_BASE_URL}/collection-groups.json`);
        if (!response.ok) return;
        const data = sanitizeCollectionGroupDefinitions(await response.json());
        if (!cancelled) setCatalogGroups(data);
      } catch (error) {
        console.error("[useCatalogCollections] groups", error);
      }
    };

    void load();
    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogCollections, catalogGroups, isCatalogLoading: isLoading };
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
