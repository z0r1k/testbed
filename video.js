/* Interop testing using apprtc.appspot.com using selenium 
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the 
 * SuperOp! 2016 event.
 */

var test = require('tape');
var buildDriver = require('./webdriver');
var WebRTCClient = require('./webrtcclient');
var SDPUtils = require('webrtc-adapter/src/js/edge/edge_sdp');

function video(t, browserA, browserB, preferredVideoCodec) {
  var driverA = buildDriver(browserA);
  var driverB = buildDriver(browserB);

  var clientA = new WebRTCClient(driverA);
  var clientB = new WebRTCClient(driverB);

  driverA.get('https://fippo.github.io/adapter/testpage.html')
  .then(function() {
    return driverB.get('https://fippo.github.io/adapter/testpage.html')
  })
  .then(function() {
    clientA.create();
    return clientA.getUserMedia({audio: true, video: true});
  })
  .then(function() {
    t.pass('got user media');
    return clientA.addStream();
  })
  .then(function() {
    return clientA.createOffer();
  })
  .then(function(offer) {
    t.pass('created offer');

    var sections = SDPUtils.splitSections(offer.sdp);
    var codecs = SDPUtils.parseRtpParameters(sections[2]).codecs;
    var pt;
    for (var i = 0; i < codecs.length; i++) {
      if (codecs[i].name === preferredVideoCodec) {
        pt = codecs[i].payloadType;
        var lines = sections[2].split('\r\n');
        mLine = lines.shift().split(' ');
        mLine.splice(mLine.indexOf(pt.toString()), 1); // remove PT from current pos.
        mLine.splice(3, 0, pt); // insert at first pos.
        mLine = mLine.join(' ');
        lines.unshift(mLine);
        sections[2] = lines.join('\r\n');
        offer.sdp = sections.join('');
        break;
      }
    }
    t.ok(pt !== undefined, 'preferred video codec ' + preferredVideoCodec + ' with PT ' + pt);

    return clientA.setLocalDescription(offer);
  })
  .then(function(offerWithCandidates) {
    t.pass('offer ready to signal');

    clientB.create();
    return clientB.setRemoteDescription(offerWithCandidates);
  })
  .then(function() {
    return clientB.createAnswer();
  })
  .then(function(answer) {
    t.pass('created answer');
    return clientB.setLocalDescription(answer); // modify answer here?
  })
  .then(function(answerWithCandidates) {
    t.pass('answer ready to signal');
    return clientA.setRemoteDescription(answerWithCandidates);
  })
  .then(function() {
    // wait for the iceConnectionState to become either connected/completed
    // or failed.
    return clientA.waitForIceConnectionStateChange();
  })
  .then(function(iceConnectionState) {
    t.ok(iceConnectionState !== 'failed', 'ICE connection is established');
  })
  /*
   * here is where the fun starts. getStats etc
   */
  .then(function() {
    driverA.sleep(3000);
    return clientB.getFrameStats();
  })
  .then(function(frameStats) {
    t.ok(frameStats.numFrames > 0, 'video frames received');
  })
  .then(function() {
    driverA.quit();
    driverB.quit()
    .then(function() {
      t.end();
    });
  })
  .catch(function(err) {
    t.fail(err);
  });
}

test('Chrome-Chrome, VP8', function(t) {
  video(t, 'chrome', 'chrome', 'VP8');
});

test('Chrome-Firefox, VP8', function(t) {
  video(t, 'chrome', 'firefox', 'VP8');
});

test('Firefox-Firefox, VP8', function(t) {
  video(t, 'firefox', 'firefox', 'VP8');
});

test('Firefox-Chrome, VP8', function(t) {
  video(t, 'firefox', 'chrome', 'VP8');
});

test('Chrome-Chrome, VP9', function(t) {
  video(t, 'chrome', 'chrome', 'VP9');
});

test('Firefox-Firefox, VP9', function(t) {
  video(t, 'firefox', 'firefox', 'VP9');
});

/*
test('Chrome-Chrome, H264', function(t) {
  video(t, 'chrome', 'chrome', 'H264');
});
*/

/* when using selenium with fresh profiles that does not contain
 * openh264 and h264 is missing...
test('Firefox-Firefox, H264', function(t) {
  video(t, 'firefox', 'firefox', 'H264');
});
*/
