export type EcosystemService = 'drive' | 'docs' | 'sheets' | 'forms' | 'pdf' | 'slides';

/**
 * Returns the canonical origin for the specified service in the QubDocs ecosystem.
 * In production (*.qubdocs.online), returns the dedicated service subdomain.
 * In localhost or development, preserves the current origin.
 */
export function getServiceOrigin(service: EcosystemService): string {
  if (typeof window === 'undefined') return '';
  // In the mobile Android native wrapper, stay on the current origin to avoid cross-subdomain page reloads
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('QubDocsAndroid')) {
    return window.location.origin;
  }
  const host = window.location.hostname.toLowerCase();

  if (host === 'qubdocs.online' || host.endsWith('.qubdocs.online')) {
    switch (service) {
      case 'drive':
        return 'https://drive.qubdocs.online';
      case 'docs':
        return 'https://docs.qubdocs.online';
      case 'sheets':
        return 'https://sheet.qubdocs.online';
      case 'forms':
        return 'https://forms.qubdocs.online';
      case 'pdf':
        return 'https://pdf.qubdocs.online';
      case 'slides':
        return 'https://slides.qubdocs.online';
    }
  }

  return window.location.origin;
}

/**
 * Builds an absolute URL to a service route within the QubDocs ecosystem.
 */
export function getServiceUrl(service: EcosystemService, path: string = ''): string {
  const origin = getServiceOrigin(service);
  if (!path) return origin;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${cleanPath}`;
}