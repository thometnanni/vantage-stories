<script>
  import Scene from '$lib/components/Scene.svelte'

  let { data } = $props()
</script>

<Scene storyPath={data.story.storyPath} />
