# Command post

A laptop or Raspberry Pi with Wi-Fi that, on the scene of an emergency, creates its own Wi-Fi network, serves the Teselia app and a relay, and replicates the group's server whenever it has internet ([ADR-0018](../../docs/decisions/0018-command-post.md), protocol §8.2–8.3). The plain-language explanation for members is in the guide: <https://teselia.eu/guia/#puesto>.

> Status: built and tested in software; not yet tried in the field.

## What you need

- A computer with Debian, Ubuntu or Raspberry Pi OS and a Wi-Fi chip that can act as an access point (a Raspberry Pi 4 or 5 works; on a laptop, a USB Wi-Fi adapter may be needed).
- Internet during the installation, by cable or USB tethering if possible: at the end the Wi-Fi becomes the post's network.
- A name under a domain you control, the same for every post of your server, e.g. `puesto.teselia.eu`, and an API key of that domain's DNS provider ([lego's list](https://go-acme.github.io/lego/dns/)). For IONOS: <https://developer.hosting.ionos.es> → API keys; the key is `prefix.secret`.

## Setting up

1. At the DNS provider, add an `A` record for the post's name pointing to `10.42.0.1`.
2. On the internet server, announce the post (run the VPS installer again with one more option):

   ```sh
   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Malla/main/deploy/vps/install.sh \
     | sudo bash -s -- --domain teselia.eu --command-post https://puesto.teselia.eu
   ```

3. On the post computer:

   ```sh
   curl -fsSLO https://raw.githubusercontent.com/guaschpau-design/Malla/main/deploy/command-post/install.sh
   sudo env IONOS_API_KEY=prefix.secret bash install.sh \
     --domain puesto.teselia.eu --upstream https://teselia.eu \
     --dns ionos --dns-var IONOS_API_KEY --email you@example.eu
   ```

   It prints the Wi-Fi name and password. Options: `--wifi-name`, `--wifi-password`, `--wifi-interface`.

4. To reach the LoRa mesh, open `https://puesto.teselia.eu/app/` in Chrome on the post (or a phone next to it), join the group and connect a radio from the **LoRa** button. Keep that screen open.

## What it sets up

| Part        | What                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Wi-Fi       | NetworkManager connection `teselia-post`: access point at `10.42.0.1`, DHCP and DNS; the post's name resolves to itself |
| Firewall    | `ufw`: Wi-Fi clients reach only the post (web, DNS, DHCP); nothing is forwarded to other networks                       |
| Containers  | [`compose.yaml`](compose.yaml): the server with `TESELIA_UPSTREAM`, and Caddy serving the certificate                   |
| Certificate | lego, DNS challenge, files in `/opt/teselia-post/certs`; credentials in `dns.env`, readable by root only                |
| Refresh     | `teselia-post-refresh.timer` every 6 hours: renews the certificate and updates the images when there is internet        |

The certificate lasts 90 days from its last renewal: connect the post to the internet at least every two months.

Useful commands:

```sh
cd /opt/teselia-post
docker compose ps                       # what is running
docker compose logs --tail 100 teselia  # replication and relay
nmcli connection down teselia-post      # stop the post's Wi-Fi
nmcli connection up teselia-post        # start it again
sudo ./refresh.sh                       # renew and update now
```
