// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {KINDS, applyDefaults, listDevices, readConfig} from './audio.js';

const NONE_LABEL = '— None —';

/** Group with the "set on login" switch and the device list of one kind. */
function buildDeviceGroup(settings, kind, title, description) {
    const group = new Adw.PreferencesGroup({title, description});
    const toggle = new Adw.SwitchRow({title: 'Set as default on login'});
    const combo = new Adw.ComboRow({title: 'Device', model: new Gtk.StringList()});
    group.add(toggle);
    group.add(combo);

    settings.bind(`${kind}-enabled`, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind(`${kind}-enabled`, combo, 'sensitive', Gio.SettingsBindFlags.GET);

    let entries = [];
    let populating = false;

    combo.connect('notify::selected', () => {
        if (populating)
            return;
        const entry = entries[combo.selected];
        if (!entry)
            return;
        settings.set_string(`${kind}-name`, entry.name);
        settings.set_string(`${kind}-description`, entry.description);
    });

    const refresh = devices => {
        const savedName = settings.get_string(`${kind}-name`);
        entries = [
            {name: '', description: '', label: NONE_LABEL},
            ...devices.map(d => ({name: d.name, description: d.description, label: d.description})),
        ];
        if (savedName && !entries.some(e => e.name === savedName)) {
            const savedDescription = settings.get_string(`${kind}-description`) || savedName;
            entries.push({
                name: savedName,
                description: savedDescription,
                label: `${savedDescription} (disconnected)`,
            });
        }

        populating = true;
        combo.model.splice(0, combo.model.get_n_items(), entries.map(e => e.label));
        combo.selected = Math.max(0, entries.findIndex(e => e.name === savedName));
        populating = false;
    };

    return {group, refresh};
}

export default class AudioAutoSwitchPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;  // keep a reference while the window exists

        const cancellable = new Gio.Cancellable();
        window.connect('close-request', () => {
            cancellable.cancel();
            return false;
        });

        const page = new Adw.PreferencesPage({title: 'Audio', icon_name: 'audio-card-symbolic'});
        window.add(page);

        const pickers = {
            sink: buildDeviceGroup(settings, 'sink', 'Audio output',
                'Speakers or headphones set as default when the session starts.'),
            source: buildDeviceGroup(settings, 'source', 'Audio input',
                'Microphone set as default when the session starts.'),
        };
        page.add(pickers.sink.group);
        page.add(pickers.source.group);

        // Delay
        const timing = new Adw.PreferencesGroup({title: 'Delay'});
        const delay = new Adw.SpinRow({
            title: 'Wait before applying',
            subtitle: 'Seconds after login. Increase it if the system restores the previous output after the switch.',
            adjustment: new Gtk.Adjustment({lower: 0, upper: 120, step_increment: 1, page_increment: 10}),
        });
        settings.bind('delay', delay, 'value', Gio.SettingsBindFlags.DEFAULT);
        timing.add(delay);
        page.add(timing);

        // Actions
        const actions = new Adw.PreferencesGroup({title: 'Actions'});
        const refreshButton = new Gtk.Button({label: 'Refresh', valign: Gtk.Align.CENTER});
        const refreshRow = new Adw.ActionRow({
            title: 'Refresh device list',
            subtitle: 'Useful after plugging in headphones, a webcam or an HDMI monitor.',
            activatable_widget: refreshButton,
        });
        refreshRow.add_suffix(refreshButton);

        const applyButton = new Gtk.Button({
            label: 'Apply',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        const applyRow = new Adw.ActionRow({
            title: 'Apply now',
            subtitle: 'Switches to the chosen devices without waiting for the next login.',
            activatable_widget: applyButton,
        });
        applyRow.add_suffix(applyButton);

        actions.add(refreshRow);
        actions.add(applyRow);
        page.add(actions);

        const toast = text => window.add_toast(new Adw.Toast({title: text, timeout: 3}));

        const refresh = async () => {
            try {
                const devices = await listDevices(cancellable);
                for (const kind of KINDS)
                    pickers[kind].refresh(devices[kind]);
            } catch (e) {
                if (!cancellable.is_cancelled())
                    toast(`Could not list devices: ${e.message}`);
            }
        };

        refreshButton.connect('clicked', () => refresh());
        applyButton.connect('clicked', async () => {
            try {
                const pending = await applyDefaults(readConfig(settings), cancellable);
                toast(pending.length ? 'The chosen device is not connected.' : 'Applied.');
            } catch (e) {
                if (!cancellable.is_cancelled())
                    toast(`Failed to apply: ${e.message}`);
            }
        });

        refresh();
    }
}
