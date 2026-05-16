/* Bank-export shape detectors. Each detector returns:
     { confidence: 0..1, columnMap: { date, payee, amount?, debit?, credit?, memo?, category? } }
   The highest-confidence shape pre-fills the column-mapping UI. The user
   can adjust before commit. */

function has(headers, name) {
  return headers.indexOf(name) !== -1;
}

function hasAny(headers, names) {
  return names.some(function (n) { return headers.indexOf(n) !== -1; });
}

/* Headers come in already normalized: trimmed, lowercased. */

export const SHAPES = {

  chase: {
    label: "Chase",
    test: function (h) {
      var hits = ["transaction date", "post date", "description", "category", "type", "amount"].filter(function (n) { return has(h, n); }).length;
      return hits >= 5 ? hits / 6 : 0;
    },
    map: function () {
      return { date: "transaction date", payee: "description", amount: "amount", category: "category", memo: "type" };
    },
  },

  capitalOne: {
    label: "Capital One",
    test: function (h) {
      var hits = ["transaction date", "posted date", "card no.", "description", "category", "debit", "credit"].filter(function (n) { return has(h, n); }).length;
      return hits >= 5 ? hits / 7 : 0;
    },
    map: function () {
      return { date: "transaction date", payee: "description", debit: "debit", credit: "credit", category: "category" };
    },
  },

  discover: {
    label: "Discover",
    test: function (h) {
      var hits = ["trans. date", "post date", "description", "amount", "category"].filter(function (n) { return has(h, n); }).length;
      return hits >= 4 ? hits / 5 : 0;
    },
    map: function () {
      return { date: "trans. date", payee: "description", amount: "amount", category: "category" };
    },
  },

  mint: {
    label: "Mint export",
    test: function (h) {
      var must = ["date", "description", "amount", "transaction type", "category"];
      var hits = must.filter(function (n) { return has(h, n); }).length;
      return hits >= 4 ? hits / must.length : 0;
    },
    map: function () {
      /* Mint uses unsigned amount + transaction type (debit / credit). */
      return { date: "date", payee: "description", amount: "amount", category: "category", memo: "notes", typeColumn: "transaction type" };
    },
  },

  actual: {
    label: "Actual Budget export",
    test: function (h) {
      var must = ["date", "payee", "notes", "category", "amount"];
      var hits = must.filter(function (n) { return has(h, n); }).length;
      return hits >= 4 ? hits / must.length : 0;
    },
    map: function () {
      return { date: "date", payee: "payee", amount: "amount", category: "category", memo: "notes" };
    },
  },

  generic: {
    label: "Generic",
    test: function (h) {
      var dateCol = h.find(function (c) { return /date/.test(c); });
      var payeeCol = h.find(function (c) { return /payee|description|merchant|name/.test(c); });
      var amountCol = h.find(function (c) { return /^amount$|signed amount/.test(c); });
      var debitCol = h.find(function (c) { return /debit|withdrawal/.test(c); });
      var creditCol = h.find(function (c) { return /^credit$|deposit/.test(c); });
      var score = 0;
      if (dateCol) score += 0.4;
      if (payeeCol) score += 0.3;
      if (amountCol || (debitCol && creditCol)) score += 0.3;
      return score;
    },
    map: function (h) {
      var find = function (re) { return h.find(function (c) { return re.test(c); }); };
      var amountCol = find(/^amount$|signed amount/);
      var debitCol = find(/debit|withdrawal/);
      var creditCol = find(/^credit$|deposit/);
      var memoCol = find(/memo|notes/);
      var catCol = find(/category/);
      var out = {
        date: find(/date/),
        payee: find(/payee|description|merchant|name/),
      };
      if (amountCol) out.amount = amountCol;
      if (debitCol) out.debit = debitCol;
      if (creditCol) out.credit = creditCol;
      if (memoCol) out.memo = memoCol;
      if (catCol) out.category = catCol;
      return out;
    },
  },

};

export function detect(headers) {
  var bestKey = "generic";
  var bestScore = 0;
  Object.keys(SHAPES).forEach(function (k) {
    var s = SHAPES[k].test(headers);
    if (s > bestScore) { bestScore = s; bestKey = k; }
  });
  var shape = SHAPES[bestKey];
  return {
    shape: bestKey,
    label: shape.label,
    confidence: bestScore,
    columnMap: shape.map(headers),
  };
}

/* Available column names for the mapping UI dropdowns. */
export function columnsFromHeaders(headers) {
  return headers.slice();
}
