/**
 * The address family (STREET, ADDRESS, CITY, ...) is searched under BASIC_INFO:
 * those names are result types, not capabilities.
 */
export type SearchCapability = "RECEPTOR" | "COORDINATE" | "ASSESSMENT_AREA" | "BASIC_INFO";

export interface SearchSuggestion {
  id: string;
  type: string;
  description: string;
  centroid?: string;
  geometry?: string;
  bbox?: string;
  score: number;
}

export interface SearchResult {
  complete: boolean;
  results: SearchSuggestion[];
  uuid: string;
}

export type SearchFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface SearchConfig {
  endpoint: string;
  capabilities: SearchCapability[];
  region: string;
  fetcher?: SearchFetcher;
}
