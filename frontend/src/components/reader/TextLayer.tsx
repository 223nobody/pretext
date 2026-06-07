import { useReaderStore } from "../../store/readerStore";

interface TextLayerProps {
  paragraphs: string[];
  columnCount: number;
  columnGap: number;
  fontSize: number;
  lineHeight: number;
}

export function TextLayer({ paragraphs, columnCount, columnGap, fontSize, lineHeight }: TextLayerProps) {
  const backgroundVideo = useReaderStore((state) => state.backgroundVideo);
  const hasVideoMask = Boolean(backgroundVideo.url);
  const maskSide = backgroundVideo.maskX < 50 ? "left" : "right";
  const maskTop = Math.max(0, Math.round((backgroundVideo.maskY / 100) * 620 - backgroundVideo.maskSize / 2));

  return (
    <article
      className="text-layer"
      style={
        {
          columnCount,
          columnGap,
          fontSize,
          lineHeight,
        } as React.CSSProperties
      }
    >
      {hasVideoMask ? (
        <span
          className={`text-flow-mask ${maskSide}`}
          style={
            {
              width: `${backgroundVideo.maskSize}px`,
              height: `${backgroundVideo.maskSize}px`,
              marginTop: `${maskTop}px`,
              shapeOutside: "ellipse(50% 50%)",
              clipPath: "ellipse(50% 50%)",
            } as React.CSSProperties
          }
          aria-hidden="true"
        />
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
      ))}
    </article>
  );
}
