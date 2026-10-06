// SPDX-License-Identifier: GPL-2.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {applyDefaults, readConfig} from './audio.js';

const RETRY_INTERVAL = 2;   // seconds between attempts while the device has not shown up yet
const RETRY_WINDOW = 60;    // total seconds to keep trying after the delay

export default class AudioAutoSwitch extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._cancellable = new Gio.Cancellable();
        this._timeoutId = 0;
        this._deadline = 0;

        this._schedule(this._settings.get_uint('delay'), () => {
            this._deadline = GLib.get_monotonic_time() / 1e6 + RETRY_WINDOW;
            this._attempt();
        });
    }

    disable() {
        this._cancellable?.cancel();
        this._cancellable = null;
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._settings = null;
    }

    _schedule(seconds, callback) {
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._timeoutId = 0;
            callback();
            return GLib.SOURCE_REMOVE;
        });
    }

    _attempt() {
        const cancellable = this._cancellable;
        applyDefaults(readConfig(this._settings), cancellable).then(pending => {
            if (cancellable.is_cancelled() || pending.length === 0)
                return;
            if (GLib.get_monotonic_time() / 1e6 > this._deadline) {
                console.warn(`audio-autoswitch: devices not found: ${pending}`);
                return;
            }
            this._schedule(RETRY_INTERVAL, () => this._attempt());
        }).catch(e => {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.error(`audio-autoswitch: ${e}`);
        });
    }
}
