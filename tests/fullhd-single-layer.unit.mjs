import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomVideoOptions, videoProfile } from '../src/_front/streams/videoQuality.js';
test('Full HD: one VP8 layer, ceiling 50 Mbps, 1080p30 capture', () => {
 const o = roomVideoOptions('full_hd');
 assert.equal(o.publishDefaults.simulcast, false);
 assert.deepEqual(o.publishDefaults.videoSimulcastLayers, []);
 assert.deepEqual(o.publishDefaults.videoEncoding, { maxBitrate: 50_000_000, maxFramerate: 30 });
 assert.equal(o.publishDefaults.videoCodec, 'vp8');
 assert.deepEqual(o.videoCaptureDefaults.resolution, {width:1920,height:1080,frameRate:30});
 assert.equal(o.adaptiveStream, true); assert.equal(o.dynacast, true);
});
test('HD default and its simulcast are preserved', () => {
 const o = roomVideoOptions();
 assert.equal(videoProfile().id, 'hd');
 assert.equal(o.publishDefaults.simulcast, true);
 assert.equal(o.publishDefaults.videoSimulcastLayers.length, 2);
 assert.equal(o.publishDefaults.videoEncoding.maxBitrate, 1_700_000);
});
test('Egress and screen-share targets stay unchanged', () => {
 assert.equal(videoProfile('full_hd').egressBitrate, 4_500_000);
 assert.equal(roomVideoOptions('full_hd').publishDefaults.screenShareEncoding.maxBitrate, 4_500_000);
});
