# Vantage Stories

![vantage-loop](https://github.com/user-attachments/assets/165f7a8e-536e-422a-b29d-23c5b40784d0)


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


## Add Or Update A Story

1. Put your files in `static/data/<slug>/`.
2. Edit `static/data/<slug>/story.json`.
3. Register the story in `src/lib/story-catalog.js`:
   - `slug`
   - `title`
   - `storyPath` (for example `/data/<slug>/story.json`)

## Story JSON Notes

- `sceneSrc`: GLTF scene path.
- `cameraPathProjectionId`: projection used as the scroll-follow camera path.
- `projections[]`: maps/perspective projections and keyframes.
- `ui`: page title, intro, credits, and theme colors.

### Recorder Camera (mandatory id marker)

Recorded camera-path behavior is enabled only for projections whose `id` contains `recorder`.

If no `recorder` projection is present, the app uses the fallback sequence camera path.

Example:

```json
{
  "id": "recorder",
  "projectionType": "perspective",
  "focus": true,
  "keyframes": [
    {
      "time": 0,
      "position": "...",
      "rotation": "...",
      "fov": 66,
      "far": 1500
    }
  ]
}
```

Context is markdown via `context.markdown`, usually on camera-path keyframes:

```json
{
  "time": 1.2,
  "position": "...",
  "rotation": "...",
  "context": {
    "markdown": "Your text."
  }
}
```

Optional pacing controls per keyframe:
- `scrollWeight`: slower/faster transition to the next keyframe.
- `pause`: hold longer on this keyframe while scrolling.

```json
 "cameraControl": {
    "mode": "triggered", // instead of always following mouse scroll
    "durationMs": 1400,
    "easing": "easeInOutCubic"
  },
```
