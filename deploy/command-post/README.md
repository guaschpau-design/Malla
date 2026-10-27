# Command post

A laptop or Raspberry Pi with Wi-Fi that, on the scene of an emergency, creates its own Wi-Fi network, serves the Tesel app and a relay, and replicates the group's server whenever it has internet ([ADR-0018](../../docs/decisions/0018-command-post.md), protocol §8.2–8.3). The plain-language explanation for members is in the guide: <https://tesel.eu/guia/#puesto>.

> Status: built and tested in software; not yet tried in the field.

## What you need

- A computer with Debian, Ubuntu or Raspberry Pi OS (64-bit) and a Wi-Fi chip that can act as an access point (a Raspberry Pi 4 or 5 works; on a laptop, a USB Wi-Fi adapter may be needed).
- Internet during the installation, by cable or USB tethering if possible: at the end the Wi-Fi becomes the post's network.
- A name under a domain you control, the same for every post of your server, e.g. `puesto.tesel.eu`. The internet server obtains its certificate and hands it to the posts ([ADR-0050](../../docs/decisions/0050-post-certificates-from-the-server.md)): posts never hold the domain's DNS credentials.

## Setting up

1. At the DNS provider, add an `A` record for the post's name pointing to `10.42.0.1`.
2. On the internet server, announce the post and let it obtain the posts' certificate with the DNS provider's API key ([deployment guide](../README.md#command-post)), then create a token for this post:

   ```sh
   sudo /opt/tesel/post-certificate.sh grant post-1
   ```

   It prints `post-1:TOKEN` once. Each post gets its own.

3. On the post computer, with that token:

   ```sh
   curl -fsSLO https://raw.githubusercontent.com/guaschpau-design/Tesel/main/deploy/command-post/install.sh
   sudo env TESEL_POST_TOKEN=post-1:TOKEN bash install.sh \
     --domain puesto.tesel.eu --upstream https://tesel.eu
   ```

   It prints the Wi-Fi name and password. Options: `--wifi-name`, `--wifi-password`, `--wifi-interface`, and `--ref` to install the files of a release tag (fetch the script from the same tag). Running it again keeps the token, so `TESEL_POST_TOKEN` is needed only the first time.

4. To reach the LoRa mesh, open `https://puesto.tesel.eu/app/` in Chrome on the post (or a phone next to it), join the group and connect a radio from the **LoRa** button. Keep that screen open.

A post installed before ADR-0050 held the domain's DNS API key. Running the new installer with a token deletes it from the post; replace that key at the DNS provider, since a copy of it may remain on old disks or backups.

## What it sets up

| Part        | What                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Wi-Fi       | NetworkManager connection `tesel-post`: access point at `10.42.0.1`, DHCP and DNS; the post's name resolves to itself                    |
| Firewall    | `ufw`: Wi-Fi clients reach only the post (web, DNS, DHCP); nothing is forwarded to other networks                                        |
| Containers  | [`compose.yaml`](compose.yaml): the server with `TESEL_UPSTREAM`, and Caddy serving the certificate with the VPS's security headers      |
| Certificate | Downloaded from the internet server with the post's token (`/opt/tesel-post/token`, readable by root only), into `/opt/tesel-post/certs` |
| Refresh     | `tesel-post-refresh.timer` every 6 hours, when there is internet: [`refresh.sh`](refresh.sh) gets the certificate, the image and the map |

Images are updated as on the VPS: only images signed by Tesel's CI are run, and one that does not become healthy is replaced by the previous one ([`../common/update.sh`](../common/update.sh)).

The certificate a post downloads lasts at least two months: connect the post to the internet at least every two months.

Useful commands:

```sh
cd /opt/tesel-post
docker compose ps                       # what is running
docker compose logs --tail 100 tesel    # replication and relay
nmcli connection down tesel-post        # stop the post's Wi-Fi
nmcli connection up tesel-post          # start it again
sudo ./refresh.sh                       # refresh now
sudo ./update.sh /opt/tesel-post rollback  # go back to the previous server version
```

If a post is lost, revoke its token on the internet server (`sudo /opt/tesel/post-certificate.sh revoke post-1`).
