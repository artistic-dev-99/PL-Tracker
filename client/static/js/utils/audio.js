// Web Audio API Synthesizer Helper
export function playUnifiedAudioTone(toneName) {
    if (!toneName || toneName === "mute") return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (toneName === "chime") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(1318.51, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        } else if (toneName === "retro") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(659.25, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        } else if (toneName === "pulse") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(349.23, ctx.currentTime);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        } else { // "classic"
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        }

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
        console.warn("Audio playback not supported:", e);
    }
}

if (typeof window !== "undefined") {
    window.playUnifiedAudioTone = playUnifiedAudioTone;
}
