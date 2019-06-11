"use strict";

// flexTimeRegex puts each component into a capture group and matches the entire line ignoring leading and trailing whitespace
// substringRegex matches anywhere into a single capture group
// flexTimeRegex is for internal use - substringRegex is for use by consumers who want to embed a flex time into another regex

const flexTimeRegex = /^\s*(\d?\d):?(\d\d)\s*(a|A|am|AM|p|P|pm|PM)?\s*$/;
const flexTimeSubstringRegex = /((?:\d?\d):?(?:\d\d)\s*(?:a|A|am|AM|p|P|pm|PM)?)/;

function _tryGetValuesFromString(str, now) {
    const match = flexTimeRegex.exec(str);

    if (match !== null) {
        let hours = Number(match[1]);
        let minutes = Number(match[2]);

        if ((hours >= 0) && (hours < 24) && (minutes >= 0) && (minutes < 60)) {
            let isValid = true;

            // 12 hour time is unambiguous if am/pm is specified
            const hasAmPm = (typeof match[3] === "string") && ((match[3].length === 1) || (match[3].length === 2));

            // 24 hour time is unambiguous if there is no am/pm and the hour is 0, greater than 12 or has an extra
            // leading 0.   So "0800" is unambiguously 8 in the morning but "800" could be either morning or evening
            const isUnambiguous24hrTime = (!hasAmPm) && ((hours === 0) || (hours > 12) || match[1][0] === "0");

            if (hasAmPm) {
                // Make sure we aren't trying to use am/pm for unambiguous 24 hour times
                isValid = isValid && ((hours > 0) && (hours <= 12));
                if (isValid) {
                    // get to 24 hour time. 12 am === 00:00
                    hours = (hours === 12) ? 0 : hours;
                    if (match[3].toLowerCase()[0] === "p") {
                        hours = hours + 12;
                    }
                }
            }

            // Here comes the "flex" part. If the user entered a possible 12-hour time
            // without am/pm then we assume they mean the upcoming one (e.g. "830" means
            // "0830" if "now" is 7 in the morning but it means "2030" if now is noon)
            // Gets a little weird across midnight (e.g. 130 means 0130 if now is 2300)
            if (isValid && (!hasAmPm) && (!isUnambiguous24hrTime)) {
                hours = findFutureHour(now, hours, minutes);
            }

            if (isValid) {
                return { hours: hours, minutes: minutes };
            }
        }
    }
    return undefined;
}

function findFutureHour(now, hours, minutes) {
    hours = (hours === 12) ? 0 : hours;

    const nowHours = now.getHours();
    while (hours < nowHours) {
        hours += 12;
    }

    if ((hours === nowHours) && (minutes < now.getMinutes())) {
        hours += 12;
    }

    return (hours % 24);
}

/**
 * Converts a flexible time specification into the nearest future time.
 */
class FlexTime {
    /**
     * Converts a flexible time specification into a specific hour and minute
     * Examples:
     * 24-hour time: 0100, 1430
     * 12-hour time: 12:10p, 9:00a
     * FlexTime or Date object
     * Number (time in ticks)
     * Ambiguous times (e.g. "9:00") are converted to the time after the 
     * starting date (so at 8am "9:00" refers to 9am, but at 10am "9:00" is 9pm)
     * @param {string|number|FlexTime|Date} init - Initializer to use for the date
     * @param {Date} [now] -  Optional start time. Defaults to Date.now()
     */
    constructor(init, now) {
        now = now || new Date();

        if ((init !== undefined) && (init !== "")) {
            if ((typeof init === "string") && (init !== "")) {
                const result = _tryGetValuesFromString(init, now);
                if (!result) {
                    throw new Error(`Invalid time string "${init}".`);
                }
                this._hours = result.hours;
                this._minutes = result.minutes;
                return;
            }
            else if ((init instanceof FlexTime) || (init instanceof Date)) {
                now = init;
            }
            else if (typeof init === "number") {
                now = new Date(init);
            }
            else {
                throw new Error(`Illegal flextime initializer ${init}`);
            }
        }

        this._hours = now.getHours();
        this._minutes = now.getMinutes();
    }

    /**
     * The hours portion of the FlexTime as a 24-hour time (0..23).
     */
    get hours() {
        return this._hours;
    }

    /**
     * The minutes portion of the FlexTime (0..59)
     */
    get minutes() {
        return this._minutes;
    }

