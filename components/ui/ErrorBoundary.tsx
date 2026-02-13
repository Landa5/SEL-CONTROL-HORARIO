'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center bg-red-50 rounded-xl border border-red-200 m-8">
                    <h1 className="text-xl font-black text-red-600 mb-2">Algo ha salido mal</h1>
                    <p className="text-sm text-red-500 mb-4">Ha ocurrido un error al cargar este componente.</p>
                    <div className="bg-white p-4 rounded border text-left overflow-auto max-h-60 mb-4 text-xs font-mono text-gray-600 shadow-inner">
                        {this.state.error?.message}
                        <br />
                        {this.state.error?.stack}
                    </div>
                    <Button onClick={() => this.setState({ hasError: false, error: null })} variant="outline">
                        Intentar de nuevo
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
