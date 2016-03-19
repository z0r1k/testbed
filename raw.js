/* Interop testing using apprtc.appspot.com using selenium 
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the 
 * SuperOp! 2016 event.
 */

var test = require('tape');
var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');
var firefox = require('selenium-webdriver/firefox');

function splitSections(blob) {
  var parts = blob.split('\r\nm=');
  return parts.map(function(part, index) {
    return (index > 0 ? 'm=' + part : part).trim() + '\r\n';
  });
}

function buildDriver(browser, version, platform) {
  // Firefox options.
  var profile = new firefox.Profile();
  profile.setPreference('media.navigator.streams.fake', true);
  profile.setPreference('media.navigator.permission.disabled', true);
  //profile.setPreference('media.peerconnection.video.vp9_enabled', true);
  profile.setPreference('xpinstall.signatures.required', false);

  var firefoxOptions = new firefox.Options()
      .setProfile(profile);

  // Chrome options.
  var chromeOptions = new chrome.Options()
      .addArguments('allow-file-access-from-files')
      .addArguments('use-fake-device-for-media-stream')
      .addArguments('use-fake-ui-for-media-stream')
      .addArguments('disable-translate')
      .addArguments('no-process-singleton-dialog')
      .addArguments('mute-audio');

  var driver = new webdriver.Builder()
      .usingServer('http://localhost:4444/wd/hub')
      .setFirefoxOptions(firefoxOptions)
      .setChromeOptions(chromeOptions)
      .forBrowser(browser, version, platform)
      .build();
  // Set global executeAsyncScript() timeout (default is 0) to allow async
  // callbacks to be caught in tests.
  driver.manage().timeouts().setScriptTimeout(2 * 1000);

  return driver;
}

function interop(t, browserA, browserB) {
  var driverA = buildDriver(browserA);
  var driverB = buildDriver(browserB);

  // static page with adapter shim
  driverA.get('https://fippo.github.io/adapter/testpage.html')
  .then(function() {
    return driverB.get('https://fippo.github.io/adapter/testpage.html')
  })
  .then(function() {
    // create PeerConnection.
    return driverA.executeScript(function() {
      window.pc = new RTCPeerConnection();
    })
  })
  .then(function() {
    // query getUserMedia.
    return driverA.executeAsyncScript(function() {
      var callback = arguments[arguments.length - 1];

      navigator.mediaDevices.getUserMedia({audio: true, video: false})
      .then(function(stream) {
        window.localstream = stream;
        callback();
      })
      .catch(function(err) {
        callback(err);
      });
    })
  })
  .then(function() {
    // add stream.
    return driverA.executeScript(function() {
      pc.addStream(localstream);
    });
  })
  .then(function() {
    // call createOffer.
    return driverA.executeAsyncScript(function() {
      var callback = arguments[arguments.length - 1];

      pc.createOffer()
      .then(function(offer) {
        callback(offer);
      });
      .catch(function(err) {
        callback(err);
      });
    })
  })
  .then(function(offer) {
    t.pass('created offer');
    // modify offer here?

    // setLocalDescription, return non-trickle offer.
    return driverA.executeAsyncScript(function(offer) {
      var callback = arguments[arguments.length - 1];
      console.log(offer);

      pc.onicecandidate = function(event) {
        if (!event.candidate) {
          callback(pc.localDescription);
        }
      };
      pc.setLocalDescription(new RTCSessionDescription(offer))
      .catch(function(err) {
        callback(err);
      });
    }, offer);
  })
  .then(function(offerWithCandidates) {
    t.pass('offer ready to signal');

    // since Chrome does not include a=end-of-candidates...
    if (offerWithCandidates.sdp.indexOf('\r\na=end-of-candidates\r\n') === -1) {
      var parts = splitSections(offerWithCandidates.sdp);
      for (var i = 1; i < parts.length; i++) {
        parts[i] += 'a=end-of-candidates\r\n';
      }
      offerWithCandidates.sdp = parts.join('');
    }

    // Create other peerconnection, setRemoteDescription and createAnswer.
    return driverB.executeAsyncScript(function(offer) {
      var callback = arguments[arguments.length - 1];

      window.pc = new RTCPeerConnection();
      pc.setRemoteDescription(new RTCSessionDescription(offer))
      .then(function() {
        return pc.createAnswer();
      })
      .then(function(answer) {
        callback(answer);
      })
      .catch(function(err) {
        callback(err);
      });
    }, offerWithCandidates)
  })
  .then(function(answer) {
    t.pass('created answer');
    // modify answer here?

    // set answer, return non-trickle answer.
    return driverB.executeAsyncScript(function(answer) {
      var callback = arguments[arguments.length - 1];

      pc.onicecandidate = function(event) {
        if (!event.candidate) {
          callback(pc.localDescription);
        }
      };
      pc.setLocalDescription(new RTCSessionDescription(answer))
      .catch(function(err) {
        callback(err);
      });
    }, answer);
  })
  .then(function(answerWithCandidates) {
    t.pass('answer ready to signal');

    // since Chrome does not include a=end-of-candidates...
    if (answerWithCandidates.sdp.indexOf('\r\na=end-of-candidates\r\n') === -1) {
      var parts = splitSections(answerWithCandidates.sdp);
      for (var i = 1; i < parts.length; i++) {
        parts[i] += 'a=end-of-candidates\r\n';
      }
      answerWithCandidates.sdp = parts.join('');
    }

    // wait for the iceConnectionState to become either connected/completed
    // or failed.
    return driverA.executeAsyncScript(function(answer) {
      var callback = arguments[arguments.length - 1];
      var isConnectedOrFailed = function() {
        var state = pc.iceConnectionState;
        if (state === 'connected' || state === 'completed' || state === 'failed') {
          callback(state);
        }
      };
      pc.addEventListener('iceconnectionstatechange', isConnectedOrFailed);
      pc.setRemoteDescription(new RTCSessionDescription(answer))
      .catch(function(err) {
        callback(err);
      });
    }, answerWithCandidates);
  })
  .then(function(iceConnectionState) {
    t.ok(iceConnectionState !== 'failed', 'ICE connection is established');
  })
  /*
   * here is where the fun starts. getStats etc
   */
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
