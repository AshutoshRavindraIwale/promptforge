import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Model output rendered as readable markdown, styled for the charcoal theme. Every
// block element is mapped explicitly since there is no typography plugin.
export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => (
            <h1 className="border-b border-line pb-2 text-base font-medium text-ink">
              {p.children}
            </h1>
          ),
          h2: (p) => (
            <h2 className="pt-1 text-[15px] font-medium text-ink">{p.children}</h2>
          ),
          h3: (p) => <h3 className="text-sm font-medium text-ink">{p.children}</h3>,
          h4: (p) => <h4 className="text-sm font-medium text-ink">{p.children}</h4>,
          strong: (p) => <strong className="font-medium text-ink">{p.children}</strong>,
          a: (p) => (
            <a href={p.href} className="text-ember underline underline-offset-2">
              {p.children}
            </a>
          ),
          ul: (p) => <ul className="list-disc space-y-1 pl-5">{p.children}</ul>,
          ol: (p) => <ol className="list-decimal space-y-1 pl-5">{p.children}</ol>,
          blockquote: (p) => (
            <blockquote className="border-l-2 border-line pl-3 text-ink-3">
              {p.children}
            </blockquote>
          ),
          hr: () => <hr className="border-line" />,
          table: (p) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{p.children}</table>
            </div>
          ),
          th: (p) => (
            <th className="border border-line bg-raised px-2.5 py-1.5 text-left font-medium text-ink">
              {p.children}
            </th>
          ),
          td: (p) => (
            <td className="border border-line px-2.5 py-1.5">{p.children}</td>
          ),
          // `pre` handles fenced blocks; `code` without a surrounding pre is inline.
          pre: (p) => (
            <pre className="overflow-x-auto rounded-lg border border-line bg-bg/60 p-3 font-mono text-xs leading-[1.7] [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0">
              {p.children}
            </pre>
          ),
          code: (p) => (
            <code className="rounded border border-line bg-raised px-1 py-0.5 font-mono text-[0.85em] text-ink">
              {p.children}
            </code>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
