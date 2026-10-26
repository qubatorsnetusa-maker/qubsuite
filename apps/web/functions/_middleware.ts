interface Env {}

const CRAWLER_USER_AGENTS = [
  'whatsapp',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'telegrambot',
  'slackbot',
  'slack-imgproxy',
  'linkedinbot',
  'discordbot',
  'applebot',
  'skypeuripreview',
  'googlebot',
  'bingbot',
  'yandex',
];

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => lower.includes(bot));
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next } = context;
  const userAgent = request.headers.get('user-agent');
  const url = new URL(request.url);

  // Skip static assets (js, css, images, fonts, icons, manifest, etc.)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.woff2')
  ) {
    return next();
  }

  const formMatch = url.pathname.match(/^\/forms\/([A-Za-z0-9_-]{16,64})(\/fill)?/);
  const shareMatch = url.pathname.match(/^\/share\/([A-Za-z0-9_-]{16,64})/);
  const docMatch = url.pathname.match(/^\/docs\/([0-9a-fA-F-]{36})/);
  const sheetMatch = url.pathname.match(/^\/sheets\/([0-9a-fA-F-]{36})/);
  const slideMatch = url.pathname.match(/^\/slides\/([A-Za-z0-9_-]+)/);
  const pdfMatch = url.pathname.match(/^\/pdf/);

  const isTargetRoute = formMatch || shareMatch || docMatch || sheetMatch || slideMatch || pdfMatch;
  if (!isCrawler(userAgent) && !url.searchParams.has('_bot')) {
    return next();
  }

  if (!isTargetRoute) {
    return next();
  }

  // Fetch the underlying SPA index.html
  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  let title = 'QubSuite – Documents, Spreadsheets, Slides & Forms';
  let description = 'Collaborate on documents, spreadsheets, presentations, and forms in real time with QubSuite.';
  let siteName = 'QubSuite';

  try {
    if (formMatch) {
      const publicId = formMatch[1];
      // Fetch public form data from API
      const apiUrl = new URL(`/api/public/forms/${publicId}?view=0`, url.origin);
      const apiRes = await fetch(apiUrl.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (apiRes.ok) {
        const json: any = await apiRes.json();
        if (json?.data?.title) {
          title = `${json.data.title} – Qub Forms`;
          description = json.data.description || 'Fill out this form on Qub Forms';
          siteName = 'Qub Forms';
        }
      }
    } else if (shareMatch) {
      const token = shareMatch[1];
      const apiUrl = new URL(`/api/share/${token}`, url.origin);
      const apiRes = await fetch(apiUrl.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (apiRes.ok) {
        const json: any = await apiRes.json();
        if (json?.data?.name) {
          title = `${json.data.name} – Qub Drive`;
          description = json.data.folder ? 'Folder shared securely on Qub Drive' : 'File shared securely on Qub Drive';
          siteName = 'Qub Drive';
        }
      }
    } else if (docMatch) {
      title = 'Document – Qub Docs';
      description = 'Collaborate on this document in real time with Qub Docs';
      siteName = 'Qub Docs';
    } else if (sheetMatch) {
      title = 'Spreadsheet – Qub Sheets';
      description = 'Collaborate on this spreadsheet in real time with Qub Sheets';
      siteName = 'Qub Sheets';
    } else if (slideMatch) {
      title = 'Presentation – Qub Slides';
      description = 'Create and present beautiful slide decks with Qub Slides';
      siteName = 'Qub Slides';
    } else if (pdfMatch) {
      title = 'PDF Studio – Qub PDF';
      description = 'View, edit, and sign PDF documents with Qub PDF Studio';
      siteName = 'Qub PDF';
    }
  } catch {
    // Graceful fallback if API call fails
  }

  // Use HTMLRewriter to rewrite <title> and OpenGraph / Twitter tags if available
  if (typeof HTMLRewriter !== 'undefined') {
    return new HTMLRewriter()
      .on('title', {
        element(e) {
          e.setInnerContent(title);
        },
      })
      .on('meta[property="og:title"]', {
        element(e) {
          e.setAttribute('content', title);
        },
      })
      .on('meta[property="og:description"]', {
        element(e) {
          e.setAttribute('content', description);
        },
      })
      .on('meta[property="og:site_name"]', {
        element(e) {
          e.setAttribute('content', siteName);
        },
      })
      .on('meta[property="og:url"]', {
        element(e) {
          e.setAttribute('content', url.toString());
        },
      })
      .on('meta[name="twitter:title"]', {
        element(e) {
          e.setAttribute('content', title);
        },
      })
      .on('meta[name="twitter:description"]', {
        element(e) {
          e.setAttribute('content', description);
        },
      })
      .transform(response);
  }

  // Fallback string replacement
  let html = await response.text();
  html = html
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:site_name" content=".*?" \/>/i, `<meta property="og:site_name" content="${siteName}" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${description}" />`);

  return new Response(html, {
    status: response.status,
    headers: response.headers,
  });
};
