"use strict";

var FlexTime = require("../../lib/flexTime.js");

function makeAmbiguousTimeString(date) {
    let hours = (date.getHours() % 12);
    hours = ((hours === 0) ? 12 : hours);
    let minutes = date.toTimeString().slice(3, 5);
    return hours + minutes;
}

describe("flexTime", function () {
    describe("constructor", () => {
        let morning = new Date(2018, 1, 1, 6, 10);
        let evening = new Date(2018, 1, 1, 18, 10);

        it("should parse unambiguous 12- or 24-hour times without regard for time of day", () => {
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
                expect(time.getHours()).toBe(test.hour);
                expect(time.getMinutes()).toBe(test.minutes);

                time = new FlexTime(test.string, evening);
                expect(time.getHours()).toBe(test.hour);
                expect(time.getMinutes()).toBe(test.minutes);
            });
        });

        it("should adjust ambiguous times depending on time of day", () => {
            [
                { string: "100", morning: 13, evening: 1, minutes: 0 },
                { string: "605", morning: 18, evening: 6, minutes: 5 },
                { string: "615", morning: 6, evening: 18, minutes: 15 },
                { string: "112", morning: 13, evening: 1, minutes: 12 },
                { string: "11:59", morning: 11, evening: 23, minutes: 59 },
            ].forEach(function (test) {
                let time = new FlexTime(test.string, morning);
                expect(time.getHours()).toBe(test.morning);
                expect(time.getMinutes()).toBe(test.minutes);

                time = new FlexTime(test.string, evening);
                expect(time.getHours()).toBe(test.evening);
                expect(time.getMinutes()).toBe(test.minutes);
            });
        });

        it("should use the current time if no time is specified", () => {
            let thirtyMinutesInMilliseconds = 30 * 60 * 1000;
            let future = new Date(Date.now() + thirtyMinutesInMilliseconds);
            let past = new Date(Date.now() - thirtyMinutesInMilliseconds);

            let time = new FlexTime(makeAmbiguousTimeString(future));
            let expected = future.getHours();
            expect(time.getHours()).toBe(expected);

            time = new FlexTime(makeAmbiguousTimeString(past));
            expected = (past.getHours() + 12) % 24;
            expect(time.getHours()).toBe(expected);

            let date = new Date();
            time = new FlexTime();
            expect(time.getHours()).toBe(date.getHours());
            expect(time.getMinutes()).toBe(date.getMinutes());
        });

        it("should initialize from another flex time", () => {
            let time = new FlexTime(new Date(2018, 1, 1, 12, 0));
            let newTime = new FlexTime(time);
            expect(time.getHours()).toEqual(newTime.getHours());
            expect(time.getMinutes()).toEqual(newTime.getMinutes());
        });

        it("should throw for invalid time strings", () => {
            [
                "12345", "12", "fred", "2515", "875", "123:4", "8:00 ama", "2300 am",
            ].forEach(function (test) {
                expect(() => new FlexTime(test)).toThrowError(Error, `Invalid time string "${test}".`);
            });
        });
    });

    describe("getFlexTime static method", () => {
        it("should use Date, time in milliseconds, or FlexTime and delta if supplied", () => {
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
                expect(time.getHours()).toBe(test.hour);
                expect(time.getMinutes()).toBe(test.minutes);

                time = FlexTime.getFlexTime(nowTime, test.string);
                expect(time.getHours()).toBe(test.hour);
                expect(time.getMinutes()).toBe(test.minutes);

                time = FlexTime.getFlexTime(now);
                time = FlexTime.getFlexTime(time, test.string);
                expect(time.getHours()).toBe(test.hour);
                expect(time.getMinutes()).toBe(test.minutes);
            });
        });

        it("should use the current time if no time is supplied", function () {
            let flexNow = FlexTime.getFlexTime();
            let now = new Date();
            let dateFromFlex = new Date();
            dateFromFlex.setHours(flexNow.getHours());
            dateFromFlex.setMinutes(flexNow.getMinutes());
            // 5 seconds should be plenty of fudge.  This test might also fail
            // right at midnight if flexNow and now happen to land on different
            // days.
            let delta = dateFromFlex.getTime() - now.getTime();
            expect(delta).toBeLessThan(5000);
        });
    });

    describe("toDate method", () => {
        it("should return accept baseDate as a number or a date", () => {
            const baseDate = new Date(2018, 1, 1, 14, 0);
            const futureDate = new Date(baseDate.getTime() + 300 * 1000);
            const flex = new FlexTime("", futureDate);

            let dateFromFlex = flex.toDate(undefined, baseDate);
            expect(dateFromFlex.getUTCDate()).toEqual(baseDate.getUTCDate());

            dateFromFlex = flex.toDate(undefined, baseDate.getTime());
            expect(dateFromFlex.getUTCDate()).toEqual(baseDate.getUTCDate());
        });

        it("should return today's date for a time later than now", () => {
            const baseDate = new Date(2018, 1, 1, 14, 0);
            const futureDate = new Date(baseDate.getTime() + 300 * 1000);
            const flex = new FlexTime("", futureDate);
            const dateFromFlex = flex.toDate(undefined, baseDate);
            expect(dateFromFlex.getUTCDate()).toEqual(baseDate.getUTCDate());
        });

        it("should return tomorrow's date for a time earlier than now", () => {
            const baseDate = new Date(2018, 1, 1, 14, 0);
            const pastDate = new Date(baseDate.getTime() - 300 * 1000);
            const flex = new FlexTime("", pastDate);
            const dateFromFlex = flex.toDate(undefined, baseDate);
            expect(dateFromFlex.getUTCDate()).not.toEqual(baseDate.getUTCDate());
        });

        it("should apply a fudge factor if supplied", () => {
            const baseDate = new Date(2018, 1, 1, 14, 0);
            const pastDate = new Date(baseDate.getTime() - 300 * 1000);
            const flex = new FlexTime("", pastDate);
            const dateFromFlex = flex.toDate(10, baseDate);
            expect(dateFromFlex.getUTCDate()).toEqual(baseDate.getUTCDate());
        });

        it("should use now if no base date is supplied", () => {
            const futureDate = new Date(Date.now() + 300 * 1000);
            const pastDate = new Date(Date.now() - 300 * 1000);
            const futureFlex = new FlexTime("", futureDate);
            const pastFlex = new FlexTime("", pastDate);
            const futureDateFromFlex = futureFlex.toDate();
            const pastDateFromFlex = pastFlex.toDate();
            const nowUTCDate = new Date().getUTCDate();
            expect(futureDateFromFlex.getUTCDate()).toEqual(nowUTCDate);
            expect(pastDateFromFlex.getUTCDate()).not.toEqual(nowUTCDate);
        });
    });

    describe("getDeltaInMinutes", () => {

    });
});
