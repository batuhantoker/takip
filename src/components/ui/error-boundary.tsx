'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: React.ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[TAKIP] ${this.props.name || 'Component'} Error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex h-full w-full flex-col items-center justify-center rounded-card border border-line bg-surface-1 p-4 text-center">
          <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-surface-2 text-red">
            <TriangleAlert aria-hidden className="size-4" strokeWidth={1.75} />
          </span>
          <p className="text-body font-medium text-ink-1">{this.props.name ? `${this.props.name} stopped working` : 'Something stopped working'}</p>
          {this.state.error?.message && (
            <p className="mt-1 max-w-[300px] truncate text-small text-ink-3">{this.state.error.message}</p>
          )}
          <Button size="sm" className="mt-4" onClick={() => this.setState({ hasError: false })}>Try again</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
