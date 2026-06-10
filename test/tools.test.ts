import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WikiClient } from "../src/wikipedia";
import { McpServer, ToolContext } from "../src/mcp-server";
import { buildTools } from "../src/tools";

class FakeKv {
  store = new Map<string, string>();
  async get(key: string, type?: "text" | "json"): Promise<any> {
    const v = this.store.get(key); if (v === undefined) return null;
    if (type === "json") return JSON.parse(v); return v;
  }
  async put(key: string, value: string): Promise<void> { this.store.set(key, value); }
  async delete(key: string): Promise<void> { this.store.delete(key); }
}

const env = {
  CACHE: new FakeKv() as unknown as KVNamespace,
  USAGE: new FakeKv() as unknown as KVNamespace,
  WIKIPEDIA_REST: "https://en.wikipedia.org/api/rest_v1",
  WIKIPEDIA_ACTION: "https://en.wikipedia.org/w/api.php",
  WIKIDATA_BASE: "https://www.wikidata.org/w/api.php",
  USER_AGENT: "test/0.1",
  UPGRADE_URL: "x",
};

beforeEach(() => {
  (env.CACHE as any).store = new Map();
  vi.stubGlobal("fetch", async (url: string | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.includes("action=query") && u.includes("list=recentchanges")) {
      return new Response(JSON.stringify({ query: { recentchanges: [
        { type: "edit", title: "Microsoft", pageid: 19001, rcid: 999001, user: "alice", bot: false, minor: false, timestamp: "2026-06-10T12:00:00Z", comment: "Updated revenue", oldlen: 12000, newlen: 12150 },
        { type: "edit", title: "Bitcoin",   pageid: 28249265, rcid: 999002, user: "bot1", bot: true,  minor: true,  timestamp: "2026-06-10T12:01:00Z", comment: "Fix typo", oldlen: 50000, newlen: 50005 },
      ] } }), { status: 200 });
    }
    if (u.includes("/page/summary/")) {
      return new Response(JSON.stringify({ title: "Microsoft", extract: "American multinational technology corporation.", description: "Tech company", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Microsoft" } }, timestamp: "2026-06-10T00:00:00Z" }), { status: 200 });
    }
    if (u.includes("/metrics/pageviews/top/")) {
      return new Response(JSON.stringify({ items: [{ articles: [{ article: "Main_Page", views: 5000000, rank: 1 }, { article: "Bitcoin", views: 200000, rank: 2 }] }] }), { status: 200 });
    }
    if (u.includes("wbsearchentities")) {
      return new Response(JSON.stringify({ search: [{ id: "Q2283", label: "Microsoft", description: "American technology corporation", concepturi: "http://www.wikidata.org/entity/Q2283" }] }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("WikiClient.recentChanges", () => {
  it("returns recent edits with URLs", async () => {
    const c = new WikiClient(env as any);
    const out = await c.recentChanges({ limit: 10 });
    expect(out.length).toBe(2);
    expect(out[0].title).toBe("Microsoft");
    expect(out[0].url).toContain("en.wikipedia.org/wiki/Microsoft");
  });
  it("topic filter narrows by title/comment substring", async () => {
    const c = new WikiClient(env as any);
    const out = await c.recentChanges({ limit: 10, topic: "Microsoft" });
    expect(out.length).toBe(1);
    expect(out[0].title).toBe("Microsoft");
  });
});

describe("WikiClient.pageSummary", () => {
  it("returns extract + URL", async () => {
    const c = new WikiClient(env as any);
    const s = await c.pageSummary("Microsoft");
    expect(s?.extract).toContain("multinational");
  });
});

describe("WikiClient.trending", () => {
  it("returns top pages with views + rank", async () => {
    const c = new WikiClient(env as any);
    const out = await c.trending("2026-06-09");
    expect(out.length).toBe(2);
    expect(out[0].views).toBe(5000000);
    expect(out[0].title).toBe("Main Page");   // underscore → space
  });
});

describe("WikiClient.wikidataEntity", () => {
  it("returns entities with Q-id + url", async () => {
    const c = new WikiClient(env as any);
    const out = await c.wikidataEntity("Microsoft");
    expect(out[0].id).toBe("Q2283");
  });
});

describe("MCP protocol", () => {
  const server = new McpServer({ name: "wikipedia-recent-changes-mcp", version: "0.1.0" });
  for (const t of buildTools()) server.register(t);
  const ctx: ToolContext = { env: env as any, apiKey: null, tier: "free", callsRemaining: 200 };

  it("lists 4 tools", async () => {
    const r = await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx);
    const names = (r!.result as any).tools.map((t: any) => t.name) as string[];
    expect(names).toHaveLength(4);
  });

  it("wiki_recent_changes end-to-end", async () => {
    const r = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "wiki_recent_changes", arguments: { limit: 5 } } }, ctx);
    const out = JSON.parse((r!.result as any).content[0].text);
    expect(out.count).toBe(2);
  });
});
