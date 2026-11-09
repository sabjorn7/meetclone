// Disabled until integration with the real PeerTube 7.0.1 jschannel protocol
// is verified. Never send custom __ready messages to a production iframe.
// Keep this entry point fail-closed so an accidental old caller cannot break playback.
export function connectPeerTubeQuality() {
    throw new Error('External PeerTube quality control is disabled; use native player controls');
}
