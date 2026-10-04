/**
 * What an unpaired device sees instead of the app.
 *
 * It replaces the whole UI on purpose: without a token nothing in perch works,
 * so a half-rendered workspace behind a banner would only be a collection of
 * dead controls. The code is read off the host's screen (Settings → Devices)
 * and typed here; the host issues the token and sets it as a cookie.
 */
import { useState } from "react";
import { claimPairing } from "../pairing";

const INPUT = "min-h-11 min-w-0 rounded-ui border border-overlay-0 bg-surface-0 px-[0.65rem] py-2 tracking-[0.08em] text-fg [font:1rem/1.2_var(--font-mono)] focus-visible:[outline-offset:-2px] focus-visible:[outline:2px_solid_var(--accent)]";

export function PairingGate({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(() => (/iPhone|iPad|Android/i.test(navigator.userAgent) ? "Phone" : "Browser"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !code.trim()) return;
    setPending(true);
    setError(null);
    try {
      await claimPairing(code, name);
      onPaired();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-fg" data-testid="pairing-gate">
      <form className="flex w-[min(26rem,100%)] flex-col gap-[0.85rem] rounded-[calc(var(--radius)*2)] border border-overlay-0 bg-panel-bg p-6" onSubmit={submit}>
        <h1 className="m-0 text-[1.1rem]">Pair this device</h1>
        <p className="m-0 text-[0.8rem] leading-[1.45] text-subtext-0">
          On the machine running perch, open Settings → Devices and choose “Pair a device”. Enter the
          code it shows. It is valid for five minutes.
        </p>
        <label className="flex flex-col gap-[0.3rem] text-[0.72rem] text-subtext-0">
          <span>Pairing code</span>
          <input
            className={INPUT}
            data-testid="pairing-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
            placeholder="ABCD2345"
          />
        </label>
        <label className="flex flex-col gap-[0.3rem] text-[0.72rem] text-subtext-0">
          <span>Name this device</span>
          <input
            className={INPUT}
            data-testid="pairing-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
          />
        </label>
        {error && <p className="m-0 text-[0.78rem] text-red" role="alert" data-testid="pairing-error">{error}</p>}
        <button type="submit" className="min-h-11 cursor-pointer rounded-ui bg-accent text-panel-bg [border:0] disabled:cursor-not-allowed disabled:opacity-[0.55]" data-testid="pairing-submit" disabled={pending || !code.trim()}>
          {pending ? "Pairing…" : "Pair device"}
        </button>
      </form>
    </div>
  );
}
