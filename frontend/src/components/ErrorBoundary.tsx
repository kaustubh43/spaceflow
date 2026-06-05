import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

/** Keeps a failure in one subtree (e.g. the WebGL 3D view) from blanking the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-ink-100 p-6 text-center">
          <TriangleAlert className="h-8 w-8 text-amber-500" />
          <p className="font-medium text-ink-700">
            {this.props.label ?? "Something went wrong"}
          </p>
          <p className="max-w-sm text-sm text-ink-500">
            {this.props.label?.includes("3D")
              ? "Your browser/GPU may not support WebGL. The 2D plan still works fully."
              : this.state.error.message}
          </p>
          <button
            className="btn-outline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
