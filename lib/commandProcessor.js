"use strict";

var CommandProcessor = function (commands) {
    var self = this;

    self._commands = [];

    if (commands) {
        commands.forEach(function (c) {
            self.addCommand(c);
        });
    }
};

function _validateCommand(cmd) {
    let self = this;

    if ((!cmd.name) || (!cmd.description) || (!cmd.pattern) || (!cmd.handleCommand)) {
        throw new Error("Command must have name, description, pattern and handleCommand.");
    }

    if ((cmd.pattern instanceof RegExp) !== true) {
        throw new Error("Command.pattern must be a regular expression.");
    }

    if (typeof cmd.handleCommand !== "function") {
        throw new Error("Command.handleCommand must be a function.");
    }

    self._commands.forEach(function (c) {
        if (c.name === cmd.name) {
            throw new Error("Duplicate command name \"" + c.name + "\".");
        }
    });
}

function addCommand(cmd) {
    this._validateCommand(cmd);
    this._commands.push(cmd);
}

function processAll(message) {
    let self = this;
    let results = [];
    self._commands.forEach(function (c) {
        let params = message.match(c.pattern);
        if (params !== null) {
            results.push(c.handleCommand(params));
        }
    });
    return results;
}

function processFirst(message) {
    let self = this;
    let result = {
        found: false,
        result: undefined,
    };

    self._commands.forEach(function (c) {
        if (!result.found) {
            let params = message.match(c.pattern);
            if (params !== null) {
                result.result = c.handleCommand(params);
                result.found = true;
            }
        }
        return result;
    });

    return result;
}

function processOne(message) {
    let self = this;
    let result = {
        found: false,
        result: undefined,
    };
    let firstCommand = undefined;

    self._commands.forEach(function (c) {
        let params = message.match(c.pattern);
        if (params !== null) {
            if (!result.found) {
                firstCommand = c;
                result.result = c.handleCommand(params);
                result.found = true;
            }
            else {
                throw new Error("Ambiguous command \"" + message + "\" could be \"" + firstCommand.name + "\" or \"" + c.name + "\".");
            }
        }
    });

    return result;
}

CommandProcessor.prototype._validateCommand = _validateCommand;
CommandProcessor.prototype.addCommand = addCommand;
CommandProcessor.prototype.numCommands = function () { return this._commands.length; };
CommandProcessor.prototype.processAll = processAll;
CommandProcessor.prototype.processFirst = processFirst;
CommandProcessor.prototype.processOne = processOne;

module.exports = CommandProcessor;

