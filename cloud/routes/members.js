var moment = require('moment');
var _ = require('underscore');

Parse.Cloud.define('checkMembers', function(req, res){
	if(req.params && req.params.emails){
		var Member = Parse.Object.extend("Member");
        var query = new Parse.Query(Member);
        
        query.containedIn("member_email", req.params.emails);

        query.find({
            success: function(members) {
            	res.success(members);
            },
            error: function(object, error) {
                res.error(error);
            }
        });
	}
});