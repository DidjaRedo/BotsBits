"use strict";

var CommandProcessor = require("../../lib/commandProcessor.js");

describe("commands", function () {
    let goodCommands = [
        { name: "Command 1", description: "Description", pattern: /^.*$/, handleCommand: function (matches) { return matches[0]; } },
        { name: "Command 2", description: "Another Description", pattern: /^This is\s(.*)\.$/, handleCommand: function (matches) { return matches[1]; } },
    ];
    let badCommands = {
        "missing name": {
            cmd: { description: "Description", pattern: /^.*$/, handleCommand: function (matches) { return matches; } },
            error: "Command must have name, description, pattern and handleCommand.",
        },
        "missing description": {
            cmd: { name: "Command", pattern: /^.*$/, handleCommand: function (matches) { return matches; } },
            error: "Command must have name, description, pattern and handleCommand.",
        },
        "missing pattern": {
            cmd: { name: "Command", description: "Description", handleCommand: function (matches) { return matches; } },
            error: "Command must have name, description, pattern and handleCommand.",
        },
        "missing handler": {
            cmd: { name: "Command", description: "Description", pattern: /^.*$/ },
            error: "Command must have name, description, pattern and handleCommand.",
        },
        "non-regexp pattern": {
            cmd: { name: "Command", description: "Description", pattern: "/^.*$/", handleCommand: function (matches) { return matches; } },
            error: "Command.pattern must be a regular expression.",
        },
        "non-function handleCommand": {
            cmd: { name: "Command", description: "Description", pattern: /^.*$/, handleCommand: "function (matches) { return matches; }" },
            error: "Command.handleCommand must be a function.",
        },
    };
    let testCommands =         [
        {
            description: "should succeed with no commands",
            cmds: undefined,
        },
        {
            description: "should succeed with a valid command",
            cmds: [goodCommands[0]],
        },
        {
            description: "should succeed with multiple valid commands",
            cmds: [goodCommands[0], goodCommands[1]],
        },
        {
            description: "should fail with duplicate command names",
            cmds: [goodCommands[0], goodCommands[0]],
            error: "Duplicate command name \"" + goodCommands[0].name + "\".",
        },
    ];

    for (let c in badCommands) {
        if (badCommands.hasOwnProperty(c)) {
            testCommands.push({
                description: "should fail with " + c,
                cmds: [badCommands[c].cmd],
                error: badCommands[c].error,
            });
        }
    }

    describe("constructor", function () {
        testCommands.forEach(function (test) {
            it(test.description, function () {
                if (test.error) {
                    expect(function () {
                        let cmds = new CommandProcessor(test.cmds);
                        expect(cmds).toBeUndefined();
                    }).toThrow(test.error);
                }
                else {
                    let cmds = new CommandProcessor(test.cmds);
                    expect(cmds).toBeDefined();
                    expect(cmds.numCommands()).toBe((test.cmds ? test.cmds.length : 0));
                }
            });
        });
    });

    describe("addCommand", function () {
        it("should add valid commands", function () {
            let cmds = new CommandProcessor();
            expect(cmds.numCommands()).toBe(0);
            cmds.addCommand(goodCommands[0]);
            expect(cmds.numCommands()).toBe(1);
            cmds.addCommand(goodCommands[1]);
            expect(cmds.numCommands()).toBe(2);
        });

        it("should fail to add a duplicate command", function () {
            let cmds = new CommandProcessor();
            expect(cmds.numCommands()).toBe(0);
            cmds.addCommand(goodCommands[0]);
            expect(cmds.numCommands()).toBe(1);
            expect(function () {
                cmds.addCommand(goodCommands[0]);
            }).toThrow("Duplicate command name \"" + goodCommands[0].name + "\".");
            expect(cmds.numCommands()).toBe(1);
        });

        describe("invalid commands", function () {
            let cmds = new CommandProcessor();
            for (let c in badCommands) {
                if (badCommands.hasOwnProperty(c)) {
                    it("should fail to add a command with " + c, function () {
                        expect(function () {
                            cmds.addCommand(badCommands[c].cmd);
                        }).toThrow(badCommands[c].error);
                        expect(cmds.numCommands()).toBe(0);
                    });
                }
            }
        });
    });

    describe("processAll", function () {
        let cmds = new CommandProcessor(goodCommands);
        it("should process only matching commands", function () {
            let result = cmds.processAll("A test, this is.");
            expect(result.length).toBe(1);
            expect(result[0]).toBe("A test, this is.");
        });
        it("should process all matching commands", function () {
            let result = cmds.processAll("This is a test.");
            expect(result.length).toBe(2);
            expect(result[0]).toBe("This is a test.");
            expect(result[1]).toBe("a test");
        });
    });
});
