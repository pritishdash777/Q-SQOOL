"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError, createGoogleChallenge, getGoogleSignInConfig, loginWithGoogle, type GoogleAuthResponse, type GoogleCredential } from "@/lib/auth-api";

type GoogleIdentityAPI = {
  initialize: (options: {
    client_id: string; nonce: string; auto_select: boolean; ux_mode: "popup";
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (container: HTMLElement, options: {
    type: "standard"; theme: "outline"; size: "large"; text: "continue_with";
    shape: "rectangular"; width: number;
  }) => void;
};

function identityAPI(): GoogleIdentityAPI | undefined {
  return (window as Window & { google?: { accounts?: { id?: GoogleIdentityAPI } } }).google?.accounts?.id;
}

export function GoogleSignIn({ disabled, onSuccess, onBusyChange }: {
  disabled: boolean;
  onSuccess: (response: GoogleAuthResponse) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const button = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const callbacks = useRef({ onSuccess, disabled });
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonReady, setButtonReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<GoogleCredential | null>(null);
  const [password, setPassword] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { callbacks.current = { onSuccess, disabled }; }, [onSuccess, disabled]);
  useEffect(() => { onBusyChange(busy || pending !== null); }, [busy, pending, onBusyChange]);
  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  useEffect(() => {
    if (!enabled || scriptReady) return;
    const timeout = setTimeout(() => setError("Google sign-in could not load. Check your connection or use email."), 12000);
    return () => clearTimeout(timeout);
  }, [enabled, scriptReady, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    getGoogleSignInConfig(controller.signal).then(config => setEnabled(config.enabled)).catch(() => {
      if (!controller.signal.aborted) setError("Google sign-in is unavailable. Use email or retry.");
    });
    return () => controller.abort();
  }, [attempt]);

  async function authenticate(credential: GoogleCredential) {
    if (activeRequest.current || callbacks.current.disabled) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true); setError("");
    try {
      const data = await loginWithGoogle(credential, controller.signal);
      setPending(null); setPassword("");
      callbacks.current.onSuccess(data);
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 409) {
        setPending({ credential: credential.credential, nonce: credential.nonce });
      } else {
        setError(failure instanceof Error ? failure.message : "Google sign-in failed. Please retry.");
        if (failure instanceof ApiError && failure.status === 401) {
          setPending(null); setPassword(""); setButtonReady(false);
        }
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }
  const authenticateRef = useRef(authenticate);
  useEffect(() => { authenticateRef.current = authenticate; });

  useEffect(() => {
    if (!enabled || !scriptReady) return;
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const container = button.current;
    createGoogleChallenge(controller.signal).then(challenge => {
      if (controller.signal.aborted || !container) return;
      const api = identityAPI();
      if (!api) throw new Error("Google sign-in could not load. Please refresh the page.");
      api.initialize({
        client_id: challenge.client_id, nonce: challenge.nonce, auto_select: false, ux_mode: "popup",
        callback: response => {
          if (!controller.signal.aborted && response.credential) {
            void authenticateRef.current({ credential: response.credential, nonce: challenge.nonce });
          }
        },
      });
      container.replaceChildren();
      api.renderButton(container, {
        type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular",
        width: Math.floor(Math.min(400, container.getBoundingClientRect().width || 280)),
      });
      setError("");
      setButtonReady(true);
      expiry = setTimeout(() => {
        setButtonReady(false); setPending(null); setPassword("");
        setError("Google sign-in expired. Please retry.");
      }, challenge.expires_in * 1000);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Google sign-in could not load.");
    });
    return () => { controller.abort(); clearTimeout(expiry); container?.replaceChildren(); };
  }, [enabled, scriptReady, attempt]);

  const retry = () => {
    if (enabled && !scriptReady) { window.location.reload(); return; }
    setError(""); setPending(null); setPassword(""); setButtonReady(false);
    setAttempt(value => value + 1);
  };

  return <div className="mb-6">
    {enabled && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
      onReady={() => setScriptReady(true)}
      onError={() => setError("Google sign-in could not load. Check your connection or use email.")} />}
    <div ref={button} inert={disabled || busy || Boolean(pending) || !buttonReady}
      className={`min-w-0 ${pending ? "hidden" : !buttonReady ? "h-0 overflow-hidden" : ""} ${disabled || busy ? "pointer-events-none opacity-50" : ""}`} />
    {!buttonReady && !pending && !error && <div className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground" role="status">
      {enabled !== false && <Loader2 className="size-4 animate-spin" />}
      {enabled === false ? "Google sign-in is not available yet" : "Loading Google sign-in…"}
    </div>}
    {busy && <p role="status" className="mt-3 text-center text-sm text-muted-foreground">Signing in with Google…</p>}
    {pending && <form onSubmit={event => { event.preventDefault(); void authenticate({ ...pending, password }); }} className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm">You already have a Q-SQOOL account. Confirm your Q-SQOOL password once to link Google and keep your projects and progress.</p>
      <label htmlFor="google-link-password" className="block text-sm font-medium">Q-SQOOL password</label>
      <input id="google-link-password" type="password" autoComplete="current-password" required value={password}
        disabled={busy} onChange={event => setPassword(event.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
      <button type="submit" disabled={busy || disabled} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Link Google and sign in</button>
      <button type="button" disabled={busy} onClick={retry} className="w-full text-sm text-muted-foreground">Cancel</button>
    </form>}
    {error && <div className="mt-3 space-y-2 text-sm">
      <p role="alert" className="text-destructive">{error}</p>
      {!pending && <button type="button" disabled={busy || disabled} onClick={retry} className="font-medium text-primary">Retry Google sign-in</button>}
    </div>}
    <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" /></div>
  </div>;
}
