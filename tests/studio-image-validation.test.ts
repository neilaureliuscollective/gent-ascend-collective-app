import { describe, expect, it } from 'vitest';
import { maxReferenceBytes, referenceExtension, referenceType } from '../src/domains/studio/image-validation';

describe('Studio reference validation', () => {
 it('accepts PNG, JPEG and WebP signatures and assigns stable extensions', () => {
  const image=(prefix:number[])=>{const bytes=new Uint8Array(128);bytes.set(prefix);return bytes;};
  expect(referenceType(image([137,80,78,71,13,10,26,10]))).toBe('image/png');
  expect(referenceType(image([255,216,255]))).toBe('image/jpeg');
  expect(referenceType(image([82,73,70,70,0,0,0,0,87,69,66,80]))).toBe('image/webp');
  expect(referenceExtension('image/jpeg')).toBe('jpg');
 });
 it('rejects unsupported signatures and a file beyond the private bucket limit', () => {
  expect(referenceType(new Uint8Array(128))).toBeNull();
  const oversized=new Uint8Array(maxReferenceBytes+1);oversized.set([137,80,78,71,13,10,26,10]);
  expect(referenceType(oversized)).toBeNull();
 });
});
