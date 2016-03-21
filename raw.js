/* Interop testing using apprtc.appspot.com using selenium 
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the 
 * SuperOp! 2016 event.
 */

var test = require('tape');
var buildDriver = require('./webdriver');
var WebRTCClient = require('./webrtcclient');

function interop(t, browserA, browserB) {
  var driverA = buildDriver(browserA);
  var driverB = buildDriver(browserB);

  var clientA = new WebRTCClient(driverA);
  var clientB = new WebRTCClient(driverB);

  // static page with adapter shim
  driverA.get('https://fippo.github.io/adapter/testpage.html')
  .then(function() {
    return driverB.get('https://fippo.github.io/adapter/testpage.html')
  })
  .then(function() {
    clientA.create();
    return clientA.getUserMedia({audio: true});
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
    return clientA.setLocalDescription(offer); // modify offer here?
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
    return clientA.getStats();
  })
  .then(function(stats) {
    console.log(stats);
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

test('Chrome-Edge', function (t) {
  interop(t, 'chrome', 'MicrosoftEdge');
});

test('Edge-Chrome', function (t) {
  interop(t, 'MicrosoftEdge', 'chrome');
});

test('Firefox-Edge', function (t) {
  interop(t, 'firefox', 'MicrosoftEdge');
});

test('Edge-Firefox', function (t) {
  interop(t, 'MicrosoftEdge', 'firefox');
});

test('Chrome-Firefox', function (t) {
  interop(t, 'chrome', 'firefox');
});

test('Firefox-Chrome', function (t) {
  interop(t, 'firefox', 'chrome');
});
