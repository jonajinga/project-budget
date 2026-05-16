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
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = suggestedFilename(profile);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  /* Revoke after a tick so the browser has the time to start the download. */
  setTimeout(function () { URL.revokeObjectURL(url); }, 0);
}
