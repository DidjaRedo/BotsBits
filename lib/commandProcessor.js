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

CommandProcessor.prototype._validateCommand = _validateCommand;
CommandProcessor.prototype.addCommand = addCommand;
CommandProcessor.prototype.numCommands = function () { return this._commands.length; };
CommandProcessor.prototype.processAll = processAll;

module.exports = CommandProcessor;

