<script>
  import {
    createStoryFromRendererHtml,
    validateLocalAssetPaths
  } from '$lib/process/story-from-html'

  let htmlInput = $state('')
  let folderFiles = $state([])
  let folderLabel = $state('No folder selected')
  let selectedFolderName = $state('')
  let outputFilename = $state('story.json')

  let outputJson = $state('')
  let errorMessage = $state('')
  let copied = $state(false)
  let saveMessage = $state('')
  let zipMessage = $state('')
  let isPackaging = $state(false)

  let summary = $state(null)
  let assetValidation = $state(null)
  let lastAssetPaths = $state([])
  let rawStory = $state(null)

  const inferFolderLabel = (files) => {
    const firstPath = files[0]?.webkitRelativePath
    if (typeof firstPath !== 'string' || firstPath.length === 0) {
      return `${files.length} file${files.length === 1 ? '' : 's'} selected`
    }

    const [rootName] = firstPath.split('/')
    return `${rootName} (${files.length} files)`
  }

  const getFolderNameFromFiles = (files) => {
    const firstPath = files[0]?.webkitRelativePath
    if (typeof firstPath !== 'string' || firstPath.length === 0) return ''
    return firstPath.split('/')[0] ?? ''
  }

  const normalizePath = (value) => value.replace(/\\+/g, '/')

  const getSuffix = (pathValue) => {
    const hashIndex = pathValue.indexOf('#')
    const queryIndex = pathValue.indexOf('?')
    const splitIndex = [hashIndex, queryIndex]
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0]
    if (splitIndex == null) return { base: pathValue, suffix: '' }
    return {
      base: pathValue.slice(0, splitIndex),
      suffix: pathValue.slice(splitIndex)
    }
  }

  const isRemoteAsset = (value) => /^(https?:|data:|blob:|\/\/|file:)/i.test(value)

  const normalizeFolderRelativeFilePath = (relativePath) => {
    const normalized = normalizePath(relativePath).replace(/^\/+/, '')
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length <= 1) return parts[0] ?? ''
    return parts.slice(1).join('/')
  }

  const getFileNameFromAssetPath = (assetPath) => {
    if (typeof assetPath !== 'string') return ''

    const trimmed = assetPath.trim()
    if (trimmed.length === 0) return ''

    const { base } = getSuffix(trimmed)
    let normalized = normalizePath(base)

    if (isRemoteAsset(normalized)) {
      try {
        normalized = new URL(normalized).pathname
      } catch {
        return ''
      }
    }

    const withoutLeading = normalized.replace(/^\/+/, '').replace(/^\.\//, '')
    const segments = withoutLeading.split('/').filter(Boolean)
    return segments.at(-1) ?? ''
  }

  const rewriteAssetPathForDataFolder = (assetPath, folderName) => {
    if (typeof assetPath !== 'string') return assetPath

    const trimmed = assetPath.trim()
    if (trimmed.length === 0) return assetPath

    const filename = getFileNameFromAssetPath(trimmed)
    if (filename.length === 0) return assetPath

    const { suffix } = getSuffix(trimmed)
    return `/data/${folderName}/${filename}${suffix}`
  }

  const collectLocalAssetPaths = (story) => {
    const localPaths = new Set()

    const addIfLocal = (value) => {
      if (typeof value !== 'string') return
      const trimmed = value.trim()
      if (trimmed.length === 0 || isRemoteAsset(trimmed)) return
      localPaths.add(trimmed)
    }

    addIfLocal(story.sceneSrc)
    for (const projection of story.projections ?? []) {
      addIfLocal(projection.src)
      addIfLocal(projection.previewSrc)
    }

    return Array.from(localPaths)
  }

  const applyFolderPrefixToStory = (story) => {
    if (selectedFolderName.length === 0) return story

    return {
      ...story,
      sceneSrc: rewriteAssetPathForDataFolder(story.sceneSrc, selectedFolderName),
      projections: (story.projections ?? []).map((projection) => ({
        ...projection,
        src: rewriteAssetPathForDataFolder(projection.src, selectedFolderName),
        previewSrc: rewriteAssetPathForDataFolder(projection.previewSrc, selectedFolderName)
      }))
    }
  }

  const updateOutputFromRawStory = () => {
    if (!rawStory) return

    const outputStory = applyFolderPrefixToStory(rawStory)
    outputJson = `${JSON.stringify(outputStory, null, 2)}\n`

    const localAssetPaths = collectLocalAssetPaths(outputStory)
    lastAssetPaths = localAssetPaths
    assetValidation = validateLocalAssetPaths(localAssetPaths, folderFiles)
  }

  const handleFolderChange = (event) => {
    const files = Array.from(event.currentTarget.files ?? [])
    folderFiles = files
    folderLabel = files.length > 0 ? inferFolderLabel(files) : 'No folder selected'
    selectedFolderName = files.length > 0 ? getFolderNameFromFiles(files) : ''
    zipMessage = ''
    saveMessage = ''

    if (rawStory) {
      updateOutputFromRawStory()
    } else if (lastAssetPaths.length > 0) {
      assetValidation = validateLocalAssetPaths(lastAssetPaths, files)
    }
  }

  const generateStory = () => {
    copied = false
    saveMessage = ''
    zipMessage = ''

    try {
      const { story, stats, assetPaths } = createStoryFromRendererHtml(htmlInput)
      rawStory = story
      updateOutputFromRawStory()
      summary = stats
      if (selectedFolderName.length === 0) {
        lastAssetPaths = assetPaths
        assetValidation = validateLocalAssetPaths(assetPaths, folderFiles)
      }
      errorMessage = ''
    } catch (error) {
      outputJson = ''
      summary = null
      assetValidation = null
      lastAssetPaths = []
      rawStory = null
      errorMessage = error instanceof Error ? error.message : 'Failed to process input HTML.'
    }
  }

  const copyJson = async () => {
    if (!outputJson) return

    try {
      await navigator.clipboard.writeText(outputJson)
      copied = true
      saveMessage = ''
      zipMessage = ''
    } catch {
      copied = false
    }
  }

  const downloadJson = () => {
    if (!outputJson) return

    const safeName = outputFilename.trim().length > 0 ? outputFilename.trim() : 'story.json'
    const filename = safeName.endsWith('.json') ? safeName : `${safeName}.json`

    const blob = new Blob([outputJson], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()

    URL.revokeObjectURL(url)
  }

  const downloadUpdatedFolderZip = async () => {
    if (!outputJson || folderFiles.length === 0 || selectedFolderName.length === 0) return

    isPackaging = true
    zipMessage = ''

    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (const file of folderFiles) {
        const relativePathRaw =
          typeof file.webkitRelativePath === 'string' && file.webkitRelativePath.length > 0
            ? normalizePath(file.webkitRelativePath)
            : `${selectedFolderName}/${file.name}`
        const relativePath = normalizeFolderRelativeFilePath(relativePathRaw)
        const filename = relativePath.split('/').filter(Boolean).at(-1)
        if (!filename) continue
        const content = await file.arrayBuffer()
        zip.file(`data/${selectedFolderName}/${filename}`, content)
      }

      zip.file(`data/${selectedFolderName}/story.json`, outputJson)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)
      const anchor = document.createElement('a')
      anchor.href = zipUrl
      anchor.download = `${selectedFolderName}.zip`
      anchor.click()
      URL.revokeObjectURL(zipUrl)

      zipMessage = `Downloaded ${selectedFolderName}.zip with /data/${selectedFolderName}/story.json.`
    } catch {
      zipMessage = 'Could not package folder zip.'
    } finally {
      isPackaging = false
    }
  }

  const saveInFolder = async () => {
    if (!outputJson) return

    const safeName = outputFilename.trim().length > 0 ? outputFilename.trim() : 'story.json'
    const filename = safeName.endsWith('.json') ? safeName : `${safeName}.json`

    if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
      saveMessage = 'Direct folder save is not supported in this browser. Use Download.'
      return
    }

    try {
      const directoryHandle = await window.showDirectoryPicker()
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(outputJson)
      await writable.close()
      saveMessage = `Saved ${filename} to selected folder.`
    } catch (error) {
      if (error?.name === 'AbortError') {
        saveMessage = 'Save cancelled.'
      } else {
        saveMessage = 'Could not save directly. Use Download.'
      }
    }
  }
