interface UploadProgressProps {
  value: number;
  label: string;
}

export function UploadProgress({ value, label }: UploadProgressProps) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
