const test = require('tape');
const os = require('os');

const webdriver = require('selenium-webdriver');
const buildDriver = require('./webdriver').buildDriver;

const TIMEOUT = 30000;

function waitNPeerConnectionsExist(driver, n) {
    return driver.wait(function() {
        return driver.executeScript(function(n) {
            var RTCManager = angular.element(document.body).injector().get('RoomService')._currentRtcManager;
            return RTCManager && Object.keys(RTCManager.peerConnections).length === n;
        }, n);
    }, TIMEOUT, 'Timed out waiting for N peerconnections to exist');
}

function waitAllPeerConnectionsConnected(driver) {
    return driver.wait(function() {
        return driver.executeScript(function() {
            var RTCManager = angular.element(document.body).injector().get('RoomService')._currentRtcManager;

            var states = [];
            Object.keys(RTCManager.peerConnections).forEach(function(id) {
                var connection = RTCManager.peerConnections[id];
                states.push(connection.pc.iceConnectionState);
            });
            return states.length === states.filter((s) => s === 'connected' || s === 'completed').length;
        });
    }, TIMEOUT, 'Timed out waiting for N peerconnections to be connected');
}

function waitNVideosExist(driver, n) {
    return driver.wait(function() {
        return driver.executeScript(function(n) {
            return document.querySelectorAll('.video-wrapper video').length === n;
        }, n);
    }, TIMEOUT, 'Timed out waiting for N videos to exist');
}

function waitAllVideosHaveEnoughData(driver) {
    return driver.wait(function() {
        return driver.executeScript(function() {
            var videos = document.querySelectorAll('.video-wrapper video');
            var ready = 0;
            for (var i = 0; i < videos.length; i++) {
                if (videos[i].readyState >= videos[i].HAVE_ENOUGH_DATA) {
                    ready++;
                }
            }
            return ready === videos.length;
        });
    }, TIMEOUT, 'Timed out waiting for N video to HAVE_ENOUGH_DATA');
}

// Edge Webdriver resolves quit slightly too early, wait a bit.
function maybeWaitForEdge(browserA, browserB) {
    if (browserA === 'MicrosoftEdge' || browserB === 'MicrosoftEdge') {
        return new Promise(function(resolve) {
            setTimeout(resolve, 2000);
        });
    }
    return Promise.resolve();
}

function interop(browserA, browserB, t) {
    var driverA = buildDriver(browserA);
    var driverB = buildDriver(browserB);

  var baseURL = 'https://appear.in/';
  var roomName = 'automated-testing-' + Math.random().toString(36).substr(2, 10);
  var url = baseURL + roomName;

  driverA.manage().timeouts().setScriptTimeout(TIMEOUT);

  return driverA.get(url)
  .then(function() {
    return driverB.get(baseURL + roomName);
  })
  .then(function() {
    // check that we have a peerconnection
    return waitNPeerConnectionsExist(driverA, 1);
  })
  .then(function() {
    t.pass('peerconnections exist');
  })
  .then(function() {
    // wait for the ice connection state change to connected/completed.
    return waitAllPeerConnectionsConnected(driverA);
  })
  .then(function() {
    t.pass('all ice connections connected');
  })
  .then(function() {
    return waitNVideosExist(driverA, 2);
  })
  .then(function() {
    t.pass('have all video elements');
  })
  .then(function() {
    return waitAllVideosHaveEnoughData(driverA);
  })
  .then(function() {
    t.pass('all videos have ENOUGH_DATA');
  })
  .then(function() {
    return waitNVideosExist(driverB, 2);
  })
  .then(function() {
    t.pass('have all video elements');
  })
  .then(function() {
    return waitAllVideosHaveEnoughData(driverB);
  })
  .then(function() {
    t.pass('all videos have ENOUGH_DATA');
  })
  .then(function() {
    return Promise.all([driverA.quit(), driverB.quit()])
  })
  .then(function() {
    return maybeWaitForEdge(browserA, browserB);
  })
  .then(function() {
    t.end();
  })
  .catch(function(e) {
    t.fail(e);
  });
}

test('Chrome-Chrome', function(t) {
    interop('chrome', 'chrome', t);
});

test('Firefox-Firefox', function(t) {
    interop('firefox', 'firefox', t);
});

test('Chrome-Firefox', function(t) {
    interop('chrome', 'firefox', t);
});

test('Firefox-Chrome', function(t) {
    interop('firefox', 'chrome', t);
});

test('Edge-Chrome', {skip: os.platform() !== 'win32'}, function (t) {
    interop('Edge', 'chrome', t);
});
