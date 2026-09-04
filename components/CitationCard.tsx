type Source = {
  text: string;
  chunkIndex?: number;
  score?: number;
};

export default function CitationCard({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <details className="mt-2 text-xs text-gray-600">
      <summary className="cursor-pointer select-none hover:text-gray-900">
        {sources.length} source{sources.length > 1 ? "s" : ""} from this document
      </summary>
      <div className="mt-2 space-y-2">
        {sources.map((s, i) => (
          <div key={i} className="border-l-2 border-gray-300 pl-2 py-1 bg-gray-50 rounded-r">
            <p className="line-clamp-3">{s.text}</p>
            {typeof s.score === "number" && (
              <p className="text-[10px] text-gray-400 mt-1">
                relevance: {(s.score * 100).toFixed(0)}%
              </p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}