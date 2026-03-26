import React from 'react';
import Card from './Card';
import Button from './Button';
import { AlertCircle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6">
          <Card className="max-w-md w-full text-center p-8 border-[#FF4A6A]/20 bg-[#FF4A6A]/5">
            <div className="w-16 h-16 bg-[#FF4A6A]/20 rounded-full flex items-center justify-center mx-auto mb-6 text-[#FF4A6A]">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-display font-medium text-white mb-2">Something went wrong</h1>
            <p className="text-[#8A8A9A] mb-8 text-sm line-clamp-3">{this.state.error?.message || "An unexpected error occurred within the render map."}</p>
            <Button onClick={() => window.location.reload()}>Reload Dashboard</Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
