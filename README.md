# Rdio Scanner Card

A HACS dashboard card for embedding a local Rdio Scanner feed in Home Assistant.

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
title: Rdio Scanner
url: http://192.168.1.49:3000
status_entity: sensor.rdio_scanner_status
systems_entity: sensor.rdio_scanner_systems
talkgroups_entity: sensor.rdio_scanner_talkgroups
height: 640
```

## Options

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `type` | yes | `custom:rdio-scanner-card` | Card type |
| `title` | no | `Rdio Scanner` | Header title |
| `url` | no | `http://192.168.1.49:3000` | Rdio Scanner URL |
| `url_entity` | no | none | Entity containing the Rdio Scanner URL |
| `status_entity` | no | `sensor.rdio_scanner_status` | Integration status sensor |
| `systems_entity` | no | `sensor.rdio_scanner_systems` | Systems count sensor |
| `talkgroups_entity` | no | `sensor.rdio_scanner_talkgroups` | Talkgroups count sensor |
| `height` | no | `640` | Iframe height in pixels |
| `show_header` | no | `true` | Show or hide the card header |

## Notes

If Home Assistant is served over HTTPS and Rdio Scanner is served over HTTP,
some browsers may block the embedded frame as mixed content. Use HTTP for both
on the LAN, or put Rdio Scanner behind HTTPS.

## License

MIT
