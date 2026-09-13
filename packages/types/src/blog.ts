export interface BlogDraft {
  title: string
  slug: string
  excerpt: string
  category: string
  authorName: string
  authorRole: string
  image: string
  imageAlt: string
  body: string
  featured: boolean
}
export interface BlogArticle extends BlogDraft {
  id: string
  publishedAt: string
  readTime: number
}
export interface BlogRecord {
  id: string
  draft: BlogDraft
  revision: number
  published?: BlogArticle
  updatedAt: string
}
