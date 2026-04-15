# Privacy Policy

**Last updated:** April 15, 2026

## Overview

**Time Horizon** ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application (the "Service").

---

## Data We Collect

### 1. Local Data (Stored in Your Browser)

Time Horizon stores the following data locally on your device using your browser's local storage:

- **Custom collections and events** you create
- **App preferences** (theme, language, sync settings)
- **Viewport state** (timeline position, zoom level)
- **Search history** (temporary, in memory)
- **UI state** (open panels, selected items)

This data is **never transmitted to our servers** unless you explicitly opt into Google Drive sync.

### 2. Google Drive Sync (Optional, Opt-In)

When you enable Google Drive sync, Time Horizon stores a copy of your collections and preferences in a dedicated folder in **your own Google Drive** account. Specifically:

- **Folder name:** `time-horizon/`
- **Contents:**
  - `manifest.json` — sync metadata
  - `collections/` — individual collection JSON files

**We do not receive, view, or store your Google Drive data.** The sync uses Google Drive as a user-controlled storage backend. You can disconnect and delete this data at any time from your Google Drive account.

### 3. Automatically Collected Data

When you use the Service, we automatically collect:

- **Basic analytics** — page views, feature usage (e.g., timeline interactions), approximate zoom ranges. No personally identifiable information is collected.
- **Error logs** — anonymized error messages and stack traces for crash reporting (via Vercel Analytics or similar).
- **Referrer/URL parameters** — when you open a shared timeline URL (e.g., `?c=...` or `?t=...`), we read those params to render the correct view. These are processed client-side only and are not stored.

---

## How We Use Data

| Purpose | Data used |
|---|---|
| Render your timeline | Local collections + events |
| Sync across devices | Encrypted snapshot sent to **your** Google Drive |
| Improve the app | Aggregated, anonymized usage analytics |
| Debug crashes | Anonymized error telemetry |
| Share timelines | URL params (processed live, not stored) |

---

## Cookies and Storage

| Type | Purpose | Duration |
|---|---|---|
| `localStorage` | App state, collections, preferences | Persistent until cleared |
| `sessionStorage` | Transient UI state (search, panels) | Cleared on tab close |
| Third-party cookies | None | — |

We do not use tracking cookies, advertising cookies, or cross-site tracking.

---

## Third-Party Services

### Google OAuth / Google Drive

When you connect Google Drive sync, you interact with Google's OAuth 2.0 flow. This is governed by [Google's Privacy Policy](https://policies.google.com/privacy) and [Terms of Service](https://policies.google.com/terms). We do not share your data with Google beyond the OAuth consent screen.

### Vercel (Hosting)

The Service is hosted on [Vercel](https://vercel.com). Vercel may collect standard server logs including your IP address, requested URLs, and browser headers. This is governed by [Vercel's Privacy Policy](https://vercel.com/legal/privacy-policy).

---

## Data Sharing

We **do not sell, trade, or rent** your personal data. We do not share your data with any third party except:

1. **Google** — as part of the optional OAuth sync flow (your data goes to **your** Google Drive, not ours)
2. **Vercel** — standard server infrastructure hosting
3. **Legal obligations** — if required by law, court order, or to protect rights

---

## Data Retention

- **Local data:** Retained until you clear browser data or manually reset the app.
- **Google Drive data:** Retained as long as you keep the `time-horizon/` folder in your Google Drive. You can delete it at any time.
- **Analytics data:** Aggregated and anonymized; individual sessions are not retained beyond 90 days.

---

## Your Rights

Depending on your jurisdiction, you may have the right to:

- **Access** your stored data (you can export your collections as JSON from the app)
- **Delete** your data — clear browser data or disconnect Google Drive sync to remove cloud copies
- **Object** to analytics collection (you can block analytics by using an ad/tracker blocker)
- **Port** your data — collections are stored as plain JSON, exportable at any time

To disconnect Google Drive sync:
1. Open the **Control Center** in the app
2. Go to **Sync Settings**
3. Click **Disconnect Google Drive**
4. Optionally, manually delete the `time-horizon/` folder from your Google Drive

---

## Data Security

- All data stored in Google Drive is under your Google account's existing security (2FA, Google account password).
- Local data lives in your browser's sandbox and is protected by your device's filesystem permissions.
- We use HTTPS for all connections (enforced by Vercel CDN).
- No encryption is applied to the Google Drive files beyond Google's at-rest encryption — be aware that anyone with access to your Google Drive can read the sync files.

---

## Children's Privacy

The Service is not directed at children under the age of 13. We do not knowingly collect data from children. If you believe a child has provided us with personal data, please contact us so we can delete it.

---

## International Data Transfers

If you are accessing the Service from outside your country, note that your data may be transferred to and processed in countries with different privacy laws. By using the Service, you consent to such transfers to the extent applicable.

---

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. For significant changes, we will notify users via the app's announcement channel or a prominent notice on the website.

**If you continue to use the Service after changes take effect, you agree to the revised policy.**

---

## Contact

If you have any questions about this Privacy Policy, please reach out:

- **GitHub Issues:** [time-horizon/issues](https://github.com/hoangTran0410/time-horizon/issues)
- **Email:** hoangtran0410 (at) gmail.com

---

## Summary

| | |
|---|---|
| Data collected | Your timeline data (collections, events) stored locally or in your own Google Drive |
| Third-party sharing | None, except Google OAuth for sync |
| Analytics | Aggregated, anonymized only |
| Sale of data | Never |
| Children's data | Not collected |
| You control | Everything — local storage + Google Drive sync are both disconnectable/deletable |