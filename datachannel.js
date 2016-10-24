/* webrtc interop testing using using selenium 
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the 
 * SuperOp! 2016 event.
 */

var os = require('os');
var test = require('tape');
var buildDriver = require('./webdriver').buildDriver;
var getTestpage = require('./webdriver').getTestpage;
var WebRTCClient = require('./webrtcclient');

function interop(t, browserA, browserB, preferredAudioCodec) {
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
    return clientA.createDataChannel('somechannel');
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
  .then(function() {
    return Promise.all([driverA.quit(), driverB.quit()])
    .then(function() {
      t.end();
    });
  })
  .catch(function(err) {
    t.fail(err);
  });
}

test('Chrome-Firefox', function (t) {
  interop(t, 'chrome', 'firefox');
});

test('Firefox-Chrome', function (t) {
  interop(t, 'firefox', 'chrome');
});
