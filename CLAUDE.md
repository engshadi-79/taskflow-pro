@AGENTS.md

## graphify

Before reading project files, query the Graphify graph (graphify query) and prefer its scoped answers; read full files only when the graph lacks the detail.

A knowledge graph of `src/` lives in `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`). Query it with `graphify query "<question>"` before grepping/reading files from scratch. Rebuild after significant code changes with `graphify <path> --update`.
