/* Generic sortable + searchable table backing for /app/reports/*
   pages. Each report's table calls reportTable(srcFn, options) and
   feeds the returned `rows` array into x-for. Header buttons call
   sort(key) to toggle direction.

   Options:
     keys        — array of { key, label, numeric? }; numeric uses
                   numeric comparison, default is string.
     searchKeys  — subset of `keys` to match against the search query
                   (defaults to all keys with `numeric: false`).
     defaultSort — { key, dir: 'asc'|'desc' } optional.

   Reactivity: srcFn() should be a function that returns the underlying
   data. We re-evaluate on every reactive dependency change (Alpine
   handles this automatically). _listVersion is touched so any store
   mutation triggers a refresh. */
(function () {
  "use strict";

  function fuzzyMatch(row, keys, query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return true;
    return keys.some(function (k) {
      var v = row[k];
      if (v === undefined || v === null) return false;
      return String(v).toLowerCase().indexOf(q) !== -1;
    });
  }

  function compare(a, b, key, numeric) {
    var av = a[key], bv = b[key];
    if (numeric) {
      var an = Number(av) || 0, bn = Number(bv) || 0;
      return an === bn ? 0 : (an < bn ? -1 : 1);
    }
    var as = String(av == null ? "" : av);
    var bs = String(bv == null ? "" : bv);
    return as.localeCompare(bs);
  }

  window.reportTable = function (srcFn, options) {
    var opts = options || {};
    var keys = opts.keys || [];
    var searchKeys = opts.searchKeys || keys.filter(function (k) { return !k.numeric; }).map(function (k) { return k.key; });
    var initial = opts.defaultSort || { key: keys[0] && keys[0].key, dir: "asc" };

    return {
      query: "",
      sortKey: initial.key,
      sortDir: initial.dir,
      _keys: keys,
      _searchKeys: searchKeys,

      get rows() {
        void this.$store.budget._listVersion;
        var src = (typeof srcFn === "function" ? srcFn(this) : srcFn) || [];
        var self = this;
        var filtered = src.filter(function (r) { return fuzzyMatch(r, self._searchKeys, self.query); });
        var keyDef = self._keys.find(function (k) { return k.key === self.sortKey; });
        var numeric = !!(keyDef && keyDef.numeric);
        filtered.sort(function (a, b) {
          var c = compare(a, b, self.sortKey, numeric);
          return self.sortDir === "asc" ? c : -c;
        });
        return filtered;
      },

      get visibleCount() { return this.rows.length; },

      sortBy(key) {
        if (this.sortKey === key) {
          this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
        } else {
          this.sortKey = key;
          var keyDef = this._keys.find(function (k) { return k.key === key; });
          /* Numeric columns default to descending (largest first). */
          this.sortDir = keyDef && keyDef.numeric ? "desc" : "asc";
        }
      },

      sortIndicator(key) {
        if (this.sortKey !== key) return "";
        return this.sortDir === "asc" ? "▲" : "▼";
      },

      print() {
        window.print();
      },

      /* Export the currently-filtered, currently-sorted rows as a CSV
         file the user can open in Excel / Sheets / Numbers. Filename
         carries the page slug + ISO date so multiple exports stay
         distinct in the Downloads folder. */
      exportCSV(filenameBase) {
        var self = this;
        var rows = this.rows;
        var header = this._keys.map(function (k) { return JSON.stringify(k.label); }).join(",");
        var body = rows.map(function (r) {
          return self._keys.map(function (k) {
            var v = r[k.key];
            if (v === null || v === undefined) return "";
            /* Cents columns get human-friendly dollars in the CSV. */
            if (k.numeric && Math.abs(v) >= 1000 && Number.isInteger(v)) {
              v = (v / 100).toFixed(2);
            }
            return JSON.stringify(String(v));
          }).join(",");
        }).join("\r\n");
        var blob = new Blob([header + "\r\n" + body], { type: "text/csv;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var stamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = (filenameBase || "report") + "-" + stamp + ".csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      },
    };
  };
})();
