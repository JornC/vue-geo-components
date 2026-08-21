import type { SearchConfig, SearchFetcher, SearchResult, SearchSuggestion } from "./searchTypes";

export interface SearchService {
  /** Start a search; resolves with partial results and a uuid to poll. */
  startSearchQuery(query: string, signal?: AbortSignal): Promise<SearchResult>;
  /** Fetch the (possibly completed) result set for a started search. */
  retrieveResults(uuid: string, signal?: AbortSignal): Promise<SearchResult>;
}

class SearchRequestError extends Error {}

class InvalidSearchResponseError extends Error {}

const defaultFetcher: SearchFetcher = (url, init) => fetch(url, init);

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}

function isOptionalString(candidate: unknown): candidate is string | null | undefined {
  return candidate === undefined || candidate === null || typeof candidate === "string";
}

function parseSuggestion(candidate: unknown, index: number, path: string): SearchSuggestion {
  if (!isRecord(candidate)) {
    throw new InvalidSearchResponseError(`Search response ${path} contains an invalid suggestion at index ${index}`);
  }
  const { id, type, description, score, centroid, geometry, bbox } = candidate;
  const hasRequiredFields =
    typeof id === "string" && typeof type === "string" && typeof description === "string" && typeof score === "number" && Number.isFinite(score);
  if (!hasRequiredFields || !isOptionalString(centroid) || !isOptionalString(geometry) || !isOptionalString(bbox)) {
    throw new InvalidSearchResponseError(`Search response ${path} contains an invalid suggestion at index ${index}`);
  }
  return {
    id,
    type,
    description,
    score,
    centroid: centroid ?? undefined,
    geometry: geometry ?? undefined,
    bbox: bbox ?? undefined,
  };
}

function parseSearchResponse(candidate: unknown, path: string): SearchResult {
  if (!isRecord(candidate)) {
    throw new InvalidSearchResponseError(`Search response ${path} is not an object`);
  }
  const { complete, results, uuid } = candidate;
  if (typeof complete !== "boolean" || !Array.isArray(results) || typeof uuid !== "string") {
    throw new InvalidSearchResponseError(`Search response ${path} has an invalid result envelope`);
  }
  return { complete, uuid, results: results.map((suggestion, index) => parseSuggestion(suggestion, index, path)) };
}

async function readSearchResponse(response: Response, path: string): Promise<SearchResult> {
  try {
    return parseSearchResponse(await response.json(), path);
  } catch (error) {
    if (error instanceof InvalidSearchResponseError) {
      throw error;
    }
    throw new InvalidSearchResponseError(`Search response ${path} is not valid JSON`, { cause: error });
  }
}

/**
 * Client for the two-phase search REST service: `search-async` returns
 * partial results plus a uuid to poll, `results/:uuid` until `complete`.
 */
export function createSearchService(config: SearchConfig): SearchService {
  const capabilities = config.capabilities.join(",");
  const fetcher = config.fetcher ?? defaultFetcher;

  async function request(path: string, signal?: AbortSignal): Promise<SearchResult> {
    const response = await fetcher(`${config.endpoint}${path}`, signal ? { signal } : undefined);
    if (!response.ok) {
      throw new SearchRequestError(`Search request ${path} failed: ${response.status} ${response.statusText}`);
    }
    return readSearchResponse(response, path);
  }

  return {
    startSearchQuery(query: string, signal?: AbortSignal) {
      // The calculator scrubs backslashes the same way.
      const params = new URLSearchParams({
        query: query.replace(/\\/g, ""),
        region: config.region,
      });
      // The service expects the capability list as literal commas; URLSearchParams would percent-encode them.
      return request(`/search-async?${params.toString()}&capabilities=${capabilities}`, signal);
    },
    retrieveResults(uuid: string, signal?: AbortSignal) {
      return request(`/results/${encodeURIComponent(uuid)}`, signal);
    },
  };
}
