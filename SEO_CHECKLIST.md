# SEO checklist — Torro Labs

The on-page work is shipped. This file is the off-page work only you can do.

## Reality check on ranking

- **"Torro Labs" / "torrolabs"** — achievable in days/weeks once Google indexes you. No one competes for your brand name.
- **Long-tail like "browser whisper transcription" / "transcribe audio without upload" / "private transcription tool"** — achievable in months with the moves below. Your "100% local, no upload" angle is a real wedge vs Otter/Rev.
- **"free transcription" / "online transcription" / "transcribe audio"** — owned by Otter.ai, Rev, Descript, Notta (domain authority 80+). Don't chase these head terms. They will eat your time.

---

## Do these tonight (~30 min total)

### 1. Google Search Console — the single biggest lever
Sign in with your Google account. Add `https://torrolabs.com` as a property.

- https://search.google.com/search-console
- Choose **URL prefix** method (not Domain — easier to verify on Vercel).
- Verify via the **HTML tag** method: Google gives you a `<meta name="google-site-verification" content="..." />` tag. Paste it into `index.html` `<head>` right after the canonical link. Push. Click Verify.
- Once verified, go to **Sitemaps** in the sidebar → submit `https://torrolabs.com/sitemap.xml`.
- That's it. Google will start crawling within hours and indexing within days.

### 2. Bing Webmaster Tools (~5 min)
~7% of search traffic. Free. Import directly from Search Console.

- https://www.bing.com/webmasters
- "Import from Google Search Console" → pick torrolabs.com → done.

### 3. Google Analytics (optional but useful)
You can't optimize what you can't measure. Use **Plausible** ($9/mo, privacy-friendly, fits your brand) or **GA4** (free).

---

## Backlinks — the actual #1 ranking factor

Google ranks you on (a) what your page says, (b) who links to you. The on-page work covers (a). Backlinks cover (b). One launch on Product Hunt is worth more than a month of meta-tag tuning.

### Launch posts — do these in the next 2 weeks

1. **Product Hunt launch** ⭐ biggest single move
   - Schedule for a Tuesday-Thursday launch (best traffic days).
   - https://www.producthunt.com/posts/new
   - Killer angle: "Whisper transcription that runs 100% in your browser. No uploads, no API keys, no costs."
   - Will give you: ~1000-3000 first-day visitors, a permanent backlink from a DA 91 site, and dozens of brand searches that train Google.

2. **Show HN on Hacker News**
   - https://news.ycombinator.com/submit
   - Title format: `Show HN: Torro Labs Transcriber – Whisper in the browser, no uploads`
   - HN engineers love the privacy/local-first angle. WebGPU + Transformers.js will get upvoted on technical merit.
   - Post Tue/Wed morning US time. Engage in comments.

3. **AlternativeTo.net**
   - Submit as an alternative to Otter.ai, Rev, Descript, Notta, Sonix.
   - https://alternativeto.net/software/otter-ai/
   - Permanent backlink + steady trickle of qualified traffic from people actively shopping for alternatives.

### Communities — pick the ones where your users actually hang out

- **r/SideProject** — show off the launch
- **r/InternetIsBeautiful** — the privacy angle does well here
- **r/podcasters** — your direct target user
- **r/Productivity** — secondary audience
- **Indie Hackers** — https://www.indiehackers.com/post (post your launch)
- Be a human in comments, not a billboard.

### Permanent backlinks from GitHub

Submit to these awesome-lists via PR:

- https://github.com/sindresorhus/awesome — too broad, but check sub-lists below
- https://github.com/awesome-selfhosted/awesome-selfhosted
- Search `awesome-whisper`, `awesome-transcription`, `awesome-ai-tools` on GitHub
- A README mention is a permanent DA 96 backlink. These take 10 min each.

---

## Content — the long game (3-12 months)

Don't start unless you can commit to 1 post/week for 6 months.

Long-tail keywords to target with blog posts (each is a separate post):

- "how to transcribe a podcast without uploading"
- "private alternatives to otter.ai"
- "whisper online free no signup"
- "how to transcribe an interview"
- "best free transcription software 2026"
- "transcribe video to text in browser"

Each post: 1500+ words, useful answer to a real question, link to torrolabs.com as the recommended tool. Publish at `torrolabs.com/blog/<slug>` — that's a Next.js or even a 2nd HTML file's job, separate from the current app.

---

## What NOT to do

- Don't buy backlinks. Google catches these and penalizes you.
- Don't keyword-stuff your existing page. The current copy is fine.
- Don't pay an "SEO agency" until you have $5k/mo to burn. For a $9/mo SaaS the ROI doesn't work.
- Don't chase "transcription" as a keyword. Chase the long-tail.
- Don't add fake AggregateRating to your structured data. Google penalizes this aggressively (and it's dishonest).

---

## Watch list

After Search Console is set up, check these monthly:

- **Impressions** in GSC → how often you appeared in search results
- **Clicks** in GSC → how often someone actually clicked
- **Avg position** → moving down (toward 1) is good
- **Top queries** → tells you what people are actually finding you for; often a surprise

For long-term tracking: Ahrefs Webmaster Tools is free and shows your backlinks growing over time.
