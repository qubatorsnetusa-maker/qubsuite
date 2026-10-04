import { useEffect, useState, type ComponentType } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  GalleryHorizontal,
  GitBranch,
  Layers,
  LineChart,
  Lock,
  Menu,
  Monitor,
  Palette,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Webhook,
  X,
  Zap,
} from 'lucide-react'
import { copyToClipboard } from '@/formsV3/utils/shareUtils'

type SessionUser = { id: string; name: string; email: string } | null

const NAV_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#templates', label: 'Templates' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#pricing', label: 'Pricing' },
]

const FOOTER_ANCHOR_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#templates', label: 'Templates' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#pricing', label: 'Pricing' },
]

const FOOTER_LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
] as const

const BENTO_CARDS: {
  span: string
  icon: ComponentType<{ className?: string }>
  iconWrap: string
  glow: string
  hover: string
  title: string
  body: string
}[] = [
  {
    span: 'md:col-span-7',
    icon: GalleryHorizontal,
    iconWrap: 'bg-accent-indigo-subtle border border-primary/20 text-primary',
    glow: 'bg-primary/5',
    hover: 'hover:border-primary/40',
    title: "'One Question at a Time' Focus",
    body: 'Immersive full-screen questions isolate focus, eliminating cognitive fatigue and endless vertical scrolling. Respondents stay in flow state from first prompt to completion.',
  },
  {
    span: 'md:col-span-5',
    icon: GitBranch,
    iconWrap: 'bg-sky-50 border border-sky-200 text-sky-600',
    glow: 'bg-sky-50',
    hover: 'hover:border-secondary/40',
    title: 'Visual Branching & Logic Jumps',
    body: 'Design infinite dynamic paths with our fluid visual logic canvas. Ask the right follow-ups and skip irrelevant steps based on live inputs.',
  },
  {
    span: 'md:col-span-5',
    icon: Palette,
    iconWrap: 'bg-rose-50 border border-rose-200 text-rose-600',
    glow: 'bg-rose-50',
    hover: 'hover:border-rose-300',
    title: 'Pixel-Perfect Theming',
    body: 'Infuse your brand voice effortlessly. Custom typography, animated video backdrops, bespoke border radii, and dark/light glass tokens without writing CSS.',
  },
  {
    span: 'md:col-span-7',
    icon: LineChart,
    iconWrap: 'bg-accent-indigo-subtle border border-primary/20 text-primary',
    glow: 'bg-primary/5',
    hover: 'hover:border-primary/40',
    title: 'Deep Analytics & Drop-off Heatmaps',
    body: 'Diagnose friction step-by-step. Pinpoint precisely where potential clients hesitate with per-field drop-off metrics and time-to-respond heatmaps.',
  },
]

export function HomePage({ user }: { user: SessionUser }) {
  const authHref = user ? '/workspace' : '/login'

  return (
    <div className="bg-background text-on-surface antialiased selection:bg-primary selection:text-white min-h-screen flex flex-col font-body-md overflow-x-hidden">
      <TopNavBar authHref={authHref} />
      <Hero authHref={authHref} />
      <CapabilitiesGrid />
      <UseCaseShowcase authHref={authHref} />
      <IntegrationsSection />
      <PricingSection authHref={authHref} />
      <Footer />
      <MobileStickyCTA authHref={authHref} />
    </div>
  )
}

function MobileStickyCTA({ authHref }: { authHref: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-outline-variant px-4 pt-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <Link
        className="w-full bg-primary text-white hover:bg-accent-indigo-hover font-label-md text-label-md px-6 py-3.5 rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all duration-150 shadow-md font-semibold"
        to={authHref}
      >
        <span>Create Free qub-form</span>
        <ArrowRight size={18} />
      </Link>
    </div>
  )
}

