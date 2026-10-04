export interface ImagePreset {
  id: string
  url: string
  thumbnailUrl: string
  alt: string
  title: string
  category: 'minimal' | 'nature' | 'architecture' | 'gradient' | 'workspace'
}

export const BACKGROUND_PRESETS: ImagePreset[] = [
  {
    id: 'bg-gradient-blue',
    url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=200',
    alt: 'Soft blue gradient background',
    title: 'Blue Gradient',
    category: 'gradient',
  },
  {
    id: 'bg-abstract-waves',
    url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200',
    alt: 'Abstract wave pattern background',
    title: 'Abstract Waves',
    category: 'minimal',
  },
]

export const HEADER_PRESETS: ImagePreset[] = [
  {
    id: 'header-minimal-lines',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=200',
    alt: 'Minimal geometric lines banner',
    title: 'Minimal Lines',
    category: 'minimal',
  },
  {
    id: 'header-workspace',
    url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=200',
    alt: 'Bright workspace desk banner',
    title: 'Workspace',
    category: 'workspace',
  },
]
