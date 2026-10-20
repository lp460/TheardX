import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Last-resort error state: never leave a blank page. */
export class ErrorBoundary extends Component<
  { children: ReactNode; compact?: boolean },
  { error: Error | null }
> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ThreadShelf] UI error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className={this.props.compact ? 'p-4' : 'mx-auto max-w-md px-6 py-20 text-center'}
      >
        <AlertTriangle className="mx-auto text-warning" size={22} />
        <h1 className="mt-3 text-[15px] font-semibold text-fg">
          Une erreur inattendue est survenue
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-4 rounded-lg bg-subtle px-3 py-1.5 text-[13px] font-medium text-fg hover:bg-line"
        >
          Recharger
        </button>
      </div>
    );
  }
}
