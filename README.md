# Rdio Scanner Card

A HACS dashboard card for running a local Rdio Scanner live feed in Home
Assistant.

This card pairs with the Rdio Scanner integration:

```text
rodgrech/HA-RDIO-SCANNER
```

## Installation

### HACS custom repository

1. Open HACS in Home Assistant.
2. Add this repository as a custom repository.
3. Select `Dashboard` as the repository category.
4. Install **Rdio Scanner Card**.
5. Refresh the browser.

HACS should add this Lovelace resource:

```text
/hacsfiles/HA-RDIO-SCANNER-CARD/rdio-scanner-card.js
```

Resource type:

```text
JavaScript module
```

## Example

```yaml
type: custom:rdio-scanner-card
mode: native
title: Rdio Scanner
url: http://192.168.1.49:3000
# access_code: "your-unlock-code"
status_entity: sensor.rdio_scanner_status
systems_entity: sensor.rdio_scanner_systems
talkgroups_entity: sensor.rdio_scanner_talkgroups
auto_start: true
show_recordings: true
recordings_limit: 20
show_header: true
```

If your Rdio Scanner server does not require an unlock code, omit
`access_code`. If it does require one and you omit it, the card shows an unlock
field and remembers the code in browser localStorage after you enter it.

## Options

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `type` | yes | `custom:rdio-scanner-card` | Card type |
| `mode` | no | `native` | `native` for direct live feed, or `iframe` for the original embedded UI |
| `title` | no | `Rdio Scanner` | Header title |
| `url` | no | `http://192.168.1.49:3000` | Rdio Scanner URL |
| `access_code` | no | none | Rdio Scanner unlock code for restricted access |
| `url_entity` | no | none | Entity containing the Rdio Scanner URL |
| `status_entity` | no | `sensor.rdio_scanner_status` | Integration status sensor |
| `systems_entity` | no | `sensor.rdio_scanner_systems` | Systems count sensor |
| `talkgroups_entity` | no | `sensor.rdio_scanner_talkgroups` | Talkgroups count sensor |
| `height` | no | `640` | Iframe height in pixels when `mode: iframe` |
| `show_header` | no | `true` | Show or hide the card header |
| `live_header` | no | `false` | Keep updating header values after the iframe loads |
| `auto_start` | no | `true` | Connect and subscribe to all talkgroups when the card loads in native mode |
| `show_recordings` | no | `true` | Show recent recorded-call controls in native mode |
| `recordings_limit` | no | `20` | Number of recent recorded calls to request |
| `auto_load_recordings` | no | `false` | Load recent recordings automatically after connection |

## Notes

- Native mode uses Rdio Scanner's browser WebSocket protocol directly.
- Browser autoplay rules may require pressing **Start Live** once before audio
  can play. The button primes WebAudio with a silent buffer before subscribing
  to live traffic.
- Press **Load recent** in the recordings section to fetch recent recorded calls.
  Each row can be played through the card or downloaded as its original audio
  file.
- If you enter the unlock code in the card, it is saved in browser localStorage
  for that scanner URL. Use **Clear saved** to remove it.
- If Home Assistant is served over HTTPS and Rdio Scanner is served over HTTP,
  some browsers may block the connection as mixed content. Use HTTP for both on
  the LAN, or put Rdio Scanner behind HTTPS.

## License

MIT
