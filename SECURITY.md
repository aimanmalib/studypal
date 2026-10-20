# Security Policy

## Supported versions

Only the latest `main` branch is supported. Fixes are not backported.

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub Security Advisories:
open the repository's **Security** tab and choose **Report a vulnerability**
(https://github.com/aimanmalib/studypal/security/advisories/new).

Do not open a public issue for security problems. Include the affected route
or file, steps to reproduce, and the impact you expect.

## Scope notes

StudyPal forwards a visitor's own LLM API key to the provider they choose (see
"Bring your own key" in the README). Issues of particular interest:

- any way to make the server log, store or return a visitor's key;
- any way to make the server call a URL outside the provider allowlist when
  `LLM_ALLOW_CUSTOM_BASE_URL` is not set (SSRF);
- any way to use a self-hosted instance's server key beyond the documented limits.

Mistakes in a provider's own API or a leaked key on the reporter's side are out
of scope.
