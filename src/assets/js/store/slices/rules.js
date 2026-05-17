/* Rules slice — exposes the auto-categorization + payee-normalization
   rule store on the Alpine store. The transactions slice consults
   applyRules() inside addTransaction / commitImport so manual entries
   AND bank imports both get rules applied transparently. */

import {
  addCategorizeRule as addCategorizeRuleImpl,
  addNormalizeRule as addNormalizeRuleImpl,
  updateRule as updateRuleImpl,
  deleteRule as deleteRuleImpl,
  moveRule as moveRuleImpl,
  applyRules as applyRulesImpl,
} from "../../domain/rules.js";

export const rulesSlice = {
  /**
   * Snapshot of the categorize rules in priority order.
   * @returns {object[]}
   */
  listCategorizeRules() {
    void this._listVersion;
    if (!this.profile || !this.profile.rules) return [];
    return (this.profile.rules.categorize || []).slice();
  },
  /**
   * Snapshot of the normalize-payee rules in priority order.
   * @returns {object[]}
   */
  listNormalizeRules() {
    void this._listVersion;
    if (!this.profile || !this.profile.rules) return [];
    return (this.profile.rules.normalizePayee || []).slice();
  },

  /**
   * Add a categorize rule. opts: {pattern, matchType, categoryId, enabled?}.
   * @param {object} opts
   * @returns {object|null}
   */
  addCategorizeRule(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add categorize rule");
    var r = addCategorizeRuleImpl(this.profile, opts);
    this._bumpLists();
    this._save();
    return r;
  },
  /**
   * Add a payee-normalize rule. opts: {pattern, matchType, replacement, enabled?}.
   * @param {object} opts
   * @returns {object|null}
   */
  addNormalizeRule(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add normalize rule");
    var r = addNormalizeRuleImpl(this.profile, opts);
    this._bumpLists();
    this._save();
    return r;
  },

  /**
   * @param {"categorize"|"normalizePayee"} kind
   * @param {id} id
   * @param {object} patch
   * @returns {object|null}
   */
  updateRule(kind, id, patch) {
    if (!this.profile) return null;
    this._recordUndo("Edit rule");
    var r = updateRuleImpl(this.profile, kind, id, patch);
    this._bumpLists();
    this._save();
    return r;
  },

  /**
   * @param {"categorize"|"normalizePayee"} kind
   * @param {id} id
   * @returns {boolean}
   */
  deleteRule(kind, id) {
    if (!this.profile) return false;
    this._recordUndo("Delete rule");
    var ok = deleteRuleImpl(this.profile, kind, id);
    if (ok) { this._bumpLists(); this._save(); }
    return ok;
  },

  /**
   * Shift a rule's priority by delta (-1 / +1).
   * @param {"categorize"|"normalizePayee"} kind
   * @param {id} id
   * @param {number} delta
   */
  moveRule(kind, id, delta) {
    if (!this.profile) return false;
    this._recordUndo("Reorder rule");
    var ok = moveRuleImpl(this.profile, kind, id, delta);
    if (ok) { this._bumpLists(); this._save(); }
    return ok;
  },

  /**
   * Pure helper for the transactions slice — given a raw payee name
   * and a fallback category, return the (possibly rewritten) payee
   * name + auto-assigned categoryId. Doesn't mutate.
   * @param {string} rawPayeeName
   * @param {id|null} fallbackCategoryId
   * @returns {{name: string, categoryId: (string|null)}}
   */
  applyRulesPreview(rawPayeeName, fallbackCategoryId) {
    if (!this.profile) return { name: rawPayeeName || "", categoryId: fallbackCategoryId || null };
    return applyRulesImpl(this.profile, rawPayeeName, fallbackCategoryId);
  },
};
