/* webrtc interop testing using using selenium
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the
 * SuperOp! 2016 event.
 */

var test = require('tape');
var buildDriver = require('./webdriver').buildDriver;
var getTestpage = require('./webdriver').getTestpage;
var WebRTCClient = require('./webrtcclient');
var SDPUtils = require('sdp');

// add MSIDs the other party understands.
function mangle(sdp) {
  var mediaSections = SDPUtils.splitSections(sdp);
  for (var i = 1; i < mediaSections.length; i++) {
    var parts;
    var ssrclines = SDPUtils.matchPrefix(mediaSections[i], 'a=ssrc');
    var chromeMsid = ssrclines.filter(function(line) {
      return line.split(' ')[1].indexOf('msid:') === 0;
    });
    var cnames = ssrclines.filter(function(line) {
      return line.split(' ')[1].indexOf('cname:') === 0;
    });
    var specMsid = SDPUtils.matchPrefix(mediaSections[i], 'a=msid:');
    if (!specMsid.length && chromeMsid.length > 0) {
      parts = chromeMsid[0].split(' ');
      parts.shift();
      mediaSections[i] += 'a=' + parts.join(' ') + '\r\n';
    } else if (specMsid.length > 0 && cnames.length && !chromeMsid.length) {
      mediaSections[i] += cnames[0].split(' ', 1)[0] + ' ' +
          specMsid[0].substr(2) + '\r\n';
    }
  }
  return mediaSections.join('');
}

// we use addStream twice and pretend to be a single stream to
// work around FF bugs.
function replaceSecondStreamId(sdp) {
  var mediaSections = SDPUtils.splitSections(sdp);

  var firstMsid = SDPUtils.matchPrefix(mediaSections[1], 'a=msid:')[0]
      .split(' ')[0].substr(7);
  var secondMsid = SDPUtils.matchPrefix(mediaSections[2], 'a=msid:')[0]
      .split(' ')[0].substr(7);

  return sdp.replace(new RegExp(secondMsid, 'g'), firstMsid);
}

function upgrade(t, browserA, browserB) {
  var driverA = buildDriver(browserA);
  var driverB = buildDriver(browserB);

  var clientA = new WebRTCClient(driverA);
  var clientB = new WebRTCClient(driverB);

  getTestpage(driverA)
  .then(function() {
    return getTestpage(driverB);
  })
  .then(function() {
    return clientA.create();
  })
  .then(function() {
    return clientB.create();
  })
  .then(function() {
    return clientA.getUserMedia({audio: true, video: false});
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
    return clientA.setLocalDescription(offer);
  })
  .then(function(offerWithCandidates) {
    t.pass('offer ready to signal');

    // mangle interoperable msids.
    offerWithCandidates.sdp = mangle(offerWithCandidates.sdp);

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

    // mangle interoperable msids.
    answerWithCandidates.sdp = mangle(answerWithCandidates.sdp);

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
  .then(function() {
    driverA.sleep(3000);
    return clientA.getUserMedia({audio: false, video: true});
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
    return clientA.setLocalDescription(offer);
  })
  .then(function(offerWithCandidates) {
    t.pass('offer ready to signal');

    // mangle interoperable msids.
    offerWithCandidates.sdp = mangle(offerWithCandidates.sdp);

    // we mangle it so it looks like adding to the stream at B.
    offerWithCandidates.sdp = replaceSecondStreamId(offerWithCandidates.sdp);

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

    // mangle interoperable msids.
    answerWithCandidates.sdp = mangle(answerWithCandidates.sdp);

    return clientA.setRemoteDescription(answerWithCandidates);
  })
  .then(function() {
    driverA.sleep(3000);
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

test('Chrome-Chrome', function(t) {
  upgrade(t, 'chrome', 'chrome');
});

test('Firefox-Firefox', function(t) {
  upgrade(t, 'firefox', 'firefox');
});

test('Chrome-Firefox', function(t) {
  upgrade(t, 'chrome', 'firefox');
});

test('Firefox-Chrome', function(t) {
  upgrade(t, 'firefox', 'chrome');
});
