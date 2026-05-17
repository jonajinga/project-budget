/* Categories slice — groups, CRUD, reordering (drag & drop), and
   derivations the templates call (categoryGroupsView, isPaymentCategory,
   etc.). The reordering helpers also cover account groups + accounts
   because the move-X helpers historically lived together in this
   section of the store; splitting them across two slices would split
   a tight family of "update sortIndex on siblings" implementations. */

import {
  findCategory as findCategoryImpl,
  findCategoryGroup as findCategoryGroupImpl,
  categoryGroupsView as categoryGroupsViewImpl,
  addCategory as addCategoryImpl,
  addCategoryGroup as addCategoryGroupImpl,
  renameCategory as renameCategoryImpl,
  renameCategoryGroup as renameCategoryGroupImpl,
  deleteCategory as deleteCategoryImpl,
  deleteCategoryGroup as deleteCategoryGroupImpl,
  moveCategoryToGroup as moveCategoryToGroupImpl,
  paymentCardId as paymentCardIdImpl,
  isPaymentCategory as isPaymentCategoryImpl,
  isIncomeCategory as isIncomeCategoryImpl,
  isIncomeGroup as isIncomeGroupImpl,
} from "../../domain/categories.js";

export const categoriesSlice = {
  /* Every mutator bumps _listVersion so categoryGroupsView()'s
     reactivity tripwire fires and the budget grid re-renders
     without a manual refresh. */
  /**
   * @param {string} name
   * @returns {object|null} the created group
   */
  addCategoryGroup(name) {
    if (!this.profile) return null;
    this._recordUndo("Add group");
    var g = addCategoryGroupImpl(this.profile, name);
    this._bumpLists();
    this._save();
    return g;
  },
  /**
   * @param {id} id
   * @param {string} name
   */
  renameCategoryGroup(id, name) {
    if (!this.profile) return;
    this._recordUndo("Rename group");
    renameCategoryGroupImpl(this.profile, id, name);
    this._bumpLists();
    this._save();
  },
  /**
   * Delete a category group; member-handling is delegated to the
   * domain helper. Records an undo entry.
   * @param {id} id
   */
  deleteCategoryGroup(id) {
    if (!this.profile) return;
    this._recordUndo("Delete group");
    deleteCategoryGroupImpl(this.profile, id);
    this._bumpLists();
    this._save();
  },
  /**
   * @param {object} opts {name, groupId, ...}
   * @returns {object|null} the created category
   */
  addCategory(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add category");
    var c = addCategoryImpl(this.profile, opts);
    this._bumpLists();
    this._save();
    return c;
  },
  /**
   * @param {id} id
   * @param {string} name
   */
  renameCategory(id, name) {
    if (!this.profile) return;
    this._recordUndo("Rename category");
    renameCategoryImpl(this.profile, id, name);
    this._bumpLists();
    this._save();
  },
  /**
   * @param {id} id
   */
  deleteCategory(id) {
    if (!this.profile) return;
    this._recordUndo("Delete category");
    deleteCategoryImpl(this.profile, id);
    this._bumpLists();
    this._save();
  },
  /**
   * Reparent a category to a different group (or detach with null).
   * No undo entry.
   * @param {id} id
   * @param {id} groupId
   */
  moveCategoryToGroup(id, groupId) {
    if (!this.profile) return;
    moveCategoryToGroupImpl(this.profile, id, groupId);
    this._bumpLists();
    this._save();
  },

  /* ---- Reordering (drag & drop) ----------------------------------
     All four helpers update sortIndex on the affected siblings so
     categoryGroupsView / accountGroupsView render the new order on
     next read. _bumpLists nudges any consumer that walked the view
     in a prior tick. */
  /**
   * Reorder a category group to a new index in the sortIndex list.
   * No undo entry.
   * @param {id} id
   * @param {number} toIndex
   */
  moveCategoryGroup(id, toIndex) {
    if (!this.profile) return;
    var arr = this.profile.categoryGroups
      .slice()
      .sort(function (a, b) { return a.sortIndex - b.sortIndex; });
    var from = arr.findIndex(function (g) { return g.id === id; });
    if (from < 0) return;
    var moved = arr.splice(from, 1)[0];
    var dest = Math.max(0, Math.min(toIndex, arr.length));
    arr.splice(dest, 0, moved);
    arr.forEach(function (g, i) { g.sortIndex = i; });
    this._bumpLists();
    this._save();
  },

  /**
   * Move a category into a group at a specific index, updating
   * sortIndex on every sibling in the target group. No undo entry.
   * @param {id} catId
   * @param {id} toGroupId
   * @param {number} toIndex
   */
  moveCategory(catId, toGroupId, toIndex) {
    if (!this.profile) return;
    var cat = this.profile.categories.find(function (c) { return c.id === catId; });
    if (!cat) return;
    cat.groupId = toGroupId || null;
    var target = this.profile.categories
      .filter(function (c) { return c.groupId === toGroupId && c.id !== catId; })
      .sort(function (a, b) { return a.sortIndex - b.sortIndex; });
    var dest = Math.max(0, Math.min(toIndex, target.length));
    target.splice(dest, 0, cat);
    target.forEach(function (c, i) { c.sortIndex = i; });
    this._bumpLists();
    this._save();
  },

  /**
   * Reorder an account group within the sortIndex list. No undo entry.
   * @param {id} id
   * @param {number} toIndex
   */
  moveAccountGroup(id, toIndex) {
    if (!this.profile) return;
    var arr = this.profile.accountGroups
      .slice()
      .sort(function (a, b) { return a.sortIndex - b.sortIndex; });
    var from = arr.findIndex(function (g) { return g.id === id; });
    if (from < 0) return;
    var moved = arr.splice(from, 1)[0];
    var dest = Math.max(0, Math.min(toIndex, arr.length));
    arr.splice(dest, 0, moved);
    arr.forEach(function (g, i) { g.sortIndex = i; });
    this._bumpLists();
    this._save();
  },

  /**
   * Move an account into a group at a specific index, updating
   * sortIndex on every sibling. No undo entry.
   * @param {id} acctId
   * @param {id} toGroupId
   * @param {number} toIndex
   */
  moveAccount(acctId, toGroupId, toIndex) {
    if (!this.profile) return;
    var a = this.profile.accounts.find(function (x) { return x.id === acctId; });
    if (!a) return;
    a.groupId = toGroupId || null;
    var target = this.profile.accounts
      .filter(function (x) { return x.groupId === toGroupId && x.id !== acctId; })
      .sort(function (x, y) { return x.sortIndex - y.sortIndex; });
    var dest = Math.max(0, Math.min(toIndex, target.length));
    target.splice(dest, 0, a);
    target.forEach(function (x, i) { x.sortIndex = i; });
    this._bumpLists();
    this._save();
  },

  /* ---- Derivations / lookups ---- */
  /** @param {id} id @returns {object|null} */
  findCategory(id) { return this.profile ? findCategoryImpl(this.profile, id) : null; },
  /** @param {id} id @returns {object|null} */
  findCategoryGroup(id) { return this.profile ? findCategoryGroupImpl(this.profile, id) : null; },
  /**
   * Budget-grid view of groups with their categories attached. Reads
   * _listVersion for reactivity.
   * @returns {object[]}
   */
  categoryGroupsView() {
    /* Reactivity tripwire — bumpLists triggers re-render even when
       the profile object reference doesn't change. */
    void this._listVersion;
    return this.profile ? categoryGroupsViewImpl(this.profile) : [];
  },
  /** @param {id} id @returns {boolean} */
  isPaymentCategory(id) { return this.profile ? isPaymentCategoryImpl(this.profile, id) : false; },
  /** @param {id} id @returns {boolean} */
  isIncomeCategory(id) { return this.profile ? isIncomeCategoryImpl(this.profile, id) : false; },
  /** @param {object} group @returns {boolean} */
  isIncomeGroup(group) { return isIncomeGroupImpl(group); },
  /**
   * Account id paired with a payment category, or null.
   * @param {id} id payment category id
   * @returns {id|null}
   */
  paymentCardId(id) { return this.profile ? paymentCardIdImpl(this.profile, id) : null; },
  /** @param {id} id @returns {string} category name, or "" */
  categoryName(id) {
    var c = this.findCategory(id);
    return c ? c.name : "";
  },

  /**
   * Flat list of categories formatted "Group / Name" for dropdown
   * pickers. Hidden categories are excluded.
   * @returns {object[]} {id, name, groupName}
   */
  categoriesFlat() {
    void this._listVersion;
    if (!this.profile) return [];
    var view = categoryGroupsViewImpl(this.profile);
    var out = [];
    view.forEach(function (b) {
      b.categories.forEach(function (c) {
        out.push({ id: c.id, name: (b.group ? b.group.name + " / " : "") + c.name, groupName: b.group ? b.group.name : "" });
      });
    });
    return out;
  },
};
