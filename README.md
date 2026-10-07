# Audio AutoSwitch

A GNOME Shell extension that automatically sets the default **audio output** and **microphone** when your session starts, after a configurable delay.

Handy when the system keeps restoring the wrong output (for example HDMI) on every boot.

**GNOME Extensions:** [pending approval](https://extensions.gnome.org/extension/11162/audio-autoswitch/). The page will be available once the review is complete.

## Features

- Pick, in a preferences panel, the output and microphone that should be the default on login.
- Independent switches for output and input.
- Delay before applying (0 to 120 s, default 5 s).
- If the device has not appeared yet, it retries every 2 s for up to 60 s.
- **Refresh** and **Apply now** buttons in the panel.

## Requirements

- GNOME Shell 46
- PipeWire with WirePlumber, which provides `wpctl` and `pw-dump` (on Ubuntu: the `wireplumber` and `pipewire-bin` packages)

## Installation

Once approved, the easiest way will be the [GNOME Extensions page](https://extensions.gnome.org/extension/11162/audio-autoswitch/) (use the Extension Manager app or the browser integration). Until then, install from source:

```bash
gnome-extensions pack --force --extra-source=audio.js --extra-source=LICENSE .
gnome-extensions install --force audio-autoswitch@kcalb7.shell-extension.zip
```

On Wayland sessions you need to log out and back in so the Shell picks up the extension. Then:

```bash
gnome-extensions enable audio-autoswitch@kcalb7
gnome-extensions prefs audio-autoswitch@kcalb7
```

## How it works

In `enable()`, the extension waits for the configured delay, lists the devices with `pw-dump` and sets the default with `wpctl set-default`. Devices are identified by the PipeWire `node.name`, which is stable across reboots. No privileged process is used and nothing is sent over the network.

## Layout

| File | Purpose |
| --- | --- |
| `extension.js` | Schedules and runs the switch on login (Shell process) |
| `prefs.js` | Preferences panel (libadwaita) |
| `audio.js` | Device listing and switching, shared by both |
| `schemas/` | GSettings schema |

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
