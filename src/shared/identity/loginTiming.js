// Login and logout times, kept in UTC and in the user's time zone (user_login_timings). These are analytics: callers
// catch and log failures so that a failure here never blocks a sign-in.
const logger = require("../../core/logger");
const { Timezone, UserLoginTiming } = require("../../models");

// The client's zone when the runtime knows it, otherwise UTC.
const resolveTimeZone = (timeZone) => {
  if (!timeZone) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
};

// Wall-clock time in `timeZone`, as a Date whose UTC fields hold it. Dates are stored in UTC, so the column gets that
// wall-clock time whatever the server's own time zone (a "yyyy-MM-dd HH:mm:ss" string would be read in it).
const localTimestamp = (date, timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value])
  );
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
};

const saveLoginTiming = async (user, tokens, ip, timezone) => {
  const zone = resolveTimeZone(timezone);
  const now = new Date();
  const timeZoneDoc = await Timezone.findOne({ where: { time_zone: zone, is_active: true } });
  if (!timeZoneDoc) {
    logger.warn(`No matching Timezone row for "${zone}" — skipping login-timing record.`);
    return null;
  }
  return UserLoginTiming.create({
    user_id: user.id,
    role_id: user.role_id,
    login_time_utc: now,
    login_time_local: localTimestamp(now, zone),
    ip_address: ip,
    token_id: tokens.access.id,
    time_zone: timeZoneDoc.id,
  });
};

const saveLogoutTiming = async (tokenDoc, timezone) => {
  const zone = resolveTimeZone(timezone);
  const now = new Date();
  const timing = await UserLoginTiming.findOne({ where: { token_id: tokenDoc.id } });
  if (!timing) return null;
  timing.logout_time_utc = now;
  timing.logout_time_local = localTimestamp(now, zone);
  await timing.save();
  return timing;
};

module.exports = { saveLoginTiming, saveLogoutTiming };
