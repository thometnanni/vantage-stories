import { error } from '@sveltejs/kit'
import { getStoryBySlug, storyCatalog } from '$lib/story-catalog'

export const prerender = true

export const entries = () => storyCatalog.map((story) => ({ slug: story.slug }))

export const load = ({ params }) => {
  const story = getStoryBySlug(params.slug)
  if (!story) {
    throw error(404, `Story "${params.slug}" not found.`)
  }

  return { story }
}