function TopNavBar({ authHref }: { authHref: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-outline-variant">
      <div className="flex justify-between items-center w-full px-6 md:px-12 max-w-7xl mx-auto h-20">
        <a
          className="flex items-center gap-3 text-headline-sm font-headline-sm font-bold tracking-tight text-on-surface group"
          href="#"
        >
          <div className="w-8 h-8 rounded-lg bg-accent-indigo-subtle border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-200 shadow-sm">
            <Sparkles size={20} />
          </div>
          <span className="text-headline-sm font-headline-sm font-bold tracking-tight text-on-surface">
            Qub-forms
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link.href}
              className={
                i === 0
                  ? 'text-primary font-semibold text-label-md font-label-md hover:text-primary transition-colors duration-150 active:scale-95'
                  : 'text-on-surface-variant font-medium text-label-md font-label-md hover:text-on-surface transition-colors duration-150 active:scale-95'
              }
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            className="hidden sm:inline-flex text-on-surface-variant hover:text-on-surface text-label-md font-label-md px-3 py-2 transition-colors duration-150 font-medium"
            to={authHref}
          >
            Log In
          </Link>
          <Link
            className="hidden sm:inline-flex bg-primary text-white hover:bg-accent-indigo-hover px-4 py-2.5 rounded-lg text-label-md font-label-md transition-all duration-150 active:scale-95 shadow-sm font-semibold items-center gap-1.5"
            to={authHref}
          >
            <span>Create Free Qub-form</span>
            <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-outline-variant bg-white px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className="text-on-surface-variant font-medium text-label-md font-label-md hover:text-primary py-2.5"
              href={link.href}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-outline-variant">
            <Link
              className="text-on-surface-variant hover:text-on-surface text-label-md font-label-md px-3 py-2.5 font-medium"
              to={authHref}
              onClick={() => setMobileOpen(false)}
            >
              Log In
            </Link>
            <Link
              className="bg-primary text-white hover:bg-accent-indigo-hover px-4 py-2.5 rounded-lg text-label-md font-label-md transition-all duration-150 shadow-sm font-semibold flex items-center justify-center gap-1.5"
              to={authHref}
              onClick={() => setMobileOpen(false)}
            >
              <span>Create Free qub-form</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

function Hero({ authHref }: { authHref: string }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [activeStep, setActiveStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [emailInput, setEmailInput] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Real live timer for interactive sandbox session
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}m ${s < 10 ? '0' : ''}${s}s`
  }

  const steps = [
    {
      id: 'q1',
      number: '01',
      title: 'What brings your team to qub-forms today?',
      subtitle: 'Choose your primary workflow to test the conversational routing engine.',
      options: [
        { key: 'A', label: 'Lead Generation & Inbound Sales' },
        { key: 'B', label: 'Customer Satisfaction & NPS' },
        { key: 'C', label: 'Employee Feedback & Team Ops' },
        { key: 'D', label: 'Event Registration & RSVP' },
      ],
    },
    {
      id: 'q2',
      number: '02',
      title: 'What is the size of your organization?',
      subtitle: 'Help us calibrate response volume and workspace quotas.',
      options: [
        { key: 'A', label: '1 - 10 people (Startup)' },
        { key: 'B', label: '11 - 50 people (Growing team)' },
        { key: 'C', label: '51 - 250 people (Scale-up)' },
        { key: 'D', label: '251+ people (Enterprise)' },
      ],
    },
    {
      id: 'q3',
      number: '03',
      title: 'Where should we send your sample workflow templates?',
      subtitle: 'Enter a valid email address to test instant validation.',
      type: 'email',
    },
  ]

  const totalSteps = steps.length
  const isCompleted = activeStep >= totalSteps
  const progressPercent = isCompleted ? 100 : Math.round((activeStep / totalSteps) * 100)

  const handleSelectOption = (stepId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [stepId]: val }))
    setTimeout(() => {
      setActiveStep((prev) => prev + 1)
    }, 220)
  }

  const handleNext = () => {
    if (activeStep < totalSteps) {
      if (activeStep === 2 && emailInput) {
        setAnswers((prev) => ({ ...prev, q3: emailInput }))
      }
      setActiveStep((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1)
    }
  }

  const handleRestart = () => {
    setAnswers({})
    setEmailInput('')
    setActiveStep(0)
    setElapsedSeconds(0)
  }

  return (
    <section className="relative pt-12 md:pt-20 pb-16 md:pb-28 px-6 md:px-12 max-w-7xl mx-auto w-full">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-[700px] max-w-[95vw] h-[380px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-12 md:mb-16">
        <h1 className="text-headline-xl-mobile md:text-display-hero font-display-hero text-on-surface tracking-tight mb-6">
          Forms people{' '}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            actually love
          </span>{' '}
          filling out.
        </h1>

        <p className="text-body-md md:text-body-lg font-body-md text-on-surface-variant max-w-2xl mb-8 leading-relaxed">
          Turn mundane questionnaires into dynamic, conversational experiences. Boost completion
          rates with intuitive keyboard-driven flows, conditional logic, and frictionless design.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            className="w-full sm:w-auto bg-primary text-white hover:bg-accent-indigo-hover font-label-md text-label-md px-6 py-3.5 rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all duration-150 shadow-md font-semibold"
            to={authHref}
          >
            <span>Create Free qub-form</span>
            <ArrowRight size={18} />
          </Link>
          <a
            className="w-full sm:w-auto bg-white border border-outline-variant text-on-surface hover:text-primary hover:border-primary/40 font-label-md text-label-md px-6 py-3.5 rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-all duration-150 shadow-sm font-medium"
            href="#demo"
          >
            <PlayCircle size={18} className="text-primary" />
            <span>Explore Interactive Demo</span>
          </a>
        </div>
      </div>

      {/* Real Interactive Demo Container */}
      <div className="relative max-w-5xl mx-auto" id="demo">
        {/* Floating Telemetry Badge */}
        <div className="hidden lg:flex absolute -left-10 top-14 z-20 glass-surface p-3.5 rounded-xl items-center gap-3 shadow-lg border border-outline-variant">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Timer size={18} />
          </div>
          <div>
            <p className="text-label-sm font-label-sm text-slate-500">Live Session Elapsed</p>
            <p className="text-body-sm font-code-sm font-semibold text-on-surface font-mono">
              {formatTimer(elapsedSeconds)}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex absolute -right-8 bottom-20 z-20 glass-surface p-3.5 rounded-xl items-center gap-3 shadow-lg border border-outline-variant">
          <div className="w-8 h-8 rounded-lg bg-accent-indigo-subtle text-primary flex items-center justify-center border border-primary/20">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-label-sm font-label-sm text-slate-500">Completion</p>
            <p className="text-body-sm font-code-sm font-semibold text-on-surface">
              {progressPercent}% <span className="text-primary text-[11px] font-medium">({activeStep} of {totalSteps} steps)</span>
            </p>
          </div>
        </div>

        {/* Browser Sandbox Frame */}
        <div className={`glass-surface ambient-glow rounded-xl overflow-hidden border border-outline-variant shadow-xl transition-all duration-300 ${device === 'mobile' ? 'max-w-md mx-auto ring-8 ring-slate-900/10' : 'w-full'}`}>
          {/* Top Browser Bar */}
          <div className="bg-surface-container px-4 py-3 border-b border-outline-variant flex flex-wrap items-center justify-between gap-2 select-none">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
              <span className="ml-2 text-label-sm font-code-sm text-on-surface-variant font-medium truncate max-w-[160px] sm:max-w-none">
                qubforms.app/demo/interactive
              </span>
            </div>

            {/* Viewport Device Toggle */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-outline-variant">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                  device === 'desktop'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setDevice('mobile')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                  device === 'mobile'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Smartphone size={14} />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>

          {/* Interactive Form Body */}
          <div className="p-6 sm:p-8 md:p-12 bg-white min-h-[440px] flex flex-col justify-between relative">
            {/* Header: Progress Bar */}
            <div>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                <span className="text-label-sm font-code-sm text-primary tracking-wide flex items-center gap-1.5 font-semibold">
                  <SlidersHorizontal size={14} /> Step {Math.min(activeStep + 1, totalSteps)} of {totalSteps} • Interactive Sandbox
                </span>
                <span className="text-label-sm font-code-sm text-on-surface-variant font-medium">
                  {progressPercent}% completed
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-sm" />
                </div>
              </div>
            </div>

            {/* Question Screen Render */}
            {!isCompleted ? (
              <div className="my-8 max-w-2xl">
                <div className="flex items-center gap-2 text-label-md font-label-md text-primary mb-2 font-bold">
                  <span>{steps[activeStep]!.number}</span>
                  <ArrowRight size={16} />
                </div>
                <h2 className="text-headline-md md:text-headline-lg font-headline-lg text-on-surface font-semibold tracking-tight mb-2">
                  {steps[activeStep]!.title}
                </h2>
                <p className="text-body-sm font-body-sm text-on-surface-variant mb-6">
                  {steps[activeStep]!.subtitle}
                </p>

                {steps[activeStep]!.options ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {steps[activeStep]!.options!.map((option) => {
                      const active = answers[steps[activeStep]!.id] === option.label
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleSelectOption(steps[activeStep]!.id, option.label)}
                          className={`text-left p-4 rounded-xl flex items-center justify-between transition-all group active:scale-98 cursor-pointer ${
                            active
                              ? 'bg-accent-indigo-subtle border-2 border-primary shadow-sm'
                              : 'hover:border-primary/40 bg-surface-container/50 border border-outline-variant'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-md font-code-sm text-label-sm flex items-center justify-center font-bold shadow-sm ${
                                active
                                  ? 'bg-primary text-white'
                                  : 'bg-white border border-outline-variant group-hover:border-primary/50 text-on-surface-variant'
                              }`}
                            >
                              {option.key}
                            </span>
                            <span
                              className={`text-body-sm font-label-md transition-colors ${
                                active
                                  ? 'font-semibold text-primary'
                                  : 'text-on-surface-variant group-hover:text-on-surface font-medium'
                              }`}
                            >
                              {option.label}
                            </span>
                          </div>
                          {active ? (
                            <CheckCircle2 size={20} className="text-primary" />
                          ) : (
                            <Circle
                              size={20}
                              className="text-outline opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNext()
                      }}
                      placeholder="alex@company.com"
                      className="w-full text-base sm:text-lg border-2 border-outline-variant focus:border-primary rounded-xl px-4 py-3 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-accent-indigo-hover transition cursor-pointer shadow-sm"
                    >
                      Continue
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Completed Screen */
              <div className="my-8 max-w-xl text-center mx-auto space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-headline-lg font-headline-lg font-bold text-on-surface">
                  You just finished the flow!
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  Notice how effortless, focused, and responsive that felt? Build your own real forms with our full multi-step visual builder.
                </p>
                <div className="p-4 rounded-xl bg-surface-container border border-outline-variant text-left text-xs font-mono-code space-y-1">
                  <div className="font-semibold text-on-surface mb-2 font-sans text-xs">Recorded Answers:</div>
                  <div>• Workflow: {answers['q1'] || 'Not specified'}</div>
                  <div>• Org Size: {answers['q2'] || 'Not specified'}</div>
                  {answers['q3'] && <div>• Email: {answers['q3']}</div>}
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="px-4 py-2 rounded-lg border border-outline-variant bg-white hover:bg-surface-container text-on-surface text-sm font-semibold transition cursor-pointer"
                  >
                    Restart Flow
                  </button>
                  <Link
                    to={authHref}
                    className="px-5 py-2 rounded-lg bg-primary hover:bg-accent-indigo-hover text-white text-sm font-semibold transition shadow-sm"
                  >
                    Create Free Form
                  </Link>
                </div>
              </div>
            )}

            {/* Navigation Bottom Controls */}
            {!isCompleted && (
              <div className="pt-6 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
                <div className="flex items-center gap-2 text-body-sm font-code-sm text-on-surface-variant">
                  <span>Press</span>
                  <kbd className="px-2 py-0.5 bg-surface-container border border-outline-variant rounded text-on-surface text-[12px] shadow-sm font-medium">
                    Enter ↵
                  </kbd>
                  <span>or click</span>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={activeStep === 0}
                    className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant text-label-sm font-label-sm flex items-center gap-1 border border-outline-variant font-medium cursor-pointer"
                  >
                    <ArrowUp size={16} /> Prev
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-1.5 rounded-lg bg-primary hover:bg-accent-indigo-hover text-white text-label-sm font-label-sm font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    Next <ArrowDown size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function CapabilitiesGrid() {
  return (
    <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full" id="product">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <p className="text-label-sm font-label-sm text-primary tracking-widest uppercase mb-3 font-semibold">
          Architected for Conversion
        </p>
        <h2 className="text-headline-lg md:text-headline-xl font-headline-xl text-on-surface font-semibold tracking-tight mb-4">
          Why modern builders choose qub-forms
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Every interaction is engineered with cognitive psychology, lightning-fast rendering,
          and intuitive logic.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {BENTO_CARDS.map((card) => (
          <div
            key={card.title}
            className={`${card.span} glass-surface rounded-2xl p-6 sm:p-8 flex flex-col justify-between ${card.hover} transition-colors relative overflow-hidden group shadow-sm`}
          >
            <div
              className={`absolute -right-16 -top-16 w-52 h-52 ${card.glow} rounded-full blur-3xl pointer-events-none`}
            />
            <div>
              <div
                className={`w-12 h-12 rounded-xl ${card.iconWrap} flex items-center justify-center mb-6 shadow-sm`}
              >
                <card.icon className="w-6 h-6" />
              </div>
              <h3 className="text-headline-md font-headline-md text-on-surface font-semibold mb-3">
                {card.title}
              </h3>
              <p className="text-body-sm font-body-sm text-on-surface-variant max-w-md leading-relaxed mb-6">
                {card.body}
              </p>
            </div>
            <BentoSnippet title={card.title} />
          </div>
        ))}
      </div>
    </section>
  )
}

function BentoSnippet({ title }: { title: string }) {
  const [selectedScore, setSelectedScore] = useState<number>(3)
  const [branchChoice, setBranchChoice] = useState<'yes' | 'no'>('yes')
  const [activeThemeId, setActiveThemeId] = useState<'slate' | 'midnight' | 'sunrise'>('slate')

  if (title.startsWith("'One Question")) {
    return (
      <div className="bg-surface-container p-4 rounded-xl border border-outline-variant mt-4">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-code-sm text-primary font-semibold">
          <span className="w-2 h-2 rounded-full bg-primary" /> Single Focus Lane
        </div>
        <p className="text-label-md font-label-md text-on-surface font-semibold mb-3">
          How satisfied are you with our deployment speed?
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { score: 1, label: '1 - Poor' },
            { score: 2, label: '2' },
            { score: 3, label: '3 - Great' },
            { score: 4, label: '4 - Exceptional' },
          ].map((item) => (
            <button
              key={item.score}
              type="button"
              onClick={() => setSelectedScore(item.score)}
              className={`px-3 py-1.5 rounded-lg text-xs font-code-sm transition cursor-pointer shadow-sm ${
                selectedScore === item.score
                  ? 'bg-accent-indigo-subtle border-2 border-primary text-primary font-bold'
                  : 'bg-white border border-outline-variant text-on-surface-variant hover:border-primary/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (title.startsWith('Visual Branching')) {
    return (
      <div className="bg-surface-container p-4 rounded-xl border border-outline-variant mt-4">
        <div className="flex items-center justify-between text-[11px] font-code-sm text-sky-700 font-semibold mb-2">
          <span>Interactive Condition Evaluator</span>
          <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-mono">Live Jump</span>
        </div>
        <p className="text-xs font-semibold text-on-surface mb-2">"Do you have existing form data?"</p>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setBranchChoice('yes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              branchChoice === 'yes'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-white border border-outline-variant text-slate-700'
            }`}
          >
            Yes, migrate data
          </button>
          <button
            type="button"
            onClick={() => setBranchChoice('no')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              branchChoice === 'no'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-white border border-outline-variant text-slate-700'
            }`}
          >
            No, start fresh
          </button>
        </div>
        <div className="text-[11px] font-mono bg-white p-2 rounded-lg border border-sky-200 text-sky-900 flex items-center gap-1.5">
          <GitBranch size={12} className="text-sky-600" />
          <span>
            {branchChoice === 'yes'
              ? 'Condition matched ➔ Jumps to Step 3 (Migration Wizard)'
              : 'Condition matched ➔ Jumps to Step 2 (Blank Canvas)'}
          </span>
        </div>
      </div>
    )
  }

  if (title.startsWith('Pixel-Perfect')) {
    const themeStyles = {
      slate: { bg: 'bg-slate-50', text: 'text-slate-900', border: 'border-slate-300', btn: 'bg-indigo-600 text-white' },
      midnight: { bg: 'bg-slate-950', text: 'text-slate-100', border: 'border-violet-500', btn: 'bg-violet-600 text-white' },
      sunrise: { bg: 'bg-amber-50', text: 'text-amber-950', border: 'border-orange-400', btn: 'bg-orange-600 text-white' },
    }
    const current = themeStyles[activeThemeId]

    return (
      <div className="bg-surface-container p-4 rounded-xl border border-outline-variant mt-4">
        <div className="flex items-center justify-between text-[11px] font-code-sm text-rose-700 font-semibold mb-2">
          <span>Theme Token Previewer</span>
          <div className="flex gap-1">
            {(['slate', 'midnight', 'sunrise'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveThemeId(t)}
                className={`text-[10px] px-2 py-0.5 rounded capitalize font-semibold cursor-pointer ${
                  activeThemeId === t ? 'bg-rose-600 text-white' : 'bg-white text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className={`p-3 rounded-xl border ${current.bg} ${current.border} transition-all duration-200 mt-2`}>
          <div className={`text-xs font-semibold ${current.text} mb-2`}>Live Respondent Theme Test</div>
          <button type="button" className={`px-3 py-1 rounded text-xs font-bold ${current.btn} shadow-xs`}>
            Accent Button
          </button>
        </div>
      </div>
    )
  }

  // Deep Analytics Heatmap Card
  const stepMetrics = [
    { label: 'Step 1: Welcome', rate: '99.1%', time: '4s', drop: '0.9%' },
    { label: 'Step 2: Team Size', rate: '96.4%', time: '9s', drop: '2.7%' },
    { label: 'Step 3: Work Email', rate: '89.2%', time: '14s', drop: '7.2%' },
    { label: 'Step 4: Submission', rate: '86.5%', time: '6s', drop: '2.7%' },
  ]

  return (
    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant mt-4">
      <div className="text-[11px] font-code-sm text-primary font-semibold mb-2 flex items-center justify-between">
        <span>Per-Step Drop-Off & Time Telemetry</span>
        <span className="text-[10px] text-slate-500 font-mono">Aggregated Data</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-code-sm">
        {stepMetrics.map((step) => (
          <div key={step.label} className="p-2.5 rounded-lg bg-white border border-outline-variant shadow-sm">
            <div className="text-[10px] font-medium text-slate-500 truncate">{step.label}</div>
            <div className="font-bold mt-1 text-emerald-600">{step.rate}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Avg: {step.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function UseCaseShowcase({ authHref }: { authHref: string }) {
  const [activeTab, setActiveTab] = useState<'feedback' | 'marketing' | 'hr' | 'sales'>('feedback')
  const [csatRating, setCsatRating] = useState<number>(9)
  const [selectedFeature, setSelectedFeature] = useState<string>('logic')
  const [selectedBudget, setSelectedBudget] = useState<string>('growth')

  const tabConfigs = {
    feedback: {
      badge: 'CSAT & Net Promoter Score',
      heading: 'Capture honest feedback without survey fatigue.',
      body: 'Replace dry grid surveys with emotionally engaging scale inputs, emoji reactions, and spontaneous open-ended sentiment questions.',
      benefits: [
        'Instant routing of low scores (<6) to support notifications',
        'Automatic calculation of CSAT & Net Promoter benchmarks',
        'Embeddable as inline modal or full-page experience',
      ],
      previewTitle: 'Customer Satisfaction Survey',
      previewPrompt: 'How likely are you to recommend our platform to a colleague?',
    },
    marketing: {
      badge: 'Product Marketing & Research',
      heading: 'Validate features and prioritize roadmap faster.',
      body: 'Uncover what your users value most with weighted ranking, multiple-choice selection, and direct feature interest polls.',
      benefits: [
        'Quantifiable feature interest metrics with instant export',
        'Dynamic branching to drill down into requested capabilities',
        'Zero dropoff with friction-free keyboard navigation',
      ],
      previewTitle: 'Feature Discovery Flow',
      previewPrompt: 'Which upcoming capability would benefit your team the most?',
    },
    hr: {
      badge: 'People Ops & Employee Pulse',
      heading: 'Foster open team communication with private check-ins.',
      body: 'Regular pulse surveys and onboarding feedback that employees actually complete. Safe, encrypted, and accessible anywhere.',
      benefits: [
        'Secure responses with optional anonymous submission',
        'Mobile-friendly for on-the-go or remote team members',
        'Automated digest summaries delivered to HR leadership',
      ],
      previewTitle: 'Weekly Team Pulse',
      previewPrompt: 'How well-supported did you feel in your projects this sprint?',
    },
    sales: {
      badge: 'Lead Qualification & Intake',
      heading: 'Turn web visitors into qualified pipeline in minutes.',
      body: 'Ask the right qualifying questions one at a time. Segment prospects by budget, timeline, and company size before booking calls.',
      benefits: [
        'Real-time webhook handoff to your CRM or custom API',
        'Direct calendar booking integration on thank-you screen',
        'Significantly higher conversion than static web forms',
      ],
      previewTitle: 'Enterprise Consultation Intake',
      previewPrompt: 'What is your estimated timeline for project rollout?',
    },
  }

  const current = tabConfigs[activeTab]

  return (
    <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full" id="templates">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <p className="text-label-sm font-label-sm text-primary tracking-widest uppercase mb-3 font-semibold">
          Versatile Experiences
        </p>
        <h2 className="text-headline-lg md:text-headline-xl font-headline-xl text-on-surface font-semibold tracking-tight mb-4">
          Engineered for every business touchpoint
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Switch between purpose-built conversational workflows tested on millions of submissions.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {[
          { key: 'feedback', label: 'Customer Feedback' },
          { key: 'marketing', label: 'Product Marketing' },
          { key: 'hr', label: 'HR & People Ops' },
          { key: 'sales', label: 'Sales Lead Capture' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-2.5 rounded-lg text-label-md font-label-md transition-all shadow-sm cursor-pointer ${
              activeTab === tab.key
                ? 'bg-primary text-white font-semibold shadow-md'
                : 'bg-white border border-outline-variant hover:text-primary hover:border-primary/40 text-on-surface-variant font-medium'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dynamic Showcase Card */}
      <div className="glass-surface ambient-glow rounded-2xl p-6 sm:p-8 md:p-12 border border-outline-variant grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-lg">
        <div className="lg:col-span-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-indigo-subtle border border-primary/20 text-primary text-label-sm font-code-sm mb-4 font-semibold">
            <Star size={14} fill="currentColor" /> {current.badge}
          </div>
          <h3 className="text-headline-lg font-headline-lg text-on-surface font-bold mb-4">
            {current.heading}
          </h3>
          <p className="text-body-md font-body-md text-on-surface-variant mb-6 leading-relaxed">
            {current.body}
          </p>
          <ul className="space-y-3 mb-8">
            {current.benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-body-sm font-body-sm text-on-surface font-medium">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            className="inline-flex items-center gap-2 text-primary font-label-md text-label-md font-semibold hover:underline"
            to={authHref}
          >
            <span>Use this template in Workspace</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="lg:col-span-7 bg-surface-container p-5 sm:p-6 md:p-8 rounded-2xl border border-outline-variant shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-6 border-b border-outline-variant text-xs font-code-sm text-slate-500">
            <span>{current.previewTitle}</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Interactive Demo
            </span>
          </div>

          <h4 className="text-headline-sm font-headline-sm text-on-surface font-semibold mb-2">
            {current.previewPrompt}
          </h4>

          {/* Tab-specific interactive elements */}
          {activeTab === 'feedback' && (
            <div className="mt-4">
              <p className="text-body-sm font-body-sm text-on-surface-variant mb-6">
                0 is Not at all likely, 10 is Extremely likely
              </p>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1 md:gap-1.5 mb-6">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCsatRating(n)}
                    className={`py-2 sm:py-2.5 rounded-lg text-center font-code-sm text-[11px] sm:text-xs font-bold transition cursor-pointer shadow-sm ${
                      csatRating === n
                        ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                        : 'bg-white border border-outline-variant hover:border-primary/40 hover:bg-slate-50 text-on-surface'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-label-sm font-label-sm text-slate-500 font-medium">
                <span>Not likely (0)</span>
                <span className="font-semibold text-primary font-mono">Selected: {csatRating} / 10</span>
                <span>Extremely likely (10)</span>
              </div>
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="mt-4 space-y-2">
              {[
                { id: 'logic', title: 'Visual Conditional Logic Branching' },
                { id: 'analytics', title: 'Step-by-step Funnel & Drop-off Heatmaps' },
                { id: 'webhook', title: 'Automated Webhooks & Spreadsheet Sync' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedFeature(opt.id)}
                  className={`w-full p-3.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                    selectedFeature === opt.id
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white border-outline-variant text-slate-800 hover:border-primary/40'
                  }`}
                >
                  <span>{opt.title}</span>
                  {selectedFeature === opt.id && <Check size={16} />}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'hr' && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'great', label: '😃 Great — high momentum' },
                  { id: 'steady', label: '🙂 Steady — on track' },
                  { id: 'blocked', label: '😟 Blocked — need assistance' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedFeature(item.id)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                      selectedFeature === item.id
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white border-outline-variant text-slate-700 hover:border-primary/40'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="mt-4 space-y-2">
              {[
                { id: 'immediate', title: 'Within 2 weeks — active rollout' },
                { id: 'growth', title: '1 - 3 months — strategic evaluation' },
                { id: 'future', title: 'Q3/Q4 — preliminary research' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedBudget(opt.id)}
                  className={`w-full p-3.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                    selectedBudget === opt.id
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white border-outline-variant text-slate-800 hover:border-primary/40'
                  }`}
                >
                  <span>{opt.title}</span>
                  {selectedBudget === opt.id && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function IntegrationsSection() {
  const [copiedCode, setCopiedCode] = useState(false)

  const curlCode = `curl -X POST https://qubforms.app/api/webhook/submissions \\
  -H "x-api-key: your_workspace_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"formId": "form_123", "answers": {"q1": "Alice", "q2": "Delighted"}}'`

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(curlCode)
    if (ok) {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  return (
    <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full border-t border-outline-variant" id="integrations">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <p className="text-label-sm font-label-sm text-primary tracking-widest uppercase mb-3 font-semibold">
          Developer & Pipeline Ready
        </p>
        <h2 className="text-headline-lg md:text-headline-xl font-headline-xl text-on-surface font-semibold tracking-tight mb-4">
          Connect your responses to any destination
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Send submissions directly to webhooks, spreadsheets, or your internal CRM with secure API keys and real-time push.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Features list */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl border border-outline-variant bg-white shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Webhook size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface mb-1">Standard Inbound Webhooks</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Send submission data instantly using our authenticated <code>/api/webhook/submissions</code> endpoint protected by your workspace API keys.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-outline-variant bg-white shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface mb-1">Qubator Sheets Real-Time Sync</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Connect your conversational forms directly to live collaborative spreadsheets for instantaneous row-by-row aggregation.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-outline-variant bg-white shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0">
              <Code2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface mb-1">JSON Schema Portability</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Export and import complete form schemas and question definitions anytime with zero proprietary lock-in.
              </p>
            </div>
          </div>
        </div>

        {/* Code terminal preview */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl text-slate-100 font-mono text-xs overflow-hidden">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="ml-2 text-slate-400 text-[11px]">Webhook Endpoint Test</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition cursor-pointer"
            >
              {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedCode ? 'Copied!' : 'Copy cURL'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300">
            <code>{curlCode}</code>
          </pre>
          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Response: 201 Created • {"{"}"received": true{"}"}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function PricingSection({ authHref }: { authHref: string }) {
  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      period: 'forever',
      description: 'Ideal for individuals and side-projects launching conversational forms.',
      features: [
        'Unlimited active forms',
        'Up to 500 submissions / month',
        'Conversational step builder',
        'Standard Webhook integration',
        'Export responses to CSV / JSON',
      ],
      cta: 'Get Started Free',
      popular: false,
    },
    {
      name: 'Professional',
      price: '$24',
      period: 'per month',
      description: 'For growing businesses requiring conditional branching and advanced branding.',
      features: [
        'Unlimited forms & submissions',
        'Visual branching & conditional jumps',
        'Bespoke CSS themes & custom logos',
        'Instant email submission alerts',
        'Drop-off and funnel analytics',
        'Priority community support',
      ],
      cta: 'Start Pro Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: '$79',
      period: 'per month',
      description: 'Complete workspace power for teams and agencies with security compliance.',
      features: [
        'Unlimited team workspaces',
        'Multi-user workspace access',
        'Dedicated API keys & rate limits',
        'Custom domain respondent URLs',
        'Audit logs & revision history',
        'Dedicated 99.9% uptime SLA',
      ],
      cta: 'Contact Enterprise',
      popular: false,
    },
  ]

  return (
    <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full border-t border-outline-variant" id="pricing">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <p className="text-label-sm font-label-sm text-primary tracking-widest uppercase mb-3 font-semibold">
          Transparent Value
        </p>
        <h2 className="text-headline-lg md:text-headline-xl font-headline-xl text-on-surface font-semibold tracking-tight mb-4">
          Simple pricing designed to scale with your responses
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Start building for free with zero credit card required. Upgrade as your submission volume grows.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl p-8 flex flex-col justify-between transition-all duration-200 ${
              tier.popular
                ? 'bg-white border-2 border-primary shadow-xl ring-4 ring-primary/10 relative'
                : 'glass-surface border border-outline-variant shadow-sm'
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                Most Popular
              </span>
            )}
            <div>
              <div className="text-base font-bold text-on-surface mb-2">{tier.name}</div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-4xl font-extrabold text-on-surface">{tier.price}</span>
                <span className="text-xs text-on-surface-variant">{tier.period}</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">{tier.description}</p>
              <div className="border-t border-outline-variant pt-6 mb-8 space-y-3">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5 text-xs text-on-surface">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <Link
              to={authHref}
              className={`w-full py-3 rounded-xl text-center text-xs font-semibold transition-all duration-150 active:scale-95 shadow-xs ${
                tier.popular
                  ? 'bg-primary text-white hover:bg-accent-indigo-hover shadow-md'
                  : 'bg-white border border-outline-variant text-on-surface hover:bg-surface-container'
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-white border-t border-outline-variant mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-6 md:px-12 py-12 max-w-7xl mx-auto gap-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <a className="text-headline-sm font-headline-sm font-bold text-on-surface flex items-center gap-2" href="#">
            <div className="w-6 h-6 rounded bg-accent-indigo-subtle border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles size={16} />
            </div>
            <span>Qub-forms</span>
          </a>
          <span className="hidden sm:inline text-outline-variant">•</span>
          <span className="text-body-sm font-body-sm text-on-surface-variant">
            © 2026 Qubator, Inc. All rights reserved.
          </span>
        </div>
        <nav className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2">
          {FOOTER_ANCHOR_LINKS.map((link) => (
            <a
              key={link.href}
              className="text-on-surface-variant text-label-sm font-label-sm hover:text-primary transition-colors duration-150 active:scale-98 font-medium"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
          {FOOTER_LEGAL_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to as any}
              className="text-on-surface-variant text-label-sm font-label-sm hover:text-primary transition-colors duration-150 active:scale-98 font-medium"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
