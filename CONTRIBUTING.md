# Contributing to Project Budget

Thanks for your interest in helping Project Budget.

## What gets accepted

- Bug fixes
- Accessibility improvements
- New CSV / OFX / QFX / QIF / bank-export shape detectors
- Documentation improvements
- Performance work that is measurable
- New reports
- New goal types

## What does not get accepted

- Anything that requires a backend, server, or hosted service
- Telemetry, analytics that touch budget data, or "phone-home" features
- Bank-connection integrations (Plaid, SimpleFIN, MX, etc.)
- Paid tiers, license keys, or any paywalled functionality
- Dependencies that are not auditable or not MIT / BSD / Apache-licensed

## Workflow

1. Open an issue describing the change before writing code, unless it is a trivial fix
2. Fork, branch from `main`, name the branch after the issue
3. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a pull request against `main`
5. Include a screenshot for any UI change

## Local development

```
npm install
npm run dev
```

## House rules

- Code style follows the repo's existing patterns. Keep functions small. Avoid premature abstraction.
- No emojis in code, headings, or commit messages
- Plain ASCII in source files (no smart quotes, em-dashes, or ellipsis characters)
- Run `npm run build` before opening a PR
