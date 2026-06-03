import path from 'path';

/** Backend package root (src/ or dist/). */
export function getBackendRoot(): string {
  return path.resolve(__dirname, '../..');
}

export function vendorPath(...segments: string[]): string {
  return path.join(getBackendRoot(), 'vendor', ...segments);
}
