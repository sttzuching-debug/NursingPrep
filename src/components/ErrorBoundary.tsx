import React from 'react';
import { 
  ShieldAlert
} from 'lucide-react';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-[#E2E8F0]">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-[#2D3436] mb-2">應用程式發生錯誤</h1>
            <p className="text-[#636E72] text-sm mb-6">很抱歉，程式在執行時遇到了未預期的問題。</p>
            <div className="bg-[#F1F2F6] p-4 rounded-xl text-left overflow-auto max-h-40 mb-6 font-mono text-[10px]">
              {this.state.error?.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#0984E3] text-white rounded-xl font-bold hover:shadow-lg transition-all"
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
