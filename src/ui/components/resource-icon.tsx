import { ResourceType } from '../../domain';
export function ResourceIcon({ type }: { type: ResourceType }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {type === ResourceType.Room ? (
        <path d="M5 21V3h14v18M9 21V7h6v14M13 13h1" />
      ) : type === ResourceType.Computer ? (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M12 16v4M7 20h10" />
        </>
      ) : (
        <>
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <path d="M10 18h4" />
        </>
      )}
    </svg>
  );
}
