/**
 * What a device that can't use perch yet sees instead of the app.
 *
 * Both replace the whole UI on purpose: perch runs on the user's laptop and a
 * phone is only a view of it, so with no token or no laptop in reach a
 * half-rendered workspace would only be a collection of dead controls.
 *
 *  - `PairingGate`: the laptop answered but doesn't know this device. The code
 *    is read off the laptop's screen (Settings → Devices) and typed or pasted
 *    here, or arrives as a `pair=` link; the host issues the token and sets it
 *    as a cookie.
 *  - `LaptopUnreachable`: the phone has never reached the laptop (asleep,
 *    another network, perch closed). It retries on its own; this says what to
 *    check.
 */
import { useEffect, useState } from "react";
import { claimPairing, takePairingCodeFromUrl } from "../pairing";

const INPUT = "min-h-11 min-w-0 rounded-ui border border-overlay-0 bg-surface-0 px-[0.65rem] py-2 tracking-[0.08em] text-fg [font:1rem/1.2_var(--font-mono)] focus-visible:[outline-offset:-2px] focus-visible:[outline:2px_solid_var(--accent)]";
const SCREEN = "flex min-h-[100dvh] items-center justify-center p-6 text-fg";
const CARD = "flex w-[min(26rem,100%)] flex-col gap-[0.85rem] rounded-[calc(var(--radius)*2)] border border-overlay-0 bg-panel-bg p-6";
const BODY = "m-0 text-[0.8rem] leading-[1.45] text-subtext-0";
const PRIMARY = "min-h-11 cursor-pointer rounded-ui bg-accent text-panel-bg [border:0] disabled:cursor-not-allowed disabled:opacity-[0.55]";

export function PairingGate({ phone = false, onPaired }: { phone?: boolean; onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(() => (/iPhone|iPad|Android/i.test(navigator.userAgent) ? "Phone" : "Browser"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function claim(value: string) {
    if (pending || !value.trim()) return;
    setPending(true);
    setError(null);
    try {
      await claimPairing(value, name);
      onPaired();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setPending(false);
    }
  }

  // A pairing link opened on this device carries its own code.
  useEffect(() => {
    const fromLink = takePairingCodeFromUrl();
    if (fromLink) void claim(fromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  return (
    <div className={SCREEN} data-testid="pairing-gate">
      <form className={CARD} onSubmit={(event) => { event.preventDefault(); void claim(code); }}>
        <h1 className="m-0 text-[1.1rem]">{phone ? "Connect to your laptop" : "Pair this device"}</h1>
        <p className={BODY}>
          {phone
            ? "perch runs on your laptop; this phone only controls it. On the laptop, open Settings → Devices and choose “Pair a device”, then enter the code it shows. It is valid for five minutes."
            : "On the machine running perch, open Settings → Devices and choose “Pair a device”. Enter the code it shows. It is valid for five minutes."}
        </p>
        <label className="flex flex-col gap-[0.3rem] text-[0.72rem] text-subtext-0">
          <span>Pairing code or link</span>
          <input
            className={INPUT}
            data-testid="pairing-code"
            value={code}
            onChange={(event) => setCode(/[/:]/.test(event.target.value) ? event.target.value : event.target.value.toUpperCase())}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={300}
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
        <button type="submit" className={PRIMARY} data-testid="pairing-submit" disabled={pending || !code.trim()}>
          {pending ? "Pairing…" : phone ? "Connect" : "Pair device"}
        </button>
      </form>
    </div>
  );
}

export function LaptopUnreachable() {
  return (
    <div className={SCREEN} data-testid="laptop-unreachable">
      <div className={CARD} role="status">
        <h1 className="m-0 text-[1.1rem]">Can’t reach your laptop</h1>
        <p className={BODY}>
          Trying <strong className="text-fg [font-family:var(--font-mono)]">{window.location.host}</strong> and
          retrying on its own. Check that:
        </p>
        <ul className={`${BODY} m-0 list-disc pl-5`}>
          <li>the laptop is awake and perch is open</li>
          <li>this phone is on the same Wi-Fi, or both are on Tailscale</li>
        </ul>
        <button type="button" className={PRIMARY} data-testid="laptop-retry" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </div>
  );
}
