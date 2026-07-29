import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  children: ReactNode;
  onRetry: () => void;
}

interface SceneErrorBoundaryState {
  error: Error | null;
}

/**
 * WebGL failures otherwise leave a silent black rectangle. Keep the failure in
 * the DOM layer, where the visitor can understand it and create a fresh canvas.
 */
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Orbitim WebGL scene failed to render.', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section
        role="alert"
        className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-6 text-center text-white backdrop-blur-md"
      >
        <div className="max-w-md rounded-3xl border border-rose-300/25 bg-[#0b0d12] p-7 shadow-2xl shadow-black/70">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rose-200/75">Scene recovery</p>
          <h2 className="mt-3 text-2xl font-light tracking-tight">The observatory renderer stopped.</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            The interactive scene could not continue. Restarting recreates its WebGL canvas; your simulation time remains in the URL.
          </p>
          <button
            type="button"
            onClick={this.props.onRetry}
            className="mt-6 min-h-11 rounded-full border border-sky-300/35 bg-sky-300/10 px-5 text-[10px] uppercase tracking-[0.16em] text-sky-100 transition-colors hover:border-sky-300/65 hover:bg-sky-300/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Restart renderer
          </button>
          <p className="mt-4 text-left font-mono text-[9px] leading-relaxed text-rose-100/50">{this.state.error.message}</p>
        </div>
      </section>
    );
  }
}
