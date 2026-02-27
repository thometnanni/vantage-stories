import storyCatalog from './story-catalog.json'

const getStoryBySlug = (slug) => storyCatalog.find((story) => story.slug === slug) ?? null

export { storyCatalog, getStoryBySlug }
