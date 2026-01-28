const { parse } = require('tldts'); //For extracting domains from subdomains.

const { custom_logger } = require("../utils/logger");
const constants = require("../utils/constants");

const domainsResting = [];

const intermediateRequest = async function (log, url, options = {}, tries) {
	var request;
	try {
		const controller = new AbortController();
		const timeoutID = setTimeout(() => controller.abort(), constants.TIMEOUT * 1000);
		options["signal"] = controller.signal;
		request = await fetch(url, options);
		clearTimeout(timeoutID);
	} catch (err) {
		if (tries < constants.RETRIES) {
			custom_logger(log, "LOG", `Retrying (${tries + 1})`)
			await constants.wait(0.5 + Math.random() * (Math.exp(tries) + 1));
			return intermediateRequest(log, url, options, tries + 1);
		}
		if (err.name == "AbortError") {
			throw new Error(`The server request timed out. It took longer than ${constants.TIMEOUT} seconds.`, {
				cause: {
					"status": 500
				}
			});
		}
		throw new Error("Server had an error. [" + err.message + "]", {
			cause: {
				error: err,
				"status": 500
			}
		});
	}
	if (request.status != 200) {
		throw new Error(`The server, which you are requesting from, returned a response with the status code "${request.status}".`, {
			cause: {
				"status": request.status
			}
		});
	}
	const buffer = await request.arrayBuffer(); //Returns an ArrayBuffer (Array of Bytes)
	return [new Uint8Array(buffer), tries]; //Returns a Uint8Array
}

const processHost = async function (domain, thread) {
	if (domainsResting[domain].busy[thread] == true) {
		return;
	}
	domainsResting[domain].busy[thread] = true;
	domainsResting[domain].activeThreads += 1;
	while (domainsResting[domain].requests[thread].length != 0) {
		const log = domainsResting[domain].requests[thread][0].log;
		custom_logger(log, "LOG", `[${thread+1}/${constants.LIMIT}][\x1b[32mRequest\x1b[0m][${domainsResting[domain].domain}]` + " - " + domainsResting[domain].requests[thread][0].msg);
		const start = Date.now();
		try {
			const output = await intermediateRequest(log, domainsResting[domain].requests[thread][0].href, domainsResting[domain].requests[thread][0].options, 0);
			domainsResting[domain].requests[thread][0].response.statusCode = 200;
			domainsResting[domain].requests[thread][0].response.setHeader('Content-Type', 'application/octet-stream');
			domainsResting[domain].requests[thread][0].response.end(output[0]); //Sends the Uint8Array as a response of type Array of Bytes
			custom_logger(log, "LOG", `[${thread+1}/${constants.LIMIT}][\x1b[35mResponse\x1b[0m][${domainsResting[domain].domain}]` + " - " + domainsResting[domain].requests[thread][0].msg);
		} catch (err) {
			custom_logger(log, "ERROR", err);
			domainsResting[domain].requests[thread][0].response.statusCode = 501;
			domainsResting[domain].requests[thread][0].response.end(`Fetching failed. (${err.message})`);
			custom_logger(log, "ERROR", `**[${thread+1}/${constants.LIMIT}][${Math.trunc((Date.now() - start) / 10)/100}s][${domainsResting[domain].domain}] - Error fetching ("${domainsResting[domain].requests[thread][0].msg}"):\n`, err.message);
		}
		await constants.wait(0.5 + Math.random() * 0.5 * (domainsResting[domain].activeThreads * 1.5));
		domainsResting[domain].requests[thread].shift();
	}
	domainsResting[domain].activeThreads -= 1;
	domainsResting[domain].busy[thread] = false;
}

const processQueue = function (log, url, request, response, options = {}) {
	const domainName = parse(url.href).domain;
	var body = request.headers["x-body-header"];
	body = decodeURIComponent(body);
	for (let domain = 0; domain < domainsResting.length; domain++) {
		if (domainsResting[domain].domain == domainName) {
			var min = 0;
			for (let thread = 1;
				thread < domainsResting[domain].requests.length;
				thread++) {
				if (domainsResting[domain].requests[thread].length < domainsResting[domain].requests[min].length) {
					min = thread;
				}
			}
			domainsResting[domain].requests[min].push({
				"log": log,
				"href": url.href,
				"msg": body && body != "" && body != "undefined" ? body : url.href,
				"options": options,
				"response": response
			});
			processHost(domain, min);
			return;
		}
	}
	const index = domainsResting.push({
		"domain": domainName,
		"requests": [
			[{
				"log": log,
				"href": url.href,
				"msg": body && body != "" && body != "undefined" ? body : url.href,
				"options": options,
				"response": response
			}]
		],
		"busy": [false],
		"activeThreads": 0
	}) - 1;
	while (domainsResting[index].busy.length < constants.LIMIT) {
		domainsResting[index].busy.push(false);
		domainsResting[index].requests.push([]);
	}
	processHost(index, 0);
}

module.exports = {domainsResting, processQueue}
