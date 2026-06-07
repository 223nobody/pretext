import { useReaderStore } from "../../store/readerStore";

export function CursorLayer() {
  const customCursor = useReaderStore((state) => state.customCursor);

  return (
    <div className={`cursor-layer ${customCursor ? "has-custom-cursor" : ""}`} aria-hidden="true">
      {customCursor ? <img src={customCursor} alt="" /> : null}
    </div>
  );
}
