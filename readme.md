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
- `src/lib/components/Story.svelte` (story presenter/controller)
- `src/lib/components/SceneDescription.svelte` (context text panel)
- `src/lib/components/TimelineControls.svelte` (timeline buttons/labels)

Architecture
----------

- `src/lib/story/core/storyData.js`: story normalization and projection defaults
- `src/lib/story/core/projectionLibrary.js`: reusable projection/timeline selectors
- `src/lib/story/runtime/assetPaths.js`: base-path aware asset URL mapping
- `src/lib/story/runtime/storySource.js`: story JSON loading/validation
- `src/lib/story/three/storyCameraBridge.js`: camera transition + overview bridge to Three/Vantage renderer
- `src/lib/components/Story.svelte`: UI orchestration layer using the modules above

This separation lets you keep the same story JSON and swap only the presenter (e.g. classic scrollytelling) while reusing `core` + `runtime` logic.
