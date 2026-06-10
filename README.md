# wikipedia-recent-changes-mcp

> Live English Wikipedia edit-feed + page summaries + trending pages + Wikidata entity lookup, all in one MCP. Per the 2026 ecosystem research, no one else packages Wikipedia's recent-changes firehose as an agent-callable MCP.

**Endpoint:** `https://wikipedia-recent-changes-mcp.prakhar-cognizance.workers.dev/mcp`

## Why this is interesting

Every breaking news event hits Wikipedia within minutes (sometimes seconds) — the recent-changes feed is **the cheapest possible "what's the world doing right now" signal**, with the bonus that the edit comments + sized deltas often summarize the news themselves. Combine `wiki_recent_changes(topic="…")` with `wiki_page_summary(title)` and your agent has a real-time topic monitor for zero upstream cost.

## Tools

- `wiki_recent_changes(limit?, topic?, exclude_bots?, namespace?)` — live edit feed (last N changes; optional substring filter)
- `wiki_page_summary(title)` — clean extract, thumbnail, last-modified
- `wiki_trending(date?)` — top 50 most-viewed pages on a date (default yesterday)
- `wikidata_search(query)` — entity disambiguation by name → Q-id

## Pricing

| Tier | Price | Calls/mo |
|---|---|---|
| Free | $0 | 200 |
| Solo | $9/mo | 3,000 |
| Team | $29/mo | 15,000 |
| Pro | $79/mo | 75,000 |
