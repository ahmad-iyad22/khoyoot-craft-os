import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";

const HeritageScene = lazy(() => import("./heritage-scene"));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function WorkspaceDepth({ children }: { children: ReactNode }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    setSupported(Boolean(gl));
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  return <div className="workspace-depth">
    {supported && <SceneBoundary><Suspense fallback={null}><HeritageScene /></Suspense></SceneBoundary>}
    <div className="workspace-content">{children}</div>
  </div>;
}