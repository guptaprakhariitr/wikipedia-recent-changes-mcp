import { Tool } from "./mcp-server";
import { WikiClient, WikiEnv } from "./wikipedia";

export function buildTools(): Tool[] {
  return [
    {
      name: "wiki_recent_changes",
      description:
        "Live feed of recent edits to English Wikipedia. Returns title, editor, timestamp, comment, size delta. Optional `topic` filter (substring match against title + edit comment) and `exclude_bots`. Useful for trend-monitoring or news-monitoring agents — every breaking news event lands in Wikipedia edits within minutes.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", default: 50, minimum: 1, maximum: 500 },
          topic: { type: "string", description: "Optional substring filter on title/comment." },
          exclude_bots: { type: "boolean", default: true },
          namespace: { type: "integer", description: "Wikipedia namespace ID. 0 = main articles (default), 1 = talk, etc." },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const c = new WikiClient(ctx.env as unknown as WikiEnv);
        const out = await c.recentChanges({
          limit: args.limit ?? 50,
          topic: args.topic,
          excludeBots: args.exclude_bots ?? true,
          namespace: args.namespace ?? 0,
        });
        return { count: out.length, changes: out };
      },
    },

    {
      name: "wiki_page_summary",
      description: "Get a clean summary of a Wikipedia article: extract, thumbnail, description, last modified. Use this to verify an entity exists or pull a one-line description.",
      inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
      handler: async (args, ctx) => {
        const c = new WikiClient(ctx.env as unknown as WikiEnv);
        return (await c.pageSummary(args.title)) ?? { error: "Page not found" };
      },
    },

    {
      name: "wiki_trending",
      description: "Top 50 most-viewed English Wikipedia pages for a given date (default yesterday). Useful for 'what's the world reading about?' signal.",
      inputSchema: { type: "object", properties: { date: { type: "string", description: "Optional ISO YYYY-MM-DD. Defaults to yesterday." } }, required: [] },
      handler: async (args, ctx) => {
        const c = new WikiClient(ctx.env as unknown as WikiEnv);
        const out = await c.trending(args.date);
        return { count: out.length, pages: out };
      },
    },

    {
      name: "wikidata_search",
      description: "Search Wikidata entities by name. Returns up to 10 matches with Q-id, label, description. Use this for entity disambiguation / canonicalization.",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      handler: async (args, ctx) => {
        const c = new WikiClient(ctx.env as unknown as WikiEnv);
        const out = await c.wikidataEntity(args.query);
        return { count: out.length, entities: out };
      },
    },
  ];
}
