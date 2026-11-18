# Notes for AI assistants

- Read README.md first. Game behavior is in lib/game/engine.ts (imperative SVG, ported from a prototype on purpose for input feel); keep it that way unless asked to refactor.
- Scoring rules live only in lib/scoring.ts and are run on the server. Run `npm test` after changing them.
- Curve data must go through the CurveSource interface in lib/curves/. Don't import placeholder curves anywhere else.
- Imports use explicit `.ts` extensions so `npm test` can run with Node's type stripping.
- Before committing: `npm run typecheck && npm test && npm run build`.
