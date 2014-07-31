module.exports = new RestApi();

function RestApi()
{
    var _config = require('./Config.js');
    var _logger = require('./Logger.js');

    var TaskManager = require('./TaskManager.js');


    var express = require('express');

    var _app = express();

    var tm = new TaskManager();

    this.init = function()
    {
        _logger.debug('[RestApi] [init]: start');

        // Create rest api
        _logger.verbose('[RestApi] [init]: Rest API server is listening on port ' + _config.restapi.port)
        _app.listen(_config.restapi.port);

        _app.all('*', function(req, res, next)
        {
            _logger.debug('[RestAPI]: Incomming request to ' + req.originalUrl);
            next();
        });

        /* ******************************************/
        /*  API ENDPOINTS
        /* ******************************************/

        _app.post('/upload', function(req, res)
        {
            var type = request.param[type] ? request.param[type] : null;

            if (!type && type != 'audio' && type != 'video')
            {
                res.send(100500, 'Specified request type not valid. Choose one of "video" and "audio"');
                return;
            }

            var id = tm.pushTask(type);

            var msg = 
            {
                id: id;    
            }

            res.json(msg);
        });

        _app.get('/status', function(req, res)
        {
           
            var id = request.param[id] ? request.param[id] : null;

            if (!id)
            {
                res.send(100501, 'Id parameter is not specified properly');
                return;
            }

            var toSend = tm.getTaskStatus(id);

            res.json(toSend);
        });

        

    }
}