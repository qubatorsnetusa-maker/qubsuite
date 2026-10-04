/**
 * AI Hero Image & Welcome Screen Generation Utility
 * Provides curated presets, smart prompt suggestions, and AI generative dispatch
 */

import { generateWelcomeCopyFn, type AIWelcomeCopy } from '@/formsV3/api/ai';

export type { AIWelcomeCopy };

export interface AIHeroPreset {
  id: string;
  name: string;
  category: '3d' | 'workspace' | 'abstract' | 'minimal' | 'tech' | 'nature';
  imageUrl: string;
  prompt: string;
  style: string;
  aspectRatio: '16:9' | '4:3' | '1:1';
}

export interface AIHeroStyleOption {
  id: string;
  name: string;
  description: string;
  promptSuffix: string;
  badgeColor: string;
  iconName: string;
}

export const AI_HERO_STYLES: AIHeroStyleOption[] = [
  {
    id: 'minimal_3d',
    name: 'Minimal 3D Render',
    description: 'Smooth matte geometric shapes, soft ambient studio lighting, pastel or monochrome tones',
    promptSuffix: 'minimalist 3D clay render, smooth matte surfaces, subtle ambient occlusion, soft studio lighting, clean composition, 8k resolution, elegant modern design',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconName: 'Box',
  },
  {
    id: 'editorial_workspace',
    name: 'Aesthetic Workspace',
    description: 'Sunlit designer desk with laptop, ceramic mug, plant shadows, Scandinavian minimalism',
    promptSuffix: 'editorial photography, minimalist Scandinavian desk, modern laptop, ceramic matcha mug, gentle dappled plant sunlight, clean warm neutral palette, depth of field',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    iconName: 'Coffee',
  },
  {
    id: 'gradient_waves',
    name: 'Fluid Abstract Waves',
    description: 'Luminous fluid silk ribbons, ethereal glowing waves, smooth modern gradient mesh',
    promptSuffix: 'fluid iridescent waves, ethereal flowing silk ribbons, smooth gradient mesh, soft glowing highlights, modern abstract art, clean luxury aesthetic',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    iconName: 'Waves',
  },
  {
    id: 'modern_vector',
    name: 'Clean Vector Illustration',
    description: 'Flat geometric vector art, friendly modern startup style, high contrast, balanced space',
    promptSuffix: 'modern flat vector illustration, clean lines, balanced negative space, contemporary tech company brand style, vibrant yet refined color harmony',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconName: 'PenTool',
  },
  {
    id: 'botanical_calm',
    name: 'Calm Botanical',
    description: 'Minimalist monstera & eucalyptus, soft earthy tones, peaceful wabi-sabi mood',
    promptSuffix: 'serene botanical composition, delicate monstera and eucalyptus leaves, soft earthy linen backdrop, morning natural light, calming Japanese wabi-sabi mood',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    iconName: 'Leaf',
  },
  {
    id: 'obsidian_dark',
    name: 'Obsidian Neon Glow',
    description: 'Dark mode luxury, deep charcoal background with subtle cyan and violet luminous accents',
    promptSuffix: 'dark mode aesthetic, deep obsidian background, subtle luminous cyan and violet edge reflections, sleek futuristic minimal geometry, cinematic lighting',
    badgeColor: 'bg-zinc-800 text-zinc-200 border-zinc-700',
    iconName: 'Moon',
  },
];

export const CURATED_AI_HERO_PRESETS: AIHeroPreset[] = [
  {
    id: 'preset-3d-pastel-shapes',
    name: 'Pastel Geometric Spheres',
    category: '3d',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Floating pastel geometric spheres and cylinders in soft morning light, minimalist 3D',
    style: 'minimal_3d',
    aspectRatio: '16:9',
  },
  {
    id: 'preset-scandinavian-desk',
    name: 'Nordic Studio Desk',
    category: 'workspace',
    imageUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Minimalist designer desk with laptop, notebook, plant and gentle window light',
    style: 'editorial_workspace',
    aspectRatio: '16:9',
  },
  {
    id: 'preset-fluid-gradient-mesh',
    name: 'Auroral Gradient Mesh',
    category: 'abstract',
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Iridescent glowing fluid gradient waves in sunset pink, coral and indigo',
    style: 'gradient_waves',
    aspectRatio: '16:9',
  },
  {
    id: 'preset-botanical-zen',
    name: 'Serene Botanical Leaves',
    category: 'nature',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Minimalist green tropical foliage with soft morning shadow play on light stone',
    style: 'botanical_calm',
    aspectRatio: '16:9',
  },
  {
    id: 'preset-tech-analytics-glass',
    name: 'Glassmorphism Metric Flow',
    category: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Clean modern data visualization dashboard, frosted glass cards, subtle blue glow',
    style: 'modern_vector',
    aspectRatio: '16:9',
  },
  {
    id: 'preset-dark-obsidian-waves',
    name: 'Obsidian Velvet Waves',
    category: 'abstract',
    imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Deep charcoal and dark obsidian waves with subtle violet edge reflections',
    style: 'obsidian_dark',
    aspectRatio: '16:9',
  },
  {
    id: 'preset-minimal-architecture',
    name: 'Modernist Arches & Shadows',
    category: 'minimal',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Minimalist architectural arches with deep clean shadows, warm limestone, clean lines',
    style: 'minimal_3d',
    aspectRatio: '16:9',
  },
  {
    id: 'preset-creative-collab',
    name: 'Creative Studio Gathering',
    category: 'workspace',
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80',
    prompt: 'Creative team collaborating around a modern wooden desk, friendly natural atmosphere',
    style: 'editorial_workspace',
    aspectRatio: '16:9',
  },
];

