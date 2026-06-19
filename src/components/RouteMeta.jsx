import { useEffect } from 'react'

const DEFAULT_ORIGIN = 'https://takda-app.vercel.app'
const DEFAULT_OG_IMAGE = `${DEFAULT_ORIGIN}/og-image.svg`
const DEFAULT_OG_IMAGE_ALT = 'Buhay all-in-one life tracker for Filipinos'

function upsertMetaByName(name, content) {
  if (typeof document === 'undefined') return
  let tag = document.head.querySelector(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function upsertMetaByProperty(property, content) {
  if (typeof document === 'undefined') return
  let tag = document.head.querySelector(`meta[property="${property}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('property', property)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function upsertCanonical(href) {
  if (typeof document === 'undefined') return
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

export default function RouteMeta({
  title,
  description,
  path = '/',
  robots = 'index, follow',
  image = DEFAULT_OG_IMAGE,
  imageAlt = DEFAULT_OG_IMAGE_ALT,
}) {
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : DEFAULT_ORIGIN
    const canonicalUrl = `${origin}${path}`

    document.title = title
    upsertMetaByName('description', description)
    upsertMetaByName('robots', robots)
    upsertCanonical(canonicalUrl)

    upsertMetaByProperty('og:type', 'website')
    upsertMetaByProperty('og:url', canonicalUrl)
    upsertMetaByProperty('og:title', title)
    upsertMetaByProperty('og:description', description)
    upsertMetaByProperty('og:image', image)
    upsertMetaByProperty('og:image:alt', imageAlt)
    upsertMetaByProperty('og:site_name', 'Buhay')
    upsertMetaByProperty('og:locale', 'en_PH')

    upsertMetaByName('twitter:card', 'summary_large_image')
    upsertMetaByName('twitter:title', title)
    upsertMetaByName('twitter:description', description)
    upsertMetaByName('twitter:image', image)
    upsertMetaByName('twitter:image:alt', imageAlt)

    // Telemetry: Privacy-respecting client-side route tracking.
    // Serves as a direct hook/extension point for integrating analytics providers like Plausible, Vercel Analytics, or custom telemetry endpoints.
    if (typeof window !== 'undefined') {
      console.log(`[Telemetry] PageView tracked - Path: ${path} | Title: "${title}" | Timestamp: ${new Date().toISOString()}`)
      // Example extension: window.plausible?.('pageview', { url: canonicalUrl })
    }
  }, [title, description, path, robots, image, imageAlt])

  return null
}
