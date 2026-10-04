class AudioManager {
    constructor() {
        this.bgmVolume = 0.5;
        this.sfxVolume = 0.7;
        this.bgmMuted = false;
        this.sfxMuted = false;

        // BGM Audio
        this.bgm = new Audio("assets/audio/bgm_mario.mp3");
        this.bgm.loop = true;
        this.bgm.volume = this.bgmVolume;

        // SFX Audio Elements
        this.sfx = {
            wing: new Audio("assets/audio/sfx_wing.wav"),
            hit: new Audio("assets/audio/sfx_hit.wav"),
            die: new Audio("assets/audio/sfx_die.wav"),
            point: new Audio("assets/audio/sfx_point.wav")
        };

        this.updateVolumes();
    }

    playBGM() {
        if (!this.bgmMuted) {
            this.bgm.play().catch(e => {
                console.log("[Audio] BGM autoplay blocked until user interaction:", e);
            });
        }
    }

    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    }

    playSFX(key) {
        if (this.sfxMuted || !this.sfx[key]) return;
        const sound = this.sfx[key].cloneNode();
        sound.volume = this.sfxVolume;
        sound.play().catch(() => {});
    }

    setBGMVolume(val) {
        this.bgmVolume = Math.max(0, Math.min(1, val));
        this.updateVolumes();
    }

    setSFXVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        this.updateVolumes();
    }

    toggleBGMMute() {
        this.bgmMuted = !this.bgmMuted;
        if (this.bgmMuted) {
            this.bgm.pause();
        } else {
            this.playBGM();
        }
        return this.bgmMuted;
    }

    toggleSFXMute() {
        this.sfxMuted = !this.sfxMuted;
        return this.sfxMuted;
    }

    updateVolumes() {
        this.bgm.volume = this.bgmMuted ? 0 : this.bgmVolume;
        for (let key in this.sfx) {
            this.sfx[key].volume = this.sfxMuted ? 0 : this.sfxVolume;
        }
    }
}

const audioManager = new AudioManager();
