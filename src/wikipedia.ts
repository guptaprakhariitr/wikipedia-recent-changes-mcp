// Wikipedia / Wikidata client.
// Wikipedia REST: https://en.wikipedia.org/api/rest_v1/
// Action API:     https://en.wikipedia.org/w/api.php
// EventStreams:   https://stream.wikimedia.org/v2/stream/recentchange (SSE — not used here; we poll instead)

import { KvCache, stableKey } from "./cache";

export interface WikiEnv {
  CACHE: KVNamespace;
  WIKIPEDIA_REST: string;        // https://en.wikipedia.org/api/rest_v1
  WIKIPEDIA_ACTION: string;      // https://en.wikipedia.org/w/api.php
  WIKIDATA_BASE: string;         // https://www.wikidata.org/w/api.php
  USER_AGENT: string;
}

export interface RecentChange {
  type: "edit" | "new" | "log" | string;
  title: string;
  pageid?: number;
  rcid: number;
  user: string;
  bot: boolean;
  minor: boolean;
  timestamp: string;             // ISO
  comment?: string;
  oldlen?: number;
  newlen?: number;
  url: string;
}

export interface PageSummary {
  title: string;
  url: string;
  extract: string;
  thumbnail?: string;
  description?: string;
  last_modified?: string;
}

export interface TrendingPage {
  title: string;
  url: string;
  views: number;
  rank: number;
}

const POLITE = (ua: string) => ({ "User-Agent": ua, "Accept": "application/json" });

export class WikiClient {
  private cache: KvCache;
  constructor(private env: WikiEnv) { this.cache = new KvCache(env.CACHE, "wiki"); }

  /** Live recent edits feed (last N changes; default 50). */
  async recentChanges(opts: { limit?: number; namespace?: number; excludeBots?: boolean; topic?: string }): Promise<RecentChange[]> {
    const key = `rc:${stableKey(opts)}`;
    return this.cache.memoize(key, 60, async () => {
      const params = new URLSearchParams({
        action: "query",
        list: "recentchanges",
        format: "json",
        rcprop: "title|ids|user|timestamp|comment|sizes|flags",
        rclimit: String(Math.min(opts.limit ?? 50, 500)),
        rctoponly: "true",
      });
      if (typeof opts.namespace === "number") params.set("rcnamespace", String(opts.namespace));
      if (opts.excludeBots) params.set("rcshow", "!bot");
      const r = await fetch(`${this.env.WIKIPEDIA_ACTION}?${params}`, { headers: POLITE(this.env.USER_AGENT) });
      if (!r.ok) throw new Error(`Wikipedia recentchanges ${r.status}`);
      const j: any = await r.json();
      let changes: RecentChange[] = (j?.query?.recentchanges ?? []).map((c: any) => ({
        type: c.type, title: c.title, pageid: c.pageid, rcid: c.rcid,
        user: c.user, bot: !!c.bot, minor: !!c.minor,
        timestamp: c.timestamp, comment: c.comment,
        oldlen: c.oldlen, newlen: c.newlen,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}`,
      }));
      if (opts.topic) {
        const needle = opts.topic.toLowerCase();
        changes = changes.filter((c) => c.title.toLowerCase().includes(needle) || (c.comment ?? "").toLowerCase().includes(needle));
      }
      return changes;
    });
  }

  /** Get a clean summary of any Wikipedia article. */
  async pageSummary(title: string): Promise<PageSummary | null> {
    const key = `summary:${title.toLowerCase()}`;
    return this.cache.memoize(key, 60 * 60, async () => {
      const r = await fetch(`${this.env.WIKIPEDIA_REST}/page/summary/${encodeURIComponent(title)}`, { headers: POLITE(this.env.USER_AGENT) });
      if (!r.ok) return null;
      const j: any = await r.json();
      return {
        title: j.title,
        url: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(j.title)}`,
        extract: j.extract ?? "",
        thumbnail: j.thumbnail?.source,
        description: j.description,
        last_modified: j.timestamp,
      };
    });
  }

  /** Most-viewed Wikipedia pages on a given date (defaults to yesterday). */
  async trending(date?: string): Promise<TrendingPage[]> {
    // Wikipedia pageviews API: /metrics/pageviews/top/{project}/{access}/{year}/{month}/{day}
    const d = date ? new Date(date) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const key = `top:${yyyy}-${mm}-${dd}`;
    return this.cache.memoize(key, 60 * 60 * 6, async () => {
      const r = await fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${yyyy}/${mm}/${dd}`, { headers: POLITE(this.env.USER_AGENT) });
      if (!r.ok) throw new Error(`pageviews ${r.status}`);
      const j: any = await r.json();
      const items = j?.items?.[0]?.articles ?? [];
      return items.slice(0, 50).map((a: any) => ({
        title: a.article.replace(/_/g, " "),
        url: `https://en.wikipedia.org/wiki/${a.article}`,
        views: a.views,
        rank: a.rank,
      }));
    });
  }

  /** Wikidata entity lookup. */
  async wikidataEntity(query: string): Promise<Array<{ id: string; label: string; description?: string; url: string }>> {
    const key = `wd:${query.toLowerCase()}`;
    return this.cache.memoize(key, 60 * 60, async () => {
      const r = await fetch(`${this.env.WIKIDATA_BASE}?action=wbsearchentities&format=json&language=en&limit=10&search=${encodeURIComponent(query)}`, { headers: POLITE(this.env.USER_AGENT) });
      if (!r.ok) return [];
      const j: any = await r.json();
      return (j?.search ?? []).map((e: any) => ({
        id: e.id, label: e.label, description: e.description,
        url: e.concepturi || `https://www.wikidata.org/wiki/${e.id}`,
      }));
    });
  }
}
