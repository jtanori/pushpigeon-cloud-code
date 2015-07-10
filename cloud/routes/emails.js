var mandrilServices = require("cloud/services/mandrillServices.js");
var vlidations = require('cloud/validations.js')

//Email for Account Creation
Parse.Cloud.define("emailAccountCreated", function(request, response) { 
	
	if(request.params){

		var username=request.params.username;
		var email=request.params.email;

	    mandrilServices.emailAccountCreated(username,email)
	   	.then(function(result){                                    
		   response.success(result);	 
		},function(error){
		   response.error(error);
		});

	}else{
	   	return response.error("No Data received");
	}
		
	
});


//Email for Account Updated
Parse.Cloud.define("emailAccountUpdated", function(request, response) { 
	
	if(request.params){

		var username=request.params.username;
		var email=request.params.email;

	    mandrilServices.emailAccountUpdated(username,email)
	   	.then(function(result){                                    
		   response.success(result);	 
		},function(error){
		   response.error(error);
		});

	}else{
	   	return response.error("No Data received");
	}		
	
});

//Email for User Invited
Parse.Cloud.define("emailUserInvited", function(request, response) { 
	
	if(request.params){

		var username=request.params.username;
		var email=request.params.email;
		var userType=request.params.userType;

	    mandrilServices.emailUserInvited(username,email,userType)
	   	.then(function(result){                                    
		   response.success(result);	 
		},function(error){
		   response.error(error);
		});

	}else{
	   	return response.error("No Data received");
	}		
	
});


//Email for User Approved
Parse.Cloud.define("emailUserApproved", function(request, response) { 
	
	if(request.params){

		var username=request.params.username;
		var email=request.params.email;
		var userType=request.params.userType;
		var groupName = request.params.groupName;

	    mandrilServices.emailUserApproved(username,email,userType,groupName)
	   	.then(function(result){                                    
		   response.success(result);	 
		},function(error){
		   response.error(error);
		});

	}else{
	   	return response.error("No Data received");
	}		
	
});


//Email for Admin Created
Parse.Cloud.define("emailAdminCreated", function(request, response) { 
	
	if(request.params){

		var username=request.params.username;
		var email=request.params.email;

	    mandrilServices.emailAdminCreated(username,email)
	   	.then(function(result){                                    
		   response.success(result);	 
		},function(error){
		   response.error(error);
		});

	}else{
	   	return response.error("No Data received");
	}		
	
});

Parse.Cloud.define('contactMessage', function(request, response){
	if(request.params){

		var name = request.params.name;
		var email = request.params.email;
		var phone = request.params.phone;
		var message = request.params.message;

	    mandrilServices.sendContactMessage(name, email, phone, message)
	   	.then(function(result){                                    
		   response.success(result);	 
		},function(error){
		   response.error(error);
		});

	}else{
	   	return response.error("No Data received");
	}
});