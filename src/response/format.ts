interface ContentItem {
  type: "text";
  text: string;
  annotations?: { audience?: ("user" | "assistant")[] };
}

interface ToolResult {
  [key: string]: unknown;
  content: ContentItem[];
}

export function formatResponse(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}