</script>

<svelte:head>
  <title>Process HTML to Story JSON</title>
</svelte:head>

<main class="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-3 px-3 py-3">
  <header
    class="tiny-shadow rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)] px-3 py-2"
  >
    <p class="mono text-[10px] uppercase tracking-[0.16em] text-slate-600">Vantage Utils</p>
    <h1 class="text-base font-semibold text-slate-900">/process</h1>
    <p class="text-sm text-slate-700">
      Paste a <code class="mono">&lt;vantage-renderer&gt;</code> block, pick the local folder with
      assets, then generate <code class="mono">story.json</code>.
    </p>
  </header>

  <section class="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
    <div
      class="tiny-shadow flex min-h-0 flex-col rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)] p-2"
    >
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <label
          for="renderer-html-input"
          class="mono text-[11px] uppercase tracking-[0.14em] text-slate-700">Source HTML</label
        >
        <button
          type="button"
          class="rounded-[var(--radius-button)] border border-[var(--panel-stroke)] bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
          onclick={() => {
            htmlInput = ''
            outputJson = ''
            errorMessage = ''
            summary = null
            assetValidation = null
            lastAssetPaths = []
            rawStory = null
            zipMessage = ''
            saveMessage = ''
          }}
        >
          Clear
        </button>
      </div>

      <textarea
        id="renderer-html-input"
        class="mono min-h-[340px] w-full flex-1 resize-y rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white p-2 text-[12px] leading-relaxed text-slate-800"
        placeholder="Paste your <vantage-renderer>...</vantage-renderer> block here"
        bind:value={htmlInput}
      ></textarea>

      <div class="mt-2 rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white p-2">
        <label for="folder-input" class="block text-xs font-medium text-slate-800"
          >Local folder (optional asset check)</label
        >
        <input
          id="folder-input"
          type="file"
          class="mt-1 block w-full text-xs text-slate-700"
          multiple
          webkitdirectory
          directory
          onchange={handleFolderChange}
        />
        <p class="mt-1 text-xs text-slate-600">{folderLabel}</p>
      </div>

      <p class="mt-2 text-xs text-slate-700">
        Scene + projection paths are rewritten to:
        <code class="mono"
          >{selectedFolderName
            ? `/data/${selectedFolderName}/FILENAME`
            : '/data/FOLDER/FILENAME'}</code
        >
      </p>

      <div class="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-[var(--radius-button)] bg-[var(--lime)] px-3 py-1.5 text-xs font-semibold text-slate-950 hover:brightness-95"
          onclick={generateStory}
        >
          Generate story.json
        </button>
      </div>

      {#if errorMessage}
        <p
          class="mt-2 rounded-[var(--radius-button)] border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
        >
          {errorMessage}
        </p>
      {/if}
    </div>

    <div
      class="tiny-shadow flex min-h-0 flex-col rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)] p-2"
    >
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <label
          for="output-json-textarea"
          class="mono text-[11px] uppercase tracking-[0.14em] text-slate-700">Output JSON</label
        >
        <input
          type="text"
          class="mono min-w-0 flex-1 rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white px-2 py-1 text-xs text-slate-800"
          bind:value={outputFilename}
          placeholder="story.json"
        />
        <button
          type="button"
          class="rounded-[var(--radius-button)] border border-[var(--panel-stroke)] bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          onclick={copyJson}
          disabled={!outputJson}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          class="rounded-[var(--radius-button)] border border-[var(--panel-stroke)] bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          onclick={downloadJson}
          disabled={!outputJson}
        >
          Download
        </button>
        <button
          type="button"
          class="rounded-[var(--radius-button)] border border-[var(--panel-stroke)] bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          onclick={saveInFolder}
          disabled={!outputJson}
        >
          Save In Folder
        </button>
        <button
          type="button"
          class="rounded-[var(--radius-button)] border border-[var(--panel-stroke)] bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          onclick={downloadUpdatedFolderZip}
          disabled={!outputJson || folderFiles.length === 0 || isPackaging}
        >
          {isPackaging ? 'Packaging...' : 'Download Folder ZIP'}
        </button>
      </div>

      <textarea
        id="output-json-textarea"
        readonly
        class="mono min-h-[340px] w-full flex-1 resize-y rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white p-2 text-[12px] leading-relaxed text-slate-800"
        placeholder="Generated JSON will appear here"
        bind:value={outputJson}
      ></textarea>

      <div class="mt-2 grid gap-2 md:grid-cols-2">
        <div
          class="rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white p-2 text-xs text-slate-700"
        >
          <p class="mono mb-1 uppercase tracking-[0.12em] text-slate-500">Summary</p>
          {#if summary}
            <p>Projections: {summary.projections}</p>
            <p>Keyframes: {summary.keyframes}</p>
          {:else}
            <p>No data yet.</p>
          {/if}
        </div>

        <div
          class="rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white p-2 text-xs text-slate-700"
        >
          <p class="mono mb-1 uppercase tracking-[0.12em] text-slate-500">Asset Check</p>
          {#if assetValidation}
            <p>Assets referenced: {assetValidation.total}</p>
            <p>Matched in folder: {assetValidation.found.length}</p>
            <p>Missing: {assetValidation.missing.length}</p>
          {:else}
            <p>Select a folder to validate media/scene paths.</p>
          {/if}
        </div>
      </div>

      {#if saveMessage}
        <p
          class="mt-2 rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white px-2 py-1 text-xs text-slate-700"
        >
          {saveMessage}
        </p>
      {/if}

      {#if zipMessage}
        <p
          class="mt-2 rounded-[var(--radius-button)] border border-[var(--stroke)] bg-white px-2 py-1 text-xs text-slate-700"
        >
          {zipMessage}
        </p>
      {/if}

      {#if assetValidation && assetValidation.missing.length > 0}
        <div
          class="mt-2 max-h-28 overflow-y-auto rounded-[var(--radius-button)] border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"
        >
          <p class="mb-1 font-medium">Missing paths</p>
          <ul class="mono space-y-0.5">
            {#each assetValidation.missing as item (item)}
              <li>{item}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </section>
</main>
