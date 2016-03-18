var seleniumServer = require('selenium-standalone');

seleniumServer.install({
    drivers: {
        chrome: {},
        firefox: {},
        ie: false
    }
}, function(err, cb) {
    seleniumServer.start(function (err, child) {
        console.log(err, child);
        if (err) {
            console.error(err);
            return;
        }
        require('./apprtc');
    });
});
