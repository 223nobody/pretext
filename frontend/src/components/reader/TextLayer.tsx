import type { CSSProperties } from "react";

import { assignArticleLineRoles, type ArticleLineRole } from "../../lib/articleStructure";
import type { PageLayout } from "../../lib/pretext-engine";

interface TextLayerProps {
  page: PageLayout | null;
  fallbackLines: string[];
  columnCount: number;
  columnGap: number;
  fontSize: number;
  lineHeight: number;
  containerWidth: number;
  containerHeight: number;
  /** Page-transition animation class (see NEXT_DEVELOPMENT_PLAN §4.3.1). */
  flipClass?: string;
}

export function TextLayer({
  page,
  fallbackLines,
  columnCount,
  columnGap,
  fontSize,
  lineHeight,
  containerWidth,
  containerHeight,
  flipClass = "",
}: TextLayerProps) {
  const pagePaddingX = Math.max(28, containerWidth * 0.04);
  const pagePaddingY = Math.max(28, containerHeight * 0.04);
  const totalGapWidth = (columnCount - 1) * columnGap;
  const columnWidth = Math.max(
    120,
    (containerWidth - pagePaddingX * 2 - totalGapWidth) / columnCount,
  );
  const lineHeightPx = fontSize * lineHeight;

  const hasFlowLines = Boolean(page && page.columns.some((column) => column.lines.length > 0));
  const fallbackRoles = assignArticleLineRoles(fallbackLines.map((text) => ({ text })));
  const roleClass = (role?: ArticleLineRole) => `article-${role ?? "body"}`;

  if (!hasFlowLines) {
    return (
      <article
        className={`text-layer ${flipClass}`.trim()}
        data-columns={columnCount}
        style={
          {
            columnCount,
            columnGap,
            fontSize,
            lineHeight,
          } as CSSProperties
        }
      >
        {fallbackLines.map((line, index) =>
          line.trim() ? (
            <p key={index} className={`text-line ${roleClass(fallbackRoles[index])}`}>
              {line}
            </p>
          ) : (
            <p key={index} className="text-line text-line-break" aria-hidden="true">
              {"\u00a0"}
            </p>
          ),
        )}
      </article>
    );
  }

  return (
    <article
      className={`text-layer text-layer-flow ${flipClass}`.trim()}
      data-columns={columnCount}
      style={
        {
          fontSize,
          lineHeight,
        } as CSSProperties
      }
    >
      {page!.columns.flatMap((column) => {
        const columnLeft = pagePaddingX + column.columnIndex * (columnWidth + columnGap);
        return column.lines.map((line, lineIndex) => {
          const left = columnLeft + (line.xOffset ?? 0);
          const top = pagePaddingY + (line.yOffset ?? lineIndex * lineHeightPx);
          const width = line.availableWidth ?? columnWidth;

          return (
            <p
              key={`${column.columnIndex}-${lineIndex}-${line.start.segmentIndex}-${line.start.graphemeIndex}`}
              className={`text-line flow-line ${roleClass(line.role)}`}
              style={
                {
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  lineHeight: `${lineHeightPx}px`,
                } as CSSProperties
              }
            >
              {line.text}
            </p>
          );
        });
      })}
    </article>
  );
}
