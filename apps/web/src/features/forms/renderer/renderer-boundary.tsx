import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Keeps a rendering bug from blanking the page. Answers already typed stay in local storage. */
export class RendererBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Form renderer crashed', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-xl bg-background p-8 text-center shadow-card">
        <h1 className="text-xl">Something went wrong showing this form</h1>
        <p className="mt-2 text-sm text-muted">Your answers so far are saved on this device. Reloading usually fixes it.</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
