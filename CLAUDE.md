# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

DeepBook is a Next.js 14 App Router app for AI-powered novel writing and roleplaying in Chinese. There is no database — all data is JSON files under `.data/` (gitignored).

### Data layer (`src/lib/`)

All data modules run on the server (Node.js `fs`) via API routes:

| File | Stores | Storage |
|------|--------|---------|
| `db.ts` | Books (故事) | `.data/books.json` |
| `dialogue-store.ts` | Dialogues — conversations within a book | `.data/dialogues/{id}.json` + per-book `idx_{bookId}.json` |
| `presets.ts` | Presets — reusable writing style templates | `.data/presets.json` |
| `personas.ts` | Personas — AI assistant personality profiles | `.data/personas.json` |
| `agent-chat-store.ts` | Persistent chat history for the floating agent | `.data/agent-chats/{id}.json` |

`storage.ts` is the only client-side module (`"use client"`). It manages API connection config and floating chat position via `localStorage`.

### API routes (`src/app/api/`)

All are Next.js Route Handlers (exporting `GET`/`POST`/`PATCH`/`DELETE` functions).

- **`/api/chat`** — The "system agent" endpoint. Streaming chat with tool calling via SSE. The agent has ~15 tools (create_book, start_dialogue, create_preset, create_persona, read_file, etc.). Task-based flows: `create-story`, `open-dialogue`, `new-dialogue`, `edit-preset`, `edit-persona`. Compacts message history at 40+ messages.
- **`/api/dialogue`** — Story dialogue chat. Simpler streaming endpoint (no tools). Supports `regenerate` mode to re-generate the last assistant response without a new user message.
- **`/api/agent-chat`** — CRUD for agent chat persistence.
- **`/api/books`**, **`/api/presets`**, **`/api/personas`**, **`/api/dialogues`** — Standard CRUD routes.
- **`/api/models`** — Proxies to the user's configured API provider to fetch available models.

### Frontend (`src/components/`, `src/app/page.tsx`)

The app has two chat surfaces:

1. **FloatingChat** — Draggable floating button/panel. Houses the "system agent" (`ChatWindow`) that handles story creation, dialogue setup, preset/persona management. Uses `/api/chat`.
2. **DialogueView** — Full-screen story conversation interface. Uses `/api/dialogue` for streaming chat within a story's dialogue.

**Cross-component communication** uses custom DOM events on `window` (e.g., `deepbook:dialogue-started`, `deepbook:persona-changed`, `deepbook:presets-updated`).

**View state** (`view-context.tsx`) manages which panel is shown: book grid (default), PresetPanel, or PersonaPanel.

`LayoutClient` renders the shell: `Toolbar` (connection, presets, personas) + `FloatingChat` + `ConnectionDialog`.

### System prompts (`src/prompts/`)

Markdown files loaded by the `/api/chat` route as skill modules. Each corresponds to a task:
- `create-story.md` — Step-by-step guide for the agent to create a book
- `open-dialogue.md` — Opening scene creation (time, place, protagonist, NPCs, mode, POV)
- `new-dialogue.md` — Starting a new dialogue (reuse existing opening or create new)
- `edit-preset.md` — Creating/modifying writing style presets
- `close-dialogue.md` — Closing the current dialogue
- `assistant.md` — Base personality description (not currently loaded by any route)

## Key patterns

- API keys, base URLs, and model selection are stored client-side in `localStorage`. They are sent with each chat request — the server never stores credentials.
- The `openai` npm package is used but the app works with any OpenAI-compatible API (DeepSeek is the primary provider).
- Dialogue compaction: in `/api/chat`, when user messages exceed 40, the middle messages are replaced with a summary marker. In `agent-chat-store.ts`, compaction keeps first 5 + last 20 messages with a summary in between.
- Path traversal protection in `/api/chat` file operation tools: `read_file`, `list_directory`, `search_files` all validate paths stay within `process.cwd()`. `write_file` additionally restricts writes to `src/prompts/` and `.data/`.