export const SMART_PROMPT_SUGGESTIONS = [
  'Minimalist 3D geometric abstract shapes in slate and warm terracotta with soft shadows',
  'Sunlit Scandinavian workspace with a sleek laptop, ceramic coffee mug, and green monstera plant',
  'Luminous flowing fluid gradient waves with soft ethereal iridescent highlights',
  'Contemporary flat vector illustration of team feedback and collaboration, clean pastel colors',
  'Minimalist architectural staircase and concrete arches with dramatic morning light',
  'Serene eucalyptus leaves on warm linen textured background with gentle bokeh',
  'Futuristic dark obsidian glowing violet and cyan mesh ribbons, cinematic perspective',
  'Warm cup of coffee next to an open notebook and fountain pen on rustic wooden table',
];

export const RICH_TEXT_SNIPPETS = [
  {
    title: 'Customer Survey Intro',
    text: `Thank you for taking the time to share your feedback. Your insights directly shape our upcoming product roadmap and help us build a better experience for everyone.

**What to expect:**
- Takes approximately **2 minutes** to finish
- All responses are completely **anonymous**
- Feel free to be as candid and specific as possible`,
  },
  {
    title: 'Product Waitlist / Beta',
    text: `We're excited to invite you to early testing of our next generation platform!

**Early Access Perks:**
- 🚀 Instant priority onboarding
- 🎁 6 months of complimentary Pro tier access
- 💬 Direct Slack channel with our core engineering team

*Please answer 4 quick questions below so we can tailor your workspace.*`,
  },
  {
    title: 'Candidate Application',
    text: `Welcome to our hiring application process! We believe in thoughtful, human-first recruitment where your story matters more than keywords on a resume.

> *"Great work begins with genuine curiosity and shared values."*

**A quick tip:** Take your time on the written prompts—there are no trick questions!`,
  },
  {
    title: 'Event / Workshop RSVP',
    text: `Join us for an exclusive interactive session exploring conversational form design and user retention strategies.

**Session Details:**
- 📅 **Date:** Thursday, October 15, 2026
- ⏰ **Duration:** 45 minutes + live Q&A
- 📍 **Format:** Live Interactive Stream (recording provided)`,
  },
];

// Confirms the generated image URL actually resolves before handing it to
// the caller — Pollinations is a free best-effort service with no SLA, and
// a broken/slow image URL silently committed to the form would only surface
// later as a blank hero image on the live respondent-facing page.
function preloadImage(url: string, timeoutMs = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(true);
      return;
    }
    const img = new Image();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

function pickFallbackPreset(style: string): AIHeroPreset {
  return (
    CURATED_AI_HERO_PRESETS.find((preset) => preset.style === style) ??
    CURATED_AI_HERO_PRESETS[0]!
  );
}

export interface AIHeroImageResult {
  imageUrl: string;
  prompt: string;
  style: string;
  source: 'ai' | 'fallback';
}

/**
 * Generate an AI hero image via a free public image-generation service,
 * falling back to a curated preset if that service is unreachable or the
 * resulting image fails to load.
 */
