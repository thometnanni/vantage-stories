## Vantage Stories


![test](https://github.com/user-attachments/assets/49c767c0-8eaf-4ecd-8f75-d22eeaeebcb5)
> ⚠️ This code depends on a project structured by the [Vantage Platform](https://github.com/thometnanni/vantage).



Setup
----------

```bash
npm install
npm run dev
npm run build
```

Process Page
----------

- Open `http://localhost:5173/process`
- Paste your `<vantage-renderer>...</vantage-renderer>` block
- Pick the local folder that contains the assets
- Download `story.json` directly to a folder

Context Authoring
----------

Context is markdown-only, so use `context.markdown` in `story.json`.

```json
{
  "context": {
    "title": "Checkpoint",
    "markdown": "This is **important**.\\n\\n- First detail\\n- Second detail\\n\\n[Source](https://example.com)"
  }
}
```


Files To Edit
----------

- `static/data/<folder>/story.json` (story content, projections, keyframes, asset paths)
- `src/routes/+page.svelte` (index layout)
- `src/lib/components/Scene.svelte` (scene presenter/controller)
- `src/lib/components/Header.svelte` (intro/header section)
- `src/lib/components/Footer.svelte` (credits/footer section)

Architecture
----------

- `src/lib/story/core/storyData.js`: story normalization and projection defaults
- `src/lib/story/runtime/assetPaths.js`: base-path aware asset URL mapping
- `src/lib/story/runtime/storySource.js`: story JSON loading/validation
- `src/lib/components/Scene.svelte`: UI orchestration layer using the modules above