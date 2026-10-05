'use client';
import Image from 'next/image';
import { useState } from 'react';
type Photo = { id: string; view: string; captured_on: string };
export function GroomingPhotoCompare({ photos }: { photos: Photo[] }) {
  const [first, setFirst] = useState(''),
    [second, setSecond] = useState('');
  const left = photos.find((photo) => photo.id === first),
    right = photos.find((photo) => photo.id === second);
  if (photos.length < 2) return <p>Add two private photos to compare moments over time.</p>;
  return (
    <section className="ritual-photo-compare" aria-label="Compare private photos">
      <h3>Two moments. Your own light.</h3>
      <p>
        Choose similar views, lighting and distance. This is a visual reference, not a measured
        change or proof a product worked.
      </p>
      <div className="ritual-photo-controls">
        {(['Earlier photo', 'Later photo'] as const).map((label, i) => (
          <label key={label}>
            {label}
            <select
              value={i === 0 ? first : second}
              onChange={(event) => (i === 0 ? setFirst : setSecond)(event.target.value)}
            >
              <option value="">Choose a moment</option>
              {photos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {photo.captured_on} · {photo.view}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {left && right && (
        <>
          <div className="ritual-photo-pair">
            {[left, right].map((photo, i) => (
              <figure key={i}>
                <Image
                  src={`/api/grooming/image?kind=photo&id=${photo.id}`}
                  width={500}
                  height={500}
                  unoptimized
                  alt={`${i === 0 ? 'Earlier selection' : 'Later selection'}: ${photo.view} view, ${photo.captured_on}`}
                />
                <figcaption>
                  {photo.captured_on} · {photo.view}
                </figcaption>
              </figure>
            ))}
          </div>
          {left.view !== right.view && (
            <p>These are different views. Choose the same angle for a clearer comparison.</p>
          )}
          {first === second && <p>You selected the same photo twice.</p>}
        </>
      )}
    </section>
  );
}
