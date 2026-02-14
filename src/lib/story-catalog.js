const storyCatalog = [
  {
    slug: 'silber',
    title: 'SilbersteinStraße',
    storyPath: '/data/silber/story.json'
  },
  {
    slug: 'g8',
    title: 'Genova 2001',
    storyPath: '/data/g8/story.json'
  },
  {
    slug: 'vajont',
    title: 'Vajont',
    storyPath: '/data/vajont/story.json'
  }
]

const getStoryBySlug = (slug) => storyCatalog.find((story) => story.slug === slug) ?? null

export { storyCatalog, getStoryBySlug }
