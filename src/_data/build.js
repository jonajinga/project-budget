// Cache-busting token for static assets. Recomputed on every build.
export default {
  hash: Date.now().toString(36),
  date: new Date().toISOString(),
};
