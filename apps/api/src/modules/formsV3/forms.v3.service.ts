import type { AIWelcomeCopy, GenerateWelcomeCopyInput } from './forms.v3.types';

export async function generateWelcomeCopy(input: GenerateWelcomeCopyInput): Promise<{ copy: AIWelcomeCopy }> {
  const title = input.formTitle.trim() || 'Conversational Survey';
  const desc = input.formDescription?.trim();
  const lower = title.toLowerCase();

  if (lower.includes('feedback') || lower.includes('nps') || lower.includes('satisfaction') || lower.includes('review')) {
    return {
      copy: {
        title: `We'd love your honest feedback on ${title}.`,
        description: desc
          ? `${desc}\n\n**What to expect:**\n- Takes under 90 seconds\n- Clear, one-question-at-a-time experience\n- Your responses directly shape future updates`
          : `Your input helps us improve every day. Please take a moment to share your experience with us.\n\n**What to expect:**\n- Takes under 90 seconds\n- 100% anonymous & secure\n- Read directly by our team`,
        tagline: 'Customer Feedback',
        timeEstimate: 'Takes ~90 seconds',
        buttonLabel: 'Share Your Thoughts',
        suggestedHeroPrompt: 'Minimalist 3D colorful geometric shapes in warm studio lighting, customer satisfaction concept',
      },
    };
  }

  if (lower.includes('job') || lower.includes('career') || lower.includes('hire') || lower.includes('apply') || lower.includes('candidate') || lower.includes('role')) {
    return {
      copy: {
        title: `Join our team — ${title}`,
        description: desc
          ? `${desc}\n\n**Candidate Journey:**\n- 4 short questions about your experience\n- No tedious resume parsing\n- Direct response within 48 hours`
          : `We're building something remarkable and looking for talented teammates to grow with us.\n\n**Candidate Journey:**\n- 4 short questions about your background\n- Showcase your best work directly\n- Human review guaranteed`,
        tagline: 'Career Opportunity',
        timeEstimate: 'Takes ~2 mins',
        buttonLabel: 'Start Application',
        suggestedHeroPrompt: 'Aesthetic Scandinavian designer desk with modern laptop, ceramic mug, and natural morning light',
      },
    };
  }

  if (lower.includes('lead') || lower.includes('contact') || lower.includes('sales') || lower.includes('quote') || lower.includes('inquiry')) {
    return {
      copy: {
        title: `Let's discuss ${title}`,
        description: desc
          ? `${desc}\n\n**Next Steps:**\n- Fast qualification in 3 steps\n- Custom recommendations tailored to your goals\n- Dedicated specialist outreach`
          : `Tell us about your organization and requirements so we can tailor the right solution for you.\n\n**Next Steps:**\n- 3 quick qualification prompts\n- Transparent project scoping\n- Priority reply from our team`,
        tagline: 'Project Consultation',
        timeEstimate: 'Takes ~1 min',
        buttonLabel: 'Get Started',
        suggestedHeroPrompt: 'Futuristic architectural curves with soft indigo ambient lighting, professional consulting aesthetic',
      },
    };
  }

  if (lower.includes('rsvp') || lower.includes('event') || lower.includes('summit') || lower.includes('webinar') || lower.includes('conference')) {
    return {
      copy: {
        title: `Reserve your seat: ${title}`,
        description: desc
          ? `${desc}\n\n**Event Details:**\n- Instant confirmation\n- Calendar invite sent immediately\n- Live Q&A and networking opportunities`
          : `Join industry leaders for an engaging session of deep dives, live demonstrations, and interactive Q&A.\n\n**Event Highlights:**\n- Fast 1-click confirmation\n- Live stream link sent to your inbox\n- Exclusive attendee resources`,
        tagline: 'Event Registration',
        timeEstimate: 'Takes ~45 seconds',
        buttonLabel: 'Confirm Attendance',
        suggestedHeroPrompt: 'Luminous abstract fluid waves in deep violet and emerald gradients, keynote conference style',
      },
    };
  }

  return {
    copy: {
      title: `Welcome to ${title}`,
      description: desc
        ? `${desc}\n\n**Instructions:**\n- Answer at your own pace\n- Seamless keyboard navigation (press Enter ↵ to advance)\n- Responses are automatically saved`
        : `Thank you for taking a moment to complete this form. We appreciate your time and perspective.\n\n**Quick Highlights:**\n- One question at a time for maximum focus\n- Keyboard-first interaction\n- Instant response confirmation`,
      tagline: 'Quick Overview',
      timeEstimate: 'Takes ~2 mins',
      buttonLabel: 'Begin Form',
      suggestedHeroPrompt: 'Clean minimalist 3D geometric abstract sculpture with soft diffuse shadows, modern aesthetic',
    },
  };
}
