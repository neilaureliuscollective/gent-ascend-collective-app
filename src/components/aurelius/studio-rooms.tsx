'use client';
export const studioRooms = [
  {
    id: 'create',
    label: 'Create',
    note: 'Image atelier',
    path: 'M4 16l4-5 4 3 4-8 4 10M5 4h14v16H5z',
  },
  {
    id: 'storyboard',
    label: 'Campaign',
    note: 'Story & motion',
    path: 'M3 5h18v14H3zM9 5v14M15 5v14',
  },
  { id: 'footage', label: 'Footage', note: 'AI video', path: 'M3 6h12v12H3zM15 10l6-4v12l-6-4' },
  {
    id: 'narration',
    label: 'Narration',
    note: 'Voice production',
    path: 'M9 4h6v10H9zM6 10v3a6 6 0 0012 0v-3M12 19v3',
  },
  {
    id: 'finish',
    label: 'Finish',
    note: 'Design & formats',
    path: 'M4 4h16v16H4zM4 10h16M10 10v10',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    note: 'Reviewed handoff',
    path: 'M3 8l9-5 9 5v11H3zM12 3v16M3 8l9 5 9-5',
  },
  {
    id: 'library',
    label: 'Library',
    note: 'Saved originals',
    path: 'M4 4h5v16H4zM12 4h5v16h-5zM20 6v14',
  },
  {
    id: 'direction',
    label: 'Direction',
    note: 'Brand & brief',
    path: 'M12 3l8 9-8 9-8-9zM12 8v8M8 12h8',
  },
] as const;
export type StudioRoom = (typeof studioRooms)[number]['id'];
export function StudioRooms({
  value,
  onChange,
}: {
  value: StudioRoom;
  onChange: (room: StudioRoom) => void;
}) {
  return (
    <div
      className="studio-view-tabs studio-room-console imperial-control-surface"
      role="group"
      aria-label="Studio workspace views"
    >
      {studioRooms.map((room, index) => (
        <button
          key={room.id}
          type="button"
          aria-label={room.label}
          aria-pressed={value === room.id}
          onClick={() => onChange(room.id)}
        >
          <span className="studio-room-number" aria-hidden="true">
            0{index + 1}
          </span>
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={room.path} />
          </svg>
          <span className="studio-room-copy">
            <strong>{room.label}</strong>
            <small aria-hidden="true">{room.note}</small>
          </span>
          <span className="studio-room-indicator" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
