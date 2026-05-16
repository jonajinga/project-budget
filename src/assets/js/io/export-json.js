/* Profile -> downloadable JSON file. The export is byte-for-byte a snapshot
   of the profile bundle so it round-trips back through importAsNew. */

function slug(s) {
  return (s || "profile")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "profile";
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function buildExport(profile) {
  return {
    schemaVersion: profile.schemaVersion,
    exportedAt: new Date().toISOString(),
    profile: profile,
  };
}

export function suggestedFilename(profile) {
  return "projectbudget-" + slug(profile.name) + "-" + todayISO() + ".json";
}

export function download(profile) {
  if (typeof document === "undefined") return;
  var data = buildExport(profile);
  triggerDownload(JSON.stringify(data, null, 2), suggestedFilename(profile));
}

/* Build a bundle export containing every profile. The format is
   { kind: "bundle", schemaVersion, exportedAt, profiles: [...] } so the
   import side can detect a bundle vs a single profile. */
export function buildBundle(profiles) {
  var versions = (profiles || []).map(function (p) { return p.schemaVersion || 1; });
  var max = versions.length ? Math.max.apply(null, versions) : 1;
  return {
    kind: "bundle",
    schemaVersion: max,
    exportedAt: new Date().toISOString(),
    profiles: profiles || [],
  };
}

export function suggestedBundleFilename() {
  return "projectbudget-all-" + todayISO() + ".json";
}

export function downloadBundle(profiles) {
  if (typeof document === "undefined") return;
  var data = buildBundle(profiles);
  triggerDownload(JSON.stringify(data, null, 2), suggestedBundleFilename());
}

function triggerDownload(text, name) {
  var blob = new Blob([text], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 0);
}
