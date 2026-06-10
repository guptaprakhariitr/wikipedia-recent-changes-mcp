# Changelog

## [0.1.0] — 2026-06-10

### Added
- Four tools: `wiki_recent_changes`, `wiki_page_summary`, `wiki_trending`, `wikidata_search`.
- Wraps three free Wikimedia APIs: Wikipedia Action API (recent changes), Wikipedia REST (page summary), Wikimedia Metrics (pageviews/top), Wikidata wbsearchentities.
- Polite User-Agent on every request per Wikimedia API policy.
- 60s cache on recent-changes (so frequent polls don't hammer Wikipedia), 1h on summaries, 6h on trending.
