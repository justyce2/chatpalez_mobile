# Mobile Security Notes

- The `ChatPalezMobile/1.0` user-agent token is presentation metadata only and must never grant authentication or authorization.
- Internal web content must use HTTPS and a configured trusted ChatPalez host.
- `javascript:` and `data:` URLs are never treated as trusted navigation.
- External HTTP(S) destinations open outside the internal ChatPalez container.
- Secrets are not permitted in `VITE_*` variables or committed native configuration.
- Authentication, CSRF and authorization remain server-controlled by ChatPalez.
- Native logs must not contain passwords, cookies, access tokens, APNs keys, Firebase credentials or session identifiers.
