#WebRTC interoperability tests
##Why do we need interoperability tests?
The current state of interoperability testing for WebRTC is still mostly as described by two
blog posts written by Google’s test engineer, Patrik Höglund in mid­2014
[here](http://googletesting.blogspot.se/2014/08/chrome-firefox-webrtc-interop-test-pt-1.html) and 
[here](http://googletesting.blogspot.se/2014/09/chrome-firefox-webrtc-interop-test-pt-2.html).

Basically, the testing process is using the [apprtc sample application](https://apprtc.appspot.com)
in a hermetic environment on Linux to test interoperability with Firefox as part of the Chrome release process.

Other notable examples include the work done by NTTs Yoshimasa Iwase who is running full
factorial tests including different NAT configurations ([described here](http://en.slideshare.net/iwashi86/extreme-testing-of-webrtc-applications)).


Yet, some breakages happen which are not detected by the testing process mentioned
above. For example, an upgrade to Chrome's DTLS library broke the interoperability with the
Jitsi Videobridge in January 2015. This was 
[noticed only very shortly](https://blog.andyet.com/2015/01/30/chrome-update-killed-the-webrtc-star/)
before rolling out to all Chrome users.

Similar issues happened when Mozilla Firefox started to require Perfect Forward Secrecy for
DTLS without announcing this change widely enough. This 
[broke interoperability](https://hacks.mozilla.org/2015/02/webrtc-requires-perfect-forward-secrecy-pfs-starting-in-firefox-38/)
for several mobile applications based on older versions of the webrtc.org library, including
Facebook Messenger which forced Mozilla to postpone the upgrade for several weeks.

##Acknowledgements
This work has been kindly sponsored by the [International Multimedia Telecommunications Consortium](http://www.imtc.org/about/)
in preparation for the upcoming SuperOp! 2016 event.

##Testing process
The testing process is based on the process used in [adapter.js](https://github.com/webrtc/adapter)
and the [samples](https://github.com/webrtc/samples). It uses selenium and
[webdriverjs](https://github.com/SeleniumHQ/selenium/wiki/WebDriverJs) and tests are written using
[tape](https://github.com/substack/tape).

###Chrome
H264 tests currently require Chrome 50 which adds H264 behind a flag.

###Microsoft Edge
The tests for Microsoft Edge only run on Windows currently. Edge is not included in video 
interoperability tests but will be once a version with interoperable H264 is released.

###Firefox 
Firefox uses a binary module from the OpenH264 project to provide H264 support. Typically, this
module is downloaded by Firefox shortly after the creation of a new profile. Since Selenium
creates a new profile for each test, the binary needs to be provided in a template profile.
See [this README](h264profile/gmp-gmpopenh264/1.5.3) for details.

VP9 can be enabled with a flag in Firefox. However, this is compatbile with Chrome only in Firefox 45+.

##AppRTC tests
apprtc.js shows how to test the [AppRTC](https://apprtc.appspot.com) example provided by Google.
It uses a number of URL parameters to tweak application behaviour, e.g. to force the VP9 or H264
video codec.
Both ICE connectivity as well as video interoperability is tested. For the latter, the frame checker
from [testRTC](https://github.com/webrtc/testrtc) is used.

##Raw interop tests
There is a second set of tests which use plain HTML pages and adapter.js. 
Those tests emulate the PeerConnection API to some degree which makes them look very similar
to some of the tests in adapter.js or the JSFiddles written by Mozilla's [Jan-Ivar](https://github.com/jan-ivar).

Tests currently include
* audio interoperability tests working in Chrome, Microsoft Edge and Firefox
* video interoperability tests in Chrome and Firefox, using VP8, VP9 and H264.
* upgrade tests which upgrade an audio-only call to an audio-video call.
