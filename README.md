# ASTRA — Personal Companion

ASTRA is being developed as a personal AI companion: part imaginative presence, part practical assistant. The target for the first complete MVP is **November 19, 2026**.

## Product direction

- A modern, restrained sci-fi interface with a responsive companion core.
- AI-backed conversation with a consistent ASTRA persona.
- Browser-local conversation history, user-controlled memory, and notes.
- Research mode using Gemini's Google Search grounding and displaying source links.
- Optional browser speech recognition and text-to-speech.
- Installable PWA basics and honest system status.

## Repositories

- **\`astra\`** is the main product.
- **\`astra2\`** remains a reference prototype for chat interactions.

## Run locally

The frontend is plain HTML, CSS and JavaScript, and the API is a Vercel serverless function. A static-file server alone can show the UI but cannot run \`/api/chat\`.

1. Deploy this repository to Vercel, or use the Vercel CLI for local development.
2. Create a Gemini API key in Google AI Studio.
3. Add these variables in Vercel Project Settings → Environment Variables:

   - \`GEMINI_API_KEY\` — required; kept on the server only.
   - \`ASTRA_ACCESS_TOKEN\` — required for production deployments; choose a long, random private token and enter it in ASTRA Preferences.
   - \`GEMINI_MODEL\` — optional; defaults to \`gemini-3.8-flash\`.

4. Redeploy after changing environment variables.
5. Open the deployed URL, select Preferences, and enter the same \`ASTRA_ACCESS_TOKEN\`.

The default model name follows the current official Gemini API model documentation. Model availability and provider pricing/quotas can change; check Google's official model page before production use.

## Privacy and security

- Never place \`GEMINI_API_KEY\` in frontend code, HTML, browser storage, or a public repository.
- Production requests are rejected when \`ASTRA_ACCESS_TOKEN\` is not configured.
- The access token is kept in browser session storage, not long-term local storage.
- Conversations, memory and notes are stored in this browser. Use **Export my Astra data** to make a backup.
- Saved personal memory is sent with chat requests only when the “Include saved memory in chats” toggle is enabled.
- Messages submitted for AI replies are sent to the configured backend and Gemini. Do not send information you are not comfortable processing with that service.
- The UI does not read CPU, RAM, network status or other device sensors. Displayed status refers only to app/backend state.

## MVP milestone plan

See [Issue #1](https://github.com/johanrohith/astra/issues/1) for the detailed November 19 acceptance checklist and milestones.

## References

- [Gemini API models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Gemini Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search)
