# FlowPay v0.5.1 — Auth fix

- Auth page is forced into the approved light FlowPay visual system, even when the workspace theme is dark.
- `Create account` now switches the form into registration mode instead of immediately firing a Supabase signup request.
- Registration requires password confirmation.
- Supabase auth errors are converted into user-friendly localized messages (RU/EN/FR/DE/ES).
- `email rate limit exceeded` is no longer exposed as a raw backend error.
- A successful signup with email confirmation enabled shows a clear confirmation message.
- A successful signup without email confirmation redirects directly to `/dashboard`.
- Mobile auth layout has been refined.
