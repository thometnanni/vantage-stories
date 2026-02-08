## Vantage Stories
----------


Setup
----------

```bash
npm install
npm run dev
```

Process Page
----------

- Open `http://localhost:5173/process`
- Paste your `<vantage-renderer>...</vantage-renderer>` block
- Pick the local folder that contains `index.html` + assets
- Generate and either download or save `story.json` directly to a folder

Files To Edit
----------

- `static/data/<folder>/story.json` (story content, projections, keyframes, asset paths)
- `src/routes/+page.svelte` (page layout)
- `src/lib/components/SceneDescription.svelte` (context text panel)
- `src/lib/components/TimelineControls.svelte` (timeline buttons/labels)
