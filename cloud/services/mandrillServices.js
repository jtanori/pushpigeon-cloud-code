var Mandrill = require('mandrill');
var _ = require('underscore');

Mandrill.initialize("6xcQtzv5ZIhr3bZ_F8tbiw");

exports.emailAccountCreated = function(username, email) {
    var promise = new Parse.Promise();

    var dynamicContent = [{
        "name": "username",
        "content": username
    }];

    sendEmail(username, email, "AccountCreated", dynamicContent, "Account Created")
        .then(function(result) {
            promise.resolve(result);
        }, function(error) {
            promise.reject(error);
        });

    return promise;
};

exports.emailAccountUpdated = function(username, email) {
    var promise = new Parse.Promise();

    var dynamicContent = [{
        "name": "username",
        "content": username
    }];

    sendEmail(username, email, "AccountUpdated", dynamicContent, "Account Updated")
        .then(function(result) {
            promise.resolve(result);
        }, function(error) {
            promise.reject(error);
        });

    return promise;
};


exports.emailUserInvited = function(username, email, userType) {
    var promise = new Parse.Promise();

    var dynamicContent = [{
        "name": "username",
        "content": username
    }];

    var templateName;
    if (userType == "member") {
        templateName = "MemberInvited";
    } else if (userType == "staff") {
        templateName = "StaffInvited";
    }

    sendEmail(username, email, templateName, dynamicContent, "Invited")
        .then(function(result) {
            promise.resolve(result);
        }, function(error) {
            promise.reject(error);
        });

    return promise;
};

exports.emailUserApproved = function(username, email, userType, groupName) {
    var promise = new Parse.Promise();

    var dynamicContent = [{
        "name": "username",
        "content": username
    }, {
        name: 'groupname',
        content: groupName
    }];

    var templateName;
    if (userType == "member") {
        templateName = "MemberApproved";
    }

    sendEmail(username, email, templateName, dynamicContent, "Group membership approved")
        .then(function(result) {
            promise.resolve(result);
        }, function(error) {
            promise.reject(error);
        });

    return promise;
};

exports.emailAdminCreated = function(username, email) {
    var promise = new Parse.Promise();

    var dynamicContent = [{
        "name": "username",
        "content": username
    }];

    sendEmail(username, email, "AdminCreated", dynamicContent, "Joined Successfully")
        .then(function(result) {
            promise.resolve(result);
        }, function(error) {
            promise.reject(error);
        });

    return promise;
};

var sendEmail = function(userName, email, templateName, dynamicContent, subject, headers) {

    var promise = new Parse.Promise();

    headers = _.extend({'X-MC-AutoText': 1}, headers || {});

    var message = {
        to: [{
            email: email,
            name: userName
        }],
        headers: headers,
        global_merge_vars: dynamicContent,
        inline_css: true,
        subject: subject,
        from_email: 'no-reply@pushpigeon.com',
        from_name: 'Push Pigeon',
    };

    Mandrill.sendTemplate({
        message: message,
        template_name: templateName,
        template_content: dynamicContent,
        async: true
    }, {
        success: function(httpResponse) {
            console.log(httpResponse);
            promise.resolve(httpResponse);
        },
        error: function(httpResponse) {
            console.error(httpResponse);
            promise.reject(httpResponse);
        }
    });

    return promise;
};

exports.sendEmail = sendEmail;

exports.sendContactMessage = function(name, email, phone, message) {
    var promise = new Parse.Promise();

    Parse.Config
        .get()
        .then(function(config) {
            var e = config.get("contactEmail");

            Mandrill.sendEmail({
                message: {
                    subject: "New contact message in PushPigeon",
                    from_email: 'no-reply@pushpigeon.com',
                    from_name: 'Push Pigeon',
                    html: '<h4>From: ' + name + ' ( ' + email + ')</h4><h4>Phone Number: ' + phone + '</h4><h4>Message:</h4><p>' + message + '</p>',
                    text: 'From: ' + name + ' ( ' + email + ')\n\nPhone Number: ' + phone + '\n\n Message: ' + message,
                    to: [{
                        email: e,
                        name: 'Push Pigeon'
                    }],
                    headers: {
                        'Reply-To': email
                    }
                },
                async: true
            }, {
                success: function(httpResponse) {
                    console.log(httpResponse);
                    promise.resolve(httpResponse)
                },
                error: function(httpResponse) {
                    console.error(httpResponse);
                    promise.reject(httpResponse);
                }
            });
        }, function(error) {
            console.log(error);
            promise.reject(error);
        });

    return promise;
};

exports.sendVerificationCode = function(email, code, template) {
    var promise = new Parse.Promise();

    template = template || 'VerificationCode'; //Default template

    Mandrill.sendTemplate({
        message: {
            to: [{
                email: email
            }],
            from_email: 'no-reply@pushpigeon.com',
            from_name: 'Push Pigeon',
            headers: {
                'Reply-To': 'contact@pushpigeon.com',
                'X-MC-Important': true
            }
        },
        template_name: template,
        template_content: [{
            name: 'verificationCode',
            content: code
        }],
        async: true
    }, {
        success: function(httpResponse) {
            console.log(httpResponse);
            promise.resolve(httpResponse)
        },
        error: function(httpResponse) {
            console.error(httpResponse);
            promise.reject(httpResponse);
        }
    });

    return promise;
}