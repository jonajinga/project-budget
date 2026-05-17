/* Scheduled-transactions slice — add/remove/update templates, post a
   due occurrence, skip one, pause/resume the whole template. The
   post/skip/pause methods do a copy-on-write replacement of the
   scheduled record so Alpine sees a new reference and re-renders the
   recurring table + calendar projection. */

import {
  addSchedule as addScheduleImpl,
  removeSchedule as removeScheduleImpl,
  updateSchedule as updateScheduleImpl,
  dueTransactions,
  postScheduled as postScheduledImpl,
  skipScheduled as skipScheduledImpl,
} from "../../domain/scheduled.js";
import { upsertPayee } from "../../domain/payees.js";

export const scheduledSlice = {
  addSchedule(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add recurring");
    var s = addScheduleImpl(this.profile, opts);
    this._save();
    return s;
  },
  removeSchedule(id) {
    if (!this.profile) return;
    this._recordUndo("Remove recurring");
    removeScheduleImpl(this.profile, id);
    this._bumpLists();
    this._save();
  },
  updateSchedule(id, patch) {
    if (!this.profile) return null;
    this._recordUndo("Edit recurring");
    var s = updateScheduleImpl(this.profile, id, patch);
    this._bumpLists();
    this._save();
    return s;
  },
  dueScheduled() {
    if (!this.profile) return [];
    return dueTransactions(this.profile);
  },
  postScheduled(id, overrides) {
    if (!this.profile) return null;
    this._recordUndo("Post scheduled");
    /* If the template carries a payeeName (set when the user authored the
       schedule before that payee existed), upsert it on post so the
       resulting transaction has a real payeeId. */
    var sched = this.profile.scheduled.find(function (s) { return s.id === id; });
    if (sched && sched.template && sched.template.payeeName && !sched.template.payeeId) {
      var p = upsertPayee(this.profile, sched.template.payeeName, sched.template.categoryId || null);
      if (p) sched.template.payeeId = p.id;
    }
    var t = postScheduledImpl(this.profile, id, overrides);
    /* The domain helper mutates s.nextDate in place. Replace the
       schedule object with a shallow clone so consumers that track the
       array (the recurring table, the calendar projection) see a new
       reference and re-render — otherwise the date stays stale until
       the next manual reload. */
    var idx = this.profile.scheduled.findIndex(function (x) { return x.id === id; });
    if (idx >= 0) {
      var copy = this.profile.scheduled.slice();
      copy[idx] = Object.assign({}, copy[idx]);
      this.profile.scheduled = copy;
    }
    this._bumpLists();
    this._save();
    return t;
  },
  skipScheduled(id) {
    if (!this.profile) return null;
    this._recordUndo("Skip scheduled");
    var s = skipScheduledImpl(this.profile, id);
    var idx = this.profile.scheduled.findIndex(function (x) { return x.id === id; });
    if (idx >= 0) {
      var copy = this.profile.scheduled.slice();
      copy[idx] = Object.assign({}, copy[idx]);
      this.profile.scheduled = copy;
    }
    this._bumpLists();
    this._save();
    return s;
  },

  /* Toggle a template's paused flag. Paused templates stay in the
     list (history, frequency, nextDate preserved) but skip the due
     queue + upcoming bills + calendar projection until resumed. */
  setSchedulePaused(id, paused) {
    if (!this.profile) return null;
    var idx = this.profile.scheduled.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return null;
    this._recordUndo(paused ? "Pause recurring" : "Resume recurring");
    /* Replace the record so Alpine sees a fresh reference. */
    var copy = this.profile.scheduled.slice();
    copy[idx] = Object.assign({}, copy[idx], { paused: !!paused });
    this.profile.scheduled = copy;
    this._bumpLists();
    this._save();
    this.pushToast(paused ? "Template paused." : "Template resumed.");
    return copy[idx];
  },
};
