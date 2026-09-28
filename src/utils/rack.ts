export const formatRack = (v?: string | null) =>
  (v || '').replace(/\s*\(U\s*\d+\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
