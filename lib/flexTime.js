"use strict";

// flexTimeRegex puts each component into a capture group and matches the entire line ignoring leading and trailing whitespace
// substringRegex matches anywhere into a single capture group
// flexTimeRegex is for internal use - substringRegex is for use by consumers who want to embed a flex time into another regex

const flexTimeRegex = /^\s*(\d?\d):?(\d\d)\s*(a|A|am|AM|p|P|pm|PM)?\s*$/;
const flexTimeSubstringRegex = /((?:\d?\d):?(?:\d\d)\s*(?:a|A|am|AM|p|P|pm|PM)?)/;

const FlexTime = function (init, now) {
    now = now || new Date();

    if ((init !== undefined) && (init !== "")) {
        if ((typeof init === "string") && (init !== "")) {
            const result = _tryGetValuesFromString(init, now);
            if (!result) {
                throw new Error(`Invalid time string "${init}".`);
            }
            this.hours = result.hours;
            this.minutes = result.minutes;
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

    this.hours = now.getHours();
    this.minutes = now.getMinutes();
};

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

function getFlexTime(fromTime, deltaInMinutes) {
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

function toDate(fudgeFactorInMinutes, baseDate) {
    let date = ((typeof baseDate === "number" ? new Date(baseDate) : baseDate)) || new Date();
    fudgeFactorInMinutes = fudgeFactorInMinutes || 0;

    const delta = this.getDeltaInMinutes(date);
    if ((delta - fudgeFactorInMinutes) > 0) {
        // date is behind us, move to tomorrow
        const dayInMilliseconds = 24 * 60 * 60 * 1000;
        date = new Date(date.getTime() + dayInMilliseconds);
    }

    date.setHours(this.hours);
    date.setMinutes(this.minutes);
    return date;
}

function toString(fmt) {
    let result = fmt || "hh:mm tt";
    result = result.replace("HH", (this.hours < 10) ? "0" + this.hours : this.hours);
    result = result.replace("hh", ((this.hours % 12) || 12));
    result = result.replace(/mm/i, (this.minutes < 10 ? `0${this.minutes}` : this.minutes));
    result = result.replace("TT", (this.hours < 12) ? "AM" : "PM");
    result = result.replace("tt", (this.hours < 12) ? "am" : "pm");
    result = result.replace("T", (this.hours < 12) ? "A" : "P");
    result = result.replace("t", (this.hours < 12) ? "a" : "p");
    return result;
}

function getAbsoluteDeltaInMinutes(other) {
    const myAbsMinutes = (this.hours * 60) + this.minutes;
    const otherAbsMinutes = (other.getHours() * 60) + (other.getMinutes());
    return otherAbsMinutes - myAbsMinutes;
}

function getDeltaInMinutes(other) {
    const myAbsMinutes = (this.hours * 60) + this.minutes;
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

FlexTime.substringRegex = flexTimeSubstringRegex;
FlexTime.getFlexTime = getFlexTime;

FlexTime.prototype.getHours = function () { return this.hours; };
FlexTime.prototype.getMinutes = function () { return this.minutes; };
FlexTime.prototype.toDate = toDate;
FlexTime.prototype.toString = toString;
FlexTime.prototype.getDeltaInMinutes = getDeltaInMinutes;
FlexTime.prototype.getAbsoluteDeltaInMinutes = getAbsoluteDeltaInMinutes;

module.exports = FlexTime;
