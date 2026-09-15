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
    <div className="pairing" data-testid="pairing-gate">
      <form className="pairing__card" onSubmit={submit}>
        <h1 className="pairing__title">Pair this device</h1>
        <p className="pairing__hint">
          On the machine running perch, open Settings → Devices and choose “Pair a device”. Enter the
          code it shows. It is valid for five minutes.
        </p>
        <label className="pairing__field">
          <span>Pairing code</span>
          <input
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
        <label className="pairing__field">
          <span>Name this device</span>
          <input
            data-testid="pairing-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
          />
        </label>
        {error && <p className="pairing__error" role="alert" data-testid="pairing-error">{error}</p>}
        <button type="submit" className="pairing__submit" data-testid="pairing-submit" disabled={pending || !code.trim()}>
          {pending ? "Pairing…" : "Pair device"}
        </button>
      </form>
    </div>
  );
}
