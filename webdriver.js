var os = require('os');
var fs = require('fs');

var seleniumServer = require('selenium-standalone');

var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');
var firefox = require('selenium-webdriver/firefox');
var edge = require('selenium-webdriver/edge');

if (os.platform() === 'win32') {
  process.env.PATH += ';C:\\Program Files (x86)\\Microsoft Web Driver\\';
  // FIXME: not sure why node_modules\.bin\ is not enough
  process.env.PATH += ';' + process.cwd() +
      '\\node_modules\\chromedriver\\lib\\chromedriver\\';
  process.env.PATH += ';' + process.cwd() +
      '\\node_modules\\geckodriver';
} else {
  process.env.PATH += ':node_modules/.bin';
}

function buildDriver(browser, options) {
  // Firefox options.
  // contains gmp-gmpopenh264/1.5.3 which may contain openh264 binary.
  var profile;
  options = options || {};
  if (options.h264) {
    profile = new firefox.Profile('h264profile');
    profile.setPreference('media.gmp-gmpopenh264.version', '1.6'); // openh264
  } else {
    profile = new firefox.Profile(options.firefoxprofile);
  }
  // note: interoperable with Chrome only in FF46+
  if (options.vp9) {
    profile.setPreference('media.peerconnection.video.vp9_enabled', true);
  }

  profile.setPreference('media.navigator.streams.fake', true);
  profile.setPreference('media.navigator.permission.disabled', true);
  profile.setPreference('xpinstall.signatures.required', false);

  var firefoxOptions = new firefox.Options()
      .setProfile(profile);
  if (os.platform() === 'win32') {
    firefoxOptions.setBinaryPath('C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe');
  }

  // Chrome options.
  var chromeOptions = new chrome.Options()
      // .setChromeBinaryPath('/usr/bin/google-chrome-beta')
      .addArguments('enable-features=WebRTC-H264WithOpenH264FFmpeg')
      .addArguments('allow-file-access-from-files')
      .addArguments('use-fake-device-for-media-stream')
      .addArguments('disable-translate')
      .addArguments('no-process-singleton-dialog')
      .addArguments('mute-audio');
  if (!options.devices) {
    chromeOptions.addArguments('use-fake-ui-for-media-stream');
  } else {
    // see https://bugs.chromium.org/p/chromium/issues/detail?id=459532#c22
    var domain = 'https://' + (options.devices.domain || 'localhost') + ':' + (options.devices.port || 443) + ',*';
    var exceptions = {
      media_stream_mic: {},
      media_stream_camera: {}
    };

    exceptions.media_stream_mic[domain] = {
      last_used: Date.now(),
      setting: options.devices.audio ? 1 : 2 // 0: ask, 1: allow, 2: denied
    };
    exceptions.media_stream_camera[domain] = {
      last_used: Date.now(),
      setting: options.devices.video ? 1 : 2
    };

    chromeOptions.setUserPreferences({
      profile: {
        content_settings: {
          exceptions: exceptions
        }
      }
    });
  }

  var edgeOptions = new edge.Options();

  var driver = new webdriver.Builder()
      .setFirefoxOptions(firefoxOptions)
      .setChromeOptions(chromeOptions)
      .setEdgeOptions(edgeOptions)
      .forBrowser(browser);
  if (options.server) {
    driver = driver.usingServer('http://localhost:4444/wd/hub/');
  }

  if (browser === 'firefox') {
    driver.getCapabilities().set('marionette', true);
  }
  driver = driver.build();

  // Set global executeAsyncScript() timeout (default is 0) to allow async
  // callbacks to be caught in tests.
  driver.manage().timeouts().setScriptTimeout(5 * 1000);

  return driver;
}

// static page that includes adapter.js 
function getTestpage(driver) {
    return driver.get('https://fippo.github.io/adapter/testpage.html')
    .then(function() {
        return driver.executeScript(fs.readFileSync('videoframechecker.js').toString());
    });
}

function startServer() {
  return new Promise(function(resolve, reject) {
    seleniumServer.install({
      drivers: {
        chrome: {},
        firefox: {},
        ie: false
      }
    }, function(err, cb) {
      seleniumServer.start(function(err, child) {
        if (err) {
          reject(err);
          return;
        }
        return resolve(child);
      });
    });
  });
}

module.exports = {
  buildDriver: buildDriver,
  getTestpage: getTestpage,
  startServer: startServer
};
