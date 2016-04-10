require("sugar");

var https = require("https");

function redirectUrl(appId, callbackUrl, permissions, state) {
    return `https://slack.com/oauth/authorize?` +
        `client_id=${ appId }` +
        `&redirect_uri=${ callbackUrl }` +
        (permissions ? `&scope=${ permissions.join(' ') }` : "") +
        (state ? `&state=${ state }` : "") +
        `&response_type=code`;
}

exports.redirectUrl = redirectUrl;

function getLoginHandler(appId, callbackUrl, permissions) {
    return function(req, res, next) {
        req.session.slack = { state: uuid().toString() };
        req.session.save(function() {
            res.redirect(redirectUrl(appId, callbackUrl, permissions, req.session.slack.state));
        });
    };
}

exports.getLoginHandler = getLoginHandler;

function getAccessToken(appId, appSecret, callbackUrl, code, cb) {
    var url = `https://slack.com/api/oauth.access?` +
        `client_id=${ appId }` +
        `&redirect_uri=${ callbackUrl }` +
        `&client_secret=${ appSecret }` +
        `&grant_type=authorization_code` +
        `&code=${ code }`;

    https.get(url, function(response) {
        if (res.statusCode == 200) {
            response.on('data', (json) => {
                json = JSON.parse(json);
                cb(null, json);
            });
        }
        else cb(new Error("HTTP response code " + res.statusCode + "."));
    }).on('error', cb);
}

exports.getAccessToken = getAccessToken;

function getCallbackHandler(appId, appSecret, callbackUrl) {
    return function(req, res, next) {
        if (req.query.error) {
            req.error = new Error(req.query.error_description);
            next();
        }
        else if (req.query.code) {
            req.session.slack = Object.merge(req.session.slack, {
                scopes: req.query.scope.split(" "),
                code: req.query.code
            });

            req.session.save(function() {
                if (!req.query.state || req.query.state == req.session.slack.state) {
                    accessToken(appId, appSecret, callbackUrl, req.query.code, function(err, data) {
                        if (err) req.error = err;
                        else req.session.slack = Object.merge(req.session.slack, data);
                        next();
                    });
                }
                else {
                    req.error = new Error("CSRF check failed.");
                    next();
                }
            });
        }
        else {
            req.error = new Error("Invalid connect call.");
            next();
        }
    };
}

exports.getCallbackHandler = getCallbackHandler;