    /**
     * Gets the hours portion of the FlexTime as a 24-hour time (0..23)
     */
    getHours() {
        return this._hours;
    }

    /**
     * Gets the minutes portion of the FlexTime (0..59)
     */
    getMinutes() {
        return this._minutes;
    }

    /**
     * Gets the delta in minutes between a supplied time and this FlexTime
     * assuming both times are on the same day.
     * @example If this time is 23:50 and other is 00:10 the delta is -23 hours 40 minutes
     * @param {FlexTime|Date} other - The time to be compared
     */
    getAbsoluteDeltaInMinutes(other) {
        const myAbsMinutes = (this._hours * 60) + this._minutes;
        const otherAbsMinutes = (other.getHours() * 60) + (other.getMinutes());
        return otherAbsMinutes - myAbsMinutes;
    }

    /**
     * Gets the delta in minutes between the nearest supplied time and this FlexTime,
     * crossing days if necessary.
     * @example If this time is 23:50 and the other is 00:10 the delta is 20 minutes
     * @param {FlexTime|Date} other - The time to be compared
     */
    getDeltaInMinutes(other) {
        const myAbsMinutes = (this._hours * 60) + this._minutes;
        const otherAbsMinutes = (other.getHours() * 60) + (other.getMinutes());
        let delta = otherAbsMinutes - myAbsMinutes;
        // difference is > 12 hours so we should go the other way
        // e.g. 0015 is 30 minutes after 2345, not 23:30 before
        if (delta > (12 * 60)) {
            delta = -((24 * 60) - delta);
        }
        else if (delta < (-12 * 60)) {
            delta = (24 * 60) + delta;
        }
        return delta;
    }

    /**
     * Converts a FlexTime to a future Date relative to now or to a specified time.
     * @param {number} [fudgeFactorInMinutes] - Optional fudge factor in minutes applied before deciding if a date is in the past.
     * @param {number|Date|FlexTime} [baseDate] - Optional base date, defaults to Date.now()
     */
    toDate(fudgeFactorInMinutes, baseDate) {
        let date = ((typeof baseDate === "number" ? new Date(baseDate) : baseDate)) || new Date();
        fudgeFactorInMinutes = fudgeFactorInMinutes || 0;

        const delta = this.getAbsoluteDeltaInMinutes(date);
        if ((delta - fudgeFactorInMinutes) > 0) {
            // date is behind us, move to tomorrow
            const dayInMilliseconds = 24 * 60 * 60 * 1000;
            date = new Date(date.getTime() + dayInMilliseconds);
        }

        date.setHours(this._hours);
        date.setMinutes(this._minutes);
        return date;
    }

    /**
     * Converts a FlexTime to a string using simple pattern replacement.
     * @param {string} [fmt] - Optional format to use, defaults to "hh:mm tt"
     */
    toString(fmt) {
        let result = fmt || "hh:mm tt";
        result = result.replace("HH", (this._hours < 10) ? "0" + this._hours : this._hours);
        result = result.replace("hh", ((this._hours % 12) || 12));
        result = result.replace(/mm/i, (this._minutes < 10 ? `0${this._minutes}` : this._minutes));
        result = result.replace("TT", (this._hours < 12) ? "AM" : "PM");
        result = result.replace("tt", (this._hours < 12) ? "am" : "pm");
        result = result.replace("T", (this._hours < 12) ? "A" : "P");
        result = result.replace("t", (this._hours < 12) ? "a" : "p");
        return result;
    }

    /**
     * Creates a FlexTime given a base time and a delta in minutes
     * @param {number|Date|FlexTime} fromTime - Base time
     * @param {number} deltaInMinutes - Delta to be applied
     */
    static getFlexTime(fromTime, deltaInMinutes) {
        let date = ((typeof fromTime === "number" ? new Date(fromTime) : fromTime)) || new Date();
        if (date instanceof FlexTime) {
            date = date.toDate();
        }

        if (deltaInMinutes) {
            const deltaInMilliseconds = deltaInMinutes * 60 * 1000;
            const timeInMillis = date.getTime() + deltaInMilliseconds;
            date = new Date(timeInMillis);
        }
        return new FlexTime(undefined, date);
    }
}

FlexTime.substringRegex = flexTimeSubstringRegex;

module.exports = FlexTime;
