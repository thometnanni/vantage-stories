const storyCatalog = [
  {
    slug: 'slug',
    title: 'Title',
    storyPath: '/data/slug/story.json'
  }
]

const getStoryBySlug = (slug) => storyCatalog.find((story) => story.slug === slug) ?? null

export { storyCatalog, getStoryBySlug }