export async function generateAIHeroImage(params: {
  prompt: string;
  style?: string;
  aspectRatio?: '16:9' | '4:3' | '1:1';
  formTitle?: string;
}): Promise<AIHeroImageResult> {
  const selectedStyle = params.style || 'minimal_3d';
  const styleObj = AI_HERO_STYLES.find((s) => s.id === selectedStyle);
  const fullPrompt = styleObj
    ? `${params.prompt}, ${styleObj.promptSuffix}`
    : params.prompt;

  const width = params.aspectRatio === '1:1' ? 800 : params.aspectRatio === '4:3' ? 1024 : 1200;
  const height = params.aspectRatio === '1:1' ? 800 : params.aspectRatio === '4:3' ? 768 : 675;
  const seed = Math.floor(Math.random() * 1000000);

  const cleanEncodedPrompt = encodeURIComponent(fullPrompt.slice(0, 280));
  const aiImageUrl = `https://image.pollinations.ai/prompt/${cleanEncodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  if (await preloadImage(aiImageUrl)) {
    return { imageUrl: aiImageUrl, prompt: fullPrompt, style: selectedStyle, source: 'ai' };
  }

  const fallback = pickFallbackPreset(selectedStyle);
  return { imageUrl: fallback.imageUrl, prompt: fullPrompt, style: selectedStyle, source: 'fallback' };
}

export interface AIWelcomeCopyResult {
  copy: AIWelcomeCopy;
  source: 'ai' | 'template';
}

/**
 * Generate AI Welcome Screen Copy via generateWelcomeCopyFn (a server
 * function that proxies to a free public LLM — see that file for why this
 * has to be server-side rather than a direct client fetch), falling back to
 * a curated template if that service is unreachable or returns something
 * unusable.
 */
export async function generateAIWelcomeCopy(params: {
  formTitle: string;
  formDescription?: string;
}): Promise<AIWelcomeCopyResult> {
  try {
    const { copy } = await generateWelcomeCopyFn({ data: params });
    if (copy) return { copy, source: 'ai' };
  } catch {
    // Falls through to the template below.
  }

  return { copy: getTemplateWelcomeCopy(params), source: 'template' };
}

// Offline/failure fallback only — reached when the public text-generation
// endpoint above is unreachable or returns something unparseable.
function getTemplateWelcomeCopy(params: { formTitle: string; formDescription?: string }): AIWelcomeCopy {
  const titleLower = params.formTitle.toLowerCase();
  if (titleLower.includes('feedback') || titleLower.includes('nps') || titleLower.includes('satisfaction')) {
    return {
      title: `We'd love your honest thoughts on ${params.formTitle}.`,
      description: `Your feedback helps our team understand what's working well and what we can improve next.\n\n**Quick Details:**\n- Takes **~90 seconds** to complete\n- Real answers from real people\n- Every response is read directly by our founders`,
      tagline: 'Customer Feedback',
      timeEstimate: 'Takes ~2 mins',
      buttonLabel: 'Share Your Thoughts',
      suggestedHeroPrompt: 'Minimalist 3D colorful geometric shapes in warm studio lighting, customer feedback concept',
    };
  }

  if (titleLower.includes('job') || titleLower.includes('apply') || titleLower.includes('hiring') || titleLower.includes('role')) {
    return {
      title: `Join our team — ${params.formTitle}`,
      description: `We're building products that make a difference, and we're looking for passionate teammates to join us.\n\n**What to expect:**\n- 4 short questions about your background and interests\n- No generic resume parsing\n- Direct response within 48 hours`,
      tagline: 'Now Hiring',
      timeEstimate: 'Takes ~3 mins',
      buttonLabel: 'Start Application',
      suggestedHeroPrompt: 'Aesthetic modern wooden workspace desk with laptop and gentle sunlight, hiring concept',
    };
  }

  if (titleLower.includes('waitlist') || titleLower.includes('beta') || titleLower.includes('early')) {
    return {
      title: `Get early access to ${params.formTitle}`,
      description: `We're rolling out private access in small cohorts to ensure a top-tier experience for early adopters.\n\n**Early Member Perks:**\n- 🚀 Priority access when invitations go out\n- 💎 Lifetime badge and founder discounts\n- 🤝 Influence feature roadmap directly`,
      tagline: 'Private Beta',
      timeEstimate: 'Takes ~1 min',
      buttonLabel: 'Request Invite',
      suggestedHeroPrompt: 'Futuristic glowing neon ribbon mesh with purple and cyan accents, luxury tech waitlist',
    };
  }

  // General default
  return {
    title: `Welcome to ${params.formTitle}`,
    description: params.formDescription
      ? `${params.formDescription}\n\n**Instructions:**\n- Please take your time answering each question\n- Use **Enter ↵** or tap the navigation buttons to proceed`
      : `Thank you for taking a moment to complete this form. We appreciate your time and perspective.\n\n**Key Highlights:**\n- Quick and easy to answer\n- Seamless keyboard navigation\n- Save progress anytime`,
    tagline: 'Quick Overview',
    timeEstimate: 'Takes ~2 mins',
    buttonLabel: 'Get Started',
    suggestedHeroPrompt: 'Clean minimalist modern 3D abstract shapes with soft studio lighting',
  };
}
