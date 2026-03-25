# dirt math

A browser-based tool for measuring landscaping blueprints and calculating material quantities. Supports both manual measurement and AI-powered automatic zone detection.

## Project philosophy

Small internal tool for a family landscaping business. Prioritize simplicity and readability over cleverness. Build the straightforward version first — optimize later if needed.

## Stack

**Frontend**
- React via Vite
- PDF.js for blueprint rendering
- Plain CSS — no CSS-in-JS
- No backend for MVP — everything runs in the browser

**Backend (v2 — not built yet)**
- Python for AI/ML zone detection logic
- Will receive a blueprint image and return detected zones + scale as JSON
- Keep it a simple REST API when the time comes — no overengineering

## Code style

- Functional React components only, no class components
- Keep components small and focused on one job
- Prefer useState and useEffect — no Redux, no Zustand
- Plain descriptive variable names
- No TypeScript — plain JavaScript is fine
- Avoid abstractions until something is repeated at least three times
- Python code should be equally readable — no clever one-liners

## What to avoid

- No unnecessary npm packages — if native browser APIs or a few lines of JS can do it, do that
- No unit tests for now
- Don't future-proof things that don't need it — build for now, not for scale

## When in doubt

Write the simplest version that works. We can make it smarter later.