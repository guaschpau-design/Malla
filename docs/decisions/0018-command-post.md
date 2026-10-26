# 0018. A command post is a replicating server on its own Wi-Fi, found by name

- Status: Accepted
- Date: 2026-10-25
- Settles: the open question of [ADR-0008](0008-one-server-vps-and-command-post.md) about HTTPS on a local network

## Context

When the mobile network fails, members without a radio, iPhones among them, are cut off. A command post on the scene (a laptop or a Raspberry Pi) can give them a Wi-Fi network to meet on, and pass everything to the rest of the group once it reaches the internet. Four problems had to be solved:

1. **HTTPS.** Browsers only run the app (service worker, Web Crypto) and open WebSockets from it over HTTPS with a certificate they trust. A post has no public address for a certificate authority to check.
2. **Finding the post.** Phones already hold their groups on the main server's origin and know nothing about posts.
3. **Getting events in and out.** What the post receives must reach the internet server later, and the reverse, without the post knowing any group secret.
4. **Safety of the owner's network.** A post plugged into a home network must not open that network to whoever joins its Wi-Fi.

## Decision

- **One name for all posts of a server**, e.g. `puesto.tesel.eu`. Each post answers it on its own Wi-Fi: NetworkManager's shared mode hands out addresses and its DNS resolves the name to the post (`10.42.0.1`). A public `A` record to the same private address helps phones that use their own DNS.
- **Certificate by DNS challenge.** The post obtains a Let's Encrypt certificate for the name with lego while it has internet, proving control of the domain through the DNS provider's API, and renews it whenever it is online. Caddy serves it. Every post of a server holds the same certificate; whoever runs a post needs DNS credentials for that domain, so posts are run by the server's operators.
- **Replication** (protocol §8.2): the post is an ordinary server with `TESEL_UPSTREAM`. For each group it stores it keeps a client connection to the upstream, takes in what the upstream has and pushes what its own clients pushed. It moves envelopes only and never holds a group secret.
- **Discovery** (protocol §8.3): the internet server announces the post's name in `healthz`; apps remember it and try it when the server does not answer. An app opened from the post itself prefers the post for the groups of the post's upstream.
- **Radio**: the post's own browser, with Tesel open and a radio connected by Bluetooth, bridges the post and the LoRa mesh exactly as any member's phone does. A radio bridge inside the server is left for later.
- **Isolation**: the post's firewall lets Wi-Fi clients reach the post's web server, DNS and DHCP only, and forwards nothing. Phones on the post's Wi-Fi do not get internet through it, and cannot see the network the post is plugged into.
- The kit (`deploy/command-post/install.sh`) supports Debian, Ubuntu and Raspberry Pi OS with a Wi-Fi chip that can be an access point.

## Consequences

- Members do nothing special: on the post's Wi-Fi their app syncs through the post and shows "Command post". Members who never had the app open the post's address and join with the group's QR code.
- The certificate expires 90 days after its last renewal: a post must have internet at least every two months, which the guide states.
- Anyone holding a post's certificate key can impersonate the post on a network they control. They would see only envelopes, as the server does, but could serve a modified app on the post's origin; groups joined there would be exposed. Posts are therefore run by trusted operators, and members are told to install the app from the main server beforehand.
- Android routes traffic to mobile data when a Wi-Fi network has no internet. While the mobile network still works the post is not needed; when it is down, phones use the post's Wi-Fi.
- Not yet tried in the field: browsers that ask for permission before a public site talks to a local address (Chrome's local network access) may show a prompt the first time. The field test checklist covers it.
