// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');
Gio._promisify(Gio.Subprocess.prototype, 'wait_check_async', 'wait_check_finish');

const CLASSES = {sink: 'Audio/Sink', source: 'Audio/Source'};
export const KINDS = Object.keys(CLASSES);

/** Reads the settings in the format used by applyDefaults. */
export function readConfig(settings) {
    return Object.fromEntries(KINDS.map(kind => [kind, {
        enabled: settings.get_boolean(`${kind}-enabled`),
        name: settings.get_string(`${kind}-name`),
    }]));
}

/** Lists PipeWire outputs and inputs: {sink: [{id, name, description}], source: [...]}. */
export async function listDevices(cancellable = null) {
    const proc = Gio.Subprocess.new(
        ['pw-dump'],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
    const [stdout] = await proc.communicate_utf8_async(null, cancellable);

    const devices = {sink: [], source: []};
    for (const obj of JSON.parse(stdout)) {
        const props = obj.info?.props ?? {};
        for (const [kind, mediaClass] of Object.entries(CLASSES)) {
            if (props['media.class'] === mediaClass) {
                devices[kind].push({
                    id: obj.id,
                    name: props['node.name'] ?? '',
                    description: props['node.description'] ?? props['node.name'] ?? '',
                });
            }
        }
    }
    return devices;
}

async function setDefault(id, cancellable) {
    const proc = Gio.Subprocess.new(['wpctl', 'set-default', String(id)], Gio.SubprocessFlags.NONE);
    await proc.wait_check_async(cancellable);
}

/**
 * Applies the configured defaults. Returns the list of kinds ('sink'/'source')
 * whose device was not found yet (for example, not connected yet).
 */
export async function applyDefaults(config, cancellable = null) {
    const devices = await listDevices(cancellable);
    const pending = [];
    for (const kind of KINDS) {
        const {enabled, name} = config[kind];
        if (!enabled || !name)
            continue;
        const device = devices[kind].find(d => d.name === name);
        if (device)
            await setDefault(device.id, cancellable);
        else
            pending.push(kind);
    }
    return pending;
}
