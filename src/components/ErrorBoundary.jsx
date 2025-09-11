import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false, err: null };
  static getDerivedStateFromError(err) { return { hasError: true, err }; }
  componentDidCatch(err, info) { console.error("UI error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 rounded-md border border-red-300 bg-red-50 text-red-800">
          Error while rendering. Please check the console for error messages.
        </div>
      );
    }
    return this.props.children;
  }
}