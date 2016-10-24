/* webrtc interop testing using using selenium 
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the 
 * SuperOp! 2016 event.
 */

var os = require('os');
var test = require('tape');
var buildDriver = require('./webdriver').buildDriver;
var startSelenium = require('./webdriver').startServer;
var WebRTCClient = require('./webrtcclient');

function dtls(t, browserA, browserB, preferredAudioCodec) {
  var driverA = buildDriver(browserA, {server: true});
  var driverB = buildDriver(browserB, {server: true});

  var clientA = new WebRTCClient(driverA);
  var clientB = new WebRTCClient(driverB);

  // static page with adapter shim
  driverA.get('https://fippo.github.io/adapter/testpage.html')
  .then(function() {
    return driverB.get('https://fippo.github.io/adapter/testpage.html');
  })
  .then(function() {
    return clientA.create(null, {
      name: 'ECDSA',
      namedCurve: 'P-256'
    });
  })
  .then(function() {
    return clientB.create(null, {
      name: 'ECDSA',
      namedCurve: 'P-256'
    });
  })
  .then(function() {
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
    if (browserA !== 'MicrosoftEdge') {
      return clientA.getStats();
    } else {
      return clientB.getStats();
    }
  })
  .then(function(stats) {
    console.log(stats);
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

startSelenium()
.then(function(server) {
  // start of tests
  test('Chrome-Edge', {skip: os.platform() !== 'win32'}, function(t) {
    dtls(t, 'chrome', 'MicrosoftEdge');
  });

  test('Chrome-Firefox', function(t) {
    dtls(t, 'chrome', 'firefox');
  });

  test('Firefox-Chrome', function(t) {
    dtls(t, 'firefox', 'chrome');
  });

  test('Edge-Chrome', {skip: os.platform() !== 'win32'}, function(t) {
    dtls(t, 'MicrosoftEdge', 'chrome');
  });

  // must be the last 'test'. Shuts down the selenium server.
  test('shutdown', function(t) {
    server.kill();
    t.end();
  });
})
.catch(function(err) {
  console.error(err);
});
