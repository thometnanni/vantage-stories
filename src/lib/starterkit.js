import { isVideoSource, resolveStoryData } from '$lib/story/core/storyData'

const resolveStarterData = (data = {}) => resolveStoryData(data)

export { isVideoSource, resolveStarterData }
