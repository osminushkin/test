module.exports = function VideoConverter () {
    this.finished = false;
    this.percents = 0;
    this._fakeWorkTime = 0;

    var interval = 0;
    var timeout = 0;

    var self = this;

    this.convert = function (callback) {
        this.percents = 0;
        this._fakeWorkTime = 20 + Math.random()*120*250;
        
        interval = setInterval(function(){
            self.percents++;
        }, this._fakeWorkTime/100);
        
        timeout = setTimeout(function(){
            self.percents = 100;
            self.finished = true;
            clearInterval(interval);
            callback();
        }, this._fakeWorkTime);
    };

    this.getStatus = function()
    {
        return this.percents;
    };

    this.abortTask = function()
    {
        clearInterval(interval);
        clearTimeout(timeout);
    };
};