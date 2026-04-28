// components/chat/SimpleMarkdown.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';

interface SimpleMarkdownProps {
  content: string;
}

export function SimpleMarkdown({ content }: SimpleMarkdownProps) {
  const components = {
    a({ href, children }: any) {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          {children}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    },
    // No custom table components - let react-markdown handle them
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}