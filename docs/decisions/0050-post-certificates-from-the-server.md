# 0050. Command posts get their certificate from the server

- Status: Accepted
- Date: 2026-10-27
- Amends: [ADR-0018](0018-command-post.md), where each post obtained the certificate itself with the domain's DNS credentials

## Context

Under ADR-0018 every command post obtained the certificate for the posts' shared name by DNS challenge, so every post kept an API key of the domain's DNS provider. A post is a laptop or a Raspberry Pi taken to the scene of an emergency, and can be lost or stolen. That key controls every record of the domain, the main server's name included: whoever holds it can point `tesel.eu` elsewhere, obtain certificates for it and serve a modified app to every member. That is far more than the risk ADR-0018 accepted, the post's own certificate.

## Decision

- The internet server obtains the certificate for the posts' shared name with lego by DNS challenge, from a daily timer that renews it with 60 days left. The DNS credentials live only on the server, readable by root (`dns.env`); its installer takes them, as posts' installers used to.
- Caddy on the server hands the certificate and its key to posts at `/post-certificate/`, behind HTTP basic authentication. Each post has a token of its own, 192 random bits, created with `post-certificate.sh grant NAME` and shown once. Caddy's configuration holds only bcrypt hashes of the tokens. `post-certificate.sh revoke NAME` removes one. While no post has a token the path does not exist.
- A post's installer takes the server's URL and the post's token, kept readable by root only. Whenever the post has internet it downloads certificate and key, checks that they are current, for its name and a matching pair, and gives them to Caddy when they changed. The installer deletes the DNS credentials and lego files of earlier installations.

## Consequences

- A lost post exposes its token and the posts' certificate, not the domain. Revoking the token stops it from downloading later certificates. The certificate it already holds stays usable until it expires, as ADR-0018 accepted; revoking it with the certificate authority helps only with browsers that check revocation.
- A post downloads a certificate with at least 60 days left, so it can stay offline two months. If the certificate authority shortens certificate lifetimes, the renewal threshold must come down, and so does that period.
- A post needs the server to be installed and to renew, as it already did to replicate.
- Each wrong token costs the server a bcrypt comparison; tokens are long random strings, so guessing one is hopeless.
- The DNS keys that existing posts held must be replaced at the DNS provider.
