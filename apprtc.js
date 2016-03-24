/* Interop testing using apprtc.appspot.com using selenium 
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the 
 * SuperOp! 2016 event.
 */

var test = require('tape');
var webdriver = require('selenium-webdriver');
var buildDriver = require('./webdriver');

// Helper function for basic interop test.
// see https://apprtc.appspot.com/params.html for queryString options (outdated...)
function interop(t, browserA, browserB, queryString) {
  var driverA = buildDriver(browserA);
  var driverB;

  //var baseURL = 'https://10.apprtc.appspot.com/';
  var baseURL = 'https://apprtc.appspot.com/';
  //var qs = '?audio=true&video=false';
  //var qs = '?it=relay';

  var info;
  return driverA.get(baseURL + (queryString || ''))
  .then(function() {
    t.pass('page loaded');
    return driverA.findElement(webdriver.By.id('join-button')).click();
  })
  .then(function() {
    // wait for URL to change to /r/some-id
    return driverA.wait(function() {
      return driverA.getCurrentUrl()
          .then(function(url) {
            return url.indexOf(baseURL + 'r/') === 0;
          });
    }, 10000, 'Did not join room for 10s');
  })
  .then(function() {
    t.pass('joined room');
    return driverA.getCurrentUrl()
  })
  .then(function(url) {
    //
    driverB = buildDriver(browserB);
    return driverB.get(url);
  })
  .then(function() {
    return driverB.findElement(webdriver.By.id('confirm-join-button')).click();
  })
  .then(function() {
    t.pass('second browser joined');
    // Show the info box.
    return driverA.executeScript('appController.infoBox_.showInfoDiv();');
  })
  .then(function() {
    // wait for the ice connection state change to connected/completed.
    driverA.manage().timeouts().setScriptTimeout(10 * 1000);
    return driverA.executeAsyncScript(function() {
      var callback = arguments[arguments.length - 1];
      var isConnectedOrFailed = function() {
        var state = appController.call_.pcClient_.pc_.iceConnectionState;
        if (state === 'connected' || state === 'completed' || state === 'failed') {
          callback(state);
        }
      };
      appController.call_.pcClient_.pc_.addEventListener('iceconnectionstatechange',
          isConnectedOrFailed);
    });
    isConnectedOrFailed();
  })
  .then(function(iceConnectionState) {
    t.ok(iceConnectionState === 'connected' || iceConnectionState === 'completed',
        'ice connection state is connected or completed');
  })
  .then(function() {
    // bundle up video frame cheecker.
    return new Promise(function(resolve, reject) {
      var bundle = require('browserify')({standalone: 'VideoFrameChecker'});
      bundle.add('./videoframechecker');
      bundle.bundle(function (err, source) {
        if (err) {
          reject(err);
        } else {
          resolve(source);
        }
      });
    })
  })
  .then(function(framecheckersource) {
    driverA.executeScript(framecheckersource.toString());
    driverA.sleep(1000); // avoid timing issues on high latency (relayed) connections.
    return driverA.executeAsyncScript(function() {
      var callback = arguments[arguments.length - 1];
      var framechecker = new VideoFrameChecker(document.getElementById('remote-video'));
      framechecker.checkVideoFrame_(); // start it
      window.setTimeout(function() {
        framechecker.stop();
        callback(framechecker.frameStats);
      }, 2000);
    });
  })
  .then(function(frameStats) {
    t.ok(frameStats.numFrames > 0, 'video frames received');
  })
  .then(function() {
    // Get the info box text.
    return driverA.findElement(webdriver.By.id('info-div')).getText();
  })
  .then(function(infotext) {
    driverA.quit();
    // return a new promise so the test can .then and inspect
    // depending on the querystring.
    return driverB.quit()
    .then(function() {
      return Promise.resolve(infotext);
    });
  });
}

test('Chrome-Chrome', function (t) {
  //interop(t, 'chrome', 'MicrosoftEdge');
  interop(t, 'chrome', 'chrome')
  .then(function(info) {
    t.end();
  });
});

test('Chrome-Firefox', function (t) {
  interop(t, 'chrome', 'firefox')
  .then(function(info) {
    t.end();
  });
});

test('Firefox-Chrome', function (t) {
  interop(t, 'firefox', 'chrome')
  .then(function(info) {
    t.end();
  });
});

test('Firefox-Firefox', function (t) {
  interop(t, 'firefox', 'firefox')
  .then(function(info) {
    t.end();
  });
});

//unclear how to evaluate audio-only
//test('Chrome-Chrome, audio-only', function (t) {
//  interop(t, 'chrome', 'chrome', '?audio=true&video=false')
//  .then(function(info) {
//    t.end();
//  });
//});

test('Chrome-Chrome, icetransports=relay', function (t) {
  interop(t, 'chrome', 'chrome', '?it=relay')
  .then(function(info) {
    t.end();
  });
});

test('Firefox-Firefox, H264', function (t) {
  interop(t, 'firefox', 'firefox', '?vsc=H264&vrc=H264')
  .then(function(info) {
    t.end();
  });
});

/*
test('Chrome-Chrome, H264', function (t) {
  interop(t, 'chrome', 'chrome', '?vsc=H264&vrc=H264')
  .then(function(info) {
    t.ok(info.indexOf('H264') !== -1, 'H264 is used');
    t.end();
  });
});

test('Chrome-Firefox, H264', function (t) {
  interop(t, 'chrome', 'firefox', '?vsc=H264&vrc=H264')
  .then(function(info) {
    t.ok(info.indexOf('H264') !== -1, 'H264 is used');
    t.end();
  });
});
*/

/*
test('Firefox-Chrome, H264', function (t) {
  interop(t, 'firefox', 'chrome', '?vsc=H264&vrc=H264')
  .then(function(info) {
    t.end();
  });
});

test('Chrome-Chrome, VP8', function (t) {
  interop(t, 'chrome', 'chrome', '?vsc=VP8&vrc=VP8')
  .then(function(info) {
    t.ok(info.indexOf('VP8') !== -1, 'VP8 is used');
    t.end();
  });
});

test('Chrome-Chrome, VP9', function (t) {
  interop(t, 'chrome', 'chrome', '?vsc=VP9&vrc=VP9')
  .then(function(info) {
    t.end();
  });
});
*/

/*
test('Firefox-Firefox, VP9', function (t) {
  interop(t, 'firefox', 'firefox', '?vsc=VP9&vrc=VP9')
  .then(function(info) {
    t.end();
  });
});
*/
