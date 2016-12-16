/* webrtc interop testing using using selenium 
 * Copyright (c) 2016, Philipp Hancke
 */

var os = require('os');
var test = require('tape');
var buildDriver = require('./webdriver').buildDriver;
var startSelenium = require('./webdriver').startServer;
var getTestpage = require('./webdriver').getTestpage;
var WebRTCClient = require('./webrtcclient');

function interop(t, browserA, browserB, preferredAudioCodec) {
  var driverA = buildDriver(browserA, {server: true});
  var driverB = buildDriver(browserB, {server: true});

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

    if (preferredAudioCodec) {
      var sections = SDPUtils.splitSections(offer.sdp);
      var codecs = SDPUtils.parseRtpParameters(sections[1]).codecs;
      var pt;
      for (var i = 0; i < codecs.length; i++) {
        if (codecs[i].name === preferredAudioCodec) {
          pt = codecs[i].payloadType;
          var lines = sections[1].split('\r\n');
          mLine = lines.shift().split(' ');
          // remove PT from current pos.
          mLine.splice(mLine.indexOf(pt.toString()), 1);
          mLine.splice(3, 0, pt); // insert at first pos.
          mLine = mLine.join(' ');
          lines.unshift(mLine);
          sections[1] = lines.join('\r\n');
          offer.sdp = sections.join('');
          break;
        }
      }
      t.ok(pt !== undefined, 'preferred audio codec ' + preferredAudioCodec +
          ' with PT ' + pt);
    }
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
    return clientA.getStats();
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
    interop(t, 'chrome', 'MicrosoftEdge');
  });

  test('Edge-Chrome', {skip: os.platform() !== 'win32'}, function(t) {
    interop(t, 'MicrosoftEdge', 'chrome');
  });

  test('Firefox-Edge', {skip: os.platform() !== 'win32'}, function(t) {
    interop(t, 'firefox', 'MicrosoftEdge');
  });

  test('Edge-Firefox', {skip: os.platform() !== 'win32'}, function(t) {
    interop(t, 'MicrosoftEdge', 'firefox');
  });

  test('Chrome-Firefox', function(t) {
    interop(t, 'chrome', 'firefox');
  });

  test('Firefox-Chrome', function(t) {
    interop(t, 'firefox', 'chrome');
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
