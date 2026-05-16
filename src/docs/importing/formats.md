---
title: "Supported import formats"
subtitle: "CSV, OFX, QFX, QIF, and GoCardless — what each looks like and which banks export which."
category: "importing"
order: 1
---

## CSV

The most common bank export. Project Budget tries to auto-detect the shape, then lets you adjust the column mapping before commit.

Recognized shapes:

- **Chase** — *Transaction Date, Post Date, Description, Category, Type, Amount* (signed amount).
- **Capital One** — *Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit* (split debit/credit).
- **Discover** — *Trans. Date, Post Date, Description, Amount, Category*.
- **Mint** — *Date, Description, Original Description, Amount, Transaction Type, Category, Account Name, Labels, Notes*.
- **Actual Budget** — *Date, Payee, Notes, Category, Amount*.
- **Generic fallback** — any CSV with columns matching `date`, `payee`/`description`/`merchant`, and either `amount` or `debit`+`credit`.

## OFX / QFX

OpenFinancial Exchange. Most US banks expose this directly (Quicken-flavored as QFX). Project Budget parses both the SGML (1.x) and XML (2.x) variants and uses the `FITID` field for dedupe.

## QIF

Quicken Interchange Format — old, but still common for personal-finance archives. Line-prefix parser (D for date, T for amount, P for payee, L for category).

## GoCardless

European Bank Account Data CSV export with `bookingDate`, `valueDate`, `debtorName`, `creditorName`, `remittanceInformation`, `amount`, `currency`, `transactionId`. Project Budget picks the non-empty name as the payee and uses `transactionId` for dedupe.

## Dedupe across all formats

Every importer skips rows it already has. The dedupe key is `accountId + date + amount + payee`, plus the bank-provided unique id (`FITID` or `transactionId`) when available. Re-running the same import is safe.
