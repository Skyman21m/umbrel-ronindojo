import React, { ErrorInfo, Fragment, PropsWithChildren } from "react";
import dynamic from "next/dynamic";

const Dialog = dynamic(() => import("./Dialog"), { ssr: false });

interface Props {}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<PropsWithChildren<Props>, State> {
  constructor(props: Props) {
    super(props);

    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI

    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log("component did catch", { error, errorInfo });
  }

  render() {
    // Check if the error is thrown
    if (this.state.error) {
      // You can render any custom fallback UI
      return (
        <Fragment>
          <Dialog
            title="Unexpected error"
            className="max-w-3xl"
            open
            actions={
              <button type="button" className="button" onClick={() => window.location.reload()}>
                Refresh page
              </button>
            }
          >
            <textarea className="w-full h-40" value={this.state.error.stack ? this.state.error.stack.toString() : this.state.error.toString()} readOnly />
          </Dialog>
        </Fragment>
      );
    }

    // Return children components in case of no error

    return this.props.children;
  }
}
