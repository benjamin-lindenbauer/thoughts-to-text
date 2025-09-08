'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      errorId: crypto.randomUUID()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error for debugging (without sensitive data)
    this.logError(error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private logError = (error: Error, errorInfo: React.ErrorInfo) => {
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
      componentStack: errorInfo.componentStack?.split('\n').slice(0, 5).join('\n'),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.retryCount,
    };

    console.error('ErrorBoundary caught an error:', errorData);
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    } else {
      // Max retries reached, force page reload
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReportError = () => {
    const errorData = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString(),
    };
    
    // Copy error ID to clipboard for user to report
    navigator.clipboard?.writeText(JSON.stringify(errorData, null, 2))
      .then(() => {
        alert('Error details copied to clipboard. Please share this with support.');
      })
      .catch(() => {
        alert(`Error ID: ${this.state.errorId}\nPlease share this ID with support.`);
      });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="max-w-md w-full space-y-6">
            <div className="text-red-500 text-6xl mb-4">
              <AlertTriangle className="w-16 h-16 mx-auto" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                An unexpected error occurred. Don't worry, your data is safe.
              </p>
            </div>

            {this.props.showErrorDetails && this.state.error && (
              <div className="bg-muted p-4 rounded-lg text-left text-sm">
                <p className="font-mono text-red-600 dark:text-red-400">
                  {this.state.error.message}
                </p>
                {this.state.errorId && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Error ID: {this.state.errorId}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                disabled={this.retryCount >= this.maxRetries}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                {this.retryCount >= this.maxRetries ? 'Max Retries Reached' : `Retry (${this.maxRetries - this.retryCount} left)`}
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                onClick={this.handleReportError}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bug className="w-4 h-4" />
                Report Error
              </button>
            </div>

            {this.retryCount > 0 && (
              <div className="text-xs text-muted-foreground">
                Retry attempt: {this.retryCount}/{this.maxRetries}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}