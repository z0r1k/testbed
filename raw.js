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
  driver.manage().timeouts().setScriptTimeout(5 * 1000);

  return driver;
}

function WebRTCClient(driver) {
  this.driver = driver;
}

WebRTCClient.prototype.create = function(pcConfig) {
  this.driver.executeScript(function(pcConfig) {
    window.pc = new RTCPeerConnection(pcConfig);
  }, pcConfig);
};

WebRTCClient.prototype.getUserMedia = function(constraints) {
  return this.driver.executeAsyncScript(function(constraints) {
    var callback = arguments[arguments.length - 1];

    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      window.localstream = stream;
      callback();
    })
    .catch(function(err) {
      callback(err);
    });
  }, constraints || {audio: true, video: true});
};

WebRTCClient.prototype.addStream = function() {
  return this.driver.executeScript(function() {
    pc.addStream(localstream);
  });
};

WebRTCClient.prototype.createOffer = function() {
  return this.driver.executeAsyncScript(function() {
    var callback = arguments[arguments.length - 1];

    pc.createOffer()
    .then(function(offer) {
      callback(offer);
    })
    .catch(function(err) {
      callback(err);
    });
  });
};

WebRTCClient.prototype.createAnswer = function() {
  return this.driver.executeAsyncScript(function() {
    var callback = arguments[arguments.length - 1];

    return pc.createAnswer()
    .then(function(answer) {
      callback(answer);
    })
    .catch(function(err) {
      callback(err);
    });
  });
};

// resolves with non-trickle description including candidates.
WebRTCClient.prototype.setLocalDescription = function(desc) {
  return this.driver.executeAsyncScript(function(desc) {
    var callback = arguments[arguments.length - 1];

    pc.onicecandidate = function(event) {
      if (!event.candidate) {
        // since Chrome does not include a=end-of-candidates...
        var desc = {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp
        }
        if (desc.sdp.indexOf('\r\na=end-of-candidates\r\n') === -1) {
          var parts = desc.sdp.split('\r\nm=').map(function(part, index) {
            return (index > 0 ? 'm=' + part : part).trim() + '\r\n';
          });
          for (var i = 1; i < parts.length; i++) {
            parts[i] += 'a=end-of-candidates\r\n';
          }
          desc.sdp = parts.join('');
        }

        callback(desc);
      }
    };

    pc.setLocalDescription(new RTCSessionDescription(desc))
    .catch(function(err) {
      callback(err);
    });
  }, desc);
};

// TODO: should this return id of media element and create one
//      for each stream?
WebRTCClient.prototype.setRemoteDescription = function(desc) {
  return this.driver.executeAsyncScript(function(desc) {
    var callback = arguments[arguments.length - 1];

    pc.setRemoteDescription(new RTCSessionDescription(desc))
    .then(function() {
      callback();
    })
    .catch(function(err) {
      callback(err);
    });
  }, desc);
};

WebRTCClient.prototype.waitForIceConnectionStateChange = function() {
  return this.driver.executeAsyncScript(function() {
    var callback = arguments[arguments.length - 1];

    var isConnectedOrFailed = function() {
      var state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed' || state === 'failed') {
        callback(state);
        return true;
      }
    };
    if (!isConnectedOrFailed()) {
      pc.addEventListener('iceconnectionstatechange', isConnectedOrFailed);
    }
  });
};

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
