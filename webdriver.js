var os = require('os');

var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');
var firefox = require('selenium-webdriver/firefox');

if (os.platform() === 'win32') {
  process.env.PATH += ';C:\\Program Files (x86)\\Microsoft Web Driver\\';
} else {
  process.env.PATH += ':node_modules/.bin';
}

function buildDriver(browser, version, platform) {
  // Firefox options.
  // contains gmp-gmpopenh264/1.5.3 which may contain openh264 binary.
  var profile = new firefox.Profile('h264profile');
  profile.setPreference('media.navigator.streams.fake', true);
  profile.setPreference('media.navigator.permission.disabled', true);
  // note: interoperable with Chrome only in FF46+
  //profile.setPreference('media.peerconnection.video.vp9_enabled', true);
  profile.setPreference('xpinstall.signatures.required', false);

  profile.setPreference('media.gmp-gmpopenh264.version', '1.5.3'); // openh264

  var firefoxOptions = new firefox.Options()
      .setProfile(profile);

  // Chrome options.
  var chromeOptions = new chrome.Options()
      //.setChromeBinaryPath('/usr/bin/google-chrome-beta')
      .addArguments('enable-features=WebRTC-H264WithOpenH264FFmpeg')
      .addArguments('allow-file-access-from-files')
      .addArguments('use-fake-device-for-media-stream')
      .addArguments('use-fake-ui-for-media-stream')
      .addArguments('disable-translate')
      .addArguments('no-process-singleton-dialog')
      .addArguments('mute-audio');

  var driver = new webdriver.Builder()
      .setFirefoxOptions(firefoxOptions)
      .setChromeOptions(chromeOptions)
      .forBrowser(browser, version, platform)
      .build();
  // Set global executeAsyncScript() timeout (default is 0) to allow async
  // callbacks to be caught in tests.
  driver.manage().timeouts().setScriptTimeout(5 * 1000);

  return driver;
}

module.exports = buildDriver;
