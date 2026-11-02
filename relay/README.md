# Perch relay

Lets a paired phone reach your computer from **any network**, with nothing
installed on the phone but its browser. You deploy it once; one person's traffic
should fit Cloudflare's free plan (not load-tested).

It is a blind pipe. Your computer connects out to it and so does the phone; it
forwards sealed frames between them and serves the Perch web app. The key that
seals them lives only in the link's `#fragment`, which browsers never send, so
the relay cannot read, change or replay your session. It stores nothing.
Phones still have to pair, as on Wi-Fi.

## Deploy

1. Build the web app and install the tools (repo root, then here):

   ```sh
   npm ci && npm run build
   cd relay && npm install
   ```

2. Sign in to Cloudflare and deploy (free account is enough):

   ```sh
   npx wrangler login
   npx wrangler deploy
   ```

   Wrangler prints an address like `https://perch-relay.<you>.workers.dev`.

3. In Perch: **Settings → Devices → Relay**, paste the address, Save. It should
   say *Connected*. Then **Pair a device** and scan the QR with the phone.

Redeploy after updating Perch (`npm run build` first) so the phone's page
matches your computer's version. To turn it off, clear the address.

## What to know

- **Trust.** The relay also serves the page that holds the key. Whoever deploys
  it could ship code that leaks the key, so deploy your own; do not use one a
  stranger runs.
- **Rotating the key.** Delete `~/.perch/relay.json` (and restart) to invalidate
  every relay link. Paired devices stay paired on Wi-Fi/Tailscale; re-scan on the
  phone.
- **Limits.** Up to 16 phones per room, 1 MiB per frame. Large files cross
  slowly. Free-plan Durable Object limits are generous for one person but were
  not load-tested.
- **Try it locally.** `npx wrangler dev --port 8787`, then use
  `http://127.0.0.1:8787` as the address. Plain `http` is accepted only for
  this machine.

Protocol and threat model: `crates/perch-core/src/relay/wire.rs` and
[DECISIONS](../docs/DECISIONS.md).
