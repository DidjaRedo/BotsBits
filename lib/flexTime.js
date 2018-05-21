"use strict";

// flexTimeRegex puts each component into a capture group and matches the entire line ignoring leading and trailing whitespace
// substringRegex matches anywhere into a single capture group
// flexTimeRegex is for internal use - substringRegex is for use by consumers who want to embed a flex time into another regex

var flexTimeRegex = /^\s*(\d?\d):?(\d\d)\s*(a|A|am|AM|p|P|pm|PM)?\s*$/;
var flexTimeSubstringRegex = /((?:\d?\d):?(?:\d\d)\s*(?:a|A|am|AM|p|P|pm|PM)?)/;

var FlexTime = function (str, now) {
    let match = flexTimeRegex.exec(str);

    if (match !== null) {
        let hours = Number(match[1]);
        let minutes = Number(match[2]);

        if ((hours >= 0) && (hours < 24) && (minutes >= 0) && (minutes < 60)) {
            let isValid = true;

            // 12 hour time is unambiguous if am/pm is specified
            let hasAmPm = (typeof match[3] === "string") && ((match[3].length === 1) || (match[3].length === 2));

            // 24 hour time is unambiguous if there is no am/pm and the hour is 0, greater than 12 or has an extra
            // leading 0.   So "0800" is unambiguously 8 in the morning but "800" could be either morning or evening
            let isUnambiguous24hrTime = (!hasAmPm) && ((hours === 0) || (hours > 12) || match[1][0] === "0");

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
                now = now || new Date();
                let nowHours = now.getHours();
                while (hours < nowHours) {
                    hours += 12;
                }

                if ((hours === nowHours) && (minutes < now.getMinutes())) {
                    hours += 12;
                }

                hours = (hours % 24);
            }

            if (isValid) {
                return { hour: hours, minutes: minutes };
            }
        }
    }

    throw new Error("Invalid flextime \"" + str + "\".");
};

function getFlexTime(now, deltaInMinutes) {
    let deltaInMilliseconds = (deltaInMinutes ? deltaInMinutes * 60 * 1000 : 0);
    now = now || Date.now();
    let timeInMillis = ((typeof now === "number") ? now : now.getTime()) + deltaInMilliseconds;
    let resultTime = new Date(timeInMillis);
    let initString = resultTime.toTimeString().slice(0, 5);

    // since the date object uses 24 hour time, hours 1-12
    // are ambiguous.  Append am/pm to make them absolute.
    if ((resultTime.getHours() > 0) && (resultTime.getHours() < 12)) {
        initString = initString + " am";
    }
    else if (resultTime.getHours() === 12) {
        initString = initString + " pm";
    }

    return new FlexTime(initString);
}

FlexTime.substringRegex = flexTimeSubstringRegex;
FlexTime.getFlexTime = getFlexTime;

module.exports = FlexTime;
