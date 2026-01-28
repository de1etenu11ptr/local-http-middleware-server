const util = require("util");

const PREFIX = "NODE SERVER";

function custom_logger(log, tag, ...args) {
	if (!log) return;
	const current_time = get_custom_format_time(new Date(Date.now()));
	const formatted_args = args.map(arg => {
		if (typeof arg === 'object' || Array.isArray(arg)) {
			return util.inspect(arg, { depth: null, colors: true });
		}
		return String(arg);
	});
	console.log(`[${current_time}][${PREFIX}][${tag}] ${formatted_args}`)
}

function get_custom_format_time(date) {
	var day = new Intl.DateTimeFormat("en", {day: "2-digit"}).format(date);;
	var month = new Intl.DateTimeFormat("en", {month: "short"}).format(date);;
	var hour = new Intl.DateTimeFormat("en", {hour: "numeric", hour12: false}).format(date);;
	var minute = new Intl.DateTimeFormat("en", {minute: "2-digit"}).format(date);;
	var second = new Intl.DateTimeFormat("en", {second: "2-digit"}).format(date);;
	return `${day} ${month} ${hour}:${minute}:${second}`;
}

module.exports = {custom_logger}
