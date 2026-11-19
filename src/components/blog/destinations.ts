import type { BlogPost } from '../../lib/database.types'

/* Where a story happened, worked out from the place names it mentions, so
   posts need no extra database field. Writers only have to name the country
   or city somewhere in the title, excerpt or text. */

export interface Place {
  country: string
  city: string
  lat: number
  lng: number
}

export const HOME: Place = { country: 'Sri Lanka', city: 'Colombo', lat: 6.9271, lng: 79.8612 }

// [country, main city, lat, lng, extra names that point here]
// Names that are also common words or first names (Jordan, Chad, Georgia)
// are left out on purpose. Matching is case-sensitive, so "turkey" the food
// does not count.
const TABLE: [string, string, number, number, string[]?][] = [
  ['Germany', 'Berlin', 52.52, 13.405, ['Munich', 'Hamburg', 'Frankfurt', 'Cologne']],
  ['Nepal', 'Kathmandu', 27.7172, 85.324, ['Pokhara']],
  ['Costa Rica', 'San José', 9.9281, -84.0907],
  [
    'India',
    'New Delhi',
    28.6139,
    77.209,
    ['Mumbai', 'Bangalore', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune'],
  ],
  ['Maldives', 'Malé', 4.1755, 73.5093],
  ['Bangladesh', 'Dhaka', 23.8103, 90.4125],
  ['Pakistan', 'Lahore', 31.5204, 74.3587, ['Karachi', 'Islamabad']],
  ['Indonesia', 'Jakarta', -6.2088, 106.8456, ['Bali', 'Bandung', 'Yogyakarta']],
  ['Malaysia', 'Kuala Lumpur', 3.139, 101.6869, ['Penang']],
  ['Thailand', 'Bangkok', 13.7563, 100.5018, ['Chiang Mai', 'Phuket']],
  ['Vietnam', 'Hanoi', 21.0278, 105.8342, ['Ho Chi Minh City', 'Da Nang']],
  ['Cambodia', 'Phnom Penh', 11.5564, 104.9282, ['Siem Reap']],
  ['Philippines', 'Manila', 14.5995, 120.9842, ['Cebu']],
  ['Singapore', 'Singapore', 1.3521, 103.8198],
  ['Japan', 'Tokyo', 35.6762, 139.6503, ['Osaka', 'Kyoto']],
  ['South Korea', 'Seoul', 37.5665, 126.978, ['Busan']],
  ['China', 'Beijing', 39.9042, 116.4074, ['Shanghai', 'Shenzhen']],
  ['Taiwan', 'Taipei', 25.033, 121.5654],
  ['Hong Kong', 'Hong Kong', 22.3193, 114.1694],
  ['United Arab Emirates', 'Dubai', 25.2048, 55.2708, ['UAE', 'Abu Dhabi']],
  ['Türkiye', 'Istanbul', 41.0082, 28.9784, ['Turkey', 'Ankara']],
  ['Egypt', 'Cairo', 30.0444, 31.2357, ['Alexandria']],
  ['Morocco', 'Casablanca', 33.5731, -7.5898, ['Marrakech', 'Rabat']],
  ['Tunisia', 'Tunis', 36.8065, 10.1815],
  ['Kenya', 'Nairobi', -1.2921, 36.8219],
  ['Tanzania', 'Dar es Salaam', -6.7924, 39.2083, ['Zanzibar']],
  ['Uganda', 'Kampala', 0.3476, 32.5825],
  ['Rwanda', 'Kigali', -1.9441, 30.0619],
  ['Ghana', 'Accra', 5.6037, -0.187],
  ['Nigeria', 'Lagos', 6.5244, 3.3792],
  ['South Africa', 'Cape Town', -33.9249, 18.4241, ['Johannesburg']],
  ['Poland', 'Warsaw', 52.2297, 21.0122, ['Kraków', 'Krakow']],
  ['Czechia', 'Prague', 50.0755, 14.4378, ['Czech Republic']],
  ['Hungary', 'Budapest', 47.4979, 19.0402],
  ['Romania', 'Bucharest', 44.4268, 26.1025],
  ['Greece', 'Athens', 37.9838, 23.7275],
  ['Italy', 'Rome', 41.9028, 12.4964, ['Milan', 'Florence']],
  ['Spain', 'Madrid', 40.4168, -3.7038, ['Barcelona']],
  ['Portugal', 'Lisbon', 38.7223, -9.1393, ['Porto']],
  ['France', 'Paris', 48.8566, 2.3522],
  ['Netherlands', 'Amsterdam', 52.3676, 4.9041, ['Rotterdam']],
  ['Belgium', 'Brussels', 50.8503, 4.3517],
  ['Austria', 'Vienna', 48.2082, 16.3738],
  ['Switzerland', 'Zurich', 47.3769, 8.5417, ['Geneva']],
  ['United Kingdom', 'London', 51.5074, -0.1278, ['UK', 'England', 'Scotland', 'Manchester']],
  ['Ireland', 'Dublin', 53.3498, -6.2603],
  ['Sweden', 'Stockholm', 59.3293, 18.0686],
  ['Norway', 'Oslo', 59.9139, 10.7522],
  ['Denmark', 'Copenhagen', 55.6761, 12.5683],
  ['Finland', 'Helsinki', 60.1699, 24.9384],
  ['Brazil', 'São Paulo', -23.5505, -46.6333, ['Rio de Janeiro']],
  ['Argentina', 'Buenos Aires', -34.6037, -58.3816],
  ['Colombia', 'Bogotá', 4.711, -74.0721, ['Medellín', 'Medellin']],
  ['Peru', 'Lima', -12.0464, -77.0428, ['Cusco']],
  ['Mexico', 'Mexico City', 19.4326, -99.1332],
  ['Chile', 'Santiago', -33.4489, -70.6693],
  ['Canada', 'Toronto', 43.6532, -79.3832, ['Vancouver', 'Montreal']],
  ['United States', 'New York', 40.7128, -74.006, ['USA']],
  ['Australia', 'Sydney', -33.8688, 151.2093, ['Melbourne']],
  ['New Zealand', 'Auckland', -36.8485, 174.7633],
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const NAMES = TABLE.flatMap(([country, city, lat, lng, extra = []]) => {
  const place = { country, city, lat, lng }
  return [country, city, ...extra].map((name) => ({ name, place }))
})
// longer names first so "South Africa" wins over a shorter overlapping name
NAMES.sort((a, b) => b.name.length - a.name.length)
const PATTERN = new RegExp(
  `(?<![\\p{L}])(${NAMES.map((n) => escape(n.name)).join('|')})(?![\\p{L}])`,
  'u',
)
const BY_NAME = new Map(NAMES.map((n) => [n.name, n.place]))

const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ')
const firstParagraph = (html: string) => stripTags(/<p[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] ?? '')

/** The first place named in the title, else the excerpt, else the opening
    paragraph. Not the whole text: a story about AIESEC life at home that
    mentions "delegates from India" further down should stay a home story. */
export function storyDestination(post: BlogPost): Place | null {
  const texts = [post.title, post.excerpt, firstParagraph(post.content)]
  for (const text of texts) {
    const m = text && PATTERN.exec(text)
    const place = m ? BY_NAME.get(m[1]) : undefined
    if (!place) continue
    // "Cambodia" in the title and "Siem Reap" in the excerpt: show the city the
    // writer named, not the country's default one (the pin stays on the country)
    const city = citiesOf(place.country).find((c) => texts.some((t) => t && wordIn(c, t)))
    return city ? { ...place, city } : place
  }
  return null
}

// extra names that are another name for the country, not a city in it
const COUNTRY_ALIASES = new Set([
  'UAE',
  'Turkey',
  'UK',
  'England',
  'Scotland',
  'USA',
  'Czech Republic',
])
const citiesOf = (country: string) => {
  const row = TABLE.find((r) => r[0] === country)
  return row ? [row[1], ...(row[4] ?? []).filter((n) => !COUNTRY_ALIASES.has(n))] : []
}
const wordIn = (name: string, text: string) =>
  new RegExp(`(?<![\\p{L}])${escape(name)}(?![\\p{L}])`, 'u').test(text)

export interface Destination {
  place: Place
  posts: BlogPost[]
}

/** Stories grouped by destination, most stories first. */
export function groupByDestination(posts: BlogPost[]): Destination[] {
  const map = new Map<string, Destination>()
  for (const post of posts) {
    const place = storyDestination(post)
    if (!place) continue
    const entry = map.get(place.country) ?? { place, posts: [] }
    entry.posts.push(post)
    map.set(place.country, entry)
  }
  return [...map.values()].sort((a, b) => b.posts.length - a.posts.length)
}

/** Stories with no place abroad: the AIESEC journey at home in Colombo. */
export const homeStories = (posts: BlogPost[]) => posts.filter((p) => !storyDestination(p))

/** Great-circle distance in km. */
export function distanceKm(a: Place, b: Place): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
