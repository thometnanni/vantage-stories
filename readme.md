## Vantage Stories


![test](https://github.com/user-attachments/assets/49c767c0-8eaf-4ecd-8f75-d22eeaeebcb5)
> ⚠️ This code depends on a project structured by the [Vantage Platform](https://github.com/thometnanni/vantage).



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
- Pick the local folder that contains the assets
- Generate and either download or save `story.json` directly to a folder

Files To Edit
----------

- `static/data/<folder>/story.json` (story content, projections, keyframes, asset paths)
- `src/routes/+page.svelte` (page layout)
- `src/lib/components/SceneDescription.svelte` (context text panel)
- `src/lib/components/TimelineControls.svelte` (timeline buttons/labels)
