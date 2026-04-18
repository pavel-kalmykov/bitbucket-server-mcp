interface FileSection {
  fileName: string;
  headerLines: string[];
  hunkContent: string[];
}

function parseDiff(lines: string[]): FileSection[] {
  const sections: FileSection[] = [];
  let current: FileSection = { fileName: "", headerLines: [], hunkContent: [] };
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      sections.push(current);
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      current = {
        fileName: match ? match[2] : "unknown",
        headerLines: [line],
        hunkContent: [],
      };
      inHunk = false;
    } else if (line.startsWith("@@")) {
      inHunk = true;
      current.hunkContent.push(line);
    } else if (inHunk) {
      current.hunkContent.push(line);
    } else {
      current.headerLines.push(line);
    }
  }

  sections.push(current);
  return sections;
}

function truncateHunkContent(
  hunkContent: string[],
  fileName: string,
  maxLines: number,
): string[] {
  const contentLines = hunkContent.filter((line) => !line.startsWith("@@"));
  const hunkHeaders = hunkContent.filter((line) => line.startsWith("@@"));

  if (contentLines.length <= maxLines) {
    return hunkContent;
  }

  const showAtStart = Math.floor(maxLines * 0.6);
  const showAtEnd = Math.floor(maxLines * 0.4);
  const truncatedCount = contentLines.length - showAtStart - showAtEnd;

  return [
    ...hunkHeaders,
    ...contentLines.slice(0, showAtStart),
    "",
    `[*** FILE TRUNCATED: ${truncatedCount} lines hidden from ${fileName} ***]`,
    `[*** File had ${contentLines.length} total lines, showing first ${showAtStart} and last ${showAtEnd} ***]`,
    `[*** Use maxLinesPerFile=0 to see complete diff ***]`,
    "",
    ...contentLines.slice(-showAtEnd),
  ];
}

export function truncateDiff(
  diffContent: string,
  maxLinesPerFile: number,
): string {
  if (!maxLinesPerFile || maxLinesPerFile <= 0) {
    return diffContent;
  }

  const lines = diffContent.split("\n");
  const sections = parseDiff(lines);

  return sections
    .flatMap((section) => [
      ...section.headerLines,
      ...truncateHunkContent(
        section.hunkContent,
        section.fileName,
        maxLinesPerFile,
      ),
    ])
    .join("\n");
}
