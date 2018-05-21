"use strict";

var FlexTime = require("../../lib/flexTime.js");

function makeAmbiguousTimeString(date) {
    let hours = (date.getHours() % 12);
    hours = ((hours === 0) ? 12 : hours);
    let minutes = date.toTimeString().slice(3, 5);
    return hours + minutes;
}

describe("flexTime", function () {
    describe("constructor", function () {
        let morning = new Date(2018, 1, 1, 6, 10);
        let evening = new Date(2018, 1, 1, 18, 10);

        it("should parse unambiguous 12- or 24-hour times without regard for time of day", function () {
            [
                { string: "0000", hour: 0, minutes: 0 },
                { string: "0100", hour: 1, minutes: 0 },
                { string: "0600", hour: 6, minutes: 0 },
                { string: "0615", hour: 6, minutes: 15 },
                { string: "1312", hour: 13, minutes: 12 },
                { string: "13:12", hour: 13, minutes: 12 },
                { string: "23:59", hour: 23, minutes: 59 },
                { string: "800 am", hour: 8, minutes: 0 },
                { string: "8:00 pm", hour: 20, minutes: 0 },
                { string: "101 am", hour: 1, minutes: 1 },
                { string: "11:11p", hour: 23, minutes: 11 },
                { string: "1212a", hour: 0, minutes: 12 },
                { string: "12:12 PM", hour: 12, minutes: 12 },
            ].forEach(function (test) {
                let time = new FlexTime(test.string, morning);
                expect(time.hour).toBe(test.hour);
                expect(time.minutes).toBe(test.minutes);

                time = new FlexTime(test.string, evening);
                expect(time.hour).toBe(test.hour);
                expect(time.minutes).toBe(test.minutes);
            });
        });

        it("should adjust ambiguous times depending on time of day", function () {
            [
                { string: "100", morning: 13, evening: 1, minutes: 0 },
                { string: "605", morning: 18, evening: 6, minutes: 5 },
                { string: "615", morning: 6, evening: 18, minutes: 15 },
                { string: "112", morning: 13, evening: 1, minutes: 12 },
                { string: "11:59", morning: 11, evening: 23, minutes: 59 },
            ].forEach(function (test) {
                let time = new FlexTime(test.string, morning);
                expect(time.hour).toBe(test.morning);
                expect(time.minutes).toBe(test.minutes);

                time = new FlexTime(test.string, evening);
                expect(time.hour).toBe(test.evening);
                expect(time.minutes).toBe(test.minutes);
            });
        });

        it("should use the current time if no time is specified", function () {
            let thirtyMinutesInMilliseconds = 30 * 60 * 1000;
            let future = new Date(Date.now() + thirtyMinutesInMilliseconds);
            let past = new Date(Date.now() - thirtyMinutesInMilliseconds);

            let time = new FlexTime(makeAmbiguousTimeString(future));
            let expected = future.getHours();
            expect(time.hour).toBe(expected);

            time = new FlexTime(makeAmbiguousTimeString(past));
            expected = (past.getHours() + 12) % 24;
            expect(time.hour).toBe(expected);
        });

        it("should throw for invalid time strings", function () {
            [
                "12345", "12", "fred", "2515", "875", "123:4", "8:00 ama", "2300 am",
            ].forEach(function (test) {
                expect(function () {
                    let time = new FlexTime(test);
                    expect(time).toBeUndefined();
                }).toThrowError(Error, `Invalid flextime "${test}".`);
            });
        });
    });

    describe("getFlexTime method", function () {
        it("should use Date or time in milliseconds and delta if supplied", function () {
            let now = new Date(2018, 1, 1, 11, 11, 11);
            let nowTime = now.getTime();
            [
                { string: "20", hour: 11, minutes: 31 },
                { string: "-20", hour: 10, minutes: 51 },
                { string: "60", hour: 12, minutes: 11 },
                { string: "120", hour: 13, minutes: 11 },
                { string: undefined, hour: 11, minutes: 11 },
            ].forEach(function (test) {
                let time = FlexTime.getFlexTime(now, test.string);
                expect(time.hour).toBe(test.hour);
                expect(time.minutes).toBe(test.minutes);

                time = FlexTime.getFlexTime(nowTime, test.string);
                expect(time.hour).toBe(test.hour);
                expect(time.minutes).toBe(test.minutes);
            });
        });

        it("should use the current time if no time is supplied", function () {
            let flexNow = FlexTime.getFlexTime();
            let now = new Date();
            let dateFromFlex = new Date();
            dateFromFlex.setHours(flexNow.hour);
            dateFromFlex.setMinutes(flexNow.minutes);
            // 5 seconds should be plenty of fudge.  This test might also fail
            // right at midnight if flexNow and now happen to land on different
            // days.
            let delta = dateFromFlex.getTime() - now.getTime();
            expect(delta).toBeLessThan(5000);
        });
    });
});
