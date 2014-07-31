var fs = require('fs');
var path = require('path');

// This is singleton
module.exports = new Config();

function Config()
{
    var _config = {};

    // Read configuration file
    if (fs.existsSync(path.resolve(__dirname + '/../conf', 'config.js')))
    {
        _config = require(path.resolve(__dirname + '/../conf', 'config.js')).get();
    }
    else
    {
        _config = require(path.resolve(__dirname + '/../conf', 'config.js.default')).get();
    }

    /**
     * Sections
     */
    this.restapi = _config.restapi;
    this.timers = _config.timers;
}