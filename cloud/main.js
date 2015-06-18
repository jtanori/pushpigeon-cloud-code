var moment = require('moment');
var _ = require('underscore');
var mandrilServices = require("cloud/services/mandrillServices.js");
var validations = require('validations');

require('cloud/routes/emails.js');

Parse.Cloud.afterSave(Parse.User, function(req){
	if(req.user.existed()){
		return;
	}

	var data = {AccessCode: _.random(1000, 9999), User: req.user};
	var code = new (Parse.Object.extend('VerificationCode'))();

	code
		.save(data)
		.then(function(){
			console.log('VerificationCode saved for user: ' + req.user.id);
		})
		.fail(function(){
			console.log('VerificationCode could not be saved for user: ' + req.user.id);
		});
});

Parse.Cloud.afterSave('GroupAdmin', function(req){
	if(req.object.existed()){
		return;
	}

	var data = {AccessCode: _.random(1000, 9999), Admin: req.object};
	var code = new (Parse.Object.extend('VerificationCode'))();

	code
		.save(data)
		.then(function(){
			console.log('VerificationCode saved for GroupAdmin: ' + req.user.id);
		})
		.fail(function(){
			console.log('VerificationCode could not be saved for GroupAdmin: ' + req.user.id);
		});
});

Parse.Cloud.afterSave('VerificationCode', function(req){
	var o = req.object;
	var isAdmin = !!o.get('Admin');
	var user = isAdmin ? o.get('Admin') : o.get('User');

	if(user){
		user.fetch()
			.then(function(){
				var email = user.get('email');
				var query = new Parse.Query('VerificationCode');

				switch(isAdmin){
				case true:
					query.equalTo('Admin', user);
					break;
				default: query.equalTo('User', user);
				}

				//Gets the first non-validated code
				query
					.first()
					.then(function(c){
						var code = c.get('AccessCode');
						var template = c.get('type');

						switch(template){
							case 'forgotPassword': template = 'ForgotPassword'; break;
							default: template = 'VerificationCode';
						}

						mandrilServices.sendVerificationCode(email, code, template)
					   	.then(function(result){
					   		console.log('VerificationCode : (' + c.id + ')' + code + ' sent to: ' + email);
						},function(error){
						   	console.log('VerificationCode : (' + c.id + ')' + code + ' could not be sent to: ' + email);
						   	console.log(error);
						});
					})
					.fail(function(e){
						console.log(e);
					})
			})
			.fail(function(){

			});
	}else{
		console.log('VerificationCode object is invalid');
	}
});

Parse.Cloud.define('verifyAccount', function(request, response){
	if(request.params && validations.EMAIL.test(request.params.email)){

		var email = request.params.email;
		var verificationCode = request.params.code;
		var query = new Parse.Query('VerificationCode');

		query
			.include('User')
			.include('Admin')
			.equalTo('AccessCode', request.params.code*1)
			.first()
			.then(function(c){
				var isValid = false;

				if(!_.isEmpty(c)){
					if(c.get('Admin')){
						isValid = c.get('Admin').get('email') === email;
					}else if(c.get('User')){
						isValid = c.get('User').get('email') === email;
					}
				}

				if(isValid){
					//TODO: Destroy Code records
					//      Update user status (emailVerified:true)
					response.success('Code is valid');
				}else{
					response.error('Invalid access code');
				}
			})
			.fail(function(){
				response.error('Invalid access code');
			});
	}else{
		response.error("No Data received");
	}
});

Parse.Cloud.define('forgotPassword', function(request, response){
	//Check if we have params and if email is valid email address
	if(request.params && validations.EMAIL.test(request.params.email)){
		var email = request.params.email;
		var isAdmin = request.params.userType === 'groupAdmin';
		var query;
		// Determine if forgotPassword has been requested by
		// a self-proclaimed GroupAdmin or regular User 
		if(isAdmin){
			query = new Parse.Query('GroupUser');
		}else{
			query = new Parse.Query('_User');
		}

		Parse.Cloud.useMasterKey();
		//Find user
		query
			.select('email')
			.equalTo('authProvider', 'password')
			.equalTo('email', email)
			.first()
			.then(function(u){
				if(!_.isEmpty(u)){
					var code = new (Parse.Object.extend('VerificationCode'))();
					var data = {AccessCode: _.random(1000, 9999), type: 'forgotPassword'};
					
					if(isAdmin){
						data.Admin = u;
					} else {
						data.User = u;
					}
					//Save verification code
					code
						.save(data)
						.then(function(){
							console.log('ForgotPassword VerificationCode saved for user: ' + req.user.id + ' (admin: ' + isAdmin + ')');
							response.success('Code sent to user');
						})
						.fail(function(e){
							console.log('ForgotPassword VerificationCode could not be saved for user: ' + req.user.id+ ' (admin: ' + isAdmin + ')');
							console.log(e);
							response.error('Could not save VerificationCode');
						});
				}else{
					response.error('User is not valid');
				}
			})
			.fail(function(e){
				console.log('forgotPassword: User not found')
				console.log(e);
				response.error('User not found');
			});
	}else{
		response.error("Invalid input");
	}
});