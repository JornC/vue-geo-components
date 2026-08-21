import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";

import type { SearchService } from "./searchService";
import type { SearchSuggestion } from "./searchTypes";

const START_SEARCH_DELAY = 500;
const POLL_DELAY = 250;
const DEFAULT_SEARCH_TIMEOUT_MILLISECONDS = 30_000;

export interface MapSearchOptions {
  timeoutMilliseconds?: number;
}

class InvalidSearchTimeoutError extends Error {}

type ActiveSearch = {
  version: number;
  controller: AbortController;
};

export interface MapSearch {
  query: Ref<string>;
  groupedResults: ComputedRef<Map<string, SearchSuggestion[]>>;
  searching: Ref<boolean>;
  hasQuery: ComputedRef<boolean>;
  noResults: ComputedRef<boolean>;
  /** A failed search is never shown as no-results. */
  error: Ref<boolean>;
  clear(): void;
}

function searchTimeoutMillisecondsFor(options: MapSearchOptions): number {
  const timeout = options.timeoutMilliseconds ?? DEFAULT_SEARCH_TIMEOUT_MILLISECONDS;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new InvalidSearchTimeoutError(`Search timeout must be a positive number, received ${timeout}`);
  }
  return timeout;
}

/**
 * Debounced, race-guarded search state over the two-phase service.
 * Port of the calculator's SearchDaemonAsynchronous + SearchContext.
 */
export function useMapSearch(service: SearchService, options: MapSearchOptions = {}): MapSearch {
  const searchTimeoutMilliseconds = searchTimeoutMillisecondsFor(options);
  const query = ref("");
  const searching = ref(false);
  const error = ref(false);
  const results = ref<SearchSuggestion[]>([]);

  const hasQuery = computed(() => query.value.trim().length > 0);
  const noResults = computed(() => hasQuery.value && !searching.value && !error.value && results.value.length === 0);

  const groupedResults = computed(() => {
    const grouped = new Map<string, SearchSuggestion[]>();
    for (const suggestion of results.value) {
      const bucket = grouped.get(suggestion.type) ?? [];
      bucket.push(suggestion);
      grouped.set(suggestion.type, bucket);
    }
    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => b.score - a.score);
    }
    return grouped;
  });

  let searchVersion = 0;
  let requestController: AbortController | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelTimers() {
    if (startTimer !== undefined) clearTimeout(startTimer);
    if (pollTimer !== undefined) clearTimeout(pollTimer);
    if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
    startTimer = undefined;
    pollTimer = undefined;
    timeoutTimer = undefined;
  }

  function isActive(activeSearch: ActiveSearch): boolean {
    return activeSearch.version === searchVersion;
  }

  function cancelActiveSearch() {
    searchVersion++;
    cancelTimers();
    requestController?.abort();
    requestController = undefined;
  }

  function completeSearch(activeSearch: ActiveSearch) {
    if (!isActive(activeSearch)) return;
    cancelTimers();
    requestController = undefined;
    searching.value = false;
  }

  function failInitialSearch(activeSearch: ActiveSearch) {
    if (!isActive(activeSearch)) return;
    cancelTimers();
    requestController = undefined;
    results.value = [];
    searching.value = false;
    error.value = true;
  }

  function failPolling(activeSearch: ActiveSearch) {
    if (!isActive(activeSearch)) return;
    cancelTimers();
    requestController = undefined;
    searching.value = false;
    error.value = true;
  }

  function expireSearch(activeSearch: ActiveSearch) {
    if (!isActive(activeSearch)) return;
    searchVersion++;
    cancelTimers();
    activeSearch.controller.abort();
    requestController = undefined;
    searching.value = false;
    error.value = true;
  }

  async function poll(uuid: string, activeSearch: ActiveSearch) {
    try {
      const next = await service.retrieveResults(uuid, activeSearch.controller.signal);
      if (!isActive(activeSearch)) return;
      results.value = next.results;
      if (next.complete) {
        completeSearch(activeSearch);
        return;
      }
      pollTimer = setTimeout(() => poll(uuid, activeSearch), POLL_DELAY);
    } catch {
      failPolling(activeSearch);
    }
  }

  async function startSearch(searchQuery: string, activeSearch: ActiveSearch) {
    timeoutTimer = setTimeout(() => expireSearch(activeSearch), searchTimeoutMilliseconds);
    try {
      const initial = await service.startSearchQuery(searchQuery, activeSearch.controller.signal);
      if (!isActive(activeSearch)) return;
      results.value = initial.results;
      if (initial.complete) {
        completeSearch(activeSearch);
        return;
      }
      pollTimer = setTimeout(() => poll(initial.uuid, activeSearch), POLL_DELAY);
    } catch {
      failInitialSearch(activeSearch);
    }
  }

  function resetSearch() {
    results.value = [];
    searching.value = false;
    error.value = false;
  }

  function queueSearch(searchQuery: string) {
    cancelActiveSearch();
    if (!searchQuery.trim()) {
      resetSearch();
      return;
    }
    searching.value = true;
    error.value = false;
    requestController = new AbortController();
    const activeSearch = { version: searchVersion, controller: requestController };
    startTimer = setTimeout(() => startSearch(searchQuery, activeSearch), START_SEARCH_DELAY);
  }

  function clear() {
    cancelActiveSearch();
    resetSearch();
    if (query.value !== "") {
      query.value = "";
    }
  }

  watch(query, queueSearch);

  onScopeDispose(cancelActiveSearch);

  return { query, groupedResults, searching, hasQuery, noResults, error, clear };
}
