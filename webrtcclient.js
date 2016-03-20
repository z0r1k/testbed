/* Interop testing using apprtc.appspot.com using selenium 
 * Copyright (c) 2016, Philipp Hancke
 * This work has been sponsored by the International Multimedia
 * Teleconferencing Consortium in preparation for the 
 * SuperOp! 2016 event.
 */

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

module.exports = WebRTCClient;
