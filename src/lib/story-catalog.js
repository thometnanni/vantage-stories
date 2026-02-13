const storyCatalog = [
  // {
  //   slug: 'g8',
  //   title: 'Genova 2001',
  //   storyPath: '/data/g8/story.json'
  // },
   {
    slug: 'silber',
    title: 'SilbersteinStraße',
    storyPath: '/data/silber/story.json'
  }
  // {
  //   slug: 'hermann',
  //   title: 'Hermannstrasse',
  //   storyPath: '/data/hermann/story.json'
  // }
]

const getStoryBySlug = (slug) => storyCatalog.find((story) => story.slug === slug) ?? null

export { storyCatalog, getStoryBySlug }
