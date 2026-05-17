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
} from "../../domain/categories.js";

export const categoriesSlice = {
  /* Every mutator bumps _listVersion so categoryGroupsView()'s
     reactivity tripwire fires and the budget grid re-renders
     without a manual refresh. */
  addCategoryGroup(name) {
    if (!this.profile) return null;
    this._recordUndo("Add group");
    var g = addCategoryGroupImpl(this.profile, name);
    this._bumpLists();
    this._save();
    return g;
  },
  renameCategoryGroup(id, name) {
    if (!this.profile) return;
    this._recordUndo("Rename group");
    renameCategoryGroupImpl(this.profile, id, name);
    this._bumpLists();
    this._save();
  },
  deleteCategoryGroup(id) {
    if (!this.profile) return;
    this._recordUndo("Delete group");
    deleteCategoryGroupImpl(this.profile, id);
    this._bumpLists();
    this._save();
  },
  addCategory(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add category");
    var c = addCategoryImpl(this.profile, opts);
    this._bumpLists();
    this._save();
    return c;
  },
  renameCategory(id, name) {
    if (!this.profile) return;
    this._recordUndo("Rename category");
    renameCategoryImpl(this.profile, id, name);
    this._bumpLists();
    this._save();
  },
  deleteCategory(id) {
    if (!this.profile) return;
    this._recordUndo("Delete category");
    deleteCategoryImpl(this.profile, id);
    this._bumpLists();
    this._save();
  },
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
  findCategory(id) { return this.profile ? findCategoryImpl(this.profile, id) : null; },
  findCategoryGroup(id) { return this.profile ? findCategoryGroupImpl(this.profile, id) : null; },
  categoryGroupsView() {
    /* Reactivity tripwire — bumpLists triggers re-render even when
       the profile object reference doesn't change. */
    void this._listVersion;
    return this.profile ? categoryGroupsViewImpl(this.profile) : [];
  },
  isPaymentCategory(id) { return this.profile ? isPaymentCategoryImpl(this.profile, id) : false; },
  paymentCardId(id) { return this.profile ? paymentCardIdImpl(this.profile, id) : null; },
  categoryName(id) {
    var c = this.findCategory(id);
    return c ? c.name : "";
  },

  /* All categories flat — used by dropdowns. Skips hidden by default. */
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
