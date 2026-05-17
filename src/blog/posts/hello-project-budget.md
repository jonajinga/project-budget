---
title: "Hello, Project Budget"
summary: "First public preview of an envelope-budgeting app that runs entirely in your browser."
date: 2026-05-15
tag: "Release"
author: "Jon Ajinga"
---

Project Budget is a free, open-source envelope-budgeting app. It runs in your browser using `localStorage`. There is no backend, no account, no bank credentials.

The shipping version covers the things that matter month to month: accounts of all six common types, a register with inline edit and reconciliation, an envelope budget with four goal types, seven D3 reports, and import from CSV, OFX, QFX, QIF, and GoCardless. Multiple profiles in one browser. Daily local backups. Print stylesheets per page. Light and dark themes.

## Why localStorage

The two paradigms in personal-finance tooling — *connect your bank and we sync everything* and *run a server and trust yourself with it* — both have honest reasons to exist. They also both have downsides. The first asks you to hand a third party permanent read access to every financial decision you make. The second asks you to set up a server, monitor a server, back up a server.

There's a third path that gets less attention: the app runs in your browser, your data sits next to it in your browser, and nobody else touches either. That's Project Budget.

## What it isn't

Project Budget will not sync to your bank. It will not run on a phone as a native app (use the PWA install). It will not encrypt your exports (decided this one explicitly — the friction of forgotten passphrases outweighed the value). It will not push notifications.

## What's next

The roadmap is short on purpose: more bank-export shape detectors as people ask, a small handful of additional reports, and the option to encrypt exports for users who want it. The full plan lives on [GitHub](https://github.com/jonajinga/project-budget).
