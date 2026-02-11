<script>
  import Story from '$lib/components/Story.svelte'

  let { data } = $props()
</script>

<Story storyPath={data.story.storyPath} />
